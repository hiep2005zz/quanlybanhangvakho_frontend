const API_BASE_URL = 'http://localhost:8000';

export interface DealerSearchItem {
    id: number;
    code: string;
    name: string;
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
}

export interface DealerSearchResponse {
    items: DealerSearchItem[];
    total: number;
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
}

const MOCK_DEALERS: DealerSearchItem[] = [
    {
        id: 1,
        code: 'DL-HN01',
        name: 'Đại lý Tuấn Phát',
        phone: '0987654321',
        email: 'tuanphat.dealer@gmail.com',
        address: 'Số 123 Cầu Giấy, Phường Dịch Vọng, Cầu Giấy, Hà Nội',
        region: 'Hà Nội',
        assigned_sale_id: 1,
        assigned_sale_name: 'Nguyễn Văn An',
        customer_group: 'dai_ly_cap_1',
        status: 'Đang hoạt động',
    },
    {
        id: 2,
        code: 'DL-HN02',
        name: 'Đại lý Minh Khang',
        phone: '0912345678',
        email: 'minhkhang.store@gmail.com',
        address: '45 Hoàng Hoa Thám, Phường Thụy Khuê, Tây Hồ, Hà Nội',
        region: 'Hà Nội',
        assigned_sale_id: 2,
        assigned_sale_name: 'Trần Thị Bình',
        customer_group: 'dai_ly_cap_2',
        status: 'Đang hoạt động',
    },
    {
        id: 3,
        code: 'DL-HCM01',
        name: 'Tổng kho Phân phối Thăng Long',
        phone: '0903123456',
        email: 'thanglong.dist@yahoo.com',
        address: '88 Nguyễn Văn Cừ, Phường 2, Quận 5, TP. Hồ Chí Minh',
        region: 'TP.HCM',
        assigned_sale_id: 1,
        assigned_sale_name: 'Nguyễn Văn An',
        customer_group: 'dai_ly_cap_1',
        status: 'Đang hoạt động',
    },
    {
        id: 4,
        code: 'DL-HCM02',
        name: 'Cửa hàng Bách Hóa Miền Nam',
        phone: '0938456789',
        email: 'miennam.bachhoa@gmail.com',
        address: '210 Lê Văn Sỹ, Phường 14, Quận 3, TP. Hồ Chí Minh',
        region: 'TP.HCM',
        assigned_sale_id: 3,
        assigned_sale_name: 'Lê Hoàng Nam',
        customer_group: 'dai_ly_cap_2',
        status: 'Tạm ngừng',
    },
    {
        id: 5,
        code: 'DL-DN01',
        name: 'Đại lý Điện máy Hải Châu',
        phone: '0977889900',
        email: 'dienmay.haichau@gmail.com',
        address: '76 Nguyễn Văn Linh, Phường Nam Dương, Hải Châu, Đà Nẵng',
        region: 'Đà Nẵng',
        assigned_sale_id: 2,
        assigned_sale_name: 'Trần Thị Bình',
        customer_group: 'dai_ly_cap_1',
        status: 'Đang hoạt động',
    },
    {
        id: 6,
        code: 'DL-HP01',
        name: 'Đại lý Bách Hóa Cảng',
        phone: '0966554433',
        email: 'bachhoa.hp@gmail.com',
        address: '15 Lạch Tray, Quận Ngô Quyền, Hải Phòng',
        region: 'Hải Phòng',
        assigned_sale_id: 3,
        assigned_sale_name: 'Lê Hoàng Nam',
        customer_group: 'khach_le',
        status: 'Đang hoạt động',
    },
    {
        id: 7,
        code: 'DL-CT01',
        name: 'Tạp hóa Hương Sen Miền Tây',
        phone: '0944112233',
        email: 'huongsen.cantho@gmail.com',
        address: '54 Đường 30 Tháng 4, Phường An Phú, Ninh Kiều, Cần Thơ',
        region: 'Cần Thơ',
        assigned_sale_id: 1,
        assigned_sale_name: 'Nguyễn Văn An',
        customer_group: 'dai_ly_cap_2',
        status: 'Đang hoạt động',
    },
    {
        id: 8,
        code: 'DL-HN03',
        name: 'Đại lý Hoàng Gia Tràng Tiền',
        phone: '0988776655',
        email: 'hoanggia.dealer@gmail.com',
        address: '12 Tràng Thi, Phường Hàng Trống, Hoàn Kiếm, Hà Nội',
        region: 'Hà Nội',
        assigned_sale_id: 2,
        assigned_sale_name: 'Trần Thị Bình',
        customer_group: 'dai_ly_cap_2',
        status: 'Tạm ngừng',
    },
];

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

function filterMockDealers(params?: DealerSearchParams): DealerSearchResponse {
    let list = [...MOCK_DEALERS];

    if (params?.keyword?.trim()) {
        const q = params.keyword.trim().toLowerCase();
        const qDigits = q.replace(/\D/g, '');
        list = list.filter((item) => {
            const codeMatch = item.code.toLowerCase().includes(q);
            const nameMatch = item.name.toLowerCase().includes(q);
            const phoneMatch = item.phone
                ? item.phone.toLowerCase().includes(q) || (qDigits.length >= 3 && item.phone.replace(/\D/g, '').includes(qDigits))
                : false;
            return codeMatch || nameMatch || phoneMatch;
        });
    }

    if (params?.region?.trim()) {
        const r = params.region.trim().toLowerCase();
        list = list.filter((item) => item.region.toLowerCase() === r);
    }

    if (params?.assigned_sale_id) {
        list = list.filter((item) => item.assigned_sale_id === params.assigned_sale_id);
    }

    if (params?.customer_group?.trim()) {
        const g = params.customer_group.trim().toLowerCase();
        list = list.filter((item) => item.customer_group?.toLowerCase() === g);
    }

    if (params?.status?.trim()) {
        const s = params.status.trim().toLowerCase();
        list = list.filter((item) => item.status?.toLowerCase() === s);
    }

    return {
        items: list,
        total: list.length,
    };
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

        if (response.ok) {
            return await response.json();
        }
    } catch {
        // Backend không khả dụng hoặc trả về lỗi, chuyển sang fallback dữ liệu mẫu
    }

    // Dự phòng fallback dữ liệu mẫu khi backend chưa sẵn sàng
    return filterMockDealers(params);
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

        if (response.ok) {
            return await response.json();
        }
    } catch {
        // Backend không khả dụng
    }

    // Fallback dữ liệu bộ lọc từ danh sách mẫu
    const uniqueRegions = Array.from(new Set(MOCK_DEALERS.map((d) => d.region))).filter(Boolean);
    const uniqueSalesMap = new Map<number, string>();
    MOCK_DEALERS.forEach((d) => {
        if (d.assigned_sale_id && d.assigned_sale_name) {
            uniqueSalesMap.set(d.assigned_sale_id, d.assigned_sale_name);
        }
    });
    const uniqueSales = Array.from(uniqueSalesMap.entries()).map(([id, name]) => ({ id, name }));

    return {
        regions: uniqueRegions,
        sales: uniqueSales,
        customer_groups: ['dai_ly_cap_1', 'dai_ly_cap_2', 'khach_le'],
        statuses: ['Đang hoạt động', 'Tạm ngừng'],
    };
}

export interface CreateDealerPayload {
    code?: string;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    region: string;
    assigned_sale_id?: number | null;
    assigned_sale_name?: string | null;
    customer_group?: string;
    status?: string;
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

        const result = await response.json();
        if (result && result.id) {
            MOCK_DEALERS.unshift(result);
            return result;
        }

    const newItem: DealerSearchItem = {
        id: Date.now(),
        code: payload.code?.trim() || `DL-${Math.floor(1000 + Math.random() * 9000)}`,
        name: payload.name.trim(),
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        address: payload.address?.trim() || null,
        region: payload.region.trim(),
        assigned_sale_id: payload.assigned_sale_id || null,
        assigned_sale_name: payload.assigned_sale_name || null,
        customer_group: payload.customer_group || 'dai_ly_cap_1',
        status: payload.status || 'Đang hoạt động',
    };

    MOCK_DEALERS.unshift(newItem);
    return newItem;
}

export async function updateDealerStatus(
    dealerId: number,
    status: string,
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

    const response = await fetch(`${API_BASE_URL}/api/v1/dealers/${dealerId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status }),
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
): Promise<{ message: string; errors?: string[] }> {
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
