const API_BASE_URL = typeof window !== 'undefined' && window.location.origin ? '' : 'http://127.0.0.1:8000';

export interface AppliedPriceBookInfo {
    id: number;
    code: string;
    name: string;
    customer_group: string;
    valid_from?: string | null;
    valid_to?: string | null;
    status: string;
    is_active_now?: boolean;
    items_count?: number;
    note?: string | null;
}

export interface DealerSearchItem {
    id: number;
    code: string;
    name: string;
    tax_code?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    region: string;
    assigned_sale_id?: number | null;
    assigned_sale_name?: string | null;
    customer_group?: string | null;
    status?: string | null;
    credit_limit?: number;
    max_debt_days?: number;
    current_debt?: number;
    debt_status?: string;
    lock_reason?: string | null;
    locked_at?: string | null;
    locked_by?: string | null;
    transaction_count?: number;
    has_transactions?: boolean;
    applied_price_book?: AppliedPriceBookInfo | null;
    warehouse_id?: string | null;
    warehouse_name?: string | null;
}

export interface DealerStats {
    total: number;
    active: number;
    stopped: number;
    paused: number;
    pending_activation: number;
    with_transactions: number;
    without_transactions?: number;
}

export interface DealerTransactionItem {
    id: number;
    order_code: string;
    created_at?: string | null;
    total_amount: number;
    status: string;
    created_by?: string;
    items_count?: number;
    assigned_sale_name?: string;
}

export interface DealerTransactionsResponse {
    dealer_id: number;
    dealer_code: string;
    dealer_name: string;
    total: number;
    items: DealerTransactionItem[];
}

export interface DealerSearchResponse {
    items: DealerSearchItem[];
    total: number;
    page?: number;
    page_size?: number;
    total_pages?: number;
    stats?: DealerStats;
}

export interface DealerFiltersResponse {
    regions: string[];
    sales: {
        id: number;
        name: string;
    }[];
    customer_groups?: string[];
    statuses?: string[];
}

export interface DealerSearchParams {
    keyword?: string;
    region?: string;
    assigned_sale_id?: number;
    customer_group?: string;
    status?: string;
    has_transactions?: boolean;
    page?: number;
    page_size?: number;
}

function getAuthToken(token?: string): string {
    if (token) return token;
    try {
        return (
            sessionStorage.getItem('auth_token') ||
            localStorage.getItem('auth_token') ||
            ''
        );
    } catch {
        return '';
    }
}

export async function searchDealers(
    params?: DealerSearchParams,
    token?: string
): Promise<DealerSearchResponse>;
export async function searchDealers(
    token: string,
    params?: DealerSearchParams
): Promise<DealerSearchResponse>;
export async function searchDealers(
    arg1?: string | DealerSearchParams,
    arg2?: string | DealerSearchParams
): Promise<DealerSearchResponse> {
    let token = '';
    let params: DealerSearchParams | undefined;

    if (typeof arg1 === 'string') {
        token = arg1;
        if (typeof arg2 === 'object') {
            params = arg2;
        }
    } else {
        params = arg1;
        if (typeof arg2 === 'string') {
            token = arg2;
        }
    }

    const authToken = getAuthToken(token);
    const query = new URLSearchParams();

    if (params?.keyword?.trim()) {
        query.set('keyword', params.keyword.trim());
    }

    if (params?.region?.trim()) {
        query.set('region', params.region.trim());
    }

    if (params?.assigned_sale_id) {
        query.set('assigned_sale_id', String(params.assigned_sale_id));
    }

    if (params?.customer_group?.trim()) {
        query.set('customer_group', params.customer_group.trim());
    }

    if (params?.status?.trim()) {
        query.set('status', params.status.trim());
    }

    if (params?.has_transactions !== undefined) {
        query.set('has_transactions', String(params.has_transactions));
    }

    if (params?.page) {
        query.set('page', String(params.page));
    }

    if (params?.page_size) {
        query.set('page_size', String(params.page_size));
    }

    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/v1/dealers/search${query.toString() ? `?${query.toString()}` : ''}`,
            {
                method: 'GET',
                headers,
            }
        );

        if (!response.ok) {
            let errorDetail = `Lỗi tải danh sách đại lý (Mã lỗi ${response.status})`;
            try {
                const errData = await response.json();
                if (errData && errData.detail) {
                    errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
                }
            } catch {
                // ignore
            }
            throw new Error(errorDetail);
        }

        return await response.json();
    } catch (err) {
        if (err instanceof Error) {
            throw err;
        }
        throw new Error('Lỗi kết nối máy chủ. Vui lòng kiểm tra đường truyền và thử lại.');
    }
}

export async function getDealerStats(
    token?: string
): Promise<DealerStats> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/v1/dealers/stats`,
            {
                method: 'GET',
                headers,
            }
        );

        if (!response.ok) {
            throw new Error(`Lỗi tải số liệu thống kê (Mã lỗi ${response.status})`);
        }

        return await response.json();
    } catch (err) {
        if (err instanceof Error) {
            throw err;
        }
        throw new Error('Không thể kết nối đến máy chủ để lấy số liệu thống kê.');
    }
}

export async function getDealerTransactions(
    dealerId: number,
    token?: string
): Promise<DealerTransactionsResponse> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/v1/dealers/${dealerId}/transactions`,
            {
                method: 'GET',
                headers,
            }
        );

        if (!response.ok) {
            let errorDetail = `Lỗi tải lịch sử giao dịch (Mã lỗi ${response.status})`;
            try {
                const errData = await response.json();
                if (errData && errData.detail) {
                    errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
                }
            } catch {
                // ignore
            }
            throw new Error(errorDetail);
        }

        return await response.json();
    } catch (err) {
        if (err instanceof Error) {
            throw err;
        }
        throw new Error('Không thể kết nối đến máy chủ để tải lịch sử giao dịch.');
    }
}

export async function getDealerFilters(
    token?: string
): Promise<DealerFiltersResponse> {
    const authToken = getAuthToken(token);

    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/v1/dealers/filters`,
            {
                method: 'GET',
                headers,
            }
        );

        if (!response.ok) {
            throw new Error(`Lỗi tải danh mục bộ lọc (Mã lỗi ${response.status})`);
        }

        return await response.json();
    } catch (err) {
        if (err instanceof Error) {
            throw err;
        }
        throw new Error('Không thể kết nối máy chủ để tải danh mục bộ lọc.');
    }
}

export interface CreateDealerPayload {
    code?: string;
    name: string;
    tax_code?: string | null;
    phone?: string;
    email?: string;
    address?: string;
    region: string;
    assigned_sale_id?: number | null;
    assigned_sale_name?: string | null;
    customer_group?: string;
    status?: string;
    transaction_count?: number | null;
    warehouse_id?: string | null;
    warehouse_name?: string | null;
}

export interface UpdateDealerPayload {
    code?: string;
    name?: string;
    tax_code?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    region?: string;
    assigned_sale_id?: number | null;
    customer_group?: string;
    status?: string;
    credit_limit?: number;
    max_debt_days?: number;
    transaction_count?: number | null;
    warehouse_id?: string | null;
    warehouse_name?: string | null;
}

export async function updateDealerProfile(
    dealerId: number,
    payload: UpdateDealerPayload,
    token?: string
): Promise<DealerSearchItem> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/dealers/${dealerId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let errorDetail = `Lỗi cập nhật hồ sơ đại lý (HTTP ${response.status})`;
        try {
            const errData = await response.json();
            if (errData && errData.detail) errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        } catch {}
        throw new Error(errorDetail);
    }
    return response.json();
}

export async function getAppliedPriceBookPreview(
    customerGroup: string,
    token?: string
): Promise<{ customer_group: string; applied_price_book: AppliedPriceBookInfo | null }> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/v1/dealers/price-book-preview?customer_group=${encodeURIComponent(customerGroup)}`,
            {
                method: 'GET',
                headers,
            }
        );

        if (response.ok) {
            return await response.json();
        }
    } catch {
        // ignore
    }
    return { customer_group: customerGroup, applied_price_book: null };
}

export async function createDealer(
    payload: CreateDealerPayload,
    token?: string
): Promise<DealerSearchItem> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/dealers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let errorDetail = `Lỗi tạo đại lý (HTTP ${response.status})`;
        try {
            const errData = await response.json();
            if (errData && errData.detail) {
                errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
            }
        } catch {
            // ignore
        }
        throw new Error(errorDetail);
    }

    return await response.json();
}

export async function updateDealerStatus(
    dealerId: number,
    status: string,
    reason?: string,
    token?: string
): Promise<DealerSearchItem> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const payload: { status: string; reason?: string } = { status };
    if (reason && reason.trim()) {
        payload.reason = reason.trim();
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/dealers/${dealerId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let errorDetail = `Lỗi cập nhật trạng thái đại lý (HTTP ${response.status})`;
        try {
            const errData = await response.json();
            if (errData && errData.detail) {
                errorDetail = errData.detail;
            }
        } catch {
            // ignore
        }
        throw new Error(errorDetail);
    }

    return response.json();
}

export interface AssignDealerPayload {
    assigned_sale_id: number;
    reason?: string;
}

export async function assignDealer(
    dealerId: number,
    payload: AssignDealerPayload,
    token?: string
): Promise<DealerSearchItem> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/dealers/${dealerId}/assign`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let errorDetail = `Lỗi phân công đại lý (HTTP ${response.status})`;
        try {
            const errData = await response.json();
            if (errData && errData.detail) errorDetail = errData.detail;
        } catch {}
        throw new Error(errorDetail);
    }
    return response.json();
}

export interface BulkAssignPayload {
    dealer_ids: number[];
    new_sale_id: number;
    reason?: string;
}

export async function bulkAssignDealers(
    payload: BulkAssignPayload,
    token?: string
): Promise<{ message: string; assigned_count: number; errors?: string[] }> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/dealers/bulk-assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let errorDetail = `Lỗi phân công hàng loạt (HTTP ${response.status})`;
        try {
            const errData = await response.json();
            if (errData && errData.detail) errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        } catch {}
        throw new Error(errorDetail);
    }
    return response.json();
}

export interface DealerHistoryItem {
    id: number;
    action_type: string;
    entity_id: string;
    old_values: string;
    new_values: string;
    reason: string;
    created_at: string;
    user_name: string;
}

export async function getDealerHistory(
    dealerCode: string,
    token?: string
): Promise<DealerHistoryItem[]> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/audit-logs/entity/Dealer/${dealerCode}`, {
        method: 'GET',
        headers,
    });

    if (!response.ok) {
        throw new Error('Lỗi tải lịch sử');
    }
    const data = await response.json();
    return data;
}

export interface UpdateCreditLimitPayload {
    credit_limit: number;
    max_debt_days: number;
    reason: string;
}

export async function updateDealerCreditLimit(
    dealerId: number,
    payload: UpdateCreditLimitPayload,
    token?: string
): Promise<any> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/orders/dealers/${dealerId}/credit-limit`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        let errorDetail = `Lỗi cập nhật hạn mức (HTTP ${response.status})`;
        try {
            const errData = await response.json();
            if (errData && errData.detail) errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        } catch {}
        throw new Error(errorDetail);
    }
    return response.json();
}

export async function deleteDealer(dealerId: number, token?: string): Promise<any> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/v1/dealers/${dealerId}`, {
        method: 'DELETE',
        headers,
    });

    if (!response.ok) {
        let errorDetail = `Lỗi xóa đại lý (HTTP ${response.status})`;
        try {
            const errData = await response.json();
            if (errData && errData.detail) errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
        } catch {}
        throw new Error(errorDetail);
    }
    return response.json();
}

