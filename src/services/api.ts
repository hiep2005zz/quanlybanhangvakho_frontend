// frontend/src/services/api.ts
export const API_BASE_URL = 'http://localhost:8000/api/v1';

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
  base_unit?: string;
  units?: UnitConversionItem[];
  cost_price?: number | null;
  profit_margin?: number | null;
  profit_per_unit?: number | null;
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
}

export interface OrderDealer {
  id: number;
  code: string;
  name: string;
  phone?: string | null;
  address?: string | null;
}

export interface CreateOrderPayload {
  dealer_id: number;
  delivery_point: string;
  desired_delivery_date: string;
  discount_percent: number;
  items: Array<{ product_id: number; quantity: number; unit: string; price: number }>;
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
  note?: string;
}

export type OrderItemCreatePayload = CreateOrderPayload['items'][number];

const isOrderItem = (value: unknown): value is OrderItem => {
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
}

export interface OrderCreateResponse {
  id: number;
  order_code: string;
  dealer_id: number;
  dealer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
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

/**
 * Fetch wrapper with 401 Interceptor:
 * If server returns 401 (token revoked or expired), immediately clears auth and redirects with notification.
 */
export async function authenticatedFetch(input: string, init: RequestInit = {}, token?: string): Promise<Response> {
  const currentToken = token || sessionStorage.getItem(AUTH_STORAGE.TOKEN);
  const headers = new Headers(init.headers || {});
  if (currentToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${currentToken}`);
  }
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  try {
    const response = await fetch(input, { ...init, headers });

    if (response.status === 401) {
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
export async function refreshTokenApi(token: string): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    notifySessionExpired('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
    throw new Error('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
  }

  if (!response.ok) {
    throw new Error('Không thể làm mới phiên đăng nhập.');
  }

  const data: LoginResponse = await response.json();
  saveClientSession(data.user, data.access_token, data.expires_in || 900);
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

export async function getProductsApi(token: string): Promise<ProductListResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/products`, {
    method: 'GET',
  }, token);

  if (!response.ok) {
    throw new Error('Không thể tải dữ liệu sản phẩm từ hệ thống.');
  }

  return response.json();
}

export async function getOrdersApi(token: string): Promise<OrderItem[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/orders`, {
    method: 'GET',
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách đơn hàng (Mã lỗi ${response.status})`);
  }
  if (!Array.isArray(data) || !data.every(isOrderItem)) {
    throw new Error('Dữ liệu danh sách đơn hàng không hợp lệ.');
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
  const response = await authenticatedFetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'CANCELLED', reason }),
  }, token);
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
    throw new Error(data.detail || `Lỗi cập nhật kho (Mã lỗi ${response.status})`);
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
    throw new Error(data.detail || `Lỗi nhập kho (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function createStockIssueApi(
  token: string,
  payload: { product_id: number; quantity: number; destination: string; note?: string; unit_name?: string; conversion_rate?: number }
): Promise<InventoryResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/inventory/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, token);

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xuất kho (Mã lỗi ${response.status})`);
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
}

export interface CustomerCreatePayload {
  full_name: string;
  email: string;
  phone: string;
  username?: string;
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
  phone?: string;
  email?: string;
  address?: string;
  assigned_sale_id?: number;
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

export async function getCategorySalesReportApi(token: string): Promise<CategorySalesReport[]> {
  const response = await authenticatedFetch(`${API_BASE_URL}/categories/sales-report`, {
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

// ==========================================
// SCRUM-29: AUDIT LOGS INTERFACES & CLIENT
// ==========================================

export interface AuditLogItem {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
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
 * User Story SCRUM-27: Xem và cập nhật hồ sơ cá nhân
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
    if (typeof err.detail === 'string') {
      msg = err.detail;
    } else if (Array.isArray(err.detail) && err.detail.length > 0) {
      msg = err.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
    }
    throw new Error(msg);
  }
  return await response.json();
}

// ============================================================================
// DÁN TOÀN BỘ NỘI DUNG FILE NÀY VÀO CUỐI FILE: frontend/src/services/api.ts
// (không cần import thêm gì, vì api.ts đã có sẵn API_BASE_URL và authenticatedFetch)
// ============================================================================
// ---------- NHÀ CUNG CẤP ----------
export interface Supplier {
  id: number;
  code: string;
  name: string;
  tax_code?: string | null;
  contact_person?: string | null;
  payment_terms?: string | null;
  is_active: boolean;
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
