import type { DeliveryPoint, DeliveryPointInput } from '../types/deliveryPoint';
export type { DeliveryPoint, DeliveryPointInput };
export const API_BASE_URL = typeof window !== 'undefined' && window.location.origin ? '/api/v1' : 'http://127.0.0.1:8000/api/v1';

/**
 * Trả về URL tuyệt đối để tải ảnh đại diện từ backend nếu là đường dẫn tĩnh /uploads/...
 */
export function getAvatarUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const backendOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Trả về URL hợp lệ để hiển thị ảnh sản phẩm (hỗ trợ cả đường dẫn tĩnh /uploads/..., base64 data:, blob: và HTTP)
 */
export function getProductImageUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  const backendOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  return `${backendOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const AUTH_STORAGE = {
  TOKEN: 'auth_token',
  USER: 'auth_user',
  EXPIRES_AT: 'auth_expires_at',
  EXPIRED_MESSAGE: 'auth_session_expired_message',
};

export interface User {
  id?: number;
  username: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  phone_number?: string | null;
  role: string;
  roles?: string[];
  role_titles?: string[];
  permissions?: string[];
  role_title?: string;
  warehouse_name?: string | null;
  territory_name?: string | null;
  branch?: string;
  can_view_cost?: boolean;
  can_write_inventory?: boolean;
  avatar_url?: string | null;
}

export interface UserProfile {
  id: number;
  username: string;
  email?: string | null;
  full_name: string;
  phone_number?: string | null;
  phone?: string | null;
  role: string;
  roles?: string[];
  role_title?: string;
  warehouse_name?: string | null;
  territory_name?: string | null;
  branch?: string | null;
  avatar_url?: string | null;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface UnitConversionItem {
  unit_name: string;
  conversion_rate: number;
}

export interface ProductItem {
  id: number;
  code: string;
  name: string;
  category: string;
  category_id?: number | null;
  stock: number;
  sell_price: number;
  floor_price?: number;
  base_unit?: string;
  units?: UnitConversionItem[];
  cost_price?: number | null;
  profit_margin?: number | null;
  profit_per_unit?: number | null;
  // Chi tiết form quản lý sản phẩm
  packaging_specification?: string;
  images?: string[];
  status?: 'active' | 'inactive' | 'out_of_stock' | string;
  is_batch_managed?: boolean;
  min_stock?: number;
  transaction_count?: number; // Số giao dịch đã phát sinh (đơn hàng, nhập/xuất kho)
}

export interface OrderItem {
  id: number;
  order_code: string;
  dealer_id: number;
  dealer_name: string;
  created_by: string;
  assigned_sale_id?: number | null;
  assigned_sale_name?: string | null;
  total_amount: number;
  status: string;
  created_at: string;
  dealer_status?: string;
  dealer_lock_reason?: string;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  approval_reason?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  dealer_code?: string | null;
  dealer_phone?: string | null;
  dealer_address?: string | null;
}

export interface OrderDetail extends OrderItem {
  subtotal_amount: number;
  discount_percent: number;
  discount_amount: number;
  delivery_point?: string | null;
  delivery_point_id?: number | null;
  desired_delivery_date?: string | null;
  note?: string | null;
  applied_policy_code?: string | null;
  applied_policy_name?: string | null;
  items: Array<{
    product_id: number;
    product_name: string;
    product_code?: string;
    quantity: number;
    price: number;
    unit?: string;
    unit_name?: string;
    conversion_rate?: number;
    base_quantity?: number;
  }>;
}

export interface OrderDealer {
  id: number;
  code: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  status?: string;
  lock_reason?: string;
  credit_limit?: number;
  overdue_days_allowed?: number;
  max_debt_days?: number;
  current_debt?: number;
  remaining_credit?: number;
  max_debt_age?: number;
  is_overdue?: boolean;
  is_over_limit?: boolean;
  customer_group?: string;
}

export interface DealerCreditInfo {
  dealer_id: number;
  dealer_code: string;
  dealer_name: string;
  phone?: string | null;
  address?: string | null;
  customer_group?: string | null;
  status?: string;
  credit_limit: number;
  overdue_days_allowed: number;
  max_debt_days: number;
  current_debt: number;
  remaining_credit: number;
  max_debt_age: number;
  is_overdue: boolean;
  is_over_limit: boolean;
}

export interface CreateOrderPayload {
  dealer_id: number;
  delivery_point: string;
  delivery_point_id?: number | null;
  desired_delivery_date: string;
  discount_percent: number;
  items: Array<{
    product_id: number;
    quantity: number;
    unit: string;
    price: number;
    conversion_rate?: number;
  }>;
  note?: string;
}

export interface OrderItemPayload {
  product_id: number;
  quantity: number;
  price: number;
  unit_name?: string;
  conversion_rate?: number;
}

export interface OrderCreatePayload {
  dealer_id: number;
  items: OrderItemPayload[];
  discount_percent?: number;
  discount_rate?: number;
  discount_amount?: number;
  note?: string;
  delivery_point_id?: number | null;
}

export type OrderItemCreatePayload = CreateOrderPayload['items'][number];

export const isOrderItem = (value: unknown): value is OrderItem => {
  if (typeof value !== 'object' || value === null) return false;
  const order = value as Record<string, unknown>;
  return typeof order.id === 'number' &&
    typeof order.order_code === 'string' &&
    typeof order.dealer_id === 'number' &&
    typeof order.dealer_name === 'string' &&
    typeof order.created_by === 'string' &&
    typeof order.total_amount === 'number' &&
    typeof order.status === 'string' &&
    typeof order.created_at === 'string';
};

export interface ProductFinancialSummary {
  total_products: number;
  total_stock: number;
  total_sell_value: number;
  total_cost_value?: number | null;
  total_gross_profit?: number | null;
  average_margin_percent?: number | null;
}

export interface ProductListResponse {
  items: ProductItem[];
  total: number;
  user_role: string;
  is_cost_price_visible: boolean;
  summary?: ProductFinancialSummary;
  applied_price_book?: string | null;
  data?: ProductItem[];
  page?: number;
  limit?: number;
  page_size?: number;
  total_pages?: number;
  has_more?: boolean;
}

export interface GetProductsParams {
  page?: number;
  limit?: number;
  page_size?: number;
  skip?: number;
  search?: string;
  category?: string;
  only_low_stock?: boolean;
}

export interface OrderCreateResponse {
  id: number;
  order_code: string;
  dealer_id: number;
  dealer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
  requires_approval?: boolean;
  approval_reason?: string | null;
  items?: any[];
  note?: string | null;
}

export type CreatedOrder = OrderCreateResponse;

export interface RoleInfoItem {
  role: string;
  title: string;
  badge_color: string;
  description: string;
  can_view_cost: boolean;
  can_write_inventory: boolean;
  permissions: string[];
}

export interface RoleMatrixResponse {
  roles: RoleInfoItem[];
  total_roles: number;
}

export interface InventoryTransaction {
  id: number;
  product_id: number;
  product_name: string;
  type: string;
  quantity: number;
  previous_stock: number;
  new_stock: number;
  unit_name?: string | null;
  conversion_rate?: number;
  base_quantity?: number | null;
  performed_by: string;
  user_role: string;
  reason: string;
  created_at: string;
}

export interface InventoryResponse {
  status: string;
  message: string;
  product_id: number;
  current_stock: number;
  transaction?: InventoryTransaction;
}

export interface AvailableStockInfo {
  product_id: number;
  product_code: string;
  product_name: string;
  dealer_id: number;
  dealer_name: string;
  warehouse_id: string;
  warehouse_name: string;
  actual_stock: number;
  reserved_stock: number;
  available_stock: number;
  base_unit: string;
}

export interface ProductStockSummaryItem {
  product_id: number;
  product_code: string;
  product_name: string;
  base_unit: string;
  actual_stock: number;
  reserved_stock: number;
  available_stock: number;
}

export interface DealerStockSummaryResponse {
  dealer_id: number;
  dealer_name: string;
  warehouse_id: string;
  warehouse_name: string;
  items: ProductStockSummaryItem[];
}


function getApiErrorMessage(data: unknown, fallback: string): string {
  if (typeof data !== 'object' || data === null || !('detail' in data)) return fallback;
  const detail = data.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item: unknown) => {
      if (typeof item !== 'object' || item === null || !('msg' in item)) return '';
      const message = typeof item.msg === 'string' ? item.msg : '';
      const location = 'loc' in item && Array.isArray(item.loc)
        ? item.loc.filter((part: unknown): part is string | number => typeof part === 'string' || typeof part === 'number').join('.')
        : '';
      return message ? (location ? `${location}: ${message}` : message) : '';
    }).filter(Boolean);
    if (messages.length) return messages.join('; ');
  }
  if (typeof detail === 'object' && detail !== null && 'message' in detail && typeof detail.message === 'string') {
    return detail.message;
  }
  return fallback;
}

// Interceptor callback list for session expiration
type SessionExpiredHandler = (message: string) => void;
const sessionExpiredHandlers: Set<SessionExpiredHandler> = new Set();

export function subscribeSessionExpired(handler: SessionExpiredHandler): () => void {
  sessionExpiredHandlers.add(handler);
  return () => {
    sessionExpiredHandlers.delete(handler);
  };
}

export function notifySessionExpired(message: string = 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.') {
  clearClientSession();
  sessionStorage.setItem(AUTH_STORAGE.EXPIRED_MESSAGE, message);

  // Đồng bộ URL với query param ?expired=true để trang login và khi reload luôn hiển thị thông báo
  try {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('expired', 'true');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  } catch {
    // ignore
  }

  sessionExpiredHandlers.forEach((handler) => handler(message));
}

export function saveClientSession(user: User, token: string, expiresInSeconds: number = 900) {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  sessionStorage.setItem(AUTH_STORAGE.USER, JSON.stringify(user));
  sessionStorage.setItem(AUTH_STORAGE.TOKEN, token);
  sessionStorage.setItem(AUTH_STORAGE.EXPIRES_AT, expiresAt.toString());
  sessionStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
}

export function clearClientSession() {
  sessionStorage.removeItem(AUTH_STORAGE.TOKEN);
  sessionStorage.removeItem(AUTH_STORAGE.USER);
  sessionStorage.removeItem(AUTH_STORAGE.EXPIRES_AT);
}

export function getClientSession(): { user: User | null; token: string | null; expiresAt: number | null } {
  try {
    const userStr = sessionStorage.getItem(AUTH_STORAGE.USER);
    const token = sessionStorage.getItem(AUTH_STORAGE.TOKEN);
    const expiresAtStr = sessionStorage.getItem(AUTH_STORAGE.EXPIRES_AT);
    const user = userStr ? JSON.parse(userStr) : null;
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : null;
    return { user, token, expiresAt };
  } catch {
    return { user: null, token: null, expiresAt: null };
  }
}

let isRefreshingGlobal = false;
let refreshSubscribersGlobal: Array<(newToken: string) => void> = [];

function onRefreshedGlobal(newToken: string) {
  refreshSubscribersGlobal.forEach((cb) => cb(newToken));
  refreshSubscribersGlobal = [];
}

/**
 * Fetch wrapper with 401 Interceptor:
 * If server returns 401, attempts silent refresh once and retries original request before expiring session.
 */
export async function authenticatedFetch(input: string, init: RequestInit = {}, token?: string): Promise<Response> {
  const storedToken = sessionStorage.getItem(AUTH_STORAGE.TOKEN);
  const currentToken = storedToken || token;
  const headers = new Headers(init.headers || {});
  if (currentToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }
  // Chỉ tự động thêm Content-Type: application/json nếu body không phải FormData và chưa có Content-Type
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    let response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
      const isAuthUrl = typeof input === 'string' && (input.includes('/auth/login') || input.includes('/auth/refresh'));
      
      // Nếu không phải endpoint login/refresh và client vẫn có token: thử làm mới ngầm 1 lần
      if (!isAuthUrl && currentToken) {
        if (!isRefreshingGlobal) {
          isRefreshingGlobal = true;
          try {
            const refreshData = await refreshTokenApi(currentToken);
            isRefreshingGlobal = false;
            onRefreshedGlobal(refreshData.access_token);

            // Thử lại request gốc với token mới
            const retryHeaders = new Headers(init.headers || {});
            retryHeaders.set('Authorization', `Bearer ${refreshData.access_token}`);
            if (init.body && !retryHeaders.has('Content-Type') && !isFormData) {
              retryHeaders.set('Content-Type', 'application/json');
            }
            response = await fetch(input, { ...init, headers: retryHeaders });
            if (response.status !== 401) {
              return response;
            }
          } catch {
            isRefreshingGlobal = false;
            const waiting = [...refreshSubscribersGlobal];
            refreshSubscribersGlobal = [];
            waiting.forEach((cb) => {
              try { cb(''); } catch {}
            });
          }
        } else {
          // Đang có một tiến trình refresh chạy dở -> chờ token mới rồi retry
          return new Promise<Response>((resolve, reject) => {
            refreshSubscribersGlobal.push(async (newToken: string) => {
              if (!newToken) {
                reject(new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.'));
                return;
              }
              const retryHeaders = new Headers(init.headers || {});
              retryHeaders.set('Authorization', `Bearer ${newToken}`);
              if (init.body && !retryHeaders.has('Content-Type') && !isFormData) {
                retryHeaders.set('Content-Type', 'application/json');
              }
              try {
                const retried = await fetch(input, { ...init, headers: retryHeaders });
                resolve(retried);
              } catch (err) {
                reject(err);
              }
            });
          });
        }
      }

      let errorDetail = 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
      try {
        const cloned = response.clone();
        const data = await cloned.json();
        if (typeof data?.detail === 'string') {
          errorDetail = data.detail;
        } else if (data?.detail && typeof data.detail.message === 'string') {
          errorDetail = data.detail.message;
        }
      } catch {
        // ignore
      }

      notifySessionExpired(errorDetail);
      throw new Error(errorDetail);
    }

    return response;
  } catch (err: any) {
    throw err;
  }
}

/**
 * Validate token with server (/auth/me):
 * If token is revoked on server (401), authenticatedFetch intercepts it and kicks session.
 */
export async function validateSessionApi(token?: string): Promise<boolean> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
    }, token);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get current user profile from server (/auth/me) with fresh roles & permissions:
 */
export async function getMeApi(token?: string): Promise<User | null> {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
    }, token);
    if (!response.ok) return null;
    const user: User = await response.json();
    return user;
  } catch {
    return null;
  }
}

export async function loginApi(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorDetail = typeof data.detail === 'object' ? data.detail : { message: data.detail };
    throw {
      status: response.status,
      message: errorDetail.message || 'Lỗi đăng nhập',
      lock_remaining_seconds: errorDetail.lock_remaining_seconds,
      remaining_attempts: errorDetail.remaining_attempts,
    };
  }

  saveClientSession(data.user, data.access_token, data.expires_in || 900);
  return data;
}

/**
 * Silent Refresh / Keep-Alive API:
 * Calls server to refresh token and sliding expiration.
 */
export async function refreshTokenApi(token?: string): Promise<LoginResponse> {
  const activeToken = token || sessionStorage.getItem(AUTH_STORAGE.TOKEN);
  if (!activeToken) {
    throw new Error('Không có token để làm mới phiên.');
  }

  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeToken}`,
    },
  });

  if (response.status === 401) {
    throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  if (!response.ok) {
    throw new Error('Không thể làm mới phiên đăng nhập.');
  }

  const data: LoginResponse = await response.json();
  saveClientSession(data.user, data.access_token, data.expires_in || 3600);
  return data;
}

/**
 * Logout API:
 * Hủy / thu hồi token ngay lập tức phía server (Blacklist) và xóa sạch client session.
 */
export async function logoutApi(token: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (e) {
    console.warn('Network error while logging out on server:', e);
  } finally {
    clearClientSession();
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel('auth_channel');
        channel.postMessage({ type: 'LOGOUT', timestamp: Date.now() });
        channel.close();
      }
    } catch {
      // ignore
    }
  }
}

export async function getProductsApi(
  token: string,
  params?: GetProductsParams
): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  const pageSizeVal = params?.page_size || params?.limit;
  if (pageSizeVal) {
    query.append('page_size', pageSizeVal.toString());
    query.append('limit', pageSizeVal.toString());
  }
  if (params?.skip !== undefined) query.append('skip', params.skip.toString());
  if (params?.search && params.search.trim()) query.append('search', params.search.trim());
  if (params?.category && params.category.toLowerCase() !== 'all') {
    query.append('category', params.category);
  }
  if (params?.only_low_stock) query.append('only_low_stock', 'true');

  const queryString = query.toString();
  const url = `${API_BASE_URL}/products${queryString ? `?${queryString}` : ''}`;

  const response = await authenticatedFetch(url, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    throw new Error('Không thể tải dữ liệu sản phẩm từ hệ thống.');
  }

  return response.json();
}

export interface ProductPayload {
  code: string;
  name: string;
  category: string;
  base_unit: string;
  units?: UnitConversionItem[];
  packaging_specification?: string;
  sell_price?: number;
  floor_price?: number;
  cost_price?: number | null;
  images?: string[];
  status?: 'active' | 'inactive';
}

export async function createProductApi(token: string, payload: ProductPayload): Promise<ProductItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo mới sản phẩm (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function updateProductApi(token: string, id: number, payload: Partial<ProductPayload>): Promise<ProductItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật sản phẩm (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function deleteProductApi(token: string, id: number): Promise<{ status: string; message: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/products/${id}`, {
    method: 'DELETE',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xóa sản phẩm (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getOrdersApi(token: string): Promise<OrderItem[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/orders`, {
    method: 'GET',
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách đơn hàng (Mã lỗi ${response.status})`);
  }
  if (Array.isArray(data)) {
    return data;
  }
  if (data && Array.isArray((data as any).items)) {
    return (data as any).items;
  }
  return [];
}

export async function getOrderDetailApi(token: string, orderCode: string): Promise<OrderDetail> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}`,
    { method: 'GET' },
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải chi tiết đơn hàng (Mã lỗi ${response.status})`);
  }
  return data as OrderDetail;
}

export async function getCloneOrderDataApi(token: string, orderCode: string): Promise<any> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}/clone-data`,
    { method: 'GET' },
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi lấy dữ liệu sao chép đơn hàng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getOrderDealersApi(token: string): Promise<OrderDealer[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/orders/dealers`, { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách đại lý (Mã lỗi ${response.status})`);
  }
  if (!Array.isArray(data)) throw new Error('Dữ liệu danh sách đại lý không hợp lệ.');
  return data;
}

export async function getDealerCreditInfoApi(token: string, dealerId: number): Promise<DealerCreditInfo> {
  const response = await authenticatedFetch(`${API_BASE_URL}/dealers/${dealerId}/credit-info`, { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải thông tin công nợ đại lý (Mã lỗi ${response.status})`);
  }
  return data as DealerCreditInfo;
}

export function createOrderApi(token: string, payload: CreateOrderPayload): Promise<CreatedOrder>;
export function createOrderApi(token: string, payload: OrderCreatePayload): Promise<CreatedOrder>;
export async function createOrderApi(
  token: string,
  payload: CreateOrderPayload | OrderCreatePayload
): Promise<CreatedOrder> {
  const endpoint = 'delivery_point' in payload ? '/orders/sales-entry' : '/orders';
  const response = await authenticatedFetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, `Lỗi tạo đơn hàng (Mã lỗi ${response.status})`));
  }
  return data as CreatedOrder;
}

export async function cancelOrderApi(
  token: string,
  orderCode: string,
  reason: string
): Promise<{ status: string; message: string; order: OrderItem }> {
  let response = await authenticatedFetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  }, token);

  if (response.status === 404 || response.status === 405) {
    response = await authenticatedFetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CANCELLED', reason }),
    }, token);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi hủy đơn hàng (Mã lỗi ${response.status})`);
  }
  return data;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password?: string;
}

export interface ChangePasswordResult {
  status: string;
  message: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export async function changePasswordApi(
  payload: ChangePasswordPayload,
  token: string
): Promise<ChangePasswordResult> {
  const response = await authenticatedFetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json();
  if (!response.ok) {
    let errorMsg = 'Đổi mật khẩu thất bại. Vui lòng thử lại.';
    if (typeof data?.detail === 'string') {
      errorMsg = data.detail;
    } else if (Array.isArray(data?.detail) && data.detail.length > 0) {
      errorMsg = data.detail[0]?.msg || errorMsg;
    } else if (typeof data?.detail === 'object' && data.detail?.message) {
      errorMsg = data.detail.message;
    }
    throw new Error(errorMsg);
  }

  // Cập nhật token mới cho client session
  if (data.access_token && data.user) {
    saveClientSession(data.user, data.access_token, data.expires_in || 900);
  }

  return data;
}

export async function getRolesMatrixApi(): Promise<RoleMatrixResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/roles-matrix`);
  if (!response.ok) {
    throw new Error('Không thể tải ma trận vai trò từ hệ thống.');
  }
  return response.json();
}

export async function getInventoryTransactionsApi(token: string): Promise<InventoryTransaction[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/transactions`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tải lịch sử biến động kho.');
  }
  return response.json();
}

export async function adjustStockApi(
  token: string,
  payload: { product_id: number; adjustment: number; reason: string; unit_name?: string; conversion_rate?: number }
): Promise<InventoryResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = formatErrorMessage(data.detail, data.message || `Lỗi cập nhật kho (Mã lỗi ${response.status})`);
    throw new Error(errorMsg);
  }
  return data;
}

export async function createStockReceiptApi(
  token: string,
  payload: { product_id: number; quantity: number; supplier: string; note?: string; unit_name?: string; conversion_rate?: number }
): Promise<InventoryResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = formatErrorMessage(data.detail, data.message || `Lỗi nhập kho (Mã lỗi ${response.status})`);
    throw new Error(errorMsg);
  }
  return data;
}

export async function createStockIssueApi(
  token: string,
  payload: {
    product_id: number;
    quantity: number;
    destination: string;
    note?: string;
    unit_name?: string;
    conversion_rate?: number;
    warehouse_id?: string | number;
    selected_batch_id?: number | null;
    suggested_batch_id?: number | null;
    batch_change_reason?: string | null;
    batch_number?: string;
    override_expired?: boolean;
    override_reason?: string;
  }
): Promise<InventoryResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = formatErrorMessage(data.detail, data.message || `Lỗi xuất kho (Mã lỗi ${response.status})`);
    throw new Error(errorMsg);
  }
  return data;
}

export async function getBatchSuggestionsApi(
  token: string,
  params: {
    product_id: number;
    warehouse_id?: string | number;
    quantity?: number;
    conversion_rate?: number;
  }
): Promise<{
  product_id: number;
  warehouse_id: number;
  required_base_qty: number;
  suggested_batch: ProductBatchInfo | null;
  available_batches: ProductBatchInfo[];
}> {
  const q = new URLSearchParams();
  q.set('product_id', String(params.product_id));
  if (params.warehouse_id) q.set('warehouse_id', String(params.warehouse_id));
  if (params.quantity) q.set('quantity', String(params.quantity));
  if (params.conversion_rate) q.set('conversion_rate', String(params.conversion_rate));

  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/batches/suggest?${q.toString()}`, {
    method: 'GET',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || 'Lỗi khi lấy danh sách lô gợi ý');
  }
  return data;
}

export async function updateProductUnitsApi(
  token: string,
  productId: number,
  payload: { base_unit?: string; units?: UnitConversionItem[] }
): Promise<any> {
  const response = await authenticatedFetch(`${API_BASE_URL}/products/${productId}/units`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật đơn vị tính (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getAvailableStockApi(
  token: string,
  dealerId: number,
  productId: number
): Promise<AvailableStockInfo> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/inventory/available-stock?dealer_id=${dealerId}&product_id=${productId}`,
    {},
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi kiểm tra tồn khả dụng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getDealerStockSummaryApi(
  token: string,
  dealerId: number
): Promise<DealerStockSummaryResponse> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/inventory/dealer-stock-summary/${dealerId}`,
    {},
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi lấy tồn khả dụng theo đại lý (Mã lỗi ${response.status})`);
  }
  return data;
}



export interface UserAccount {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  phone?: string;
  role: string;
  roles?: string[];
  role_title: string;
  role_titles?: string[];
  branch: string;
  is_active: boolean;
  status: string;
  lock_reason?: string | null;
  locked_at?: string | null;
  dealers_needing_handover: number;
  can_view_cost: boolean;
  can_write_inventory: boolean;
  badge_color: string;
  avatar_url?: string | null;
}

export interface CustomerCreatePayload {
  full_name: string;
  email: string;
  phone: string;
  username?: string;
  role?: string;
  roles?: string[];
  branch?: string;
}

export interface CustomerCreateResponse {
  user: UserAccount;
  email_sent: boolean;
  message: string;
}

export interface UserCreatePayload {
  full_name: string;
  username?: string;
  email: string;
  password: string;
  role?: string;
  roles?: string[];
  branch?: string;
  phone?: string;
}

export interface UserUpdatePayload {
  full_name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: string;
  roles?: string[];
  branch?: string;
  is_active?: boolean;
  status?: string;
  lock_reason?: string;
}

export interface DealerItem {
  id: number;
  code: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  region?: string | null;
  assigned_sale_id?: number | null;
  assigned_sale_name?: string | null;
  credit_limit?: number;
  max_debt_days?: number;
  customer_group?: string;
  status?: string;
  lock_reason?: string | null;
  needs_handover?: boolean;
}

export interface UserDealersResponse {
  user_id: number;
  username: string;
  full_name: string;
  is_locked: boolean;
  lock_reason?: string | null;
  total_dealers: number;
  dealers: DealerItem[];
}

export interface UserListResponse {
  users: UserAccount[];
  total: number;
}

export async function getUsersApi(token: string): Promise<UserListResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users`, {
    method: 'GET',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách người dùng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function createUserApi(token: string, payload: UserCreatePayload): Promise<UserAccount> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo người dùng mới (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function createCustomerApi(token: string, payload: CustomerCreatePayload): Promise<CustomerCreateResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo tài khoản kinh doanh (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function updateUserApi(token: string, username: string, payload: UserUpdatePayload): Promise<UserAccount> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật người dùng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function deleteUserApi(token: string, username: string): Promise<{ status: string; message: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xóa người dùng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getUserDealersApi(token: string, username: string): Promise<UserDealersResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}/dealers`, {
    method: 'GET',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách đại lý (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function handoverDealersApi(
  token: string,
  username: string,
  newSaleUsername: string
): Promise<{ status: string; message: string; transferred_count: number }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/${encodeURIComponent(username)}/handover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_sale_username: newSaleUsername }),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi bàn giao đại lý (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getAdminContactApi(): Promise<{ admin_email: string; admin_name: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/admin-contact`);
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // fallback
  }
  return { admin_email: 'daongochiep645@gmail.com', admin_name: 'Nguyễn Quản Trị' };
}


export interface Category {
  id: number;
  name: string;
  parent_id?: number | null;
  description?: string | null;
}

export interface CategoryTreeResponse extends Category {
  sub_categories: CategoryTreeResponse[];
}

export interface CategorySalesReport {
  id: number;
  name: string;
  parent_id?: number | null;
  direct_sales: number;
  total_sales: number;
}

export async function getCategoryTreeApi(token: string): Promise<CategoryTreeResponse[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/categories/tree`, {
    method: 'GET',
  }, token);
  if (!response.ok) throw new Error('Lỗi tải danh sách danh mục');
  return response.json();
}

export async function createCategoryApi(token: string, payload: { name: string; parent_id?: number | null; description?: string }): Promise<Category> {
  const response = await authenticatedFetch(`${API_BASE_URL}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Lỗi tạo danh mục');
  return data;
}

export async function updateCategoryApi(token: string, categoryId: number, payload: { name: string; parent_id?: number | null; description?: string }): Promise<Category> {
  const response = await authenticatedFetch(`${API_BASE_URL}/categories/${categoryId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Lỗi cập nhật danh mục');
  return data;
}

export async function deleteCategoryApi(token: string, categoryId: number): Promise<{ status: string; message: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/categories/${categoryId}`, {
    method: 'DELETE',
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Lỗi xóa danh mục');
  return data;
}

export async function getCategorySalesReportApi(token: string, period?: string): Promise<CategorySalesReport[]> {
  const url = period ? `${API_BASE_URL}/categories/sales-report?period=${encodeURIComponent(period)}` : `${API_BASE_URL}/categories/sales-report`;
  const response = await authenticatedFetch(url, {
    method: 'GET',
  }, token);
  if (!response.ok) throw new Error('Lỗi tải báo cáo doanh số');
  return response.json();
}

export async function moveProductCategoryApi(token: string, productId: number, categoryId: number): Promise<any> {
  const response = await authenticatedFetch(`${API_BASE_URL}/products/${productId}/category`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: categoryId }),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || 'Lỗi cập nhật danh mục sản phẩm');
  return data;
}

// ===================================
// AUDIT LOGS INTERFACES & CLIENT
// ===================================
export interface AuditLogItem {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
  user_avatar?: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string;
  old_values?: string | null;
  new_values?: string | null;
  reason?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AuditLogFilterParams {
  user_id?: number | null;
  entity_type?: string;
  entity_id?: string;
  action_type?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  page_size?: number;
}

export async function getAuditLogsApi(token: string, params: AuditLogFilterParams = {}): Promise<AuditLogListResponse> {
  const query = new URLSearchParams();
  if (params.user_id !== undefined && params.user_id !== null) {
    query.set('user_id', String(params.user_id));
  }
  if (params.entity_type && params.entity_type !== 'ALL') {
    query.set('entity_type', params.entity_type);
  }
  if (params.entity_id && params.entity_id.trim()) {
    query.set('entity_id', params.entity_id.trim());
  }
  if (params.action_type && params.action_type !== 'ALL') {
    query.set('action_type', params.action_type);
  }
  if (params.from_date && params.from_date.trim()) {
    query.set('from_date', params.from_date.trim());
  }
  if (params.to_date && params.to_date.trim()) {
    query.set('to_date', params.to_date.trim());
  }
  if (params.page) {
    query.set('page', String(params.page));
  }
  if (params.page_size) {
    query.set('page_size', String(params.page_size));
  }

  const url = `${API_BASE_URL}/audit-logs${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải nhật ký thao tác (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getEntityAuditLogsApi(token: string, entityType: string, entityId: string | number): Promise<AuditLogItem[]> {
  const url = `${API_BASE_URL}/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  const data = await response.json().catch(() => ([]));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải lịch sử thao tác đối tượng (Mã lỗi ${response.status})`);
  }
  return Array.isArray(data) ? data : [];
}

export async function deleteAuditLogApi(token: string, logId: number): Promise<{ message: string; deleted_id?: number }> {
  const url = `${API_BASE_URL}/audit-logs/${logId}`;
  const response = await authenticatedFetch(url, { method: 'DELETE' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xóa bản ghi nhật ký (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function clearAllAuditLogsApi(token: string): Promise<{ message: string }> {
  const url = `${API_BASE_URL}/audit-logs`;
  const response = await authenticatedFetch(url, { method: 'DELETE' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xóa toàn bộ nhật ký (Mã lỗi ${response.status})`);
  }
  return data;
}
/**
 * Xem và cập nhật hồ sơ cá nhân
 */
export async function getMyProfileApi(token: string): Promise<UserProfile> {
  const response = await authenticatedFetch(`${API_BASE_URL}/me`, {
    method: 'GET',
  }, token);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Không thể tải thông tin hồ sơ.');
  }
  return await response.json();
}

export async function updateMyProfileApi(
  token: string,
  data: { full_name: string; phone_number: string }
): Promise<UserProfile> {
  const response = await authenticatedFetch(`${API_BASE_URL}/me`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  }, token);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    let msg = 'Cập nhật hồ sơ thất bại.';
    let errorCode: string | undefined = err?.code;

    if (typeof err.detail === 'string') {
      msg = err.detail;
    } else if (typeof err.detail === 'object' && err.detail !== null) {
      if (err.detail.code) {
        errorCode = err.detail.code;
      }
      if (err.detail.message) {
        msg = err.detail.message;
      } else if (err.detail.msg) {
        msg = err.detail.msg;
      }
    } else if (Array.isArray(err.detail) && err.detail.length > 0) {
      msg = err.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
    }

    const error: any = new Error(msg);
    error.status = response.status;
    error.statusCode = response.status;
    error.code = errorCode;
    error.response = {
      status: response.status,
      data: err,
    };
    throw error;
  }
  return await response.json();
}

export interface ProfileAvatarUploadResponse {
  status: string;
  message: string;
  avatar_url: string;
  thumbnail_url: string;
  user: UserProfile;
}

export async function uploadProfileAvatarApi(
  token: string,
  file: File
): Promise<ProfileAvatarUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await authenticatedFetch(`${API_BASE_URL}/me/avatar`, {
    method: 'POST',
    body: formData,
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    let msg = 'Tải lên ảnh đại diện thất bại.';
    if (typeof data.detail === 'string') {
      msg = data.detail;
    } else if (Array.isArray(data.detail) && data.detail.length > 0) {
      msg = data.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
    }
    throw new Error(msg);
  }
  return data;
}

// =====================================================================// DÁN TOÀN BỘ NỘI DUNG FILE NÀY VÀO CUỐI FILE: frontend/src/services/api.ts
// (không cần import thêm gì, vì api.ts đã có sẵn API_BASE_URL và authenticatedFetch)
// =====================================================================// ---------- NHÀ CUNG CẤP ----------
export interface Supplier {
  id: number;
  code: string;
  name: string;
  tax_code?: string | null;
  contact_person?: string | null;
  payment_terms?: string | null;
  is_active: boolean;
  has_receipts?: boolean;
  inactive_reason?: string | null;
  deactivated_at?: string | null;
  deactivated_by?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SupplierListResponse {
  items: Supplier[];
  total: number;
  active_count: number;
  inactive_count: number;
}

export interface SupplierPayload {
  name: string;
  tax_code: string;
  contact_person?: string | null;
  payment_terms?: string | null;
}

export interface SupplierCreatePayload extends SupplierPayload {
  code: string;
}

// Lấy thông báo lỗi từ phản hồi của backend (detail có thể là chuỗi hoặc danh sách lỗi)
function extractSupplierError(data: any, fallback: string): string {
  if (typeof data?.detail === 'string') return data.detail;
  if (Array.isArray(data?.detail) && data.detail.length > 0) {
    const msg = data.detail[0]?.msg;
    if (typeof msg === 'string') return msg.replace(/^Value error, /, '');
  }
  if (typeof data?.detail?.message === 'string') return data.detail.message;
  return fallback;
}

export async function getSuppliersApi(
  token: string,
  params: { search?: string; status?: 'all' | 'active' | 'inactive' } = {}
): Promise<SupplierListResponse> {
  const query = new URLSearchParams();
  if (params.search && params.search.trim()) query.set('search', params.search.trim());
  if (params.status && params.status !== 'all') query.set('status', params.status);
  const qs = query.toString();

  const response = await authenticatedFetch(`${API_BASE_URL}/suppliers${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractSupplierError(data, `Lỗi tải danh sách nhà cung cấp (Mã lỗi ${response.status})`));
  }
  return data;
}

export async function createSupplierApi(token: string, payload: SupplierCreatePayload): Promise<Supplier> {
  const response = await authenticatedFetch(`${API_BASE_URL}/suppliers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractSupplierError(data, `Lỗi thêm nhà cung cấp (Mã lỗi ${response.status})`));
  }
  return data;
}

export async function updateSupplierApi(token: string, code: string, payload: SupplierPayload): Promise<Supplier> {
  const response = await authenticatedFetch(`${API_BASE_URL}/suppliers/${encodeURIComponent(code)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractSupplierError(data, `Lỗi cập nhật nhà cung cấp (Mã lỗi ${response.status})`));
  }
  return data;
}

export async function deactivateSupplierApi(token: string, code: string, reason?: string): Promise<Supplier> {
  const response = await authenticatedFetch(`${API_BASE_URL}/suppliers/${encodeURIComponent(code)}/deactivate`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason && reason.trim() ? reason.trim() : null }),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractSupplierError(data, `Lỗi ngừng giao dịch nhà cung cấp (Mã lỗi ${response.status})`));
  }
  return data;
}

export async function activateSupplierApi(token: string, code: string): Promise<Supplier> {
  const response = await authenticatedFetch(`${API_BASE_URL}/suppliers/${encodeURIComponent(code)}/activate`, {
    method: 'POST',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractSupplierError(data, `Lỗi mở lại giao dịch nhà cung cấp (Mã lỗi ${response.status})`));
  }
  return data;
}


// ===================================// CHÍNH SÁCH CHIẾT KHẤU THEO SẢN LƯỢNG (VOLUME DISCOUNT)
// ===================================
export interface DiscountTier {
  id?: number | string;
  min_quantity: number;
  max_quantity?: number | null;
  discount_percent: number;
  discount_amount?: number;
  discount_type?: 'percent' | 'amount';
}

export interface DiscountPolicy {
  id?: number | string;
  code: string;
  name?: string;
  title?: string;
  category?: string;
  target_dealer_type?: string;
  target_group?: string;
  description?: string | null;
  is_active?: boolean;
  status?: string;
  start_date?: string;
  end_date?: string;
  tiers: DiscountTier[];
  note?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DiscountListResponse {
  items: DiscountPolicy[];
  total: number;
}

export interface DiscountPolicyCreatePayload {
  name: string;
  title?: string;
  code?: string;
  category?: string;
  target_dealer_type?: string;
  target_group?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  is_active?: boolean;
  status?: string;
  tiers: {
    min_quantity: number;
    max_quantity?: number | null;
    discount_percent: number;
  }[];
}

export interface DiscountCalculateResult {
  product_id: number;
  product_name: string;
  quantity: number;
  base_price: number;
  cost_price?: number | null;
  applied_policy_name?: string | null;
  applied_tier_label?: string | null;
  discount_percent: number;
  unit_discount_amount: number;
  final_unit_price: number;
  subtotal_before_discount: number;
  total_discount_amount: number;
  final_total_amount: number;
  estimated_profit?: number | null;
  profit_margin_percent?: number | null;
}

export async function getDiscountPoliciesApi(
  token: string,
  params: { category?: string; is_active?: boolean } = {}
): Promise<DiscountListResponse> {
  const query = new URLSearchParams();
  if (params.category && params.category !== 'ALL') {
    query.set('category', params.category);
  }
  if (params.is_active !== undefined) {
    query.set('is_active', String(params.is_active));
  }

  const url = `${API_BASE_URL}/discounts${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải chính sách chiết khấu (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function createDiscountPolicyApi(
  payload: DiscountPolicyCreatePayload,
  token: string
): Promise<DiscountPolicy> {
  const url = `${API_BASE_URL}/discounts`;
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
    throw new Error(data.detail || `Lỗi tạo chính sách chiết khấu (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function updateDiscountPolicyApi(
  id: number,
  payload: Partial<DiscountPolicyCreatePayload>,
  token: string
): Promise<DiscountPolicy> {
  const url = `${API_BASE_URL}/discounts/${id}`;
  const response = await authenticatedFetch(
    url,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật chính sách chiết khấu (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function toggleDiscountPolicyStatusApi(
  id: number,
  token: string
): Promise<DiscountPolicy> {
  const url = `${API_BASE_URL}/discounts/${id}/toggle-status`;
  const response = await authenticatedFetch(url, { method: 'PATCH' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi thay đổi trạng thái chính sách (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function deleteDiscountPolicyApi(
  id: number,
  token: string
): Promise<{ message: string; deleted_id: number }> {
  const url = `${API_BASE_URL}/discounts/${id}`;
  const response = await authenticatedFetch(url, { method: 'DELETE' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xóa chính sách chiết khấu (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function calculateDiscountApi(
  productId: number,
  quantity: number,
  token: string
): Promise<DiscountCalculateResult> {
  const url = `${API_BASE_URL}/discounts/calculate`;
  const response = await authenticatedFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, quantity: quantity }),
    },
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tính chiết khấu tự động (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function deleteSupplierApi(token: string, code: string): Promise<{ status: string; message: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/suppliers/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractSupplierError(data, `Lỗi xóa nhà cung cấp (Mã lỗi ${response.status})`));
  }
  return data;
}
function extractDeliveryPointError(data: any, fallback: string): string {
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail) && data.detail.length > 0) {
    return data.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
  }
  if (typeof data.message === 'string') return data.message;
  return fallback;
}

async function deliveryPointRequest<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  }, token);

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(extractDeliveryPointError(data, `Lỗi điểm giao hàng (Mã lỗi ${response.status})`));
  }
  return data as T;
}

export function listDeliveryPointsApi(token: string, dealerId: number) {
  return deliveryPointRequest<DeliveryPoint[]>(token, `/dealers/${dealerId}/delivery-points`);
}

export interface DealerOption {
  id: number;
  name: string;
  code?: string;
  phone?: string;
  address?: string;
}

export interface AllDeliveryPointItem extends DeliveryPoint {
  dealer_name?: string;
  dealer_code?: string;
  dealer_phone?: string;
}

export function listDealersApi(token: string) {
  return deliveryPointRequest<DealerOption[]>(token, `/dealers`);
}

export function listAllDeliveryPointsApi(token: string) {
  return deliveryPointRequest<AllDeliveryPointItem[]>(token, `/dealers/all-delivery-points`);
}

export function createDeliveryPointApi(token: string, dealerId: number, body: DeliveryPointInput) {
  return deliveryPointRequest<DeliveryPoint>(token, `/dealers/${dealerId}/delivery-points`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateDeliveryPointApi(token: string, dealerId: number, id: number, body: DeliveryPointInput) {
  return deliveryPointRequest<DeliveryPoint>(token, `/dealers/${dealerId}/delivery-points/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function setDefaultDeliveryPointApi(token: string, dealerId: number, id: number) {
  return deliveryPointRequest<DeliveryPoint>(token, `/dealers/${dealerId}/delivery-points/${id}/set-default`, {
    method: 'POST',
  });
}

export function deleteDeliveryPointApi(token: string, dealerId: number, id: number) {
  return deliveryPointRequest<void>(token, `/dealers/${dealerId}/delivery-points/${id}`, {
    method: 'DELETE',
  });
}

export function createMasterDeliveryPointApi(token: string, body: DeliveryPointInput) {
  return deliveryPointRequest<AllDeliveryPointItem>(token, `/dealers/master-delivery-points`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateMasterDeliveryPointApi(token: string, id: number, body: DeliveryPointInput) {
  return deliveryPointRequest<AllDeliveryPointItem>(token, `/dealers/master-delivery-points/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteMasterDeliveryPointApi(token: string, id: number) {
  return deliveryPointRequest<void>(token, `/dealers/master-delivery-points/${id}`, {
    method: 'DELETE',
  });
}
// ===================================// PRICE BOOKS & SALES ORDER APPROVAL EXTENSIONS
// ===================================
export interface OrderResponseData {
  id: number;
  order_code: string;
  dealer_id: number;
  dealer_name: string;
  created_by: string;
  assigned_sale_id?: number | null;
  assigned_sale_name?: string | null;
  total_amount: number;
  status: string;
  requires_approval?: boolean;
  approval_reason?: string | null;
  items?: any[];
  items_json?: any;
  created_at: string;
  approved_by?: string | null;
  approved_at?: string | null;
  delivery_point_id?: number | null;
  delivery_point?: string | null;
  desired_delivery_date?: string | null;
  note?: string | null;
  discount_rate?: number;
  discount_percent?: number;
  discount_amount?: number;
  dealer_status?: string;
  dealer_lock_reason?: string;
  cancel_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
}

export interface ApprovalHistoryItem {
  id: number;
  user_id?: number | null;
  user_name: string;
  user_avatar?: string | null;
  action_type: string;
  action_label: string;
  reason?: string | null;
  created_at: string;
}

export async function approveOrderApi(token: string, orderIdOrCode: number | string): Promise<OrderResponseData> {
  const response = await authenticatedFetch(`${API_BASE_URL}/orders/${orderIdOrCode}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi phê duyệt đơn hàng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function rejectOrderApi(token: string, orderIdOrCode: number | string, reason: string): Promise<OrderResponseData> {
  const response = await authenticatedFetch(`${API_BASE_URL}/orders/${orderIdOrCode}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi từ chối đơn hàng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function returnOrderApi(token: string, orderIdOrCode: number | string, reason: string): Promise<OrderResponseData> {
  const response = await authenticatedFetch(`${API_BASE_URL}/orders/${orderIdOrCode}/return-for-edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi trả lại đơn hàng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getOrderApprovalHistoryApi(token: string, orderIdOrCode: number | string): Promise<ApprovalHistoryItem[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/orders/${orderIdOrCode}/approval-history`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }, token);

  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error((data && data.detail) || `Lỗi tải lịch sử duyệt đơn (Mã lỗi ${response.status})`);
  }
  return Array.isArray(data) ? data : [];
}

export interface ReorderItemDetail {
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  price: number;
  current_price?: number;
  subtotal?: number;
  old_price?: number;
  unit: string;
  unit_name?: string;
  conversion_rate: number;
  base_unit: string;
  stock: number;
  available_units: Array<{ unit_name: string; conversion_rate: number; is_base: boolean }>;
  price_note?: string;
}

export interface ExcludedItemDetail {
  product_id: number;
  product_code?: string;
  product_name: string;
  reason: string;
}

export interface ReorderResponseData {
  order_id: number;
  order_code: string;
  dealer_id: number;
  dealer_name: string;
  valid_items: ReorderItemDetail[];
  excluded_items: ExcludedItemDetail[];
  total_valid: number;
  total_excluded: number;
  can_reorder: boolean;
  message: string;
  created_order?: any;
}

export async function reorderOrderApi(
  token: string,
  orderIdOrCode: number | string,
  payload?: { product_id?: number; create_immediate?: boolean; note?: string }
): Promise<ReorderResponseData> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/orders/${encodeURIComponent(orderIdOrCode)}/reorder`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    },
    token
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi khi đặt lại đơn hàng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getDealersApi(token: string): Promise<DealerItem[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/dealers`, {
    method: 'GET',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách đại lý (Mã lỗi ${response.status})`);
  }
  return Array.isArray(data) ? data : (data.items || []);
}

export interface PriceBookItem {
  id?: number;
  price_book_id?: number;
  product_id: number;
  product_code?: string;
  product_name?: string;
  price: number;
  min_price: number;
  sale_price?: number | null;
  floor_price?: number | null;
}

export interface PriceBook {
  id: number;
  code: string;
  name: string;
  customer_group: string;
  valid_from: string;
  valid_to: string;
  status: string;
  version?: number;
  is_locked?: boolean;
  note?: string | null;
  created_by: string;
  created_at: string;
  items?: PriceBookItem[];
}

export interface PriceBookCreate {
  code: string;
  name: string;
  customer_group: string;
  valid_from: string;
  valid_to: string;
  note?: string | null;
  status?: string;
  version?: number;
  is_locked?: boolean;
  items: Omit<PriceBookItem, 'id' | 'product_code' | 'product_name'>[];
}

export interface PriceBookUpdate {
  name?: string;
  customer_group?: string;
  valid_from?: string;
  valid_to?: string;
  status?: string;
  note?: string | null;
  items?: Omit<PriceBookItem, 'id' | 'product_code' | 'product_name'>[];
}

export async function fetchPriceBooksApi(
  token: string,
  filters?: { customer_group?: string; status_filter?: string; is_active_now?: boolean; search?: string }
): Promise<PriceBook[]> {
  let url = `${API_BASE_URL}/price-books?`;
  if (filters?.customer_group) url += `customer_group=${encodeURIComponent(filters.customer_group)}&`;
  if (filters?.status_filter) url += `status_filter=${encodeURIComponent(filters.status_filter)}&`;
  if (filters?.search) url += `search=${encodeURIComponent(filters.search)}&`;
  if (filters?.is_active_now !== undefined) url += `is_active_now=${filters.is_active_now}&`;

  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi khi tải danh sách bảng giá');
  }
  return response.json();
}

export async function fetchPriceBookDetailApi(token: string, id: number): Promise<PriceBook> {
  const response = await authenticatedFetch(`${API_BASE_URL}/price-books/${id}`, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi khi tải chi tiết bảng giá');
  }
  return response.json();
}

export async function createPriceBookApi(token: string, data: PriceBookCreate): Promise<PriceBook> {
  const response = await authenticatedFetch(`${API_BASE_URL}/price-books`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tạo bảng giá');
  }
  return response.json();
}

export async function updatePriceBookApi(token: string, id: number, data: PriceBookUpdate): Promise<PriceBook> {
  const response = await authenticatedFetch(`${API_BASE_URL}/price-books/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi cập nhật bảng giá (Có thể đã khóa)');
  }
  return response.json();
}

export async function clonePriceBookApi(token: string, id: number): Promise<PriceBook> {
  const response = await authenticatedFetch(`${API_BASE_URL}/price-books/${id}/clone`, {
    method: 'POST',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi nhân bản bảng giá');
  }
  return response.json();
}

export async function resolvePriceApi(token: string, customerId: number, productId: number): Promise<{
  price_book_id?: number;
  price_book_code?: string;
  price_book_name?: string;
  customer_id: number;
  customer_group: string;
  product_id: number;
  product_code?: string;
  product_name?: string;
  sale_price: number;
  floor_price: number;
}> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/price-books/resolve-price?customer_id=${customerId}&product_id=${productId}`,
    { method: 'GET' },
    token
  );
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tra cứu bảng giá');
  }
  return response.json();
}

// ==========================================
// QUẢN LÝ PHIẾU NHẬP KHO TỪ NCC (GOODS RECEIPT NOTE - GRN)
// ==========================================

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  address?: string | null;
  is_active: boolean;
}

export interface UnitOfMeasure {
  id: number;
  code: string;
  name: string;
  description?: string | null;
}

export interface GoodsReceiptItemCreatePayload {
  product_id: number;
  uom_id?: number | null;
  unit_name?: string | null;
  quantity: number;
  conversion_rate?: number | null;
  unit_price?: number;
  batch_number?: string | null;
  expiry_date?: string | null;
  note?: string | null;
}

export interface GoodsReceiptCreatePayload {
  supplier_id: number;
  reference_number?: string | null;
  receipt_date?: string | null;
  warehouse_id: number;
  note?: string | null;
  items: GoodsReceiptItemCreatePayload[];
}

export interface GoodsReceiptItemResponse {
  id: number;
  receipt_note_id: number;
  product_id: number;
  product_code?: string | null;
  product_name?: string | null;
  uom_id?: number | null;
  unit_name: string;
  quantity: number;
  conversion_rate: number;
  base_quantity: number;
  unit_price: number;
  batch_number?: string | null;
  expiry_date?: string | null;
  note?: string | null;
}

export interface GoodsReceiptResponse {
  id: number;
  code: string;
  supplier_id: number;
  supplier_code?: string | null;
  supplier_name?: string | null;
  reference_number?: string | null;
  receipt_date: string;
  warehouse_id: number;
  warehouse_code?: string | null;
  warehouse_name?: string | null;
  status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
  note?: string | null;
  total_items: number;
  total_quantity: number;
  total_amount: number;
  created_by?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  items: GoodsReceiptItemResponse[];
}

export interface GoodsReceiptListResponse {
  items: GoodsReceiptResponse[];
  total: number;
}

export async function getGoodsReceiptWarehousesApi(token: string): Promise<Warehouse[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/goods-receipts/meta/warehouses`, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải danh sách kho nhận hàng');
  }
  return response.json();
}

export async function getUnitsOfMeasureApi(token: string): Promise<UnitOfMeasure[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/goods-receipts/meta/uoms`, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải danh mục đơn vị tính');
  }
  return response.json();
}

export async function createGoodsReceiptApi(token: string, payload: GoodsReceiptCreatePayload): Promise<GoodsReceiptResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/goods-receipts`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo phiếu nhập kho (${response.status})`);
  }
  return data;
}

export async function getGoodsReceiptsApi(
  token: string,
  params: { supplier_id?: number; warehouse_id?: number; status?: string; search?: string; limit?: number; offset?: number } = {}
): Promise<GoodsReceiptListResponse> {
  const q = new URLSearchParams();
  if (params.supplier_id) q.set('supplier_id', String(params.supplier_id));
  if (params.warehouse_id) q.set('warehouse_id', String(params.warehouse_id));
  if (params.status) q.set('status', params.status);
  if (params.search) q.set('search', params.search);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.offset) q.set('offset', String(params.offset));
  const qs = q.toString();

  const response = await authenticatedFetch(`${API_BASE_URL}/goods-receipts${qs ? `?${qs}` : ''}`, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải danh sách phiếu nhập kho');
  }
  return response.json();
}

export async function getGoodsReceiptDetailApi(token: string, id: number): Promise<GoodsReceiptResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/goods-receipts/${id}`, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải chi tiết phiếu nhập kho');
  }
  return response.json();
}

export async function confirmGoodsReceiptApi(token: string, id: number): Promise<GoodsReceiptResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/goods-receipts/${id}/confirm`, {
    method: 'POST',
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xác nhận phiếu nhập kho (${response.status})`);
  }
  return data;
}

export async function updateGoodsReceiptApi(
  token: string,
  id: number,
  payload: Partial<GoodsReceiptCreatePayload>
): Promise<GoodsReceiptResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/goods-receipts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật phiếu nhập kho (${response.status})`);
  }
  return data;
}

export async function deleteGoodsReceiptApi(token: string, id: number): Promise<void> {
  const response = await authenticatedFetch(`${API_BASE_URL}/goods-receipts/${id}`, {
    method: 'DELETE',
  }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Lỗi xóa phiếu nhập kho (${response.status})`);
  }
}

// ==========================================
// QUẢN LÝ KHO HÀNG & VỊ TRÍ LƯU TRỮ
// ==========================================

export interface WarehouseItem {
  id: number;
  code: string;
  name: string;
  address?: string;
  manager_name?: string;
  phone?: string;
  status: string;
  is_active: boolean;
  created_at?: string;
  locations_count: number;
  total_products_count: number;
  total_stock_quantity: number;
}

export interface WarehouseLocationItem {
  id: number;
  warehouse_id: number;
  warehouse_code?: string;
  warehouse_name?: string;
  location_code: string;
  location_name?: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  bin?: string;
  max_capacity?: number;
  is_active: boolean;
  status: string;
  note?: string;
  created_at?: string;
  items_count: number;
  total_quantity: number;
}

export interface LocationProductStockItem {
  id: number;
  location_id: number;
  location_code: string;
  location_name?: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  bin?: string;
  product_id: number;
  product_code: string;
  product_name: string;
  base_unit: string;
  quantity: number;
  warehouse_total_stock: number;
}

export type Product = ProductItem;

export interface ProductPickingLocationItem {
  location_id: number;
  location_code: string;
  location_name: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  bin?: string;
  available_quantity: number;
  actual_quantity?: number;
}

export interface ProductBatchInfo {
  id: number;
  batch_number: string;
  manufacturing_date?: string | null;
  expiry_date?: string | null;
  quantity: number;
  reserved_quantity?: number;
  available_quantity: number;
}

export interface OrderPickingItem {
  product_id: number;
  product_code: string;
  product_name: string;
  ordered_quantity: number;
  unit_name: string;
  conversion_rate?: number;
  base_quantity?: number;
  is_batch_managed?: boolean;
  warehouse_id?: number;
  warehouse_code?: string;
  warehouse_name?: string;
  locations: ProductPickingLocationItem[];
  suggested_batch?: ProductBatchInfo | null;
  available_batches?: ProductBatchInfo[];
  selected_batch_id?: number | null;
  batch_change_reason?: string | null;
}

export interface OrderPickingSummary {
  warehouse_id?: number;
  warehouse_code?: string;
  warehouse_name?: string;
  warehouse_address?: string;
  items: OrderPickingItem[];
}

export async function getWarehousesApi(
  token: string,
  search?: string,
  statusFilter?: string
): Promise<WarehouseItem[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.set('search', search.trim());
  if (statusFilter && statusFilter.trim() && statusFilter !== 'all') params.set('status', statusFilter.trim());
  const qs = params.toString() ? `?${params.toString()}` : '';

  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses${qs}`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải danh sách kho hàng');
  }
  return response.json();
}

export async function getWarehouseDetailApi(token: string, id: number): Promise<WarehouseItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${id}`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải thông tin chi tiết kho hàng');
  }
  return response.json();
}

export async function createWarehouseApi(
  token: string,
  payload: {
    code: string;
    name: string;
    address?: string;
    manager_name?: string;
    phone?: string;
    status?: string;
    is_active?: boolean;
  }
): Promise<WarehouseItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo kho hàng mới (${response.status})`);
  }
  return data;
}

export async function updateWarehouseApi(
  token: string,
  id: number,
  payload: {
    name?: string;
    address?: string;
    manager_name?: string;
    phone?: string;
    status?: string;
    is_active?: boolean;
  }
): Promise<WarehouseItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật kho hàng (${response.status})`);
  }
  return data;
}

export async function deleteWarehouseApi(token: string, id: number): Promise<{ message: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${id}`, {
    method: 'DELETE',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xóa kho hàng (${response.status})`);
  }
  return data;
}

export async function getWarehouseLocationsApi(
  token: string,
  warehouseId: number,
  zone?: string,
  search?: string
): Promise<WarehouseLocationItem[]> {
  const params = new URLSearchParams();
  if (zone && zone !== 'all') params.set('zone', zone);
  if (search && search.trim()) params.set('search', search.trim());
  const qs = params.toString() ? `?${params.toString()}` : '';

  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${warehouseId}/locations${qs}`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải danh sách vị trí lưu kho');
  }
  return response.json();
}

export async function createWarehouseLocationApi(
  token: string,
  warehouseId: number,
  payload: {
    location_code: string;
    location_name?: string;
    zone?: string;
    aisle?: string;
    rack?: string;
    bin?: string;
    max_capacity?: number;
    status?: string;
    note?: string;
  }
): Promise<WarehouseLocationItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${warehouseId}/locations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi thêm vị trí lưu kho (${response.status})`);
  }
  return data;
}

export async function updateWarehouseLocationApi(
  token: string,
  locationId: number,
  payload: {
    location_code?: string;
    location_name?: string;
    zone?: string;
    aisle?: string;
    rack?: string;
    bin?: string;
    max_capacity?: number;
    status?: string;
    is_active?: boolean;
    note?: string;
  }
): Promise<WarehouseLocationItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/locations/${locationId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật vị trí (${response.status})`);
  }
  return data;
}

export async function deleteWarehouseLocationApi(token: string, locationId: number): Promise<{ message: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/locations/${locationId}`, {
    method: 'DELETE',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xóa vị trí lưu kho (${response.status})`);
  }
  return data;
}

export async function getWarehouseProductsApi(
  token: string,
  warehouseId: number,
  search?: string
): Promise<LocationProductStockItem[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.set('search', search.trim());
  const qs = params.toString() ? `?${params.toString()}` : '';

  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${warehouseId}/products${qs}`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải danh sách sản phẩm theo vị trí');
  }
  return response.json();
}

export async function assignProductToLocationApi(
  token: string,
  locationId: number,
  productId: number,
  quantity: number
): Promise<{ message: string; quantity: number }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/locations/assign-product`, {
    method: 'POST',
    body: JSON.stringify({
      location_id: locationId,
      product_id: productId,
      quantity,
    }),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi gán sản phẩm vào vị trí (${response.status})`);
  }
  return data;
}

export async function transferLocationProductApi(
  token: string,
  fromLocationId: number,
  toLocationId: number,
  productId: number,
  quantity: number
): Promise<{ message: string; quantity: number }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/locations/transfer-product`, {
    method: 'POST',
    body: JSON.stringify({
      from_location_id: fromLocationId,
      to_location_id: toLocationId,
      product_id: productId,
      quantity,
    }),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi chuyển vị trí sản phẩm (${response.status})`);
  }
  return data;
}

export async function assignDefaultWarehouseToDealerApi(
  token: string,
  dealerId: number,
  warehouseId: number | string
): Promise<{ message: string; dealer_id: number; warehouse_id: number; warehouse_name: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/dealers/${dealerId}/default-warehouse`, {
    method: 'PUT',
    body: JSON.stringify({ warehouse_id: warehouseId }),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi gán kho mặc định cho đại lý (${response.status})`);
  }
  return data;
}

export async function getOrderPickingLocationsApi(
  token: string,
  orderCode: string
): Promise<OrderPickingSummary> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/orders/${encodeURIComponent(orderCode)}/picking-locations`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tra cứu vị trí kệ soạn đơn hàng');
  }
  const items: OrderPickingItem[] = await response.json();
  const first = items[0];
  return {
    warehouse_id: first?.warehouse_id,
    warehouse_code: first?.warehouse_code,
    warehouse_name: first?.warehouse_name,
    items,
  };
}

export const getWarehousePickingSummaryApi = getOrderPickingLocationsApi;

// ==========================================================
// WAVE / BATCH PICKING THEO LỘ TRÌNH KHO (OPTIMIZED PICK PATH)
// ==========================================================

export interface OrderBreakdownItem {
  order_code: string;
  quantity: number;
  dealer_name?: string;
  desired_delivery_date?: string;
}

export interface BatchPickingRouteItem {
  step_number: number;
  product_id: number;
  product_code: string;
  product_name: string;
  unit_name: string;
  total_ordered_quantity: number;
  available_stock: number;
  location_id?: number;
  location_code: string;
  location_name: string;
  zone?: string;
  aisle?: string;
  rack?: string;
  bin?: string;
  pick_path_code: string;
  order_breakdown: OrderBreakdownItem[];
}

export interface BatchPickingPreviewResponse {
  batch_code: string;
  warehouse_id?: number;
  warehouse_name?: string;
  selected_order_codes: string[];
  total_orders: number;
  total_unique_items: number;
  total_pick_units: number;
  route_items: BatchPickingRouteItem[];
}

export interface EligiblePickingOrder {
  order_code: string;
  dealer_id?: number;
  dealer_name?: string;
  status: string;
  created_at?: string;
  desired_delivery_date?: string;
  delivery_point?: string;
  total_items: number;
  total_quantity: number;
  items_summary: string[];
}

export interface PickingItemExecution {
  product_id: number;
  product_code: string;
  ordered_quantity: number;
  picked_quantity: number;
  shortage_reason?: string;
  location_code?: string;
}

export interface BatchPickingCompleteRequest {
  batch_code?: string;
  order_codes: string[];
  items: PickingItemExecution[];
  picker_name?: string;
  notes?: string;
}

export interface BatchPickingCompleteResponse {
  success: boolean;
  batch_code: string;
  message: string;
  total_orders_updated: number;
  total_items_picked: number;
  shortage_items_count: number;
  updated_at: string;
}

export async function getEligiblePickingOrdersApi(
  token: string,
  search?: string,
  statusFilter?: string
): Promise<EligiblePickingOrder[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (statusFilter && statusFilter !== 'all') params.set('status_filter', statusFilter);

  const url = `${API_BASE_URL}/warehouses/picking/eligible-orders${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải danh sách đơn hàng sẵn sàng soạn.');
  }
  return await response.json();
}

export async function previewBatchPickingApi(
  token: string,
  orderCodes: string[]
): Promise<BatchPickingPreviewResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/picking/batch-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_codes: orderCodes }),
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tạo bản xem trước phiếu soạn hàng gộp.');
  }
  return await response.json();
}

export async function completeBatchPickingApi(
  token: string,
  data: BatchPickingCompleteRequest
): Promise<BatchPickingCompleteResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/picking/batch-complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi hoàn tất phiếu soạn hàng.');
  }
  return await response.json();
}


// ==========================================================
// MASTER DATA: KHU VỰC (ZONES) & KỆ / DÃY (RACKS / AISLES)
// ==========================================================

export interface WarehouseZoneItem {
  id: number;
  warehouse_id: number;
  zone_code: string;
  zone_name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  locations_count: number;
}

export interface WarehouseRackItem {
  id: number;
  warehouse_id: number;
  zone_id?: number;
  zone_name?: string;
  rack_code: string;
  rack_name: string;
  rack_type: string;
  max_capacity?: number;
  is_active: boolean;
  created_at?: string;
  locations_count: number;
}

export interface MasterDataOptionItem {
  id?: number;
  code: string;
  name: string;
  type?: string;
  zone_name?: string;
}

export interface WarehouseMasterData {
  zones: MasterDataOptionItem[];
  aisles: MasterDataOptionItem[];
  racks: MasterDataOptionItem[];
  bins: MasterDataOptionItem[];
}

export async function getWarehouseMasterDataApi(
  token: string,
  warehouseId: number
): Promise<WarehouseMasterData> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${warehouseId}/master-data`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi nạp cấu hình danh mục kệ và khu vực');
  }
  return response.json();
}

// CHỨC NĂNG KIỂM KÊ KHO (STOCK AUDITS)
// ==========================================

export interface StockAuditItem {
  product_id: number;
  product_code: string;
  product_name: string;
  category_name?: string | null;
  base_unit: string;
  system_stock: number;
  actual_stock?: number | null;
  discrepancy?: number | null;
  result_status: 'MATCH' | 'DEFICIT' | 'SURPLUS' | 'PENDING';
  result_label: string;
  reason?: string | null;
  reserved_stock: number;
  current_actual_stock?: number;
}

export interface StockAudit {
  id: number;
  code: string;
  warehouse_id: string;
  warehouse_name: string;
  category_id?: number | null;
  category_name?: string | null;
  scope_type: 'WAREHOUSE' | 'CATEGORY';
  status: 'IN_PROGRESS' | 'CONFIRMED' | 'CANCELLED';
  status_label: string;
  note?: string | null;
  total_items: number;
  discrepancy_items_count: number;
  total_discrepancy_qty: number;
  items: StockAuditItem[];
  created_by: string;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface StockAuditListResponse {
  items: StockAudit[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface StockAuditCreateInput {
  scope_type: 'WAREHOUSE' | 'CATEGORY';
  warehouse_id: string;
  category_id?: number | null;
  note?: string;
  product_ids?: number[];
}

export async function getAuditWarehousesApi(token: string): Promise<{ id: string; name: string }[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/stock-audits/warehouses`, {
    method: 'GET',
  }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể lấy danh sách kho kiểm kê');
  }
  return response.json();
}

export async function getWarehouseZonesApi(
  token: string,
  warehouseId: number
): Promise<WarehouseZoneItem[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${warehouseId}/zones`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải danh mục khu vực');
  }
  return response.json();
}

export async function createWarehouseZoneApi(
  token: string,
  warehouseId: number,
  payload: {
    zone_code: string;
    zone_name: string;
    description?: string;
    is_active?: boolean;
  }
): Promise<WarehouseZoneItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${warehouseId}/zones`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo khu vực mới (${response.status})`);
  }
  return data;
}

export async function updateWarehouseZoneApi(
  token: string,
  zoneId: number,
  payload: {
    zone_code?: string;
    zone_name?: string;
    description?: string;
    is_active?: boolean;
  }
): Promise<WarehouseZoneItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/zones/${zoneId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật khu vực (${response.status})`);
  }
  return data;
}

export async function deleteWarehouseZoneApi(token: string, zoneId: number): Promise<{ message: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/zones/${zoneId}`, {
    method: 'DELETE',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xóa khu vực (${response.status})`);
  }
  return data;
}

export async function getWarehouseRacksApi(
  token: string,
  warehouseId: number,
  rackType?: string,
  zoneId?: number
): Promise<WarehouseRackItem[]> {
  const params = new URLSearchParams();
  if (rackType && rackType !== 'all') params.set('rack_type', rackType);
  if (zoneId) params.set('zone_id', String(zoneId));
  const qs = params.toString() ? `?${params.toString()}` : '';

  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${warehouseId}/racks${qs}`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải danh mục kệ và dãy');
  }
  return response.json();
}

export async function createWarehouseRackApi(
  token: string,
  warehouseId: number,
  payload: {
    rack_code: string;
    rack_name: string;
    rack_type?: string;
    zone_id?: number;
    max_capacity?: number;
    is_active?: boolean;
  }
): Promise<WarehouseRackItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/${warehouseId}/racks`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo kệ mới (${response.status})`);
  }
  return data;
}

export async function updateWarehouseRackApi(
  token: string,
  rackId: number,
  payload: {
    rack_code?: string;
    rack_name?: string;
    rack_type?: string;
    zone_id?: number;
    max_capacity?: number;
    is_active?: boolean;
  }
): Promise<WarehouseRackItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/racks/${rackId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật kệ (${response.status})`);
  }
  return data;
}

export async function deleteWarehouseRackApi(token: string, rackId: number): Promise<{ message: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/warehouses/racks/${rackId}`, {
    method: 'DELETE',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xóa kệ (${response.status})`);
  }
  return data;
}

export async function previewAuditProductsApi(
  token: string,
  params: {
    warehouse_id: string;
    scope_type?: string;
    category_id?: number;
    page?: number;
    page_size?: number;
    search?: string;
  }
): Promise<{
  warehouse_id: string;
  warehouse_name: string;
  scope_type: string;
  category_id?: number;
  total_items: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
  items: {
    product_id: number;
    product_code: string;
    product_name: string;
    category_name: string;
    base_unit: string;
    system_stock: number;
    reserved_stock: number;
    available_stock: number;
  }[];
}> {
  const query = new URLSearchParams({
    warehouse_id: params.warehouse_id,
    scope_type: params.scope_type || 'WAREHOUSE',
  });
  if (params.category_id) {
    query.set('category_id', String(params.category_id));
  }
  if (params.page !== undefined) {
    query.set('page', String(params.page));
  }
  if (params.page_size !== undefined) {
    query.set('page_size', String(params.page_size));
  }
  if (params.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  const response = await authenticatedFetch(`${API_BASE_URL}/stock-audits/preview-products?${query.toString()}`, {
    method: 'GET',
  }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể xem trước danh sách sản phẩm');
  }
  return response.json();
}

export async function getStockAuditsApi(
  token: string,
  params?: {
    search?: string;
    warehouse_id?: string;
    status?: string;
    scope_type?: string;
    page?: number;
    page_size?: number;
  }
): Promise<StockAuditListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.warehouse_id) query.set('warehouse_id', params.warehouse_id);
  if (params?.status) query.set('status', params.status);
  if (params?.scope_type) query.set('scope_type', params.scope_type);
  if (params?.page) query.set('page', String(params.page));
  if (params?.page_size) query.set('page_size', String(params.page_size));

  const qs = query.toString();
  const url = `${API_BASE_URL}/stock-audits${qs ? `?${qs}` : ''}`;
  const response = await authenticatedFetch(url, {
    method: 'GET',
  }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tải danh sách phiếu kiểm kê');
  }
  return response.json();
}

export async function getStockAuditDetailApi(token: string, auditId: number): Promise<StockAudit> {
  const response = await authenticatedFetch(`${API_BASE_URL}/stock-audits/${auditId}`, {
    method: 'GET',
  }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tải chi tiết phiếu kiểm kê');
  }
  return response.json();
}

export async function createStockAuditApi(
  token: string,
  data: StockAuditCreateInput
): Promise<StockAudit> {
  const response = await authenticatedFetch(`${API_BASE_URL}/stock-audits`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);
  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(resData.detail || `Lỗi tạo phiếu kiểm kê (${response.status})`);
  }
  return resData;
}

export async function updateStockAuditResultsApi(
  token: string,
  auditId: number,
  data: {
    items: { product_id: number; actual_stock?: number | null; reason?: string }[];
    note?: string;
  }
): Promise<StockAudit> {
  const response = await authenticatedFetch(`${API_BASE_URL}/stock-audits/${auditId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);
  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(resData.detail || `Lỗi cập nhật kết quả kiểm kê (${response.status})`);
  }
  return resData;
}

export async function confirmStockAuditApi(
  token: string,
  auditId: number,
  data?: {
    items?: { product_id: number; actual_stock?: number | null; reason?: string }[];
    note?: string;
  }
): Promise<StockAudit> {
  const response = await authenticatedFetch(`${API_BASE_URL}/stock-audits/${auditId}/confirm`, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  }, token);
  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(resData.detail || `Lỗi xác nhận phiếu kiểm kê (${response.status})`);
  }
  return resData;
}

export async function cancelStockAuditApi(
  token: string,
  auditId: number,
  reason?: string
): Promise<StockAudit> {
  const response = await authenticatedFetch(`${API_BASE_URL}/stock-audits/${auditId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }, token);
  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(resData.detail || `Lỗi hủy phiếu kiểm kê (${response.status})`);
  }
  return resData;
}

// ==================== BỔ SUNG CÁC API TỪ NHÁNH HIEUHIEU / TEST ====================

export function formatErrorMessage(detail: any, fallback: string = 'Đã có lỗi xảy ra'): string {
  if (!detail) return fallback;
  if (typeof detail === 'string') {
    if (detail === '[object Object]' || detail.trim() === '') return fallback;
    return detail;
  }
  if (Array.isArray(detail)) {
    if (detail.length === 0) return fallback;
    return detail
      .map((d: any) => {
        if (typeof d === 'string') return d;
        if (d && typeof d === 'object') {
          const msg = d.msg || d.message || d.detail || (d.type ? `Lỗi: ${d.type}` : '');
          const loc = Array.isArray(d.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : '';
          if (loc && msg) return `${loc}: ${msg}`;
          if (msg) return msg;
          try { return JSON.stringify(d); } catch { return fallback; }
        }
        return String(d);
      })
      .filter((s) => s && s !== '[object Object]')
      .join('; ') || fallback;
  }
  if (typeof detail === 'object') {
    const extracted = detail.message || detail.msg || detail.detail;
    if (extracted && typeof extracted === 'string' && extracted !== '[object Object]') {
      return extracted;
    }
    if (extracted && typeof extracted === 'object') {
      return formatErrorMessage(extracted, fallback);
    }
    try {
      const jsonStr = JSON.stringify(detail);
      return jsonStr !== '{}' ? jsonStr : fallback;
    } catch {
      return fallback;
    }
  }
  return String(detail);
}

export interface PurchaseHistoryItem {
  product_id: number;
  product_code: string;
  product_name: string;
  unit: string;
  conversion_rate: number;
  price: number;
  total_quantity: number;
  order_count: number;
  avg_quantity: number;
  last_order_quantity: number;
  last_purchased_date?: string | null;
}

export interface LastOrderItem {
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  price: number;
  unit: string;
  conversion_rate: number;
}

export interface LastOrderSummary {
  order_code: string;
  created_at: string;
  items: LastOrderItem[];
}

export interface DealerPurchaseHistory {
  dealer_id: number;
  dealer_name: string;
  period: string;
  has_history: boolean;
  total_orders_3_months: number;
  items: PurchaseHistoryItem[];
  last_order?: LastOrderSummary | null;
  last_order_items: LastOrderItem[];
}

export interface WarehouseInfo {
  warehouse_id: string;
  warehouse_name: string;
}

export interface WarehouseThresholdItem {
  warehouse_id: string;
  warehouse_name: string;
  product_id: number;
  product_code: string;
  product_name: string;
  category?: string;
  base_unit: string;
  actual_stock: number;
  reserved_stock: number;
  available_stock: number;
  min_stock: number;
  is_low_stock: boolean;
  shortage_quantity: number;
}

export interface UpdateThresholdPayload {
  warehouse_id: string;
  product_id: number;
  min_stock: number;
}

export interface LowStockAlertSummary {
  total_low_stock: number;
  total_alerts?: number;
  total_products: number;
  out_of_stock_count?: number;
  near_depleted_count?: number;
  warehouses: Array<{
    warehouse_id: string;
    warehouse_name: string;
    low_stock_count: number;
  }>;
  items: WarehouseThresholdItem[];
  page?: number;
  page_size?: number;
  total_pages?: number;
}

export async function getDealerPurchaseHistoryApi(
  token: string,
  dealerId: number
): Promise<DealerPurchaseHistory> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/orders/dealers/${dealerId}/purchase-history`,
    { method: 'GET' },
    token
  );
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Chỉ hiển thị với đại lý mà nhân viên được phân công.');
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Lỗi tải lịch sử mua hàng (Mã lỗi ${response.status})`);
  }
  return response.json();
}

export async function supplementaryDeliveryApi(
  token: string,
  orderCode: string,
  payload?: { note?: string; delivered_quantities?: Record<string, number> }
): Promise<any> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}/supplementary-delivery`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || { note: 'Giao bổ sung đợt 2 - hoàn tất đơn hàng' }),
    },
    token
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi giao bổ sung đơn hàng (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function getInventoryWarehousesApi(token: string): Promise<WarehouseInfo[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/warehouses`, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải danh sách kho hàng');
  }
  return response.json();
}

export interface WarehouseThresholdPageResponse {
  items: WarehouseThresholdItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  total_count?: number;
  low_count?: number;
  safe_count?: number;
  active_warehouses?: number;
}

export async function getWarehouseThresholdsApi(
  token: string,
  warehouseId?: string,
  page?: number,
  pageSize: number = 20,
  search?: string,
  filterMode?: 'ALL' | 'LOW_ONLY'
): Promise<WarehouseThresholdPageResponse | WarehouseThresholdItem[]> {
  const params = new URLSearchParams();
  if (warehouseId && warehouseId !== 'ALL') params.set('warehouse_id', warehouseId);
  if (page !== undefined && page !== null) {
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
  }
  if (search && search.trim()) params.set('search', search.trim());
  if (filterMode && filterMode !== 'ALL') params.set('filter_mode', filterMode);

  const qs = params.toString();
  const url = `${API_BASE_URL}/inventory/thresholds${qs ? `?${qs}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải định mức tồn tối thiểu');
  }
  return response.json();
}

export async function updateWarehouseThresholdApi(
  token: string,
  payload: UpdateThresholdPayload
): Promise<WarehouseThresholdItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/thresholds`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || 'Lỗi cập nhật định mức tồn tối thiểu');
  }
  return data;
}

export async function getLowStockAlertsApi(
  token: string,
  page?: number,
  pageSize?: number,
  warehouseId?: string,
  search?: string,
  severity?: string
): Promise<LowStockAlertSummary> {
  const params = new URLSearchParams();
  if (page) params.append('page', page.toString());
  if (pageSize) params.append('page_size', pageSize.toString());
  if (warehouseId && warehouseId !== 'ALL') params.append('warehouse_id', warehouseId);
  if (search && search.trim()) params.append('search', search.trim());
  if (severity && severity !== 'ALL') params.append('severity', severity);

  const qs = params.toString();
  const url = `${API_BASE_URL}/inventory/low-stock-alerts${qs ? `?${qs}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải cảnh báo tồn tối thiểu');
  }
  return response.json();
}

export interface StockBookItem {
  warehouse_id: string;
  warehouse_name: string;
  product_id: number;
  product_code: string;
  product_name: string;
  category: string;
  base_unit: string;
  actual_stock: number;
  reserved_stock: number;
  available_stock: number;
  min_stock: number;
  is_low_stock: boolean;
  status: 'available' | 'out_of_stock' | 'low_stock' | string;
}

export interface StockBookSummary {
  total_actual_stock: number;
  total_reserved_stock: number;
  total_available_stock: number;
  total_skus: number;
}

export interface StockBookResponse {
  summary: StockBookSummary;
  items: StockBookItem[];
  warehouses: WarehouseInfo[];
  categories: string[];
  total?: number;
  page?: number;
  page_size?: number;
}

export interface StockBookFilterParams {
  warehouse_id?: string;
  category?: string;
  stock_status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export async function getStockBookApi(
  token: string,
  params?: StockBookFilterParams
): Promise<StockBookResponse> {
  const query = new URLSearchParams();
  if (params?.warehouse_id && params.warehouse_id !== 'all') {
    query.set('warehouse_id', params.warehouse_id);
  }
  if (params?.category && params.category !== 'all') {
    query.set('category', params.category);
  }
  if (params?.stock_status && params.stock_status !== 'all') {
    query.set('stock_status', params.stock_status);
  }
  if (params?.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params?.page) {
    query.set('page', String(params.page));
  }
  if (params?.page_size) {
    query.set('page_size', String(params.page_size));
  }

  const url = `${API_BASE_URL}/inventory/stock-book${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải dữ liệu sổ tồn kho');
  }
  return response.json();
}
// ==========================================
// CHỨC NĂNG KIỂM KÊ KHO (STOCK AUDITS)
// ==========================================


// ==========================================
// ORDER ADVANCED FILTERING & KPIS (nhánh hieuhieu)
// ==========================================
export interface OrderFilterParams {
  status?: string;
  dealer_id?: number;
  sales_rep_id?: number;
  region?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  page_size?: number;
  format?: string;
}

export interface OrderListFilteredResponse {
  items: any[];
  total: number;
  total_count: number;
  filtered_total_amount: number;
  pending_count: number;
  confirmed_count: number;
  page: number;
  page_size: number;
}

export async function getOrdersFilteredApi(
  token: string,
  params?: OrderFilterParams
): Promise<OrderListFilteredResponse> {
  const query = new URLSearchParams();
  if (params) {
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.dealer_id) query.append('dealer_id', String(params.dealer_id));
    if (params.sales_rep_id) query.append('sales_rep_id', String(params.sales_rep_id));
    if (params.region && params.region !== 'ALL') query.append('region', params.region);
    if (params.start_date) query.append('start_date', params.start_date);
    if (params.end_date) query.append('end_date', params.end_date);
    if (params.search && params.search.trim()) query.append('search', params.search.trim());
    if (params.page) query.append('page', String(params.page));
    if (params.page_size) query.append('page_size', String(params.page_size));
    if (params.format) query.append('format', params.format);
    else query.append('format', 'summary');
  } else {
    query.append('format', 'summary');
    query.append('page', '1');
    query.append('page_size', '20');
  }
  const queryString = query.toString();
  const url = `${API_BASE_URL}/orders${queryString ? `?${queryString}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách đơn hàng (Mã lỗi ${response.status})`);
  }
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      total_count: data.length,
      pending_count: data.filter((o: any) => o.status === 'PENDING_APPROVAL' || o.status === 'PENDING').length,
      confirmed_count: data.filter((o: any) => o.status === 'CONFIRMED').length,
      page: 1,
      page_size: data.length,
      filtered_total_amount: data.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0),
    };
  }
  return data as OrderListFilteredResponse;
}

export interface SalesRepItem {
  id: number;
  username: string;
  full_name: string;
  role: string;
}

export async function getFilteredOrdersApi(
  token: string,
  params?: OrderFilterParams
): Promise<OrderListFilteredResponse> {
  return getOrdersFilteredApi(token, params);
}

export async function getOrderSalesRepsApi(token: string): Promise<SalesRepItem[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/orders/sales-reps`, { method: 'GET' }, token);
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export async function getOrderRegionsApi(token: string): Promise<string[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/orders/regions`, { method: 'GET' }, token);
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    return [];
  }
  return Array.isArray(data) ? data : [];
}

// ===================================
// DYNAMIC PRICING & FLOOR VALIDATION APIS (from test branch)
// ===================================
export interface LineItemPricingPayload {
  dealer_id?: number;
  customer_group?: string;
  product_id: number;
  quantity: number;
  unit_price_override?: number;
}

export interface LineItemPricingResult {
  product_id: number;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  book_price: number;
  floor_price: number;
  is_below_floor: boolean;
  requires_approval: boolean;
  approval_reason?: string | null;
  discount_rate: number;
  discount_amount: number;
  applied_policy_code?: string | null;
  applied_policy_name?: string | null;
  line_total: number;
}

export interface EffectivePriceResult {
  price_book_id: number;
  price_book_code: string;
  price_book_name: string;
  customer_group: string;
  product_id: number;
  product_code: string;
  product_name: string;
  sale_price: number;
  floor_price: number;
  unit_price: number;
}

export interface ValidateOrderPriceFloorPayload {
  dealer_id?: number;
  customer_group?: string;
  items: Array<{
    product_id: number;
    price: number;
    quantity: number;
  }>;
}

export interface ValidateOrderPriceFloorResult {
  requires_approval: boolean;
  approval_reasons: string[];
  approval_reason?: string | null;
  items_evaluation: Array<{
    product_id: number;
    product_code?: string;
    product_name?: string;
    unit_price: number;
    book_price: number;
    floor_price: number;
    is_below_floor: boolean;
    quantity: number;
    error?: string;
  }>;
}

export async function calculateLineItemPricingApi(
  token: string,
  payload: LineItemPricingPayload
): Promise<LineItemPricingResult> {
  const response = await authenticatedFetch(`${API_BASE_URL}/pricing/calculate-line-item`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, `Lỗi tính giá dòng hàng (Mã lỗi ${response.status})`));
  }
  return data as LineItemPricingResult;
}

export async function getEffectivePriceApi(
  token: string,
  params: { product_id: number; dealer_id?: number; customer_group?: string }
): Promise<EffectivePriceResult> {
  const query = new URLSearchParams({ product_id: String(params.product_id) });
  if (params.dealer_id) query.set('dealer_id', String(params.dealer_id));
  if (params.customer_group) query.set('customer_group', params.customer_group);
  const response = await authenticatedFetch(`${API_BASE_URL}/pricing/effective-price?${query.toString()}`, {
    method: 'GET',
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, `Lỗi tra cứu bảng giá (Mã lỗi ${response.status})`));
  }
  return data as EffectivePriceResult;
}

export async function validateOrderPriceFloorApi(
  token: string,
  payload: ValidateOrderPriceFloorPayload
): Promise<ValidateOrderPriceFloorResult> {
  const response = await authenticatedFetch(`${API_BASE_URL}/pricing/validate-floor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(getApiErrorMessage(data, `Lỗi kiểm tra giá sàn (Mã lỗi ${response.status})`));
  }
  return data as ValidateOrderPriceFloorResult;
}

// ==========================================

export interface StockTransferItem {
  product_id: number;
  product_code: string;
  product_name: string;
  category?: string;
  unit?: string;
  transfer_qty: number;
  received_qty?: number | null;
  discrepancy_qty: number;
  reason?: string | null;
}

export interface StockTransfer {
  id: number;
  code: string;
  from_warehouse_id: string;
  from_warehouse_name: string;
  to_warehouse_id: string;
  to_warehouse_name: string;
  status: 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  note?: string | null;
  total_items: number;
  total_transfer_qty: number;
  total_received_qty: number;
  discrepancy_qty: number;
  discrepancy_reason?: string | null;
  items: StockTransferItem[];
  created_by: string;
  dispatched_by?: string | null;
  dispatched_at?: string | null;
  received_by?: string | null;
  received_at?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStockTransferPayload {
  from_warehouse_id: string;
  to_warehouse_id: string;
  items: { product_id: number; transfer_qty: number }[];
  note?: string;
}

export interface ReceiveStockTransferPayload {
  items: { product_id: number; received_qty: number; reason?: string }[];
  discrepancy_reason?: string;
}

export async function getStockTransfersApi(token: string, status?: string, warehouseId?: string): Promise<StockTransfer[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (warehouseId) params.append('warehouse_id', warehouseId);
  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/transfers${queryStr}`, {
    method: 'GET',
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách chuyển kho (${response.status})`);
  }
  return data;
}

export async function getStockTransferDetailApi(token: string, code: string): Promise<StockTransfer> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/transfers/${code}`, {
    method: 'GET',
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải chi tiết phiếu chuyển kho (${response.status})`);
  }
  return data;
}

export async function createStockTransferApi(token: string, payload: CreateStockTransferPayload): Promise<StockTransfer> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/transfers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi lập phiếu chuyển kho (${response.status})`);
  }
  return data;
}

export async function receiveStockTransferApi(token: string, code: string, payload: ReceiveStockTransferPayload): Promise<StockTransfer> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/transfers/${code}/receive`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xác nhận nhận hàng chuyển kho (${response.status})`);
  }
  return data;
}

export async function cancelStockTransferApi(token: string, code: string, reason?: string): Promise<StockTransfer> {
  const query = reason ? `?cancel_reason=${encodeURIComponent(reason)}` : '';
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/transfers/${code}/cancel${query}`, {
    method: 'POST',
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi hủy phiếu chuyển kho (${response.status})`);
  }
  return data;
}

// ==========================================
// SCRUM-91: Báo cáo Sổ công nợ theo đại lý & Phân tích tuổi nợ
// ==========================================

export interface AgeingBuckets {
  bucket_0_30: number;
  bucket_31_60: number;
  bucket_61_90: number;
  bucket_over_90: number;
}

export interface DealerDebtAgeingItem {
  dealer_id: number;
  dealer_code: string;
  dealer_name: string;
  region?: string | null;
  assigned_sale_id?: number | null;
  assigned_sale_name?: string | null;
  phone?: string | null;
  credit_limit: number;
  max_debt_days: number;
  overdue_days_allowed: number;
  total_receivable: number;
  total_paid: number;
  remaining_debt: number;
  oldest_debt_days: number;
  is_overdue: boolean;
  ageing: AgeingBuckets;
}

export interface DebtLedgerSummary {
  total_dealers: number;
  total_receivable: number;
  total_paid: number;
  total_remaining_debt: number;
  total_bucket_0_30: number;
  total_bucket_31_60: number;
  total_bucket_61_90: number;
  total_bucket_over_90: number;
}

export interface DebtLedgerResponse {
  items: DealerDebtAgeingItem[];
  summary: DebtLedgerSummary;
}

export interface DebtLedgerFilters {
  region?: string;
  assigned_sale_id?: number;
  overdue_only?: boolean;
  search?: string;
}

export async function getDebtLedgerApi(token: string, filters?: DebtLedgerFilters): Promise<DebtLedgerResponse> {
  const params = new URLSearchParams();
  if (filters?.region) params.append('region', filters.region);
  if (filters?.assigned_sale_id) params.append('assigned_sale_id', String(filters.assigned_sale_id));
  if (filters?.overdue_only) params.append('overdue_only', 'true');
  if (filters?.search) params.append('search', filters.search);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedFetch(`${API_BASE_URL}/dealers/debt-ledger${qs}`, {
    method: 'GET',
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải sổ công nợ (${response.status})`);
  }
  return data;
}

export async function exportDebtLedgerExcelApi(token: string, filters?: DebtLedgerFilters): Promise<Blob> {
  const params = new URLSearchParams();
  if (filters?.region) params.append('region', filters.region);
  if (filters?.assigned_sale_id) params.append('assigned_sale_id', String(filters.assigned_sale_id));
  if (filters?.overdue_only) params.append('overdue_only', 'true');
  if (filters?.search) params.append('search', filters.search);

  const qs = params.toString() ? `?${params.toString()}` : '';
  const response = await authenticatedFetch(`${API_BASE_URL}/dealers/debt-ledger/export${qs}`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Lỗi tải file Excel (${response.status})`);
  }
  return await response.blob();
}

// ==========================================
// SCRUM-84: THEO DÕI HÀNG TRÊN ĐƯỜNG & CHUYẾN GIAO HÀNG
// ==========================================
export interface DeliveryTripStopItem {
  product_id?: number;
  product_code?: string;
  product_name: string;
  unit: string;
  quantity: number;
  price: number;
  line_total: number;
}

export interface DeliveryTripStop {
  id: number;
  trip_id?: number;
  stop_order: number;
  dealer_name: string;
  order_code: string;
  delivery_address: string;
  total_amount: number;
  status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'RETURNED_TO_WAREHOUSE' | string;
  status_label: string;
  items?: DeliveryTripStopItem[];
  failure_reason?: string | null;
  return_note?: string | null;
  returned_at?: string | null;
  returned_to_warehouse_at?: string | null;
  returned_by?: string | null;
  delivered_at?: string | null;
}

export interface DeliveryTrip {
  id: number;
  trip_code: string;
  warehouse_id: number;
  warehouse_name: string;
  driver_name: string;
  driver_phone?: string | null;
  license_plate: string;
  departure_time: string;
  expected_completion_time: string;
  actual_completion_time?: string | null;
  total_stops: number;
  delivered_stops: number;
  remaining_stops: number;
  failed_stops?: number;
  failed_stops_count: number;
  in_transit_amount: number;
  total_trip_amount: number;
  status: 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED' | string;
  is_overdue: boolean;
  overdue_hours?: number;
  overdue_text?: string;
  note?: string | null;
  stops: DeliveryTripStop[];
}

export interface InTransitSummary {
  total_active_trips: number;
  total_stops: number;
  total_remaining_stops: number;
  total_delivered_stops: number;
  total_in_transit_amount: number;
  total_overdue_trips: number;
  trips: DeliveryTrip[];
}

export interface CreateDeliveryTripPayload {
  warehouse_id: string | number;
  driver_name: string;
  driver_phone?: string;
  license_plate: string;
  expected_completion_time: string;
  note?: string;
  stops: Array<{
    order_code: string;
    dealer_name: string;
    delivery_address: string;
    items: Array<{
      product_id: number;
      product_code: string;
      product_name: string;
      unit: string;
      quantity: number;
      price: number;
      line_total: number;
    }>;
  }>;
}

export async function getInTransitTripsApi(
  token: string,
  warehouseId?: string,
  onlyOverdue?: boolean
): Promise<InTransitSummary> {
  const query = new URLSearchParams();
  if (warehouseId && warehouseId !== 'all') query.append('warehouse_id', warehouseId);
  if (onlyOverdue) query.append('only_overdue', 'true');
  const url = `${API_BASE_URL}/inventory/delivery-trips/in-transit${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách chuyến giao hàng (${response.status})`);
  }
  return data;
}

export async function createDeliveryTripApi(
  token: string,
  payload: CreateDeliveryTripPayload
): Promise<DeliveryTrip> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/delivery-trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo chuyến giao hàng (${response.status})`);
  }
  return data;
}

export async function updateTripStopStatusApi(
  token: string,
  stopId: number,
  status: 'DELIVERED' | 'FAILED',
  failureReason?: string
): Promise<DeliveryTripStop> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/delivery-trips/stops/${stopId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, failure_reason: failureReason }),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi cập nhật trạng thái điểm giao (${response.status})`);
  }
  return data;
}

export async function returnStopGoodsToWarehouseApi(
  token: string,
  stopId: number,
  returnNote?: string
): Promise<DeliveryTripStop> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/delivery-trips/stops/${stopId}/return-to-warehouse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ return_note: returnNote }),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi hoàn nhập hàng về kho (${response.status})`);
  }
  return data;
}

// ==========================================
// QUẢN LÝ LÔ VÀ HẠN SỬ DỤNG HÀNG HÓA (BATCH & EXPIRY TRACKING)
// ==========================================
export interface BatchItem {
  id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  base_unit: string;
  warehouse_id: number;
  warehouse_name: string;
  batch_number: string;
  manufacturing_date: string | null;
  expiry_date: string | null;
  remaining_quantity: number;
  days_until_expiry: number | null;
  expiry_status: 'EXPIRED' | 'NEAR_EXPIRY' | 'SAFE';
  warning_threshold_days: number;
  created_at?: string;
  updated_at?: string;
}

export interface BatchListResponse {
  items: BatchItem[];
  total: number;
  expired_count: number;
  near_expiry_count: number;
  safe_count: number;
  warning_threshold_days: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
}

export interface BatchCreatePayload {
  product_id: number;
  warehouse_id?: number;
  batch_number: string;
  manufacturing_date?: string | null;
  expiry_date: string;
  initial_quantity?: number;
  note?: string;
}

export interface BatchTrackingTogglePayload {
  is_batch_managed: boolean;
  initial_batch_number?: string;
  initial_manufacturing_date?: string | null;
  initial_expiry_date?: string | null;
  reason?: string;
}

export interface BatchTrackingToggleResponse {
  product_id: number;
  product_code: string;
  product_name: string;
  is_batch_managed: boolean;
  message: string;
  batch_created?: BatchItem | null;
}

export async function getBatchesApi(
  token: string,
  params?: {
    product_id?: number;
    warehouse_id?: number;
    status?: string;
    warning_days?: number;
    search?: string;
    page?: number;
    page_size?: number;
  }
): Promise<BatchListResponse> {
  const query = new URLSearchParams();
  if (params?.product_id) query.append('product_id', String(params.product_id));
  if (params?.warehouse_id) query.append('warehouse_id', String(params.warehouse_id));
  if (params?.status) query.append('status', params.status);
  if (params?.warning_days) query.append('warning_days', String(params.warning_days));
  if (params?.search) query.append('search', params.search);
  if (params?.page) query.append('page', String(params.page));
  if (params?.page_size) query.append('page_size', String(params.page_size));

  const url = `${API_BASE_URL}/batches${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách lô hàng (${response.status})`);
  }
  return data;
}

export async function createBatchApi(
  token: string,
  payload: BatchCreatePayload
): Promise<BatchItem> {
  const response = await authenticatedFetch(`${API_BASE_URL}/batches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = formatErrorMessage(data.detail, data.message || `Lỗi tạo lô hàng (${response.status})`);
    throw new Error(errorMsg);
  }
  return data;
}

export async function toggleProductBatchTrackingApi(
  token: string,
  productId: number,
  payload: BatchTrackingTogglePayload
): Promise<BatchTrackingToggleResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/batches/product/${productId}/tracking`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = formatErrorMessage(data.detail, data.message || `Lỗi chuyển đổi cấu hình lô (${response.status})`);
    throw new Error(errorMsg);
  }
  return data;
}

// ==========================================
// BÁO CÁO TỒN KHO & VÒNG QUAY HÀNG HÓA (INVENTORY TURNOVER & AGING STOCK)
// ==========================================
export interface WarehouseBreakdown {
  warehouse_id: string;
  warehouse_name: string;
  total_value: number;
  total_stock: number;
  sku_count: number;
  percentage: number;
}

export interface CategoryBreakdown {
  category: string;
  total_value: number;
  total_stock: number;
  sku_count: number;
  percentage: number;
}

export interface TurnoverReportItem {
  product_id: number;
  product_code: string;
  product_name: string;
  category: string;
  base_unit: string;
  warehouse_id?: string;
  warehouse_name?: string;
  current_stock: number;
  cost_price: number;
  inventory_value: number;
  sold_quantity: number;
  cogs: number;
  turnover_rate: number;
  dsi: number | null;
  last_sale_date: string | null;
  days_without_sale: number | null;
  status: 'stagnant' | 'slow' | 'normal' | 'fast' | 'out_of_stock' | string;
  status_label: string;
  status_severity: 'danger' | 'warning' | 'info' | 'success' | 'neutral';
  warning_note?: string;
}

export interface TurnoverReportSummary {
  total_inventory_value: number;
  slow_stagnant_value: number;
  slow_stagnant_skus: number;
  total_skus: number;
  avg_turnover_rate: number;
  avg_dsi: number | null;
  total_cogs: number;
  period_days: number;
}

export interface TurnoverSummaryResponse {
  summary: TurnoverReportSummary;
  warehouse_breakdown: WarehouseBreakdown[];
  category_breakdown: CategoryBreakdown[];
  warehouses: WarehouseInfo[];
  categories: string[];
}

export interface TurnoverReportResponse {
  summary?: TurnoverReportSummary;
  warehouse_breakdown?: WarehouseBreakdown[];
  category_breakdown?: CategoryBreakdown[];
  items: TurnoverReportItem[];
  warehouses?: WarehouseInfo[];
  categories?: string[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TurnoverReportFilterParams {
  warehouse_id?: string;
  warehouse_code?: string;
  category?: string;
  days?: number;
  search?: string;
  status?: string;
  page?: number;
  page_size?: number;
  include_summary?: boolean;
}

export async function getTurnoverSummaryApi(
  token: string,
  params?: { warehouse_id?: string; category?: string; days?: number; status?: string }
): Promise<TurnoverSummaryResponse> {
  const query = new URLSearchParams();
  if (params?.warehouse_id && params.warehouse_id !== 'all') {
    query.set('warehouse_id', params.warehouse_id);
  }
  if (params?.category && params.category !== 'all') {
    query.set('category', params.category);
  }
  if (params?.days) {
    query.set('days', String(params.days));
  }
  if (params?.status && params.status !== 'all') {
    query.set('status', params.status);
  }

  const url = `${API_BASE_URL}/inventory/turnover-report/summary${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải thống kê báo cáo tồn kho');
  }
  return response.json();
}

export async function getTurnoverReportApi(
  token: string,
  params?: TurnoverReportFilterParams
): Promise<TurnoverReportResponse> {
  const query = new URLSearchParams();
  if (params?.warehouse_id && params.warehouse_id !== 'all') {
    query.set('warehouse_id', params.warehouse_id);
  }
  if (params?.category && params.category !== 'all') {
    query.set('category', params.category);
  }
  if (params?.days) {
    query.set('days', String(params.days));
  }
  if (params?.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params?.status && params.status !== 'all') {
    query.set('status', params.status);
  }
  if (params?.page) {
    query.set('page', String(params.page));
  }
  if (params?.page_size) {
    query.set('page_size', String(params.page_size));
  }
  if (params?.include_summary !== undefined) {
    query.set('include_summary', String(params.include_summary));
  }

  const url = `${API_BASE_URL}/inventory/turnover-report${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi tải dữ liệu báo cáo vòng quay tồn kho');
  }
  return response.json();
}

export async function exportTurnoverReportExcelApi(
  token: string,
  params?: TurnoverReportFilterParams
): Promise<void> {
  const query = new URLSearchParams();
  const wh = params?.warehouse_id || params?.warehouse_code;
  if (wh && wh !== 'all') {
    query.set('warehouse_id', wh);
    query.set('warehouse_code', wh);
  }
  if (params?.category && params.category !== 'all') {
    query.set('category', params.category);
  }
  if (params?.days) {
    query.set('days', String(params.days));
  }
  if (params?.search && params.search.trim()) {
    query.set('search', params.search.trim());
  }
  if (params?.status && params.status !== 'all') {
    query.set('status', params.status);
  }

  const url = `${API_BASE_URL}/inventory/turnover-report/export${query.toString() ? `?${query.toString()}` : ''}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Lỗi xuất file Excel báo cáo tồn kho');
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = downloadUrl;
    const contentDisposition = response.headers.get('content-disposition');
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let defaultSlug = 'Tat_Ca';
    if (wh && wh !== 'all') {
      defaultSlug = wh.replace(/[^a-zA-Z0-9]/g, '');
    }
    let filename = `Bao_Cao_Ton_Kho_Vong_Quay_${defaultSlug}_${todayStr}.xlsx`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      if (match && match[1]) {
        filename = decodeURIComponent(match[1]);
      }
    }
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    window.URL.revokeObjectURL(downloadUrl);
  }
}
