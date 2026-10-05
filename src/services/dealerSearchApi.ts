const API_BASE_URL = 'http://localhost:8000';

export interface DealerSearchItem {
    id: number;
    code: string;
    name: string;
    phone?: string | null;
    email?: string | null;
    tax_id?: string | null;
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
    price_list?: string | null;
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
        assigned_sale_name: 'Nhân viên bán hàng',
        customer_group: 'Đại lý cấp 1',
        status: 'Đang hoạt động',
        current_debt: 0,
        credit_limit: 50000000,
        max_debt_days: 30,
        debt_status: 'Còn hạn',
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
        assigned_sale_name: 'Trưởng phòng',
        customer_group: 'Đại lý cấp 2',
        status: 'Đang hoạt động',
        current_debt: 0,
        credit_limit: 50000000,
        max_debt_days: 30,
        debt_status: 'Còn hạn',
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
        assigned_sale_name: 'Nhân viên bán hàng',
        customer_group: 'Đại lý cấp 1',
        status: 'Đang hoạt động',
        current_debt: 0,
        credit_limit: 50000000,
        max_debt_days: 30,
        debt_status: 'Còn hạn',
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
        assigned_sale_name: 'Nhân viên bán hàng',
        customer_group: 'Khách sỉ',
        status: 'Tạm ngừng',
        current_debt: 15000000,
        credit_limit: 50000000,
        max_debt_days: 30,
        debt_status: 'Hết hạn',
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
        assigned_sale_name: 'Trưởng phòng',
        customer_group: 'Đại lý cấp 1',
        status: 'Đang hoạt động',
        current_debt: 0,
        credit_limit: 50000000,
        max_debt_days: 30,
        debt_status: 'Còn hạn',
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
        assigned_sale_name: 'Nhân viên bán hàng',
        customer_group: 'Khách lẻ',
        status: 'Đang hoạt động',
        current_debt: 0,
        credit_limit: 50000000,
        max_debt_days: 30,
        debt_status: 'Còn hạn',
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
        assigned_sale_name: 'Nhân viên bán hàng',
        customer_group: 'Khách sỉ',
        status: 'Đang hoạt động',
        current_debt: 0,
        credit_limit: 50000000,
        max_debt_days: 30,
        debt_status: 'Còn hạn',
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
        assigned_sale_name: 'Trưởng phòng',
        customer_group: 'Đại lý cấp 2',
        status: 'Tạm ngừng',
        current_debt: 0,
        credit_limit: 50000000,
        max_debt_days: 30,
        debt_status: 'Còn hạn',
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
    const uniqueSales = [
        { id: 1, name: 'Nhân viên bán hàng' },
        { id: 2, name: 'Trưởng phòng' },
    ];

    return {
        regions: uniqueRegions,
        sales: uniqueSales,
        customer_groups: ['Đại lý cấp 1', 'Đại lý cấp 2', 'Khách sỉ', 'Khách lẻ'],
        statuses: ['Đang hoạt động', 'Tạm ngừng'],
    };
}

export interface CreateDealerPayload {
    code?: string;
    name: string;
    phone?: string;
    email?: string;
    tax_id?: string;
    address?: string;
    region: string;
    assigned_sale_id?: number | null;
    assigned_sale_name?: string | null;
    customer_group?: string;
    price_list?: string;
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

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/dealers`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            const result = await response.json();
            if (result && result.id) {
                MOCK_DEALERS.unshift(result);
                return result;
            }
        }
    } catch {
        // Dự phòng fallback khi backend chưa cấu hình endpoint POST /dealers
    }

    const newItem: DealerSearchItem = {
        id: Date.now(),
        code: payload.code?.trim() || `DL-${Math.floor(1000 + Math.random() * 9000)}`,
        name: payload.name.trim(),
        phone: payload.phone?.trim() || null,
        email: payload.email?.trim() || null,
        tax_id: payload.tax_id?.trim() || null,
        address: payload.address?.trim() || null,
        region: payload.region.trim(),
        assigned_sale_id: payload.assigned_sale_id || null,
        assigned_sale_name: payload.assigned_sale_name || null,
        customer_group: payload.customer_group || 'Đại lý cấp 1',
        status: payload.status || 'Đang hoạt động',
    };

    MOCK_DEALERS.unshift(newItem);
    return newItem;
}

export interface UpdateDealerPayload {
    code?: string;
    name?: string;
    phone?: string;
    email?: string;
    tax_id?: string;
    address?: string;
    region?: string;
    assigned_sale_id?: number | null;
    assigned_sale_name?: string | null;
    customer_group?: string;
    price_list?: string;
    status?: string;
}

export async function updateDealer(
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
        headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/dealers/${dealerId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            const result = await response.json();
            if (result && result.id) {
                const idx = MOCK_DEALERS.findIndex((d) => d.id === dealerId);
                if (idx !== -1) {
                    MOCK_DEALERS[idx] = { ...MOCK_DEALERS[idx], ...result };
                }
                return result;
            }
        } else {
            let errorDetail = `Lỗi cập nhật hồ sơ đại lý (HTTP ${response.status})`;
            try {
                const errData = await response.json();
                if (errData && errData.detail) errorDetail = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail);
            } catch {}
            throw new Error(errorDetail);
        }
    } catch (err) {
        if (err instanceof Error && !err.message.includes('Failed to fetch')) {
            throw err;
        }
        // Fallback mock
    }

    const idx = MOCK_DEALERS.findIndex((d) => d.id === dealerId);
    if (idx !== -1) {
        MOCK_DEALERS[idx] = {
            ...MOCK_DEALERS[idx],
            ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
            ...(payload.code !== undefined ? { code: payload.code.trim() } : {}),
            ...(payload.phone !== undefined ? { phone: payload.phone.trim() || null } : {}),
            ...(payload.email !== undefined ? { email: payload.email.trim() || null } : {}),
            ...(payload.tax_id !== undefined ? { tax_id: payload.tax_id.trim() || null } : {}),
            ...(payload.address !== undefined ? { address: payload.address.trim() || null } : {}),
            ...(payload.region !== undefined ? { region: payload.region.trim() } : {}),
            ...(payload.assigned_sale_id !== undefined ? { assigned_sale_id: payload.assigned_sale_id } : {}),
            ...(payload.assigned_sale_name !== undefined ? { assigned_sale_name: payload.assigned_sale_name } : {}),
            ...(payload.customer_group !== undefined ? { customer_group: payload.customer_group } : {}),
            ...(payload.price_list !== undefined ? { price_list: payload.price_list } : {}),
            ...(payload.status !== undefined ? { status: payload.status } : {}),
        };
        return MOCK_DEALERS[idx];
    }

    throw new Error('Không tìm thấy đại lý cần cập nhật');
}

export async function checkDealerTransactions(
    dealerId: number,
    token?: string
): Promise<{ dealer_id: number; has_transactions: boolean; transaction_count: number; can_delete: boolean; message: string }> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/dealers/${dealerId}/transaction-status`, {
            method: 'GET',
            headers,
        });

        if (response.ok) {
            return await response.json();
        }
    } catch {}

    // Fallback: đại lý mặc định có id <= 5 coi như đã có giao dịch
    return {
        dealer_id: dealerId,
        has_transactions: dealerId <= 5,
        transaction_count: dealerId <= 5 ? 2 : 0,
        can_delete: dealerId > 5,
        message: dealerId <= 5 ? 'Đại lý đã phát sinh giao dịch, không được xóa.' : 'Đại lý chưa phát sinh giao dịch.',
    };
}

export async function deleteDealer(
    dealerId: number,
    token?: string
): Promise<{ success: boolean; message: string }> {
    const authToken = getAuthToken(token);
    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
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

    const idx = MOCK_DEALERS.findIndex((d) => d.id === dealerId);
    if (idx !== -1) {
        MOCK_DEALERS.splice(idx, 1);
    }

    return await response.json();
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

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/dealers/${dealerId}/status`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status }),
        });

        if (response.ok) {
            const data = await response.json();
            const idx = MOCK_DEALERS.findIndex((d) => d.id === dealerId);
            if (idx !== -1) {
                MOCK_DEALERS[idx].status = status;
            }
            return data;
        } else {
            let errorDetail = `Lỗi cập nhật trạng thái đại lý (HTTP ${response.status})`;
            try {
                const errData = await response.json();
                if (errData && errData.detail) {
                    errorDetail = errData.detail;
                }
            } catch {}
            throw new Error(errorDetail);
        }
    } catch (err) {
        if (err instanceof Error && !err.message.includes('Failed to fetch')) {
            throw err;
        }
        // Fallback cập nhật bộ dữ liệu mẫu trong bộ nhớ
        const idx = MOCK_DEALERS.findIndex((d) => d.id === dealerId);
        if (idx !== -1) {
            MOCK_DEALERS[idx].status = status;
            return MOCK_DEALERS[idx];
        }
        throw err;
    }
}

export async function updateDealerDebtStatus(
    dealerId: number,
    debt_status: string,
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

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/dealers/${dealerId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ debt_status }),
        });

        if (response.ok) {
            const data = await response.json();
            const idx = MOCK_DEALERS.findIndex((d) => d.id === dealerId);
            if (idx !== -1) {
                MOCK_DEALERS[idx].debt_status = debt_status;
            }
            return data;
        }
    } catch {}

    const idx = MOCK_DEALERS.findIndex((d) => d.id === dealerId);
    if (idx !== -1) {
        MOCK_DEALERS[idx].debt_status = debt_status;
        return MOCK_DEALERS[idx];
    }
    throw new Error('Không tìm thấy đại lý cần cập nhật trạng thái công nợ');
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
