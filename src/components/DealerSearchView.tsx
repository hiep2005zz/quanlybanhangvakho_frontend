import { useEffect, useState, useCallback } from 'react';
import {
    DealerSearchItem,
    searchDealers,
    getDealerFilters,
    createDealer,
    CreateDealerPayload,
    updateDealer,
    UpdateDealerPayload,
    updateDealerStatus,
    updateDealerDebtStatus,
    deleteDealer,
    assignDealer,
    bulkAssignDealers,
    getDealerHistory,
    updateDealerCreditLimit,
} from '../services/dealerSearchApi';
import { User } from '../services/api';
import { emitStatusToast } from './StatusToast';
import './dealer-search.css';

const DEFAULT_CUSTOMER_GROUPS = [
    'Đại lý cấp 1',
    'Đại lý cấp 2',
    'Khách sỉ',
    'Khách lẻ',
];

const DEFAULT_STATUSES = [
    'Đang hoạt động',
    'Tạm ngừng',
];

const formatSaleName = (name?: string | null): string => {
    if (!name) return 'Chưa gán';
    const trimmed = name.trim();
    if (trimmed.includes('Trưởng') || trimmed.toLowerCase().includes('manager')) {
        return 'Trưởng phòng';
    }
    return 'Nhân viên bán hàng';
};

const formatDealerStatus = (status?: string | null): string => {
    if (!status) return 'Đang hoạt động';
    const lower = status.trim().toLowerCase();
    if (lower.includes('ngừng') || lower.includes('dừng') || lower === 'inactive') {
        return 'Tạm ngừng';
    }
    if (lower.includes('hoạt động') || lower === 'active') {
        return 'Đang hoạt động';
    }
    return status.trim();
};

const formatDebtStatus = (debtStatus?: string | null): string => {
    if (!debtStatus) return 'Còn hạn';
    const lower = debtStatus.trim().toLowerCase();
    if (lower.includes('hết') || lower.includes('quá') || lower.includes('vượt') || lower === 'expired') {
        return 'Hết hạn';
    }
    return 'Còn hạn';
};

const getPriceListByCustomerGroup = (group?: string | null): string => {
    const g = (group || '').trim().toLowerCase();
    if (g.includes('cấp 1') || g.includes('cap 1')) return 'Bảng giá đại lý cấp 1';
    if (g.includes('cấp 2') || g.includes('cap 2')) return 'Bảng giá đại lý cấp 2';
    if (g.includes('sỉ') || g.includes('si')) return 'Bảng giá khách sỉ';
    if (g.includes('lẻ') || g.includes('le')) return 'Bảng giá khách lẻ';
    return group ? `Bảng giá ${group}` : 'Bảng giá đại lý cấp 1';
};

export interface DealerSearchViewProps {
    currentUser?: User;
    token?: string;
    onBackToHome?: () => void;
}

export default function DealerSearchView({
    currentUser,
    token,
    onBackToHome,
}: DealerSearchViewProps) {
    const [dealers, setDealers] = useState<DealerSearchItem[]>([]);
    const [keyword, setKeyword] = useState('');
    const [region, setRegion] = useState('');
    const [customerGroup, setCustomerGroup] = useState('');
    const [assignedSaleId, setAssignedSaleId] = useState('');
    const [status, setStatus] = useState('');

    const [regions, setRegions] = useState<string[]>([]);
    const [sales, setSales] = useState<
        { id: number; name: string }[]
    >([]);
    const [customerGroups, setCustomerGroups] = useState<string[]>(DEFAULT_CUSTOMER_GROUPS);
    const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [onlyMyDealers, setOnlyMyDealers] = useState(false);

    // Trạng thái cho tính năng Thêm đại lý & khách hàng
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addFormData, setAddFormData] = useState({
        code: '',
        name: '',
        phone: '',
        tax_id: '',
        address: '',
        region: '',
        assigned_sale_id: '3',
        assigned_sale_name: 'Nhân viên bán hàng',
        customer_group: 'Đại lý cấp 1',
        status: 'Đang hoạt động',
        credit_limit: 50000000,
        current_debt: 0,
        debt_status: 'Còn hạn',
    });
    const [addError, setAddError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [togglingDebtId, setTogglingDebtId] = useState<number | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

    // Trạng thái cho Modal Xóa đại lý / Cảnh báo công nợ (Thay thế localhost confirm popup)
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        dealer: DealerSearchItem | null;
        hasDebt: boolean;
        formattedDebt: string;
    }>({
        isOpen: false,
        dealer: null,
        hasDebt: false,
        formattedDebt: '',
    });

    // Trạng thái cho tính năng Chỉnh sửa hồ sơ đại lý
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editTargetDealer, setEditTargetDealer] = useState<DealerSearchItem | null>(null);
    const [editFormData, setEditFormData] = useState({
        code: '',
        name: '',
        phone: '',
        email: '',
        tax_id: '',
        address: '',
        region: '',
        assigned_sale_id: '',
        customer_group: 'Đại lý cấp 1',
        status: 'Đang hoạt động',
    });
    const [editError, setEditError] = useState('');

    // Trạng thái cho tính năng Xem chi tiết hồ sơ đại lý
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [detailTargetDealer, setDetailTargetDealer] = useState<DealerSearchItem | null>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.dealer-dropdown-container')) {
                setOpenDropdownId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Ràng buộc phân quyền: Kế toán công nợ (accountant), Quản lý kinh doanh (sales_manager), Admin và Sales
    const rawRoles = currentUser?.roles && currentUser.roles.length > 0
        ? currentUser.roles
        : (currentUser?.role ? [currentUser.role] : []);
    
    // Kế toán công nợ, Quản lý KD, Admin, Sales đều có quyền quản lý hồ sơ đại lý
    const canManageDealers = rawRoles.some((r) => ['admin', 'sales_manager', 'sales', 'accountant'].includes(r))
        || Boolean(currentUser?.permissions && (currentUser.permissions.includes('user:manage') || currentUser.permissions.includes('*')))
        || !currentUser;
    const canAddDealer = canManageDealers;
    const canEditDealer = canManageDealers;
    const canManageStatus = rawRoles.some((r) => ['admin', 'sales_manager', 'accountant'].includes(r)) || rawRoles.includes('sales');

    // Ràng buộc push từ nhánh test trên git về (bảo toàn không đổi):
    const canAssignDealer = rawRoles.includes('admin') || rawRoles.includes('sales_manager');
    const canUpdateCreditLimit = rawRoles.includes('admin') || rawRoles.includes('sales_manager') || rawRoles.includes('accountant');

    // State cho SCRUM-48: Phân công
    const [selectedDealerIds, setSelectedDealerIds] = useState<number[]>([]);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
    const [assignTargetDealer, setAssignTargetDealer] = useState<DealerSearchItem | null>(null);
    const [newSaleIdForAssign, setNewSaleIdForAssign] = useState<string>('');
    const [assignReason, setAssignReason] = useState<string>('');

    // State cho SCRUM-48: Lịch sử phân công
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyTargetDealer, setHistoryTargetDealer] = useState<DealerSearchItem | null>(null);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const handleViewHistory = async (dealer: DealerSearchItem) => {
        if (!dealer.code) return;
        setHistoryTargetDealer(dealer);
        setIsHistoryModalOpen(true);
        setLoadingHistory(true);
        setHistoryLogs([]);
        try {
            const logs = await getDealerHistory(dealer.code, token);
            // Lọc các log liên quan đến công nợ hoặc phân công
            setHistoryLogs(logs.filter((l: any) => 
                l.action_type === 'DEALER_ASSIGNMENT' || 
                l.action_type === 'DEBT_LIMIT_CHANGE' ||
                l.action_type === 'DEALER_STATUS_CHANGE'
            ));
        } catch (err) {
            emitStatusToast({ title: 'Lỗi', message: 'Không thể tải lịch sử', type: 'error' });
        } finally {
            setLoadingHistory(false);
        }
    };

    const toggleSelectDealer = (id: number) => {
        setSelectedDealerIds((prev) => 
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleSelectAllDealers = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedDealerIds(dealers.map((d) => d.id));
        } else {
            setSelectedDealerIds([]);
        }
    };

    // State cho SCRUM: Cập nhật hạn mức công nợ
    const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
    const [creditTargetDealer, setCreditTargetDealer] = useState<DealerSearchItem | null>(null);
    const [creditLimitData, setCreditLimitData] = useState<{
        credit_limit: number | string;
        max_debt_days: number | string;
        reason: string;
    }>({
        credit_limit: 50000000,
        max_debt_days: 30,
        reason: '',
    });

    const handleOpenCreditModal = (dealer: DealerSearchItem) => {
        setCreditTargetDealer(dealer);
        setCreditLimitData({
            credit_limit: dealer.credit_limit ?? 50000000,
            max_debt_days: dealer.max_debt_days ?? 30,
            reason: '',
        });
        setIsCreditModalOpen(true);
    };

    const handleCreditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!creditTargetDealer) return;

        setIsSubmitting(true);
        try {
            await updateDealerCreditLimit(creditTargetDealer.id, {
                credit_limit: Number(creditLimitData.credit_limit),
                max_debt_days: Number(creditLimitData.max_debt_days),
                reason: creditLimitData.reason,
            }, token);
            emitStatusToast({ title: 'Thành công', message: 'Cập nhật hạn mức công nợ thành công', type: 'success' });
            setIsCreditModalOpen(false);
            handleSearch();
        } catch (err) {
            emitStatusToast({ title: 'Lỗi', message: err instanceof Error ? err.message : 'Có lỗi xảy ra', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAssignSubmit = async () => {
        if (!newSaleIdForAssign) {
            emitStatusToast({ title: 'Lỗi', message: 'Vui lòng chọn nhân viên kinh doanh mới.', type: 'error' });
            return;
        }
        if (assignTargetDealer && assignTargetDealer.assigned_sale_id === Number(newSaleIdForAssign)) {
            emitStatusToast({ title: 'Cảnh báo', message: 'Nhân viên này đang phụ trách đại lý.', type: 'warning' });
            return;
        }
        
        setIsSubmitting(true);
        try {
            if (isBulkAssignModalOpen) {
                const res = await bulkAssignDealers({
                    dealer_ids: selectedDealerIds,
                    new_sale_id: Number(newSaleIdForAssign),
                    reason: assignReason
                }, token);
                emitStatusToast({ title: 'Thành công', message: res.message, type: 'success' });
                setSelectedDealerIds([]);
                setIsBulkAssignModalOpen(false);
            } else if (assignTargetDealer) {
                await assignDealer(assignTargetDealer.id, {
                    assigned_sale_id: Number(newSaleIdForAssign),
                    reason: assignReason
                }, token);
                emitStatusToast({ title: 'Thành công', message: `Đã chuyển giao đại lý ${assignTargetDealer.name}`, type: 'success' });
                setIsAssignModalOpen(false);
            }
            handleSearch();
        } catch (err) {
            emitStatusToast({ title: 'Lỗi chuyển giao', message: err instanceof Error ? err.message : 'Có lỗi xảy ra', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (dealer: DealerSearchItem) => {
        if (togglingId === dealer.id) return;

        // Phân quyền: Nhân viên kinh doanh (sales) chỉ được đổi trạng thái đại lý do mình trực tiếp phụ trách
        // Kế toán công nợ, Quản lý KD, Admin có quyền với tất cả đại lý
        const isSalesOnly = rawRoles.includes('sales') && !rawRoles.includes('admin') && !rawRoles.includes('sales_manager') && !rawRoles.includes('accountant');
        const isMyDealer = Boolean(
            currentUser?.id &&
            (dealer.assigned_sale_id === currentUser.id ||
             (dealer.assigned_sale_name && currentUser.full_name && dealer.assigned_sale_name.trim().toLowerCase() === currentUser.full_name.trim().toLowerCase()))
        );

        if (isSalesOnly && !isMyDealer) {
            emitStatusToast({
                title: 'Thông báo quyền hạn',
                message: 'Bạn chỉ có quyền thay đổi trạng thái của đại lý/khách hàng do bạn trực tiếp phụ trách.',
                type: 'warning',
            });
            return;
        }

        const isCurrentInactive = (dealer.status || '').toLowerCase().includes('ngừng')
            || (dealer.status || '').toLowerCase().includes('dừng')
            || (dealer.status || '').toLowerCase().includes('inactive');
        const nextStatus = isCurrentInactive ? 'Đang hoạt động' : 'Tạm ngừng';

        setTogglingId(dealer.id);

        // Chuyển đổi trạng thái tức thì trên giao diện (1-click)
        setDealers((prev) =>
            prev.map((d) => (d.id === dealer.id ? { ...d, status: nextStatus } : d))
        );

        try {
            await updateDealerStatus(dealer.id, nextStatus, token);
            emitStatusToast({
                title: 'Trạng thái đại lý',
                message: `Đã cập nhật trạng thái đại lý "${dealer.name}" sang "${nextStatus}".`,
                type: 'success',
            });
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : 'Có lỗi khi cập nhật trạng thái đại lý';
            if (errMsg.includes('Không tìm thấy') || errMsg.includes('404')) {
                // Đại lý mới tạo trong phiên, cập nhật thành công trên giao diện
                emitStatusToast({
                    title: 'Trạng thái đại lý',
                    message: `Đã cập nhật trạng thái đại lý "${dealer.name}" sang "${nextStatus}".`,
                    type: 'success',
                });
                return;
            }
            // Khôi phục lại trạng thái cũ nếu lỗi phân quyền hoặc lỗi khác
            setDealers((prev) =>
                prev.map((d) => (d.id === dealer.id ? { ...d, status: dealer.status } : d))
            );
            const isConnErr = errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network');
            emitStatusToast({
                title: isConnErr ? 'Lỗi kết nối máy chủ' : 'Thông báo trạng thái',
                message: isConnErr ? 'Không thể kết nối đến máy chủ backend (port 8000). Vui lòng thử lại.' : errMsg,
                type: 'warning',
            });
        } finally {
            setTogglingId(null);
        }
    };

    const handleToggleDebtStatus = async (dealer: DealerSearchItem) => {
        if (togglingDebtId === dealer.id) return;

        const currentDebtSt = formatDebtStatus(dealer.debt_status);
        const nextDebtSt = currentDebtSt === 'Còn hạn' ? 'Hết hạn' : 'Còn hạn';

        setTogglingDebtId(dealer.id);

        // Chuyển đổi trạng thái công nợ tức thì trên giao diện (1-click)
        setDealers((prev) =>
            prev.map((d) => (d.id === dealer.id ? { ...d, debt_status: nextDebtSt } : d))
        );

        try {
            await updateDealerDebtStatus(dealer.id, nextDebtSt, token);
            emitStatusToast({
                title: 'Trạng thái công nợ',
                message: `Đã cập nhật trạng thái công nợ của đại lý "${dealer.name}" sang "${nextDebtSt}".`,
                type: 'success',
            });
        } catch (err) {
            setDealers((prev) =>
                prev.map((d) => (d.id === dealer.id ? { ...d, debt_status: dealer.debt_status } : d))
            );
            const errMsg = err instanceof Error ? err.message : 'Có lỗi khi cập nhật trạng thái công nợ';
            emitStatusToast({
                title: 'Thông báo',
                message: errMsg,
                type: 'warning',
            });
        } finally {
            setTogglingDebtId(null);
        }
    };

    const handleOpenAddModal = () => {
        if (!canAddDealer) {
            emitStatusToast({
                title: 'Thông báo quyền hạn',
                message: 'Bạn không có quyền thêm hồ sơ đại lý.',
                type: 'warning',
            });
            return;
        }

        let defaultSaleName = 'Nhân viên bán hàng';
        const userRoles = currentUser?.roles && currentUser.roles.length > 0
            ? currentUser.roles
            : (currentUser?.role ? [currentUser.role] : []);
        if (userRoles.includes('sales_manager')) {
            defaultSaleName = 'Trưởng phòng';
        }

        setAddFormData({
            code: `DL-${Math.floor(1000 + Math.random() * 9000)}`,
            name: '',
            phone: '',
            tax_id: '',
            address: '',
            region: regions.includes('Hà Nội') ? 'Hà Nội' : (regions[0] || 'Hà Nội'),
            assigned_sale_id: defaultSaleName === 'Trưởng phòng' ? '2' : '3',
            assigned_sale_name: defaultSaleName,
            customer_group: customerGroups[0] || 'Đại lý cấp 1',
            status: 'Đang hoạt động',
            credit_limit: 50000000,
            current_debt: 0,
            debt_status: 'Còn hạn',
        });
        setAddError('');
        setIsAddModalOpen(true);
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError('');

        // 1. Ràng buộc phân quyền
        if (!canAddDealer) {
            setAddError('Bạn không có quyền thêm hồ sơ đại lý.');
            return;
        }

        // 2. Ràng buộc Tên đại lý / Khách hàng
        const trimmedName = addFormData.name.trim();
        if (!trimmedName) {
            setAddError('Vui lòng nhập tên đại lý hoặc khách hàng.');
            return;
        }
        if (trimmedName.length < 2) {
            setAddError('Tên đại lý / khách hàng quá ngắn (tối thiểu 2 ký tự).');
            return;
        }
        if (/^\d+$/.test(trimmedName)) {
            setAddError('Tên không hợp lệ! Tên đại lý / khách hàng không được chỉ bao gồm chữ số.');
            return;
        }

        // 3. Ràng buộc Mã đại lý / Khách hàng (In hoa, không trùng lặp)
        const cleanCode = (addFormData.code.trim() || `DL-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
        if (cleanCode.length < 3) {
            setAddError('Mã đại lý / khách hàng quá ngắn (tối thiểu 3 ký tự, ví dụ DL-01).');
            return;
        }
        const isDuplicateCode = dealers.some(
            (d) => d.code && d.code.trim().toUpperCase() === cleanCode
        );
        if (isDuplicateCode) {
            setAddError(`Mã đại lý/khách hàng "${cleanCode}" đã tồn tại trên hệ thống! Vui lòng nhập mã khác.`);
            return;
        }

        // 4. Ràng buộc Số điện thoại (Định dạng VN và không trùng lặp)
        const trimmedPhone = addFormData.phone.trim();
        if (!trimmedPhone) {
            setAddError('Vui lòng nhập số điện thoại liên hệ.');
            return;
        }

        let cleanPhone = trimmedPhone.replace(/[\s\.\-\(\)]/g, '');
        if (cleanPhone.startsWith('+84')) {
            cleanPhone = '0' + cleanPhone.slice(3);
        } else if (cleanPhone.startsWith('84') && cleanPhone.length === 11) {
            cleanPhone = '0' + cleanPhone.slice(2);
        }

        const vnPhoneRegex = /^(0[3|5|7|8|9][0-9]{8}|02[0-9]{9})$/;
        if (!vnPhoneRegex.test(cleanPhone)) {
            setAddError('Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 chữ số (bắt đầu bằng 03, 05, 07, 08, 09, ví dụ 0987654321).');
            return;
        }

        const isDuplicatePhone = dealers.some((d) => {
            if (!d.phone) return false;
            let p = d.phone.replace(/[\s\.\-\(\)]/g, '');
            if (p.startsWith('+84')) p = '0' + p.slice(3);
            else if (p.startsWith('84') && p.length === 11) p = '0' + p.slice(2);
            return p === cleanPhone;
        });
        if (isDuplicatePhone) {
            setAddError(`Số điện thoại "${cleanPhone}" đã được sử dụng cho một đại lý/khách hàng khác!`);
            return;
        }

        // 5. Ràng buộc Khu vực
        const trimmedRegion = addFormData.region.trim();
        if (!trimmedRegion) {
            setAddError('Vui lòng chọn hoặc nhập khu vực cho đại lý.');
            return;
        }

        // 6. Ràng buộc Địa chỉ (Bắt buộc để hỗ trợ chỉ đường Google Maps)
        const trimmedAddress = addFormData.address.trim();
        if (!trimmedAddress) {
            setAddError('Vui lòng nhập địa chỉ cụ thể để phục vụ việc định vị và chỉ đường.');
            return;
        }
        if (trimmedAddress.length < 5) {
            setAddError('Địa chỉ quá ngắn (tối thiểu 5 ký tự). Vui lòng nhập rõ số nhà/đường, phường, quận/huyện.');
            return;
        }

        // 7. Ràng buộc người phụ trách
        const saleName = addFormData.assigned_sale_name || 'Nhân viên bán hàng';
        const saleId = saleName === 'Trưởng phòng' ? 2 : 3;

        setIsSubmitting(true);
        try {
            const payload: CreateDealerPayload = {
                code: cleanCode,
                name: trimmedName,
                phone: cleanPhone,
                tax_id: addFormData.tax_id.trim() || undefined,
                address: trimmedAddress,
                region: trimmedRegion,
                assigned_sale_id: saleId,
                assigned_sale_name: saleName,
                customer_group: addFormData.customer_group || 'Đại lý cấp 1',
                price_list: getPriceListByCustomerGroup(addFormData.customer_group),
                status: addFormData.status || 'Đang hoạt động',
                credit_limit: Number(addFormData.credit_limit) || 50000000,
                current_debt: Number(addFormData.current_debt) || 0,
                debt_status: addFormData.debt_status || 'Còn hạn',
            };

            const created = await createDealer(payload, token);
            const savedCurrentDebt = Number(addFormData.current_debt) || 0;
            const itemWithDebt: DealerSearchItem = {
                ...created,
                current_debt: savedCurrentDebt,
                debt_status: addFormData.debt_status || (savedCurrentDebt > 0 ? 'Còn hạn' : 'Còn hạn'),
                credit_limit: Number(addFormData.credit_limit) || 50000000,
            };
            setDealers((prev) => [itemWithDebt, ...prev.filter((d) => d.id !== itemWithDebt.id)]);

            emitStatusToast({
                title: 'Hồ sơ đại lý',
                message: `Đã thêm thành công hồ sơ đại lý "${created.name}" (${created.code}).`,
                type: 'success',
            });

            setIsAddModalOpen(false);
        } catch (err) {
            setAddError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi thêm đại lý');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Chức năng Chỉnh sửa hồ sơ đại lý
    const handleOpenEditModal = (dealer: DealerSearchItem) => {
        if (!canEditDealer) {
            emitStatusToast({
                title: 'Thông báo quyền hạn',
                message: 'Bạn không có quyền chỉnh sửa hồ sơ đại lý.',
                type: 'warning',
            });
            return;
        }

        setEditTargetDealer(dealer);
        setEditFormData({
            code: dealer.code || '',
            name: dealer.name || '',
            phone: dealer.phone || '',
            email: dealer.email || '',
            tax_id: dealer.tax_id || '',
            address: dealer.address || '',
            region: (dealer.region && dealer.region.trim().toLowerCase() !== 'ha noi') ? dealer.region : (regions.includes('Hà Nội') ? 'Hà Nội' : (regions[0] || 'Hà Nội')),
            assigned_sale_id: dealer.assigned_sale_id ? String(dealer.assigned_sale_id) : '',
            customer_group: (dealer.customer_group && (dealer.customer_group.toLowerCase() === 'dai ly cap 1' || dealer.customer_group.toLowerCase() === 'dai ly 1')) ? 'Đại lý cấp 1' : (dealer.customer_group || customerGroups[0] || 'Đại lý cấp 1'),
            status: formatDealerStatus(dealer.status),
        });
        setEditError('');
        setIsEditModalOpen(true);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTargetDealer) return;
        setEditError('');

        if (!canEditDealer) {
            setEditError('Bạn không có quyền chỉnh sửa hồ sơ đại lý.');
            return;
        }

        const trimmedName = editFormData.name.trim();
        if (!trimmedName || trimmedName.length < 2) {
            setEditError('Tên đại lý quá ngắn (tối thiểu 2 ký tự).');
            return;
        }
        if (/^\d+$/.test(trimmedName)) {
            setEditError('Tên không hợp lệ! Tên đại lý không được chỉ bao gồm chữ số.');
            return;
        }

        const trimmedPhone = editFormData.phone.trim();
        if (!trimmedPhone) {
            setEditError('Vui lòng nhập số điện thoại liên hệ.');
            return;
        }

        let cleanPhone = trimmedPhone.replace(/[\s\.\-\(\)]/g, '');
        if (cleanPhone.startsWith('+84')) {
            cleanPhone = '0' + cleanPhone.slice(3);
        } else if (cleanPhone.startsWith('84') && cleanPhone.length === 11) {
            cleanPhone = '0' + cleanPhone.slice(2);
        }

        const vnPhoneRegex = /^(0[3|5|7|8|9][0-9]{8}|02[0-9]{9})$/;
        if (!vnPhoneRegex.test(cleanPhone)) {
            setEditError('Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 chữ số (bắt đầu bằng 03, 05, 07, 08, 09).');
            return;
        }

        const isDuplicatePhone = dealers.some((d) => {
            if (d.id === editTargetDealer.id || !d.phone) return false;
            let p = d.phone.replace(/[\s\.\-\(\)]/g, '');
            if (p.startsWith('+84')) p = '0' + p.slice(3);
            else if (p.startsWith('84') && p.length === 11) p = '0' + p.slice(2);
            return p === cleanPhone;
        });
        if (isDuplicatePhone) {
            setEditError(`Số điện thoại "${cleanPhone}" đã được sử dụng cho một đại lý khác!`);
            return;
        }

        const trimmedRegion = editFormData.region.trim();
        if (!trimmedRegion) {
            setEditError('Vui lòng chọn hoặc nhập khu vực cho đại lý.');
            return;
        }

        const trimmedAddress = editFormData.address.trim();
        if (!trimmedAddress || trimmedAddress.length < 5) {
            setEditError('Địa chỉ quá ngắn (tối thiểu 5 ký tự).');
            return;
        }

        const selectedSale = sales.find((s) => String(s.id) === String(editFormData.assigned_sale_id));
        const saleName = selectedSale ? selectedSale.name : (editTargetDealer.assigned_sale_name || null);

        setIsSubmitting(true);
        try {
            const payload: UpdateDealerPayload = {
                name: trimmedName,
                phone: cleanPhone,
                email: editFormData.email.trim() || undefined,
                tax_id: editFormData.tax_id.trim() || undefined,
                address: trimmedAddress,
                region: trimmedRegion,
                assigned_sale_id: editFormData.assigned_sale_id ? Number(editFormData.assigned_sale_id) : undefined,
                assigned_sale_name: saleName || undefined,
                customer_group: editFormData.customer_group,
                price_list: getPriceListByCustomerGroup(editFormData.customer_group),
                status: editFormData.status,
            };

            const updated = await updateDealer(editTargetDealer.id, payload, token);
            setDealers((prev) => prev.map((d) => (d.id === editTargetDealer.id ? { ...d, ...updated } : d)));

            emitStatusToast({
                title: 'Hồ sơ đại lý',
                message: `Đã cập nhật thành công hồ sơ đại lý "${updated.name}".`,
                type: 'success',
            });
            setIsEditModalOpen(false);
        } catch (err) {
            setEditError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi cập nhật hồ sơ');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Chức năng Xem chi tiết hồ sơ đại lý
    const handleOpenDetailModal = (dealer: DealerSearchItem) => {
        setDetailTargetDealer(dealer);
        setIsDetailModalOpen(true);
    };

    // Chức năng Xóa hồ sơ đại lý (Mở Custom Modal thay vì window.confirm localhost)
    const handleDeleteDealer = (dealer: DealerSearchItem) => {
        if (!canAddDealer) {
            emitStatusToast({
                title: 'Thông báo quyền hạn',
                message: 'Bạn không có quyền xóa hồ sơ đại lý.',
                type: 'warning',
            });
            return;
        }

        const currentDebt = dealer.current_debt ?? 0;
        const hasDebt = currentDebt > 0 || formatDebtStatus(dealer.debt_status) === 'Hết hạn';
        const formattedDebt = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(currentDebt);

        setDeleteModal({
            isOpen: true,
            dealer,
            hasDebt,
            formattedDebt,
        });
    };

    const handleConfirmDelete = async () => {
        if (!deleteModal.dealer) return;
        const target = deleteModal.dealer;
        setDeleteModal((prev) => ({ ...prev, isOpen: false }));

        try {
            setTogglingId(target.id);
            await deleteDealer(target.id, token);
            setDealers((prev) => prev.filter((d) => d.id !== target.id));
            emitStatusToast({
                title: 'Thành công',
                message: `Đã xóa thành công hồ sơ đại lý "${target.name}" (đã hết công nợ).`,
                type: 'success',
            });
        } catch (err) {
            emitStatusToast({
                title: 'Lỗi',
                message: err instanceof Error ? err.message : 'Có lỗi khi xóa đại lý',
                type: 'error',
            });
        } finally {
            setTogglingId(null);
        }
    };

    const handleStopTransaction = async () => {
        if (!deleteModal.dealer) return;
        const target = deleteModal.dealer;
        setDeleteModal((prev) => ({ ...prev, isOpen: false }));

        const isAlreadyStopped = (target.status || '').toLowerCase().includes('ngừng') || (target.status || '').toLowerCase().includes('dừng');
        if (isAlreadyStopped) {
            emitStatusToast({
                title: 'Trạng thái đại lý',
                message: `Đại lý "${target.name}" hiện đã ở trạng thái Tạm ngừng.`,
                type: 'info',
            });
        } else {
            await handleToggleStatus(target);
        }
    };

    // Chức năng Xuất danh sách khách hàng chuẩn hóa (CSV/Excel)
    const handleExportStandardList = () => {
        if (!dealers || dealers.length === 0) {
            emitStatusToast({
                title: 'Thông báo',
                message: 'Không có dữ liệu đại lý để xuất danh sách.',
                type: 'warning',
            });
            return;
        }

        const headers = [
            'Mã đại lý',
            'Tên đại lý',
            'Mã số thuế',
            'Nhóm khách hàng',
            'Bảng giá áp dụng',
            'Số điện thoại',
            'Email',
            'Địa chỉ',
            'Khu vực',
            'Người phụ trách',
            'Hạn mức công nợ (VNĐ)',
            'Số ngày nợ tối đa (ngày)',
            'Dư nợ hiện tại (VNĐ)',
            'Trạng thái công nợ',
            'Trạng thái hoạt động',
        ];

        const rows = dealers.map((d) => [
            `"${(d.code || '').replace(/"/g, '""')}"`,
            `"${(d.name || '').replace(/"/g, '""')}"`,
            `"${(d.tax_id || '').replace(/"/g, '""')}"`,
            `"${(d.customer_group || '').replace(/"/g, '""')}"`,
            `"${(d.price_list || getPriceListByCustomerGroup(d.customer_group)).replace(/"/g, '""')}"`,
            `"${(d.phone || '').replace(/"/g, '""')}"`,
            `"${(d.email || '').replace(/"/g, '""')}"`,
            `"${(d.address || '').replace(/"/g, '""')}"`,
            `"${((d.region && d.region.trim().toLowerCase() === 'ha noi') ? 'Hà Nội' : (d.region || '')).replace(/"/g, '""')}"`,
            `"${(formatSaleName(d.assigned_sale_name) || '').replace(/"/g, '""')}"`,
            d.credit_limit != null ? d.credit_limit : 50000000,
            d.max_debt_days != null ? d.max_debt_days : 30,
            d.current_debt != null ? d.current_debt : 0,
            `"${(d.debt_status || 'Bình thường').replace(/"/g, '""')}"`,
            `"${formatDealerStatus(d.status).replace(/"/g, '""')}"`,
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `Danh_sach_ho_so_dai_ly_chuan_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        emitStatusToast({
            title: 'Xuất danh sách chuẩn',
            message: `Đã xuất ${dealers.length} hồ sơ đại lý chuẩn hóa thành công!`,
            type: 'success',
        });
    };

    async function loadFilters() {
        try {
            const data = await getDealerFilters(token);

            if (data.regions && data.regions.length > 0) {
                const cleanedRegions = Array.from(
                    new Set(
                        data.regions
                            .map((r) => {
                                const trim = (r || '').trim();
                                if (trim.toLowerCase() === 'ha noi') return 'Hà Nội';
                                return trim;
                            })
                            .filter(Boolean)
                    )
                );
                setRegions(cleanedRegions.length > 0 ? cleanedRegions : ['Hà Nội', 'TP. HCM', 'Hải Phòng', 'Đà Nẵng']);
            } else {
                setRegions(['Hà Nội', 'TP. HCM', 'Hải Phòng', 'Đà Nẵng']);
            }

            const standardizedSales = [
                { id: 1, name: 'Nhân viên bán hàng' },
                { id: 2, name: 'Trưởng phòng' },
            ];
            setSales(standardizedSales);

            if (data.customer_groups && data.customer_groups.length > 0) {
                const cleanedGroups = Array.from(
                    new Set(
                        data.customer_groups
                            .map((g) => {
                                const trim = (g || '').trim();
                                if (trim.toLowerCase() === 'dai ly cap 1' || trim.toLowerCase() === 'dai ly 1') return 'Đại lý cấp 1';
                                if (trim.toLowerCase() === 'dai ly cap 2' || trim.toLowerCase() === 'dai ly 2') return 'Đại lý cấp 2';
                                return trim;
                            })
                            .filter(Boolean)
                    )
                );
                DEFAULT_CUSTOMER_GROUPS.forEach((dg) => {
                    if (!cleanedGroups.includes(dg)) cleanedGroups.push(dg);
                });
                setCustomerGroups(cleanedGroups);
            }

            if (data.statuses && data.statuses.length > 0) {
                const cleanedStatuses = Array.from(
                    new Set(
                        data.statuses
                            .map((st) => formatDealerStatus(st))
                            .filter(Boolean)
                    )
                );
                DEFAULT_STATUSES.forEach((ds) => {
                    if (!cleanedStatuses.includes(ds)) cleanedStatuses.push(ds);
                });
                setStatuses(cleanedStatuses);
            }
        } catch (err) {
            console.error(err);
        }
    }

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isAddModalOpen) {
                setIsAddModalOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAddModalOpen]);

    const handleSearch = useCallback(async (overrides?: {
        keyword?: string;
        region?: string;
        assignedSaleId?: string;
        customerGroup?: string;
        status?: string;
        onlyMine?: boolean;
    }) => {
        try {
            setLoading(true);
            setError('');

            const searchKw = overrides?.keyword !== undefined ? overrides.keyword : keyword;
            const searchRegion = overrides?.region !== undefined ? overrides.region : region;
            const searchSaleId = overrides?.assignedSaleId !== undefined ? overrides.assignedSaleId : assignedSaleId;
            const searchGroup = overrides?.customerGroup !== undefined ? overrides.customerGroup : customerGroup;
            const searchStatus = overrides?.status !== undefined ? overrides.status : status;
            const isOnlyMine = overrides?.onlyMine !== undefined ? overrides.onlyMine : onlyMyDealers;

            const effectiveSaleId = isOnlyMine && currentUser?.id
                ? currentUser.id
                : (searchSaleId ? Number(searchSaleId) : undefined);

            const data = await searchDealers(
                {
                    keyword: searchKw.trim() || undefined,
                    region: searchRegion || undefined,
                    assigned_sale_id: effectiveSaleId,
                    customer_group: searchGroup || undefined,
                    status: searchStatus || undefined,
                },
                token
            );

            let items = data.items || [];

            // Lọc client-side bổ trợ nếu backend chưa filter một số trường
            if (searchGroup) {
                const normSearchGroup = (searchGroup.toLowerCase() === 'dai ly cap 1' || searchGroup.toLowerCase() === 'dai ly 1') ? 'đại lý cấp 1' : searchGroup.toLowerCase();
                items = items.filter(
                    (d) => {
                        const dg = (d.customer_group || '').toLowerCase();
                        const normDg = (dg === 'dai ly cap 1' || dg === 'dai ly 1') ? 'đại lý cấp 1' : dg;
                        return normDg === normSearchGroup;
                    }
                );
            }
            if (searchStatus) {
                const normSearchStatus = formatDealerStatus(searchStatus).toLowerCase();
                items = items.filter(
                    (d) => formatDealerStatus(d.status).toLowerCase() === normSearchStatus
                );
            }
            if (isOnlyMine && currentUser) {
                const myName = (currentUser.full_name || currentUser.username || '').toLowerCase();
                items = items.filter(
                    (d) => (currentUser.id && d.assigned_sale_id === currentUser.id) ||
                        (d.assigned_sale_name && d.assigned_sale_name.toLowerCase().includes(myName))
                );
            }

            setDealers(items);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Có lỗi xảy ra khi tìm kiếm'
            );
        } finally {
            setLoading(false);
        }
    }, [keyword, region, assignedSaleId, customerGroup, status, onlyMyDealers, token, currentUser]);

    async function handleReset() {
        setKeyword('');
        setRegion('');
        setCustomerGroup('');
        setAssignedSaleId('');
        setStatus('');
        setOnlyMyDealers(false);

        try {
            setLoading(true);
            setError('');

            const data = await searchDealers(undefined, token);
            setDealers(data.items || []);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Không thể tải danh sách đại lý'
            );
        } finally {
            setLoading(false);
        }
    }

    const handleClearKeyword = () => {
        setKeyword('');
        handleSearch({ keyword: '' });
    };

    const toggleOnlyMyDealers = () => {
        const nextState = !onlyMyDealers;
        setOnlyMyDealers(nextState);
        handleSearch({ onlyMine: nextState });
    };

    useEffect(() => {
        loadFilters();
        handleSearch();
    }, []);

    return (
        <div className="dealer-search-page">
            <div className="dealer-search-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        {onBackToHome && (
                            <button
                                type="button"
                                onClick={onBackToHome}
                                className="dealer-back-btn"
                                title="Quay lại Kho hàng"
                            >
                                <span>Về kho hàng</span>
                            </button>
                        )}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <h2>Quản lý và tra cứu đại lý</h2>
                                <span className="dealer-standard-badge">Danh sách khách hàng chuẩn hóa</span>
                            </div>
                            <p>
                                Quản lý hồ sơ đại lý & khách hàng tập trung toàn hệ thống phục vụ theo dõi công nợ, phân công chăm sóc và bán hàng thống nhất thay vì mỗi nhân viên giữ một file riêng
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={handleExportStandardList}
                            className="dealer-btn-export"
                            title="Xuất file danh sách khách hàng chuẩn hóa (CSV/Excel) để toàn công ty dùng chung một nguồn dữ liệu"
                        >
                            <span>Xuất danh sách chuẩn (CSV/Excel)</span>
                        </button>
                        {currentUser && (
                            <button
                                type="button"
                                onClick={toggleOnlyMyDealers}
                                className={`dealer-my-route-toggle ${onlyMyDealers ? 'active' : ''}`}
                                title="Lọc nhanh danh sách đại lý thuộc tuyến do bạn phụ trách"
                            >
                                <span>{onlyMyDealers ? 'Đang lọc: Tuyến của tôi' : 'Xem tuyến của tôi'}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleOpenAddModal}
                            className={`dealer-btn-add ${!canAddDealer ? 'disabled' : ''}`}
                            disabled={!canAddDealer}
                            title={
                                canAddDealer
                                    ? 'Thêm mới hồ sơ đại lý vào hệ thống chuẩn'
                                    : 'Bạn không có quyền thực hiện chức năng này'
                            }
                        >
                            <span>Thêm hồ sơ đại lý</span>
                        </button>
                    </div>
                </div>
            </div>


            <div className="dealer-search-filter">
                <div className="dealer-field search-keyword-field">
                    <label>Tìm nhanh</label>
                    <div className="dealer-input-wrap">
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSearch();
                                }
                            }}
                            placeholder="Nhập mã, tên hoặc số điện thoại..."
                        />
                        {keyword && (
                            <button
                                type="button"
                                className="dealer-clear-btn"
                                onClick={handleClearKeyword}
                                title="Xóa từ khóa và làm mới"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className="dealer-field">
                    <label>Khu vực</label>
                    <select
                        value={region}
                        onChange={(e) => {
                            const val = e.target.value;
                            setRegion(val);
                            handleSearch({ region: val });
                        }}
                    >
                        <option value="">Tất cả khu vực</option>
                        {regions.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="dealer-field">
                    <label>Nhóm khách hàng</label>
                    <select
                        value={customerGroup}
                        onChange={(e) => {
                            const val = e.target.value;
                            setCustomerGroup(val);
                            handleSearch({ customerGroup: val });
                        }}
                    >
                        <option value="">Tất cả nhóm</option>
                        {customerGroups.map((group) => (
                            <option key={group} value={group}>
                                {group}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="dealer-field">
                    <label>Người phụ trách</label>
                    <select
                        value={assignedSaleId}
                        onChange={(e) => {
                            const val = e.target.value;
                            setAssignedSaleId(val);
                            handleSearch({ assignedSaleId: val });
                        }}
                    >
                        <option value="">Tất cả người phụ trách</option>
                        {sales.map((sale) => (
                            <option key={sale.id} value={sale.id}>
                                {formatSaleName(sale.name)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="dealer-field">
                    <label>Trạng thái</label>
                    <select
                        value={status}
                        onChange={(e) => {
                            const val = e.target.value;
                            setStatus(val);
                            handleSearch({ status: val });
                        }}
                    >
                        <option value="">Tất cả trạng thái</option>
                        {statuses.map((st) => (
                            <option key={st} value={st}>
                                {formatDealerStatus(st)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="dealer-actions">
                    <button
                        type="button"
                        className="btn-search-primary"
                        onClick={() => handleSearch()}
                        disabled={loading}
                    >
                        {loading ? 'Đang tìm...' : 'Tìm kiếm'}
                    </button>

                    <button
                        type="button"
                        className="btn-search-reset"
                        onClick={handleReset}
                        disabled={loading}
                    >
                        Đặt lại
                    </button>
                </div>
            </div>

            {error && (
                <div className="dealer-error">
                    {error}
                </div>
            )}

            <div className="dealer-result">
                <div className="dealer-result-title">
                    <div>
                        <strong>Danh sách đại lý trong tuyến</strong>
                        <span className="dealer-count-badge">{dealers.length} đại lý</span>
                        {selectedDealerIds.length > 0 && (
                            <span className="dealer-count-badge" style={{ background: '#f59e0b', marginLeft: 8 }}>
                                Đã chọn {selectedDealerIds.length}
                            </span>
                        )}
                    </div>
                    {canAssignDealer && selectedDealerIds.length > 0 && (
                        <button
                            type="button"
                            className="btn-search-primary"
                            onClick={() => {
                                setNewSaleIdForAssign('');
                                setAssignReason('');
                                setIsBulkAssignModalOpen(true);
                            }}
                        >
                            Chuyển giao hàng loạt
                        </button>
                    )}
                </div>

                {/* Bảng danh sách cho màn hình Desktop / Tablet */}
                <div className="dealer-table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                {canAssignDealer && (
                                    <th style={{ width: 40 }}>
                                        <input
                                            type="checkbox"
                                            checked={dealers.length > 0 && selectedDealerIds.length === dealers.length}
                                            onChange={handleSelectAllDealers}
                                        />
                                    </th>
                                )}
                                <th>Mã đại lý</th>
                                <th>Tên đại lý</th>
                                <th>Số điện thoại / Liên hệ</th>
                                <th>Địa chỉ</th>
                                <th>Khu vực</th>
                                <th>Công nợ</th>
                                <th>Trạng thái công nợ</th>
                                <th>Người phụ trách</th>
                                <th>Trạng thái</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>

                        <tbody>
                            {dealers.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={10} className="dealer-empty">
                                        Không tìm thấy đại lý phù hợp với điều kiện lọc
                                    </td>
                                </tr>
                            ) : (
                                dealers.map((dealer) => (
                                    <tr key={dealer.id}>
                                        {canAssignDealer && (
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDealerIds.includes(dealer.id)}
                                                    onChange={() => toggleSelectDealer(dealer.id)}
                                                />
                                            </td>
                                        )}
                                        <td>
                                            <span className="dealer-code-badge">{dealer.code}</span>
                                        </td>
                                        <td>
                                            <div className="dealer-name-cell">
                                                <strong style={{ fontSize: '14.5px', color: '#0f172a' }}>{dealer.name}</strong>
                                                <div style={{ fontSize: '12px', color: '#475569', marginTop: '3px', fontWeight: '500' }}>
                                                    <span style={{ color: '#64748b' }}>MST: </span>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: '600', color: dealer.tax_id ? '#0f172a' : '#94a3b8' }}>
                                                        {dealer.tax_id || 'Chưa cập nhật'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                                                    {dealer.customer_group && (
                                                        <span className="dealer-group-tag">
                                                            {dealer.customer_group}
                                                        </span>
                                                    )}
                                                    <span className="dealer-group-tag" style={{ background: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd' }} title="Bảng giá áp dụng (quyết định theo nhóm khách hàng)">
                                                        📋 {dealer.price_list || getPriceListByCustomerGroup(dealer.customer_group)}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {dealer.phone ? (
                                                <a
                                                    href={`tel:${dealer.phone}`}
                                                    className="dealer-phone-link"
                                                    title="Bấm để gọi ngay"
                                                >
                                                    {dealer.phone}
                                                </a>
                                            ) : (
                                                <span className="text-muted">-</span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="dealer-address-cell">
                                                <span>{dealer.address || '-'}</span>
                                                {dealer.address && (
                                                    <a
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dealer.address)}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="dealer-map-link"
                                                        title="Xem trên Google Maps"
                                                    >
                                                        Chỉ đường
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td>{dealer.region || '-'}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontSize: '0.85rem' }}>
                                                    <strong>Nợ:</strong>{' '}
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dealer.current_debt ?? 0)}
                                                </span>
                                                <span style={{ fontSize: '0.85rem' }}>
                                                    <strong>Hạn mức:</strong>{' '}
                                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dealer.credit_limit ?? 50000000)}
                                                </span>
                                                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                                    Tối đa: {dealer.max_debt_days ?? 30} ngày
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            {(() => {
                                                const debtSt = formatDebtStatus(dealer.debt_status);
                                                const isExpired = debtSt === 'Hết hạn';
                                                return (
                                                    <button
                                                        type="button"
                                                        className={`dealer-status-toggle-btn ${isExpired ? 'status-inactive' : 'status-active'}`}
                                                        style={{
                                                            background: isExpired ? '#fee2e2' : '#dcfce7',
                                                            borderColor: isExpired ? '#fca5a5' : '#86efac',
                                                            color: isExpired ? '#b91c1c' : '#15803d',
                                                            cursor: 'pointer',
                                                        }}
                                                        onClick={() => handleToggleDebtStatus(dealer)}
                                                        disabled={togglingDebtId === dealer.id}
                                                        title={isExpired ? 'Bấm 1 cái để chuyển sang Còn hạn' : 'Bấm 1 cái để chuyển sang Hết hạn'}
                                                    >
                                                        <span className="status-dot" style={{ background: isExpired ? '#ef4444' : '#22c55e' }} />
                                                        <span>
                                                            {togglingDebtId === dealer.id ? 'Đang đổi...' : debtSt}
                                                        </span>
                                                    </button>
                                                );
                                            })()}
                                        </td>
                                        <td>
                                            {dealer.assigned_sale_name ? (
                                                <span className="dealer-sale-badge">
                                                    {formatSaleName(dealer.assigned_sale_name)}
                                                </span>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
                                        <td>
                                            <div className="dealer-status-cell">
                                                {(() => {
                                                    const isInactive = (dealer.status || '').toLowerCase().includes('ngừng')
                                                        || (dealer.status || '').toLowerCase().includes('dừng')
                                                        || (dealer.status || '').toLowerCase().includes('inactive');
                                                    return canManageStatus ? (
                                                        <button
                                                            type="button"
                                                            className={`dealer-status-toggle-btn ${isInactive ? 'status-inactive' : 'status-active'}`}
                                                            onClick={() => handleToggleStatus(dealer)}
                                                            disabled={togglingId === dealer.id}
                                                            title={isInactive ? 'Bấm 1 cái để chuyển sang Đang hoạt động' : 'Bấm 1 cái để chuyển sang Tạm ngừng'}
                                                        >
                                                            <span className="status-dot" />
                                                            <span>
                                                                {togglingId === dealer.id
                                                                    ? 'Đang cập nhật...'
                                                                    : formatDealerStatus(dealer.status)}
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <span className={`dealer-status-toggle-btn read-only ${isInactive ? 'status-inactive' : 'status-active'}`}>
                                                            <span className="status-dot" />
                                                            <span>{formatDealerStatus(dealer.status)}</span>
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </td>
                                        <td>
                                            <div className="dealer-dropdown-container">
                                                <button
                                                    type="button"
                                                    style={{ 
                                                        width: '32px', 
                                                        height: '32px', 
                                                        padding: 0, 
                                                        display: 'flex', 
                                                        alignItems: 'center', 
                                                        justifyContent: 'center', 
                                                        fontSize: '1.2rem', 
                                                        fontWeight: 'bold',
                                                        background: '#ffffff', 
                                                        color: '#64748b', 
                                                        border: '1px solid #e2e8f0', 
                                                        borderRadius: '8px', 
                                                        cursor: 'pointer',
                                                        transition: 'all 0.15s ease'
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenDropdownId(openDropdownId === dealer.id ? null : dealer.id);
                                                    }}
                                                    onMouseOver={(e) => {
                                                        e.currentTarget.style.background = '#f1f5f9';
                                                        e.currentTarget.style.color = '#0f172a';
                                                    }}
                                                    onMouseOut={(e) => {
                                                        e.currentTarget.style.background = '#ffffff';
                                                        e.currentTarget.style.color = '#64748b';
                                                    }}
                                                    title="Thao tác"
                                                >
                                                    ⋮
                                                </button>
                                                {openDropdownId === dealer.id && (
                                                    <div className="dealer-dropdown-menu">
                                                        <button 
                                                            type="button" 
                                                            className="dealer-dropdown-item" 
                                                            onClick={(e) => { e.stopPropagation(); handleOpenDetailModal(dealer); setOpenDropdownId(null); }}
                                                        >
                                                            <span style={{ width: '20px', display: 'inline-block' }}>👁️</span> Xem chi tiết
                                                        </button>
                                                        {canEditDealer && (
                                                            <button 
                                                                type="button" 
                                                                className="dealer-dropdown-item" 
                                                                onClick={(e) => { e.stopPropagation(); handleOpenEditModal(dealer); setOpenDropdownId(null); }}
                                                            >
                                                                <span style={{ width: '20px', display: 'inline-block' }}>✏️</span> Chỉnh sửa hồ sơ
                                                            </button>
                                                        )}
                                                        {canUpdateCreditLimit && (
                                                            <button 
                                                                type="button" 
                                                                className="dealer-dropdown-item" 
                                                                onClick={(e) => { e.stopPropagation(); handleOpenCreditModal(dealer); setOpenDropdownId(null); }}
                                                            >
                                                                <span style={{ width: '20px', display: 'inline-block', opacity: 0.7 }}>💰</span> Cập nhật hạn mức
                                                            </button>
                                                        )}
                                                        {canAssignDealer && (
                                                            <button 
                                                                type="button" 
                                                                className="dealer-dropdown-item" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setAssignTargetDealer(dealer);
                                                                    setNewSaleIdForAssign('');
                                                                    setAssignReason('');
                                                                    setIsAssignModalOpen(true);
                                                                    setOpenDropdownId(null);
                                                                }}
                                                            >
                                                                <span style={{ width: '20px', display: 'inline-block', opacity: 0.7 }}>👤</span> Chuyển giao
                                                            </button>
                                                        )}
                                                        <button 
                                                            type="button" 
                                                            className="dealer-dropdown-item" 
                                                            onClick={(e) => { e.stopPropagation(); handleViewHistory(dealer); setOpenDropdownId(null); }}
                                                        >
                                                            <span style={{ width: '20px', display: 'inline-block', opacity: 0.7 }}>🕒</span> Lịch sử
                                                        </button>
                                                        {canAddDealer && (
                                                            <button 
                                                                type="button" 
                                                                className="dealer-dropdown-item danger" 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteDealer(dealer); setOpenDropdownId(null); }}
                                                            >
                                                                <span style={{ width: '20px', display: 'inline-block' }}>🗑️</span> Xóa hồ sơ
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Danh sách dạng Thẻ (Cards) tối ưu cho Sales khi đang đứng ngoài đường / màn hình điện thoại */}
                <div className="dealer-cards-wrapper">
                    {dealers.length === 0 && !loading ? (
                        <div className="dealer-empty">
                            Không tìm thấy đại lý phù hợp với điều kiện lọc
                        </div>
                    ) : (
                        dealers.map((dealer) => (
                            <div key={dealer.id} className="dealer-card-item">
                                <div className="dealer-card-header">
                                    <div>
                                        <span className="dealer-code-badge">{dealer.code}</span>
                                        <h3 className="dealer-card-name">{dealer.name}</h3>
                                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px', fontWeight: '500' }}>
                                            <span style={{ color: '#64748b' }}>MST: </span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{dealer.tax_id || 'Chưa cập nhật'}</span>
                                        </div>
                                    </div>
                                    <div className="dealer-status-cell">
                                        {(() => {
                                            const isInactive = (dealer.status || '').toLowerCase().includes('ngừng')
                                                || (dealer.status || '').toLowerCase().includes('dừng')
                                                || (dealer.status || '').toLowerCase().includes('inactive');
                                            return canManageStatus ? (
                                                <button
                                                    type="button"
                                                    className={`dealer-status-toggle-btn ${isInactive ? 'status-inactive' : 'status-active'}`}
                                                    onClick={() => handleToggleStatus(dealer)}
                                                    disabled={togglingId === dealer.id}
                                                    title={isInactive ? 'Bấm để chuyển sang Đang hoạt động' : 'Bấm để chuyển sang Tạm ngừng'}
                                                >
                                                    <span className="status-dot" />
                                                    <span>
                                                        {togglingId === dealer.id
                                                            ? 'Đang cập nhật...'
                                                            : formatDealerStatus(dealer.status)}
                                                    </span>
                                                </button>
                                            ) : (
                                                <span className={`dealer-status-toggle-btn read-only ${isInactive ? 'status-inactive' : 'status-active'}`}>
                                                    <span className="status-dot" />
                                                    <span>{formatDealerStatus(dealer.status)}</span>
                                                </span>
                                            );
                                        })()}
                                    </div>
                                </div>

                                <div className="dealer-card-body">
                                    {dealer.customer_group && (
                                        <div className="dealer-card-meta">
                                            <span className="meta-label">Nhóm:</span>
                                            <span className="dealer-group-tag">{dealer.customer_group}</span>
                                        </div>
                                    )}

                                    <div className="dealer-card-meta">
                                        <span className="meta-label">Khu vực:</span>
                                        <span>{dealer.region || 'Chưa phân vùng'}</span>
                                    </div>

                                    {dealer.assigned_sale_name && (
                                        <div className="dealer-card-meta">
                                            <span className="meta-label">Phụ trách:</span>
                                            <span>{formatSaleName(dealer.assigned_sale_name)}</span>
                                        </div>
                                    )}

                                    {dealer.address && (
                                        <div className="dealer-card-meta address">
                                            <span className="meta-label">Địa chỉ:</span>
                                            <span>{dealer.address}</span>
                                        </div>
                                    )}

                                    <div className="dealer-card-meta">
                                        <span className="meta-label">Công nợ:</span>
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span>
                                                <strong>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dealer.current_debt ?? 0)}</strong>
                                                {' / '} 
                                                <span style={{ color: '#64748b' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dealer.credit_limit ?? 50000000)}</span>
                                            </span>
                                            {(() => {
                                                const debtSt = formatDebtStatus(dealer.debt_status);
                                                const isExpired = debtSt === 'Hết hạn';
                                                return (
                                                    <button
                                                        type="button"
                                                        className={`dealer-status-toggle-btn ${isExpired ? 'status-inactive' : 'status-active'}`}
                                                        style={{
                                                            background: isExpired ? '#fee2e2' : '#dcfce7',
                                                            borderColor: isExpired ? '#fca5a5' : '#86efac',
                                                            color: isExpired ? '#b91c1c' : '#15803d',
                                                            cursor: 'pointer',
                                                            marginTop: '4px',
                                                            alignSelf: 'flex-start',
                                                        }}
                                                        onClick={() => handleToggleDebtStatus(dealer)}
                                                        disabled={togglingDebtId === dealer.id}
                                                        title={isExpired ? 'Bấm để chuyển sang Còn hạn' : 'Bấm để chuyển sang Hết hạn'}
                                                    >
                                                        <span className="status-dot" style={{ background: isExpired ? '#ef4444' : '#22c55e' }} />
                                                        <span>
                                                            {togglingDebtId === dealer.id ? 'Đang đổi...' : debtSt}
                                                        </span>
                                                    </button>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                <div className="dealer-card-actions">
                                    <button
                                        onClick={() => handleOpenDetailModal(dealer)}
                                        className="dealer-btn-call"
                                        style={{ background: '#0284c7', color: '#fff', borderColor: '#0284c7' }}
                                    >
                                        Chi tiết
                                    </button>
                                    {canEditDealer && (
                                        <button
                                            onClick={() => handleOpenEditModal(dealer)}
                                            className="dealer-btn-call"
                                            style={{ background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' }}
                                        >
                                            Sửa
                                        </button>
                                    )}
                                    {canUpdateCreditLimit && (
                                        <button
                                            onClick={() => handleOpenCreditModal(dealer)}
                                            className="dealer-btn-call"
                                            style={{ background: '#8b5cf6', color: '#fff', borderColor: '#8b5cf6' }}
                                        >
                                            Hạn mức
                                        </button>
                                    )}
                                    {dealer.phone && (
                                        <a
                                            href={`tel:${dealer.phone}`}
                                            className="dealer-btn-call"
                                        >
                                            Gọi {dealer.phone}
                                        </a>
                                    )}
                                    {dealer.address && (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dealer.address)}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="dealer-btn-map"
                                        >
                                            Chỉ đường
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {isAddModalOpen && (
                <div className="dealer-modal-overlay" onClick={() => setIsAddModalOpen(false)}>
                    <div className="dealer-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="dealer-modal-header">
                            <div className="dealer-modal-title-wrap">
                                <div>
                                    <h3>Thêm hồ sơ đại lý mới</h3>
                                    <p>Nhập thông tin đại lý hoặc khách hàng để đưa vào danh sách chuẩn hóa toàn hệ thống</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="dealer-modal-close-btn"
                                onClick={() => setIsAddModalOpen(false)}
                                title="Đóng"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleAddSubmit} className="dealer-modal-form">
                            <div className="dealer-modal-body">
                                {addError && (
                                    <div className="dealer-modal-error">
                                        {addError}
                                    </div>
                                )}

                                <div className="dealer-modal-form-grid">
                                    <div className="dealer-modal-field">
                                        <label>
                                            Nhóm khách hàng <span className="required">*</span>
                                        </label>
                                        <select
                                            value={addFormData.customer_group}
                                            onChange={(e) => setAddFormData({ ...addFormData, customer_group: e.target.value })}
                                        >
                                            {customerGroups.map((group) => (
                                                <option key={group} value={group}>
                                                    {group}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Bảng giá áp dụng (Theo nhóm)</label>
                                        <div style={{
                                            padding: '10px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            background: '#f8fafc',
                                            color: '#1d4ed8',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <span>📋</span>
                                            <span>{getPriceListByCustomerGroup(addFormData.customer_group)}</span>
                                        </div>
                                        <span className="dealer-modal-field-hint" style={{ color: '#0369a1', fontSize: '0.75rem', marginTop: '3px' }}>
                                            ℹ Nhóm khách hàng tự động quyết định bảng giá được áp dụng
                                        </span>
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Mã đại lý / khách hàng</label>
                                        <input
                                            type="text"
                                            value={addFormData.code}
                                            onChange={(e) => setAddFormData({ ...addFormData, code: e.target.value })}
                                            placeholder="Ví dụ: DL-1024 hoặc KH-01"
                                        />
                                    </div>

                                    <div className="dealer-modal-field dealer-form-full">
                                        <label>
                                            Tên đại lý / Khách hàng <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={addFormData.name}
                                            onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                                            placeholder="Ví dụ: Đại lý Toàn Thắng hoặc Công ty Minh Tuấn"
                                        />
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Mã số thuế (MST)</label>
                                        <input
                                            type="text"
                                            value={addFormData.tax_id}
                                            onChange={(e) => setAddFormData({ ...addFormData, tax_id: e.target.value })}
                                            placeholder="Ví dụ: 0101234567"
                                        />
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>
                                            Số điện thoại liên hệ <span className="required">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={addFormData.phone}
                                            onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                                            placeholder="Ví dụ: 0987654321"
                                        />
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>
                                            Khu vực <span className="required">*</span>
                                        </label>
                                        <select
                                            value={addFormData.region}
                                            onChange={(e) => setAddFormData({ ...addFormData, region: e.target.value })}
                                        >
                                            {regions.map((reg) => (
                                                <option key={reg} value={reg}>
                                                    {reg}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>
                                            Người phụ trách <span className="required">*</span>
                                        </label>
                                        <select
                                            required
                                            value={addFormData.assigned_sale_name}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                const saleId = val === 'Trưởng phòng' ? '2' : '3';
                                                setAddFormData({
                                                    ...addFormData,
                                                    assigned_sale_name: val,
                                                    assigned_sale_id: saleId,
                                                });
                                            }}
                                        >
                                            <option value="Nhân viên bán hàng">Nhân viên bán hàng</option>
                                            <option value="Trưởng phòng">Trưởng phòng</option>
                                        </select>
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Hạn mức công nợ (VNĐ)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="1000000"
                                            value={addFormData.credit_limit || ''}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                                const clean = e.target.value.replace(/^0+(?=\d)/, '');
                                                setAddFormData({ ...addFormData, credit_limit: clean === '' ? 0 : Number(clean) });
                                            }}
                                            placeholder="Ví dụ: 50000000"
                                        />
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Số nợ còn (Dư nợ - VNĐ)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="500000"
                                            value={addFormData.current_debt === 0 ? '' : addFormData.current_debt}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => {
                                                const clean = e.target.value.replace(/^0+(?=\d)/, '');
                                                const val = clean === '' ? 0 : Number(clean);
                                                setAddFormData({ ...addFormData, current_debt: val });
                                            }}
                                            placeholder="0 (Nhập số nợ còn nếu có)"
                                        />
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Trạng thái công nợ</label>
                                        <select
                                            value={addFormData.debt_status}
                                            onChange={(e) => setAddFormData({ ...addFormData, debt_status: e.target.value })}
                                        >
                                            <option value="Còn hạn">Còn hạn</option>
                                            <option value="Hết hạn">Hết hạn</option>
                                        </select>
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>
                                            Trạng thái hoạt động <span className="required">*</span>
                                        </label>
                                        <select
                                            value={addFormData.status}
                                            onChange={(e) => setAddFormData({ ...addFormData, status: e.target.value })}
                                        >
                                            <option value="Đang hoạt động">Đang hoạt động</option>
                                            <option value="Tạm ngừng">Tạm ngừng</option>
                                        </select>
                                    </div>

                                    <div className="dealer-modal-field dealer-form-full">
                                        <label>
                                            Địa chỉ <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={addFormData.address}
                                            onChange={(e) => setAddFormData({ ...addFormData, address: e.target.value })}
                                            placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                                        />
                                        <span className="dealer-modal-field-hint">
                                            Địa chỉ chi tiết (tối thiểu 5 ký tự) phục vụ định vị và chỉ đường trên Google Maps
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="dealer-modal-footer">
                                <button
                                    type="button"
                                    className="dealer-btn-cancel"
                                    onClick={() => setIsAddModalOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    className="dealer-btn-save"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Đang lưu...' : 'Lưu hồ sơ đại lý'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Chỉnh sửa hồ sơ đại lý */}
            {isEditModalOpen && editTargetDealer && (
                <div className="dealer-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
                    <div className="dealer-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="dealer-modal-header">
                            <div className="dealer-modal-title-wrap">
                                <div>
                                    <h3>Chỉnh sửa hồ sơ đại lý</h3>
                                    <p>Cập nhật và chuẩn hóa thông tin đại lý: {editTargetDealer.name} ({editTargetDealer.code})</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="dealer-modal-close-btn"
                                onClick={() => setIsEditModalOpen(false)}
                                title="Đóng"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleEditSubmit} className="dealer-modal-form">
                            <div className="dealer-modal-body">
                                {editError && (
                                    <div className="dealer-modal-error">
                                        {editError}
                                    </div>
                                )}

                                <div className="dealer-modal-form-grid">
                                    <div className="dealer-modal-field">
                                        <label>Nhóm khách hàng <span className="required">*</span></label>
                                        <select
                                            value={editFormData.customer_group}
                                            onChange={(e) => setEditFormData({ ...editFormData, customer_group: e.target.value })}
                                        >
                                            {customerGroups.map((group) => (
                                                <option key={group} value={group}>
                                                    {group}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Bảng giá áp dụng (Theo nhóm)</label>
                                        <div style={{
                                            padding: '10px 12px',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            background: '#f8fafc',
                                            color: '#1d4ed8',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}>
                                            <span>📋</span>
                                            <span>{getPriceListByCustomerGroup(editFormData.customer_group)}</span>
                                        </div>
                                        <span className="dealer-modal-field-hint" style={{ color: '#0369a1', fontSize: '0.75rem', marginTop: '3px' }}>
                                            ℹ Nhóm khách hàng tự động quyết định bảng giá được áp dụng
                                        </span>
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Trạng thái hoạt động</label>
                                        <select
                                            value={editFormData.status}
                                            onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                                        >
                                            {statuses.map((st) => (
                                                <option key={st} value={st}>
                                                    {formatDealerStatus(st)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="dealer-modal-field dealer-form-full">
                                        <label>
                                            Tên đại lý / Khách hàng <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={editFormData.name}
                                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                            placeholder="Tên đại lý hoặc doanh nghiệp..."
                                        />
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Mã số thuế (MST)</label>
                                        <input
                                            type="text"
                                            value={editFormData.tax_id}
                                            onChange={(e) => setEditFormData({ ...editFormData, tax_id: e.target.value })}
                                            placeholder="Ví dụ: 0101234567"
                                        />
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>
                                            Số điện thoại liên hệ <span className="required">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={editFormData.phone}
                                            onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                            placeholder="Ví dụ: 0987654321"
                                        />
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Email liên hệ</label>
                                        <input
                                            type="email"
                                            value={editFormData.email}
                                            onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                            placeholder="Ví dụ: daily@gmail.com"
                                        />
                                    </div>

                                    <div className="dealer-modal-field">
                                        <label>Khu vực <span className="required">*</span></label>
                                        <select
                                            value={editFormData.region}
                                            onChange={(e) => setEditFormData({ ...editFormData, region: e.target.value })}
                                        >
                                            {regions.map((reg) => (
                                                <option key={reg} value={reg}>
                                                    {reg}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="dealer-modal-field dealer-form-full">
                                        <label>Người phụ trách</label>
                                        <select
                                            value={editFormData.assigned_sale_id}
                                            onChange={(e) => setEditFormData({ ...editFormData, assigned_sale_id: e.target.value })}
                                        >
                                            <option value="">-- Chưa gán người phụ trách --</option>
                                            {sales.map((sale) => (
                                                <option key={sale.id} value={sale.id}>
                                                    {formatSaleName(sale.name)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="dealer-modal-field dealer-form-full">
                                        <label>Địa chỉ <span className="required">*</span></label>
                                        <input
                                            type="text"
                                            required
                                            value={editFormData.address}
                                            onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                                            placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="dealer-modal-footer">
                                <button
                                    type="button"
                                    className="dealer-btn-cancel"
                                    onClick={() => setIsEditModalOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    className="dealer-btn-save"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Đang lưu...' : 'Lưu cập nhật'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Xem chi tiết hồ sơ đại lý */}
            {isDetailModalOpen && detailTargetDealer && (
                <div className="dealer-modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
                    <div className="dealer-modal-box" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="dealer-modal-header">
                            <div className="dealer-modal-title-wrap">
                                <div>
                                    <h3>Chi tiết hồ sơ đại lý</h3>
                                    <p>Mã: <strong>{detailTargetDealer.code}</strong> | Trạng thái: <strong style={{ color: ((detailTargetDealer.status || '').includes('dừng') || (detailTargetDealer.status || '').includes('ngừng')) ? '#dc2626' : '#16a34a' }}>{formatDealerStatus(detailTargetDealer.status)}</strong></p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="dealer-modal-close-btn"
                                onClick={() => setIsDetailModalOpen(false)}
                                title="Đóng"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="dealer-modal-body" style={{ padding: '20px' }}>
                            <div className="dealer-detail-grid">
                                <div className="dealer-detail-section">
                                    <h4>🏢 Thông tin pháp lý & Nhóm</h4>
                                    <div className="dealer-detail-row">
                                        <span className="label">Tên đại lý:</span>
                                        <span className="value">{detailTargetDealer.name}</span>
                                    </div>
                                    <div className="dealer-detail-row">
                                        <span className="label">Mã số thuế (MST):</span>
                                        <span className="value">{detailTargetDealer.tax_id || 'Chưa cập nhật'}</span>
                                    </div>
                                    <div className="dealer-detail-row">
                                        <span className="label">Nhóm khách hàng:</span>
                                        <span className="value">{detailTargetDealer.customer_group || 'Đại lý cấp 1'}</span>
                                    </div>
                                    <div className="dealer-detail-row">
                                        <span className="label">Bảng giá áp dụng:</span>
                                        <span className="value">{detailTargetDealer.price_list || `Bảng giá ${detailTargetDealer.customer_group || 'Đại lý cấp 1'}`}</span>
                                    </div>
                                </div>

                                <div className="dealer-detail-section">
                                    <h4>📞 Thông tin liên hệ</h4>
                                    <div className="dealer-detail-row">
                                        <span className="label">Số điện thoại:</span>
                                        <span className="value">
                                            {detailTargetDealer.phone ? (
                                                <a href={`tel:${detailTargetDealer.phone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                                                    {detailTargetDealer.phone}
                                                </a>
                                            ) : '-'}
                                        </span>
                                    </div>
                                    <div className="dealer-detail-row">
                                        <span className="label">Email:</span>
                                        <span className="value">{detailTargetDealer.email || '-'}</span>
                                    </div>
                                    <div className="dealer-detail-row">
                                        <span className="label">Khu vực:</span>
                                        <span className="value">{detailTargetDealer.region || '-'}</span>
                                    </div>
                                    <div className="dealer-detail-row">
                                        <span className="label">Địa chỉ:</span>
                                        <span className="value">{detailTargetDealer.address || '-'}</span>
                                    </div>
                                </div>

                                <div className="dealer-detail-section" style={{ gridColumn: 'span 2' }}>
                                    <h4>💰 Quản lý công nợ & Phân công</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                                        <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>Nhân viên phụ trách</div>
                                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginTop: '4px' }}>
                                                {formatSaleName(detailTargetDealer.assigned_sale_name)}
                                            </div>
                                        </div>

                                        <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>Hạn mức công nợ</div>
                                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#2563eb', marginTop: '4px' }}>
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(detailTargetDealer.credit_limit ?? 50000000)}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>Số ngày nợ: {detailTargetDealer.max_debt_days ?? 30} ngày</div>
                                        </div>

                                        <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontSize: '12px', color: '#64748b' }}>Dư nợ hiện tại</div>
                                            <div style={{ fontSize: '15px', fontWeight: '700', color: '#dc2626', marginTop: '4px' }}>
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(detailTargetDealer.current_debt ?? 0)}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#64748b' }}>Trạng thái: {detailTargetDealer.debt_status || 'Bình thường'}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="dealer-modal-footer" style={{ justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                {canEditDealer && (
                                    <button
                                        type="button"
                                        className="dealer-btn-save"
                                        style={{ background: '#f59e0b' }}
                                        onClick={() => {
                                            setIsDetailModalOpen(false);
                                            handleOpenEditModal(detailTargetDealer);
                                        }}
                                    >
                                        Chỉnh sửa hồ sơ
                                    </button>
                                )}
                                {canUpdateCreditLimit && (
                                    <button
                                        type="button"
                                        className="dealer-btn-save"
                                        style={{ background: '#8b5cf6' }}
                                        onClick={() => {
                                            setIsDetailModalOpen(false);
                                            handleOpenCreditModal(detailTargetDealer);
                                        }}
                                    >
                                        Hạn mức nợ
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="dealer-btn-cancel"
                                    onClick={() => {
                                        setIsDetailModalOpen(false);
                                        handleViewHistory(detailTargetDealer);
                                    }}
                                >
                                    Lịch sử
                                </button>
                            </div>
                            <button
                                type="button"
                                className="dealer-btn-cancel"
                                onClick={() => setIsDetailModalOpen(false)}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Phân công lẻ */}
            {isAssignModalOpen && assignTargetDealer && (
                <div className="dealer-modal-overlay" onClick={() => setIsAssignModalOpen(false)}>
                    <div className="dealer-modal-box" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="dealer-modal-header">
                            <div className="dealer-modal-title-wrap">
                                <div>
                                    <h3>Chuyển giao đại lý</h3>
                                    <p>Chỉ định nhân viên kinh doanh mới phụ trách</p>
                                </div>
                            </div>
                            <button type="button" className="dealer-modal-close-btn" onClick={() => setIsAssignModalOpen(false)} title="Đóng">✕</button>
                        </div>
                        <div className="dealer-modal-body">
                            <div style={{ padding: '0 0 16px 0', borderBottom: '1px solid #eaeaea', marginBottom: '16px' }}>
                                <p style={{ margin: '0 0 8px 0' }}>Đại lý / Khách hàng: <strong style={{ color: '#0f172a' }}>{assignTargetDealer.name}</strong></p>
                                <p style={{ margin: '0' }}>Người phụ trách hiện tại: <strong style={{ color: '#64748b' }}>{formatSaleName(assignTargetDealer.assigned_sale_name)}</strong></p>
                            </div>
                            
                            <div className="dealer-modal-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                                <div className="dealer-modal-field dealer-form-full">
                                    <label>Chọn người phụ trách mới <span className="required">*</span></label>
                                    <select 
                                        value={newSaleIdForAssign}
                                        onChange={(e) => setNewSaleIdForAssign(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    >
                                        <option value="">-- Chọn người phụ trách --</option>
                                        {sales.map(s => (
                                            <option key={s.id} value={s.id}>{formatSaleName(s.name)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="dealer-modal-field dealer-form-full">
                                    <label>Lý do (tuỳ chọn)</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ví dụ: Thay đổi khu vực phụ trách"
                                        value={assignReason}
                                        onChange={(e) => setAssignReason(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="dealer-modal-footer">
                            <button type="button" className="dealer-btn-cancel" onClick={() => setIsAssignModalOpen(false)} disabled={isSubmitting}>Hủy bỏ</button>
                            <button type="button" className="dealer-btn-save" onClick={handleAssignSubmit} disabled={isSubmitting}>
                                {isSubmitting ? 'Đang lưu...' : 'Xác nhận chuyển giao'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Phân công hàng loạt */}
            {isBulkAssignModalOpen && (
                <div className="dealer-modal-overlay" onClick={() => setIsBulkAssignModalOpen(false)}>
                    <div className="dealer-modal-box" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="dealer-modal-header">
                            <div className="dealer-modal-title-wrap">
                                <div>
                                    <h3>Chuyển giao hàng loạt</h3>
                                    <p>Chuyển {selectedDealerIds.length} đại lý sang người mới</p>
                                </div>
                            </div>
                            <button type="button" className="dealer-modal-close-btn" onClick={() => setIsBulkAssignModalOpen(false)} title="Đóng">✕</button>
                        </div>
                        <div className="dealer-modal-body">
                            <p style={{ margin: '0 0 16px 0', padding: '12px', background: '#eff6ff', borderRadius: '8px', color: '#1e40af' }}>
                                Bạn đang chọn chuyển giao <strong>{selectedDealerIds.length}</strong> đại lý / khách hàng.
                            </p>
                            
                            <div className="dealer-modal-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                                <div className="dealer-modal-field dealer-form-full">
                                    <label>Chọn người phụ trách tiếp nhận <span className="required">*</span></label>
                                    <select 
                                        value={newSaleIdForAssign}
                                        onChange={(e) => setNewSaleIdForAssign(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    >
                                        <option value="">-- Chọn người phụ trách --</option>
                                        {sales.map(s => (
                                            <option key={s.id} value={s.id}>{formatSaleName(s.name)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="dealer-modal-field dealer-form-full">
                                    <label>Lý do chuyển giao (tuỳ chọn)</label>
                                    <input 
                                        type="text" 
                                        placeholder="Ghi chú thêm..."
                                        value={assignReason}
                                        onChange={(e) => setAssignReason(e.target.value)}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="dealer-modal-footer">
                            <button type="button" className="dealer-btn-cancel" onClick={() => setIsBulkAssignModalOpen(false)} disabled={isSubmitting}>Hủy bỏ</button>
                            <button type="button" className="dealer-btn-save" onClick={handleAssignSubmit} disabled={isSubmitting}>
                                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận chuyển giao'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal Lịch sử phân công */}
            {isHistoryModalOpen && historyTargetDealer && (
                <div className="dealer-modal-overlay" onClick={() => setIsHistoryModalOpen(false)}>
                    <div className="dealer-modal-box" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="dealer-modal-header">
                            <div className="dealer-modal-title-wrap">
                                <div>
                                    <h3>Lịch sử chuyển giao</h3>
                                    <p>Đại lý: {historyTargetDealer.name}</p>
                                </div>
                            </div>
                            <button type="button" className="dealer-modal-close-btn" onClick={() => setIsHistoryModalOpen(false)} title="Đóng">✕</button>
                        </div>
                        <div className="dealer-modal-body">
                            {loadingHistory ? (
                                <p style={{ textAlign: 'center', padding: '20px' }}>Đang tải dữ liệu...</p>
                            ) : historyLogs.length === 0 ? (
                                <p style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>Đại lý này chưa từng được chuyển giao.</p>
                            ) : (
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                                <th style={{ padding: '8px' }}>Thời gian</th>
                                                <th style={{ padding: '8px' }}>Người thực hiện</th>
                                                <th style={{ padding: '8px' }}>Hành động</th>
                                                <th style={{ padding: '8px' }}>Chi tiết (Cũ &rarr; Mới)</th>
                                                <th style={{ padding: '8px' }}>Lý do</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyLogs.map(log => {
                                                let oldObj: any = {};
                                                let newObj: any = {};
                                                try { if (log.old_values) oldObj = typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values; } catch {}
                                                try { if (log.new_values) newObj = typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values; } catch {}
                                                
                                                let actionName = 'Khác';
                                                let detail = '';
                                                
                                                if (log.action_type === 'DEALER_ASSIGNMENT') {
                                                    actionName = 'Chuyển giao NV';
                                                    detail = `${formatSaleName(oldObj.assigned_sale_name) || 'Trống'} ➔ ${formatSaleName(newObj.assigned_sale_name) || 'Trống'}`;
                                                } else if (log.action_type === 'DEBT_LIMIT_CHANGE') {
                                                    actionName = 'Đổi hạn mức';
                                                    const oldL = oldObj.credit_limit != null ? new Intl.NumberFormat('vi-VN').format(oldObj.credit_limit) : '-';
                                                    const newL = newObj.credit_limit != null ? new Intl.NumberFormat('vi-VN').format(newObj.credit_limit) : '-';
                                                    const oldD = oldObj.max_debt_days ?? '-';
                                                    const newD = newObj.max_debt_days ?? '-';
                                                    detail = `Hạn mức: ${oldL} ➔ ${newL} | Ngày: ${oldD} ➔ ${newD}`;
                                                } else if (log.action_type === 'DEALER_STATUS_CHANGE') {
                                                    actionName = 'Đổi trạng thái';
                                                    detail = `${formatDealerStatus(oldObj.status) || '-'} ➔ ${formatDealerStatus(newObj.status) || '-'}`;
                                                }

                                                return (
                                                <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '8px' }}>{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                                                    <td style={{ padding: '8px', color: '#0f172a', fontWeight: 'bold' }}>{log.user_name}</td>
                                                    <td style={{ padding: '8px' }}>
                                                        <span className="dealer-group-tag" style={{ background: '#e2e8f0', color: '#334155', padding: '2px 6px', fontSize: '0.8rem' }}>
                                                            {actionName}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '8px' }}>{detail}</td>
                                                    <td style={{ padding: '8px', color: '#64748b', fontStyle: 'italic' }}>{log.reason || '-'}</td>
                                                </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Cập nhật hạn mức công nợ */}
            {isCreditModalOpen && creditTargetDealer && (
                <div className="dealer-modal-overlay" onClick={() => setIsCreditModalOpen(false)}>
                    <div className="dealer-modal-box" onClick={(e) => e.stopPropagation()}>
                        <div className="dealer-modal-header">
                            <div className="dealer-modal-title-wrap">
                                <div>
                                    <h3>Cập nhật hạn mức công nợ</h3>
                                    <p>Đại lý: {creditTargetDealer.name}</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="dealer-modal-close-btn"
                                onClick={() => setIsCreditModalOpen(false)}
                                title="Đóng"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreditSubmit} className="dealer-modal-form">
                            <div className="dealer-modal-body">
                                <div className="dealer-modal-form-grid">
                                    <div className="dealer-modal-field dealer-form-full">
                                        <label>Hạn mức tiền công nợ (VNĐ) <span className="required">*</span></label>
                                        <input
                                            type="number"
                                            required
                                            min={0}
                                            value={creditLimitData.credit_limit}
                                            onChange={(e) => setCreditLimitData({ ...creditLimitData, credit_limit: e.target.value })}
                                        />
                                    </div>
                                    <div className="dealer-modal-field dealer-form-full">
                                        <label>Số ngày nợ tối đa (Ngày) <span className="required">*</span></label>
                                        <input
                                            type="number"
                                            required
                                            min={1}
                                            value={creditLimitData.max_debt_days}
                                            onChange={(e) => setCreditLimitData({ ...creditLimitData, max_debt_days: e.target.value })}
                                        />
                                    </div>
                                    <div className="dealer-modal-field dealer-form-full">
                                        <label>Lý do cập nhật <span className="required">*</span></label>
                                        <textarea
                                            required
                                            value={creditLimitData.reason}
                                            onChange={(e) => setCreditLimitData({ ...creditLimitData, reason: e.target.value })}
                                            placeholder="Nhập lý do thay đổi hạn mức/ngày nợ..."
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="dealer-modal-footer">
                                <button
                                    type="button"
                                    className="dealer-btn-cancel"
                                    onClick={() => setIsCreditModalOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="dealer-btn-save"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? 'Đang lưu...' : 'Lưu cập nhật'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Xóa đại lý / Cảnh báo công nợ (Thay thế popup localhost của trình duyệt) */}
            {deleteModal.isOpen && deleteModal.dealer && (
                <div className="dealer-modal-overlay" onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}>
                    <div 
                        className="dealer-modal-box" 
                        style={{ maxWidth: '520px', borderRadius: '12px' }} 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="dealer-modal-header" style={{ paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
                            <div className="dealer-modal-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    backgroundColor: deleteModal.hasDebt ? '#fef3c7' : '#fee2e2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '22px'
                                }}>
                                    {deleteModal.hasDebt ? '⚠️' : '🗑️'}
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.2rem', color: deleteModal.hasDebt ? '#b45309' : '#b91c1c' }}>
                                        {deleteModal.hasDebt ? 'Không được phép xóa đại lý' : 'Xác nhận xóa đại lý'}
                                    </h3>
                                    <p style={{ margin: '2px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                                        Mã đại lý: <strong>{deleteModal.dealer.code}</strong>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="dealer-modal-close-btn"
                                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                                title="Đóng"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="dealer-modal-body" style={{ padding: '20px 0' }}>
                            {deleteModal.hasDebt ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div style={{
                                        backgroundColor: '#fffbeb',
                                        border: '1px solid #fde68a',
                                        borderRadius: '8px',
                                        padding: '12px 16px',
                                        color: '#92400e',
                                        fontSize: '0.92rem',
                                        lineHeight: '1.5'
                                    }}>
                                        Đại lý <strong>"{deleteModal.dealer.name}"</strong> ({deleteModal.dealer.code}) 
                                        đã phát sinh giao dịch trong hệ thống và <strong>ĐANG CÒN CÔNG NỢ ({deleteModal.formattedDebt})</strong> nên 
                                        <strong style={{ color: '#dc2626' }}> KHÔNG ĐƯỢC PHÉP XÓA</strong> theo quy định kế toán.
                                    </div>

                                    <p style={{ margin: 0, color: '#334155', fontSize: '0.92rem', lineHeight: '1.5' }}>
                                        Bạn có muốn <strong>NGỪNG GIAO DỊCH</strong> đại lý này (chuyển trạng thái sang <strong>"Tạm ngừng"</strong>) ngay bây giờ không?
                                    </p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div style={{
                                        backgroundColor: '#f0fdf4',
                                        border: '1px solid #bbf7d0',
                                        borderRadius: '8px',
                                        padding: '12px 16px',
                                        color: '#166534',
                                        fontSize: '0.92rem',
                                        lineHeight: '1.5'
                                    }}>
                                        Đại lý <strong>"{deleteModal.dealer.name}"</strong> ({deleteModal.dealer.code}) 
                                        <strong> ĐÃ HẾT NỢ</strong> (dư nợ: <strong>0 VNĐ</strong>) và đủ điều kiện xóa khỏi hệ thống.
                                    </div>

                                    <p style={{ margin: 0, color: '#334155', fontSize: '0.92rem', lineHeight: '1.5' }}>
                                        Bạn có chắc chắn muốn xóa vĩnh viễn hồ sơ đại lý này khỏi hệ thống không? Hành động này không thể hoàn tác.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="dealer-modal-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button
                                type="button"
                                className="dealer-btn-cancel"
                                onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}
                            >
                                {deleteModal.hasDebt ? 'Đóng' : 'Hủy bỏ'}
                            </button>

                            {deleteModal.hasDebt ? (
                                <button
                                    type="button"
                                    style={{
                                        padding: '8px 18px',
                                        backgroundColor: '#f59e0b',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                    }}
                                    onClick={handleStopTransaction}
                                >
                                    Ngừng giao dịch (Tạm ngừng)
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="dealer-btn-save"
                                    style={{ backgroundColor: '#dc2626' }}
                                    onClick={handleConfirmDelete}
                                >
                                    Xác nhận xóa đại lý
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
