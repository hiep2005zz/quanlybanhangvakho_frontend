import { useEffect, useState, useCallback } from 'react';
import {
    DealerSearchItem,
    searchDealers,
    getDealerFilters,
    updateDealerStatus,
    assignDealer,
    bulkAssignDealers,
    getDealerHistory,
    updateDealerCreditLimit,
    deleteDealer,
} from '../services/dealerSearchApi';
import {
    User,
    getProductsApi,
    ProductItem,
    getCreditPolicyConfigApi,
    updateCreditPolicyConfigApi,
    evaluateCreditPolicyApi,
    recordDealerPaymentApi,
    CreditPolicyConfig,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { OrderCreateModal } from './OrderCreateModal';
import DeliveryPointManager from './DeliveryPointManager';
import { ModalPortal } from './ModalPortal';
import { CreateDealerPageView } from './CreateDealerPageView';
import './dealer-search.css';

const DEFAULT_CUSTOMER_GROUPS = [
    'Đại lý cấp 1',
    'Đại lý cấp 2',
    'Khách sỉ',
    'Khách lẻ',
];

const DEFAULT_REGIONS = [
    'Hà Nội',
    'Đà Nẵng',
    'TP. Hồ Chí Minh',
    'Hải Phòng',
    'Cần Thơ',
    'Bắc Ninh',
    'Bình Dương',
    'Đồng Nai',
    'Quảng Ninh',
    'Thái Nguyên',
    'Hải Dương',
    'Nam Định',
    'Nghệ An',
    'Khánh Hòa',
    'Lâm Đồng',
];

const formatGroupName = (grp: string) => {
    if (!grp) return '';
    const clean = grp.trim();
    if (clean === 'dai_ly_cap_1' || clean === 'CAP_1' || clean === 'Dai_ly_cap_1' || clean === 'Đại lý cấp 1') return 'Đại lý cấp 1';
    if (clean === 'dai_ly_cap_2' || clean === 'CAP_2' || clean === 'Dai_ly_cap_2' || clean === 'Đại lý cấp 2') return 'Đại lý cấp 2';
    if (clean === 'khach_si' || clean === 'Khach_si' || clean === 'Khách sỉ') return 'Khách sỉ';
    if (clean === 'khach_le' || clean === 'RETAIL' || clean === 'Khach_le' || clean === 'Khách lẻ') return 'Khách lẻ';
    return clean;
};

const getUniqueFormattedGroups = (groups: string[]): string[] => {
    const formattedList = (groups || []).map(formatGroupName).filter(Boolean);
    const unique = Array.from(new Set(formattedList));
    const order = ['Đại lý cấp 1', 'Đại lý cấp 2', 'Khách sỉ', 'Khách lẻ'];
    return unique.sort((a, b) => {
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b, 'vi');
    });
};

const getDealerCreditStatusInfo = (dealer: DealerSearchItem) => {
    const isOverLimit = Boolean(
        dealer.is_over_credit_limit ||
        ((dealer.current_debt ?? 0) > (dealer.credit_limit ?? 0) && (dealer.credit_limit ?? 0) > 0) ||
        dealer.debt_status?.includes('Vượt')
    );
    const isOverdue = Boolean(
        dealer.is_overdue ||
        dealer.debt_status?.includes('Quá hạn')
    );
    const isWarning = Boolean(
        dealer.credit_warning_flag ||
        isOverLimit ||
        isOverdue ||
        (dealer.debt_status && dealer.debt_status !== 'Trong hạn mức' && dealer.debt_status !== 'Bình thường')
    );

    if (!isWarning) {
        return {
            isWarning: false,
            label: 'Trong hạn mức',
            tooltip: 'Dư nợ trong hạn mức cho phép',
            className: 'dealer-group-tag success',
            style: {
                background: '#dcfce7',
                color: '#16a34a',
                borderColor: '#86efac',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap'
            }
        };
    }

    let label = 'Cảnh báo công nợ';
    if (isOverLimit && isOverdue) {
        label = 'Vượt hạn mức & Quá hạn';
    } else if (isOverLimit) {
        label = 'Vượt hạn mức tiền';
    } else if (isOverdue) {
        label = 'Quá hạn thanh toán';
    }

    const tooltip = [
        dealer.credit_flag_reason || (isOverLimit ? `Vượt hạn mức công nợ (${(dealer.current_debt ?? 0).toLocaleString('vi-VN')} đ > ${(dealer.credit_limit ?? 0).toLocaleString('vi-VN')} đ)` : isOverdue ? 'Quá hạn thanh toán công nợ' : 'Đang bị gắn cờ cảnh báo công nợ'),
        dealer.last_credit_evaluated_at ? `ĐG: ${new Date(dealer.last_credit_evaluated_at).toLocaleDateString('vi-VN')}` : ''
    ].filter(Boolean).join(' • ');

    return {
        isWarning: true,
        label,
        tooltip,
        className: 'dealer-group-tag danger',
        style: {
            background: '#fee2e2',
            color: '#dc2626',
            borderColor: '#fca5a5',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap'
        }
    };
};

export const formatDealerStatus = (status?: string | null): string => {
    const s = (status || '').trim();
    if (!s || s.includes('ho?t') || s === 'Đang hoạt động' || s.toUpperCase() === 'ACTIVE' || s.includes('Ðang')) {
        return 'Đang hoạt động';
    }
    const lower = s.toLowerCase();
    if (lower.includes('khóa') || lower.includes('khoá') || s.includes('Đ?') || lower.includes('lock')) {
        return 'Đã khóa';
    }
    if (lower.includes('tạm') || lower.includes('ngừng') || lower.includes('ngung') || lower.includes('inactive')) {
        return 'Tạm ngừng';
    }
    return s;
};

export const isDealerStatusLocked = (status?: string | null): boolean => {
    const s = (status || '').toLowerCase();
    return s.includes('khóa') || s.includes('khoá') || s.includes('đ?') || s.includes('lock') || s.includes('ngừng') || s.includes('ngung') || s.includes('inactive');
};

const DEFAULT_STATUSES = [
    'Đang hoạt động',
    'Tạm ngừng',
];

export interface DealerSearchViewProps {
    currentUser?: User;
    token?: string;
    onBackToHome?: () => void;
}

export default function DealerSearchView({
    currentUser,
    token,
    onBackToHome: _onBackToHome,
}: DealerSearchViewProps) {
    const [dealers, setDealers] = useState<DealerSearchItem[]>([]);
    const [keyword, setKeyword] = useState('');
    const [region, setRegion] = useState('');
    const [customerGroup, setCustomerGroup] = useState('');
    const [assignedSaleId, setAssignedSaleId] = useState('');
    const [status, setStatus] = useState('');
    const [creditStatus, setCreditStatus] = useState('');

    const [regions, setRegions] = useState<string[]>(DEFAULT_REGIONS);
    const [sales, setSales] = useState<
        { id: number; name: string }[]
    >([]);
    const [customerGroups, setCustomerGroups] = useState<string[]>(DEFAULT_CUSTOMER_GROUPS);
    const [statuses, setStatuses] = useState<string[]>(DEFAULT_STATUSES);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [onlyMyDealers, setOnlyMyDealers] = useState(false);

    // Trạng thái cho tính năng Thêm đại lý & khách hàng (Trang mới)
    const [isAddPageOpen, setIsAddPageOpen] = useState<boolean>(() => {
        return typeof window !== 'undefined' && (
            window.location.pathname.toLowerCase() === '/dealers/create' ||
            window.location.pathname.toLowerCase().startsWith('/dealers/create')
        );
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

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

    // Ràng buộc phân quyền
    const rawRoles = currentUser?.roles && currentUser.roles.length > 0
        ? currentUser.roles
        : (currentUser?.role ? [currentUser.role] : []);
    const isAdmin = rawRoles.includes('admin');
    const isSalesManager = rawRoles.includes('sales_manager');
    const isAccountant = rawRoles.includes('accountant');
    const isSales = rawRoles.includes('sales');
    const isCustomer = rawRoles.includes('customer');

    const canAddDealer = rawRoles.some((r) => ['admin', 'sales_manager', 'sales'].includes(r))
        || Boolean(currentUser?.permissions && (currentUser.permissions.includes('user:manage') || currentUser.permissions.includes('*')))
        || !currentUser;
    // Nghiệp vụ Khóa / Mở khóa đại lý: Dành riêng cho Kế toán công nợ và Quản trị
    const canManageStatus = isAdmin || isSalesManager || isAccountant;
    const canAssignDealer = isAdmin || isSalesManager;
    const canUpdateCreditLimit = isAdmin || isSalesManager || isAccountant;

    // State cho Modal Khóa / Mở khóa giao dịch
    const [lockTargetDealer, setLockTargetDealer] = useState<DealerSearchItem | null>(null);
    const [lockReasonInput, setLockReasonInput] = useState('');
    const [lockError, setLockError] = useState('');
    const [unlockTargetDealer, setUnlockTargetDealer] = useState<DealerSearchItem | null>(null);

    // State cho Tạo đơn hàng đại lý (Customer portal)
    const [isCreateOrderModalOpen, setIsCreateOrderModalOpen] = useState(false);
    const [productsForOrder, setProductsForOrder] = useState<ProductItem[]>([]);

    // State cho Modal Điểm giao hàng
    const [isDeliveryPointModalOpen, setIsDeliveryPointModalOpen] = useState(false);
    const [deliveryPointTargetDealer, setDeliveryPointTargetDealer] = useState<DealerSearchItem | null>(null);

    // State cho Phân công
    const [selectedDealerIds, setSelectedDealerIds] = useState<number[]>([]);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
    const [assignTargetDealer, setAssignTargetDealer] = useState<DealerSearchItem | null>(null);
    const [newSaleIdForAssign, setNewSaleIdForAssign] = useState<string>('');
    const [assignReason, setAssignReason] = useState<string>('');

    // State cho Lịch sử phân công
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [historyTargetDealer, setHistoryTargetDealer] = useState<DealerSearchItem | null>(null);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [historyFilterTab, setHistoryFilterTab] = useState<'ALL' | 'ASSIGNMENT' | 'STATUS' | 'DEBT'>('ALL');
    const [historyPage, setHistoryPage] = useState<number>(1);
    const [historyPageSize, setHistoryPageSize] = useState<number>(10);

    const handleViewHistory = async (dealer: DealerSearchItem) => {
        if (!dealer.code) return;
        setHistoryTargetDealer(dealer);
        setHistoryFilterTab('ALL');
        setHistoryPage(1);
        setIsHistoryModalOpen(true);
        setLoadingHistory(true);
        setHistoryLogs([]);
        try {
            window.history.pushState({}, '', `/dealers?history=${encodeURIComponent(dealer.code)}`);
        } catch {}
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

    const handleBackFromHistory = () => {
        setIsHistoryModalOpen(false);
        setHistoryTargetDealer(null);
        try {
            window.history.pushState({}, '', '/dealers');
        } catch {}
    };

    // Modal Xác nhận xóa Đại lý (thay thế window.confirm bằng modal hệ thống)
    const [dealerToDelete, setDealerToDelete] = useState<DealerSearchItem | null>(null);
    const [isDeletingDealer, setIsDeletingDealer] = useState<boolean>(false);
    const [deleteDealerError, setDeleteDealerError] = useState<string | null>(null);

    const openDeleteDealerModal = (dealer: DealerSearchItem) => {
        setDealerToDelete(dealer);
        setDeleteDealerError(null);
    };

    const handleConfirmDeleteDealer = async () => {
        if (!dealerToDelete) return;
        setIsDeletingDealer(true);
        setDeleteDealerError(null);
        try {
            await deleteDealer(dealerToDelete.id, token);
            emitStatusToast({ title: 'Thành công', message: `Đã xóa đại lý "${dealerToDelete.name}" thành công`, type: 'success' });
            setDealerToDelete(null);
            handleSearch();
        } catch (err) {
            setDeleteDealerError(err instanceof Error ? err.message : 'Có lỗi khi xóa đại lý');
        } finally {
            setIsDeletingDealer(false);
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

    // State cho Cập nhật hạn mức công nợ
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

    // S7-04 State cho Cấu hình chính sách cảnh báo & khoá bán
    const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
    const [policyConfig, setPolicyConfig] = useState<CreditPolicyConfig>({
        over_limit_action: 'REQUIRE_APPROVAL',
        overdue_action: 'BLOCK',
        auto_eval_enabled: true,
    });
    const [loadingPolicy, setLoadingPolicy] = useState(false);
    const [savingPolicy, setSavingPolicy] = useState(false);
    const [evaluatingPolicy, setEvaluatingPolicy] = useState(false);

    // S7-02 / S7-04 State cho Thu tiền & đối trừ công nợ
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentTargetDealer, setPaymentTargetDealer] = useState<DealerSearchItem | null>(null);
    const [paymentAmount, setPaymentAmount] = useState<string>('');
    const [paymentMethod, setPaymentMethod] = useState<string>('Chuyển khoản');
    const [paymentRef, setPaymentRef] = useState<string>('');
    const [paymentNote, setPaymentNote] = useState<string>('');
    const [submittingPayment, setSubmittingPayment] = useState(false);

    const handleOpenPolicyModal = async () => {
        setIsPolicyModalOpen(true);
        setLoadingPolicy(true);
        try {
            const cfg = await getCreditPolicyConfigApi(token);
            setPolicyConfig(cfg);
        } catch (err) {
            emitStatusToast({ title: 'Lỗi', message: err instanceof Error ? err.message : 'Không thể tải cấu hình chính sách', type: 'error' });
        } finally {
            setLoadingPolicy(false);
        }
    };

    const handleSavePolicyConfig = async () => {
        setSavingPolicy(true);
        try {
            const updated = await updateCreditPolicyConfigApi({
                over_limit_action: policyConfig.over_limit_action,
                overdue_action: policyConfig.overdue_action,
                auto_eval_enabled: policyConfig.auto_eval_enabled,
            }, token);
            setPolicyConfig(updated);
            emitStatusToast({ title: 'Thành công', message: 'Đã cập nhật chính sách cảnh báo & khoá bán công nợ', type: 'success' });
            setIsPolicyModalOpen(false);
        } catch (err) {
            emitStatusToast({ title: 'Lỗi', message: err instanceof Error ? err.message : 'Không thể lưu cấu hình', type: 'error' });
        } finally {
            setSavingPolicy(false);
        }
    };

    const handleRunEvaluation = async () => {
        setEvaluatingPolicy(true);
        try {
            const res = await evaluateCreditPolicyApi(token);
            emitStatusToast({
                title: 'Đánh giá hoàn tất',
                message: `Đã đánh giá lại ${res.dealers_evaluated?.length || 0} đại lý. Cờ cảnh báo đã được cập nhật.`,
                type: 'success',
            });
            handleSearch();
            const cfg = await getCreditPolicyConfigApi(token);
            setPolicyConfig(cfg);
        } catch (err) {
            emitStatusToast({ title: 'Lỗi', message: err instanceof Error ? err.message : 'Lỗi đánh giá công nợ', type: 'error' });
        } finally {
            setEvaluatingPolicy(false);
        }
    };

    const handleOpenPaymentModal = (dealer: DealerSearchItem) => {
        setPaymentTargetDealer(dealer);
        setPaymentAmount(dealer.current_debt ? String(dealer.current_debt) : '');
        setPaymentMethod('Chuyển khoản');
        setPaymentRef('');
        setPaymentNote(`Thanh toán công nợ đơn hàng cho đại lý ${dealer.name}`);
        setIsPaymentModalOpen(true);
    };
    void handleOpenPaymentModal;

    const handleSubmitPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentTargetDealer) return;
        const amt = Number(paymentAmount);
        if (!amt || amt <= 0) {
            emitStatusToast({ title: 'Lỗi', message: 'Vui lòng nhập số tiền thanh toán hợp lệ lớn hơn 0', type: 'error' });
            return;
        }

        setSubmittingPayment(true);
        try {
            const res = await recordDealerPaymentApi(paymentTargetDealer.id, {
                amount: amt,
                payment_method: paymentMethod,
                reference_code: paymentRef.trim() || undefined,
                note: paymentNote.trim() || undefined,
            }, token);
            emitStatusToast({
                title: 'Ghi nhận thanh toán thành công',
                message: `Đã thu ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(res.amount)}. Đối trừ hoàn tất ${res.cleared_orders_count} đơn hàng và tự động đánh giá lại cờ công nợ.`,
                type: 'success',
            });
            setIsPaymentModalOpen(false);
            handleSearch();
        } catch (err) {
            emitStatusToast({ title: 'Lỗi', message: err instanceof Error ? err.message : 'Ghi nhận thanh toán thất bại', type: 'error' });
        } finally {
            setSubmittingPayment(false);
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
                if (res.assigned_count === 0) {
                    emitStatusToast({ title: 'Không có thay đổi', message: res.message, type: 'warning' });
                } else {
                    emitStatusToast({ title: 'Thành công', message: res.message, type: 'success' });
                }
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

    const handleOpenStatusModal = (dealer: DealerSearchItem) => {
        if (!canManageStatus) {
            emitStatusToast({
                title: 'Thông báo quyền hạn',
                message: 'Chỉ Kế toán công nợ và Quản trị viên mới có quyền Khóa / Mở khóa giao dịch đại lý.',
                type: 'warning',
            });
            return;
        }

        const isCurrentlyLocked = isDealerStatusLocked(dealer.status);

        if (isCurrentlyLocked) {
            setUnlockTargetDealer(dealer);
        } else {
            setLockTargetDealer(dealer);
            setLockReasonInput('');
            setLockError('');
        }
    };

    const handleConfirmLock = async () => {
        if (!lockTargetDealer) return;
        const trimmedReason = lockReasonInput.trim();
        if (!trimmedReason) {
            setLockError('Vui lòng nhập lý do khóa giao dịch (bắt buộc, không được để trống hoặc chỉ chứa khoảng trắng).');
            return;
        }

        setIsSubmitting(true);
        setLockError('');
        try {
            await updateDealerStatus(lockTargetDealer.id, 'Đã khóa', trimmedReason, token);
            emitStatusToast({
                title: 'Khóa giao dịch thành công',
                message: `Đã khóa giao dịch đại lý "${lockTargetDealer.name}".`,
                type: 'success',
            });
            setLockTargetDealer(null);
            setLockReasonInput('');
            handleSearch();
        } catch (err: any) {
            setLockError(err instanceof Error ? err.message : 'Có lỗi khi khóa đại lý');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmUnlock = async () => {
        if (!unlockTargetDealer) return;

        setIsSubmitting(true);
        try {
            await updateDealerStatus(unlockTargetDealer.id, 'Đang hoạt động', undefined, token);
            emitStatusToast({
                title: 'Mở khóa thành công',
                message: `Đã mở khóa giao dịch cho đại lý "${unlockTargetDealer.name}".`,
                type: 'success',
            });
            setUnlockTargetDealer(null);
            handleSearch();
        } catch (err: any) {
            emitStatusToast({
                title: 'Lỗi',
                message: err instanceof Error ? err.message : 'Có lỗi khi mở khóa đại lý',
                type: 'error',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCustomerCreateOrder = async (dealer: DealerSearchItem) => {
        const isLocked = isDealerStatusLocked(dealer.status);
        if (isLocked) {
            emitStatusToast({
                title: 'Giao dịch bị khóa',
                message: 'Đại lý của bạn hiện đã bị khóa giao dịch. Vui lòng liên hệ quản trị viên.',
                type: 'warning',
            });
            return;
        }

        if (productsForOrder.length === 0 && token) {
            try {
                const res = await getProductsApi(token);
                setProductsForOrder(res.items || []);
            } catch (e) {
                console.error('Không thể tải sản phẩm cho đơn hàng:', e);
            }
        }
        setIsCreateOrderModalOpen(true);
    };

    const handleOpenAddModal = () => {
        if (!canAddDealer) {
            emitStatusToast({
                title: 'Thông báo quyền hạn',
                message: 'Bạn không có quyền thêm đại lý & khách hàng. Chức năng này yêu cầu quyền Quản trị viên hoặc Bộ phận Kinh doanh.',
                type: 'warning',
            });
            return;
        }

        setIsAddPageOpen(true);
        try {
            window.history.pushState({}, '', '/dealers/create');
        } catch {}
    };



    async function loadFilters() {
        try {
            const data = await getDealerFilters(token);

            if (data.regions && data.regions.length > 0) {
                setRegions(Array.from(new Set([...DEFAULT_REGIONS, ...data.regions])));
            }
            if (data.sales && data.sales.length > 0) {
                setSales(data.sales);
            }
            if (data.customer_groups && data.customer_groups.length > 0) {
                setCustomerGroups(getUniqueFormattedGroups(data.customer_groups));
            }
            if (data.statuses && data.statuses.length > 0) {
                setStatuses(data.statuses);
            }
        } catch (err) {
            console.error(err);
        }
    }

    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname.toLowerCase();
            setIsAddPageOpen(path === '/dealers/create' || path.startsWith('/dealers/create'));
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleSearch = useCallback(async (overrides?: {
        keyword?: string;
        region?: string;
        assignedSaleId?: string;
        customerGroup?: string;
        status?: string;
        creditStatus?: string;
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
            const searchCreditStatus = overrides?.creditStatus !== undefined ? overrides.creditStatus : creditStatus;
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
                    credit_status: searchCreditStatus || undefined,
                },
                token
            );

            let items = data.items || [];

            // Lọc client-side bổ trợ nếu backend chưa filter một số trường
            if (searchGroup) {
                items = items.filter(
                    (d) => Boolean(d.customer_group && formatGroupName(d.customer_group) === formatGroupName(searchGroup))
                );
            }
            if (searchStatus) {
                items = items.filter(
                    (d) => Boolean(d.status && d.status.toLowerCase() === searchStatus.toLowerCase())
                );
            }
            if (searchCreditStatus) {
                const cs = searchCreditStatus.toLowerCase();
                if (cs === 'flagged') {
                    items = items.filter((d) => Boolean(d.credit_warning_flag || d.is_over_credit_limit || d.is_overdue));
                } else if (cs === 'over_limit') {
                    items = items.filter((d) => Boolean(d.is_over_credit_limit));
                } else if (cs === 'overdue') {
                    items = items.filter((d) => Boolean(d.is_overdue));
                } else if (cs === 'safe') {
                    items = items.filter((d) => !d.credit_warning_flag && !d.is_over_credit_limit && !d.is_overdue);
                }
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
    }, [keyword, region, assignedSaleId, customerGroup, status, creditStatus, onlyMyDealers, token, currentUser]);

    async function handleReset() {
        setKeyword('');
        setRegion('');
        setCustomerGroup('');
        setAssignedSaleId('');
        setStatus('');
        setCreditStatus('');
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
    };

    const toggleOnlyMyDealers = () => {
        const nextState = !onlyMyDealers;
        setOnlyMyDealers(nextState);
        handleSearch({ onlyMine: nextState });
    };

    useEffect(() => {
        loadFilters();
        handleSearch();

        const handleDataSync = () => {
            loadFilters();
            handleSearch();
        };

        window.addEventListener('DEALER_DATA_CHANGED', handleDataSync);
        window.addEventListener('USER_ACCOUNTS_CHANGED', handleDataSync);
        return () => {
            window.removeEventListener('DEALER_DATA_CHANGED', handleDataSync);
            window.removeEventListener('USER_ACCOUNTS_CHANGED', handleDataSync);
        };
    }, []);

    // Phân trang danh sách đại lý (Mặc định 20 đại lý/trang)
    const [currentPage, setCurrentPage] = useState<number>(1);
    const pageSize = 20;

    useEffect(() => {
        setCurrentPage(1);
    }, [dealers.length, keyword, region, customerGroup, assignedSaleId, status, onlyMyDealers]);

    const totalPages = Math.max(1, Math.ceil(dealers.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const paginatedDealers = dealers.slice((safePage - 1) * pageSize, safePage * pageSize);

    // Đồng bộ URL và sự kiện popstate cho trang Lịch sử biến động
    useEffect(() => {
        const handlePopState = () => {
            const params = new URLSearchParams(window.location.search);
            const historyCode = params.get('history');
            if (historyCode) {
                const found = dealers.find((d) => d.code === historyCode);
                if (found) {
                    handleViewHistory(found);
                }
            } else if (isHistoryModalOpen) {
                setIsHistoryModalOpen(false);
                setHistoryTargetDealer(null);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [dealers, isHistoryModalOpen]);

    useEffect(() => {
        if (dealers.length > 0 && !isHistoryModalOpen) {
            const params = new URLSearchParams(window.location.search);
            const historyCode = params.get('history');
            if (historyCode) {
                const found = dealers.find((d) => d.code === historyCode);
                if (found) {
                    handleViewHistory(found);
                }
            }
        }
    }, [dealers]);

    if (isAddPageOpen) {
        return (
            <CreateDealerPageView
                token={token}
                currentUser={currentUser}
                regions={regions}
                sales={sales}
                customerGroups={customerGroups}
                dealers={dealers}
                onSuccess={(newDealer) => {
                    setDealers((prev) => [newDealer, ...prev]);
                    setIsAddPageOpen(false);
                    try {
                        window.history.pushState({}, '', '/dealers');
                    } catch {}
                }}
                onBack={() => {
                    setIsAddPageOpen(false);
                    try {
                        window.history.pushState({}, '', '/dealers');
                    } catch {}
                }}
            />
        );
    }

    // GIAO DIỆN 1 TRANG: LỊCH SỬ CHUYỂN GIAO & BIẾN ĐỘNG ĐẠI LÝ
    if (isHistoryModalOpen && historyTargetDealer) {
        const assignmentCount = historyLogs.filter((l: any) => l.action_type === 'DEALER_ASSIGNMENT').length;
        const statusCount = historyLogs.filter((l: any) => l.action_type === 'DEALER_STATUS_CHANGE').length;
        const debtCount = historyLogs.filter((l: any) => l.action_type === 'DEBT_LIMIT_CHANGE').length;

        const displayedLogs = historyLogs.filter((l: any) => {
            if (historyFilterTab === 'ASSIGNMENT') return l.action_type === 'DEALER_ASSIGNMENT';
            if (historyFilterTab === 'STATUS') return l.action_type === 'DEALER_STATUS_CHANGE';
            if (historyFilterTab === 'DEBT') return l.action_type === 'DEBT_LIMIT_CHANGE';
            return true;
        });

        const historyTotalPages = Math.max(1, Math.ceil(displayedLogs.length / historyPageSize));
        const safeHistoryPage = Math.min(Math.max(1, historyPage), historyTotalPages);
        const paginatedLogs = displayedLogs.slice((safeHistoryPage - 1) * historyPageSize, safeHistoryPage * historyPageSize);

        const isLocked = isDealerStatusLocked(historyTargetDealer.status);
        const displayStatus = formatDealerStatus(historyTargetDealer.status);
        const creditInfo = getDealerCreditStatusInfo(historyTargetDealer);

        return (
            <div className="dealer-search-page dealer-history-view">
                {/* 1. Header & Điều hướng Quay lại */}
                <div className="dealer-search-header" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', width: '100%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className="dealer-back-btn"
                                onClick={handleBackFromHistory}
                                title="Quay lại danh sách đại lý"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '9px 18px',
                                    background: '#ffffff',
                                    color: '#0f766e',
                                    border: '1px solid #ccfbf1',
                                    borderRadius: '10px',
                                    fontSize: '13.5px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 3px rgba(15, 118, 110, 0.08)',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="19" y1="12" x2="5" y2="12"></line>
                                    <polyline points="12 19 5 12 12 5"></polyline>
                                </svg>
                                <span>Quay lại danh sách đại lý</span>
                            </button>

                            <div>
                                <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    Lịch sử chuyển giao &amp; biến động
                                </h2>
                            </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() => handleViewHistory(historyTargetDealer)}
                                disabled={loadingHistory}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '9px 16px',
                                    borderRadius: '10px',
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    color: '#334155',
                                    fontSize: '13.5px',
                                    fontWeight: '600',
                                    cursor: loadingHistory ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                }}
                            >
                                <span>{loadingHistory ? 'Đang tải...' : 'Làm mới dữ liệu'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Khối Bảng Thống Nhất: Thông Tin Đại Lý & Lịch Sử Biến Động */}
                <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    flex: '1 1 auto',
                    minHeight: '400px'
                }}>
                    {/* Phần Thông Tin Tóm Tắt Đại Lý Trên Cùng Bảng */}
                    <div style={{
                        padding: '18px 24px',
                        borderBottom: '1px solid #e2e8f0',
                        background: '#ffffff'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                <div style={{
                                    width: '52px',
                                    height: '52px',
                                    borderRadius: '14px',
                                    background: 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)',
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '22px',
                                    fontWeight: '700',
                                    boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)'
                                }}>
                                    {historyTargetDealer.name ? historyTargetDealer.name.charAt(0).toUpperCase() : 'Đ'}
                                </div>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>
                                            {historyTargetDealer.name}
                                        </h3>
                                        <span style={{
                                            fontFamily: 'monospace',
                                            fontSize: '13px',
                                            padding: '3px 10px',
                                            borderRadius: '6px',
                                            background: '#f1f5f9',
                                            color: '#334155',
                                            fontWeight: '700',
                                            border: '1px solid #cbd5e1'
                                        }}>
                                            {historyTargetDealer.code}
                                        </span>
                                        <span style={{
                                            fontSize: '12.5px',
                                            padding: '3px 12px',
                                            borderRadius: '20px',
                                            fontWeight: '600',
                                            background: isLocked ? '#fee2e2' : '#dcfce7',
                                            color: isLocked ? '#dc2626' : '#16a34a',
                                            border: `1px solid ${isLocked ? '#fca5a5' : '#86efac'}`
                                        }}>
                                            {displayStatus}
                                        </span>
                                        {historyTargetDealer.customer_group && (
                                            <span style={{
                                                fontSize: '12.5px',
                                                padding: '3px 12px',
                                                borderRadius: '20px',
                                                fontWeight: '600',
                                                background: '#f0fdf4',
                                                color: '#166534',
                                                border: '1px solid #bbf7d0'
                                            }}>
                                                {formatGroupName(historyTargetDealer.customer_group)}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '13.5px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        {historyTargetDealer.address && (
                                            <span>{historyTargetDealer.address}</span>
                                        )}
                                        {historyTargetDealer.region && (
                                            <span>Vùng: {historyTargetDealer.region}</span>
                                        )}
                                        {historyTargetDealer.phone && (
                                            <span>SĐT: {historyTargetDealer.phone}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Metrics Pills */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                <div className="dealer-history-metric-box">
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>NV Phụ trách hiện tại</div>
                                    <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', marginTop: '3px' }}>
                                        {historyTargetDealer.assigned_sale_name || 'Chưa phân công'}
                                    </div>
                                </div>
                                <div className="dealer-history-metric-box">
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Hạn mức công nợ</div>
                                    <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f766e', marginTop: '3px' }}>
                                        {new Intl.NumberFormat('vi-VN').format(historyTargetDealer.credit_limit ?? 50000000)} đ
                                    </div>
                                </div>
                                <div className="dealer-history-metric-box">
                                    <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Thời hạn nợ / Tình trạng</div>
                                    <div style={{ fontSize: '14.5px', fontWeight: '700', color: creditInfo.isWarning ? '#dc2626' : '#16a34a', marginTop: '3px' }}>
                                        {historyTargetDealer.max_debt_days ?? 30} ngày &bull; {creditInfo.label}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Header Tabs */}
                    <div style={{
                        padding: '14px 20px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px',
                        background: '#fafbfc'
                    }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                className={`dealer-history-tab-btn ${historyFilterTab === 'ALL' ? 'active' : ''}`}
                                onClick={() => { setHistoryFilterTab('ALL'); setHistoryPage(1); }}
                            >
                                <span>Tất cả</span>
                                <span className="dealer-history-tab-count">{historyLogs.length}</span>
                            </button>
                            <button
                                type="button"
                                className={`dealer-history-tab-btn ${historyFilterTab === 'ASSIGNMENT' ? 'active' : ''}`}
                                onClick={() => { setHistoryFilterTab('ASSIGNMENT'); setHistoryPage(1); }}
                            >
                                <span>Chuyển giao NV</span>
                                <span className="dealer-history-tab-count">{assignmentCount}</span>
                            </button>
                            <button
                                type="button"
                                className={`dealer-history-tab-btn ${historyFilterTab === 'STATUS' ? 'active' : ''}`}
                                onClick={() => { setHistoryFilterTab('STATUS'); setHistoryPage(1); }}
                            >
                                <span>Đổi trạng thái</span>
                                <span className="dealer-history-tab-count">{statusCount}</span>
                            </button>
                            <button
                                type="button"
                                className={`dealer-history-tab-btn ${historyFilterTab === 'DEBT' ? 'active' : ''}`}
                                onClick={() => { setHistoryFilterTab('DEBT'); setHistoryPage(1); }}
                            >
                                <span>Hạn mức nợ</span>
                                <span className="dealer-history-tab-count">{debtCount}</span>
                            </button>
                        </div>

                        <div style={{ fontSize: '13px', color: '#64748b' }}>
                            Hiển thị <strong>{displayedLogs.length === 0 ? 0 : `${(safeHistoryPage - 1) * historyPageSize + 1}–${Math.min(safeHistoryPage * historyPageSize, displayedLogs.length)}`}</strong> trong <strong>{displayedLogs.length}</strong> biến động
                        </div>
                    </div>

                    {/* Table Body or Empty / Loading State */}
                    {loadingHistory ? (
                        <div style={{ padding: '80px 20px', textAlign: 'center', color: '#64748b' }}>
                            <div style={{ display: 'inline-block', marginBottom: '12px' }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                                    <line x1="12" y1="2" x2="12" y2="6"></line>
                                    <line x1="12" y1="18" x2="12" y2="22"></line>
                                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                                    <line x1="2" y1="12" x2="6" y2="12"></line>
                                    <line x1="18" y1="12" x2="22" y2="12"></line>
                                    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                                    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                                </svg>
                            </div>
                            <p style={{ margin: 0, fontSize: '14.5px', fontWeight: '500' }}>Đang tải lịch sử chuyển giao và biến động đại lý...</p>
                        </div>
                    ) : displayedLogs.length === 0 ? (
                        <div style={{
                            padding: '80px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            color: '#64748b'
                        }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                background: '#f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: '16px',
                                color: '#94a3b8'
                            }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                    <polyline points="14 2 14 8 20 8"></polyline>
                                    <line x1="16" y1="13" x2="8" y2="13"></line>
                                    <line x1="16" y1="17" x2="8" y2="17"></line>
                                    <polyline points="10 9 9 9 8 9"></polyline>
                                </svg>
                            </div>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: '600', color: '#334155' }}>
                                Chưa có bản ghi lịch sử nào
                            </h4>
                            <p style={{ margin: 0, fontSize: '14px', maxWidth: '440px', lineHeight: 1.5, color: '#64748b' }}>
                                {historyFilterTab === 'ASSIGNMENT'
                                    ? 'Đại lý này chưa từng có lịch sử điều chuyển nhân viên kinh doanh phụ trách.'
                                    : historyFilterTab === 'STATUS'
                                        ? 'Chưa có lịch sử thay đổi trạng thái hoạt động (Khóa / Mở khóa).'
                                        : historyFilterTab === 'DEBT'
                                            ? 'Chưa có lịch sử điều chỉnh hạn mức công nợ hoặc thời hạn nợ.'
                                            : 'Đại lý này chưa có bất kỳ lịch sử chuyển giao hoặc thay đổi thiết lập nào trong hệ thống.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="dealer-history-table-wrap">
                                <table className="dealer-history-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '160px', minWidth: '160px' }}>Thời gian</th>
                                            <th style={{ width: '190px', minWidth: '190px' }}>Người thực hiện</th>
                                            <th style={{ width: '140px', minWidth: '140px' }}>Hành động</th>
                                            <th style={{ minWidth: '340px' }}>Chi tiết biến động (Cũ &rarr; Mới)</th>
                                            <th style={{ minWidth: '220px' }}>Lý do / Ghi chú</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedLogs.map((log, idx) => {
                                            let oldObj: any = {};
                                            let newObj: any = {};
                                            try { if (log.old_values) oldObj = typeof log.old_values === 'string' ? JSON.parse(log.old_values) : log.old_values; } catch { }
                                            try { if (log.new_values) newObj = typeof log.new_values === 'string' ? JSON.parse(log.new_values) : log.new_values; } catch { }

                                            let actionName = 'Khác';
                                            let badgeBg = '#f1f5f9';
                                            let badgeColor = '#334155';
                                            let badgeBorder = '#cbd5e1';

                                            if (log.action_type === 'DEALER_ASSIGNMENT') {
                                                actionName = 'Chuyển giao NV';
                                                badgeBg = '#dcfce7';
                                                badgeColor = '#15803d';
                                                badgeBorder = '#bbf7d0';
                                            } else if (log.action_type === 'DEBT_LIMIT_CHANGE') {
                                                actionName = 'Đổi hạn mức';
                                                badgeBg = '#e0f2fe';
                                                badgeColor = '#0369a1';
                                                badgeBorder = '#bae6fd';
                                            } else if (log.action_type === 'DEALER_STATUS_CHANGE') {
                                                actionName = 'Đổi trạng thái';
                                                badgeBg = '#fef3c7';
                                                badgeColor = '#b45309';
                                                badgeBorder = '#fde68a';
                                            }

                                            return (
                                                <tr key={log.id || idx}>
                                                    <td style={{ whiteSpace: 'nowrap', color: '#475569', fontSize: '13px' }}>
                                                        {new Date(log.created_at).toLocaleString('vi-VN')}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span style={{
                                                                width: '26px',
                                                                height: '26px',
                                                                borderRadius: '50%',
                                                                background: '#e2e8f0',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '11px',
                                                                fontWeight: '700',
                                                                color: '#475569',
                                                                flexShrink: 0
                                                            }}>
                                                                {(log.user_name || 'H')[0].toUpperCase()}
                                                            </span>
                                                            <span style={{ color: '#0f172a', fontWeight: '600' }}>{log.user_name || 'Hệ thống'}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ whiteSpace: 'nowrap' }}>
                                                        <span style={{
                                                            background: badgeBg,
                                                            color: badgeColor,
                                                            border: `1px solid ${badgeBorder}`,
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            fontSize: '12px',
                                                            fontWeight: '600',
                                                            display: 'inline-block'
                                                        }}>
                                                            {actionName}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {log.action_type === 'DEALER_ASSIGNMENT' ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                <span style={{
                                                                    color: '#475569',
                                                                    fontWeight: 500,
                                                                    padding: '2px 8px',
                                                                    background: '#f1f5f9',
                                                                    borderRadius: '5px',
                                                                    border: '1px solid #e2e8f0',
                                                                    fontSize: '13px'
                                                                }}>
                                                                    {oldObj.assigned_sale_name || 'Chưa phân công'}
                                                                </span>
                                                                <span style={{ color: '#0f766e', fontWeight: 700, fontSize: '14px' }}>➔</span>
                                                                <span style={{
                                                                    color: '#0f766e',
                                                                    fontWeight: 700,
                                                                    padding: '2px 8px',
                                                                    background: '#f0fdf4',
                                                                    borderRadius: '5px',
                                                                    border: '1px solid #bbf7d0',
                                                                    fontSize: '13px'
                                                                }}>
                                                                    {newObj.assigned_sale_name || 'Chưa phân công'}
                                                                </span>
                                                            </div>
                                                        ) : log.action_type === 'DEALER_STATUS_CHANGE' ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                <span style={{
                                                                    fontSize: '12px',
                                                                    padding: '2px 9px',
                                                                    borderRadius: '12px',
                                                                    background: (oldObj.status === 'ACTIVE' || oldObj.status === 'Đang hoạt động') ? '#dcfce7' : '#fee2e2',
                                                                    color: (oldObj.status === 'ACTIVE' || oldObj.status === 'Đang hoạt động') ? '#15803d' : '#dc2626',
                                                                    fontWeight: 600,
                                                                    border: `1px solid ${(oldObj.status === 'ACTIVE' || oldObj.status === 'Đang hoạt động') ? '#bbf7d0' : '#fecaca'}`
                                                                }}>
                                                                    {oldObj.status || '-'}
                                                                </span>
                                                                <span style={{ color: '#94a3b8', fontWeight: 700 }}>➔</span>
                                                                <span style={{
                                                                    fontSize: '12px',
                                                                    padding: '2px 9px',
                                                                    borderRadius: '12px',
                                                                    background: (newObj.status === 'ACTIVE' || newObj.status === 'Đang hoạt động') ? '#dcfce7' : '#fee2e2',
                                                                    color: (newObj.status === 'ACTIVE' || newObj.status === 'Đang hoạt động') ? '#15803d' : '#dc2626',
                                                                    fontWeight: 600,
                                                                    border: `1px solid ${(newObj.status === 'ACTIVE' || newObj.status === 'Đang hoạt động') ? '#bbf7d0' : '#fecaca'}`
                                                                }}>
                                                                    {newObj.status || '-'}
                                                                </span>
                                                            </div>
                                                        ) : log.action_type === 'DEBT_LIMIT_CHANGE' ? (
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                                                    <span style={{ color: '#64748b' }}>Hạn mức:</span>
                                                                    <span style={{ color: '#475569' }}>{oldObj.credit_limit != null ? `${new Intl.NumberFormat('vi-VN').format(oldObj.credit_limit)} đ` : '-'}</span>
                                                                    <span style={{ color: '#0369a1', fontWeight: 700 }}>➔</span>
                                                                    <strong style={{ color: '#0f766e' }}>{newObj.credit_limit != null ? `${new Intl.NumberFormat('vi-VN').format(newObj.credit_limit)} đ` : '-'}</strong>
                                                                </div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#64748b' }}>
                                                                    <span>Thời hạn:</span>
                                                                    <span>{oldObj.max_debt_days != null ? `${oldObj.max_debt_days} ngày` : '-'}</span>
                                                                    <span>➔</span>
                                                                    <strong>{newObj.max_debt_days != null ? `${newObj.max_debt_days} ngày` : '-'}</strong>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: '#1e293b' }}>-</span>
                                                        )}
                                                    </td>
                                                    <td style={{ color: '#475569', fontSize: '13px', lineHeight: 1.45 }}>
                                                        {log.reason ? (
                                                            <span style={{ fontStyle: 'italic' }}>{log.reason}</span>
                                                        ) : (
                                                            <span style={{ color: '#94a3b8' }}>-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* FOOTER PHÂN TRANG LỊCH SỬ BIẾN ĐỘNG */}
                            <div
                                style={{
                                    padding: '12px 20px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '12px',
                                    borderTop: '1px solid #e2e8f0',
                                    background: '#f8fafc',
                                    fontSize: '13px',
                                    color: '#64748b',
                                    flexShrink: 0,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                    <span>
                                        Hiển thị <strong>{(safeHistoryPage - 1) * historyPageSize + 1}</strong>–<strong>{Math.min(safeHistoryPage * historyPageSize, displayedLogs.length)}</strong> trên <strong>{displayedLogs.length}</strong> biến động
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ fontSize: '12.5px' }}>Số dòng:</span>
                                        <select
                                            value={historyPageSize}
                                            onChange={(e) => {
                                                setHistoryPageSize(Number(e.target.value));
                                                setHistoryPage(1);
                                            }}
                                            style={{
                                                padding: '4px 8px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                fontSize: '12.5px',
                                                background: '#ffffff',
                                                color: '#334155',
                                                cursor: 'pointer',
                                                outline: 'none',
                                            }}
                                        >
                                            <option value={5}>5 dòng / trang</option>
                                            <option value={10}>10 dòng / trang</option>
                                            <option value={20}>20 dòng / trang</option>
                                            <option value={50}>50 dòng / trang</option>
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                                        disabled={safeHistoryPage === 1}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '0 10px',
                                            height: '32px',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            backgroundColor: '#ffffff',
                                            color: safeHistoryPage === 1 ? '#94a3b8' : '#334155',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            cursor: safeHistoryPage === 1 ? 'not-allowed' : 'pointer',
                                            opacity: safeHistoryPage === 1 ? 0.6 : 1,
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        ‹ Trước
                                    </button>

                                    {Array.from({ length: historyTotalPages }, (_, i) => i + 1)
                                        .filter((p) => p === 1 || p === historyTotalPages || Math.abs(p - safeHistoryPage) <= 1)
                                        .reduce<(number | string)[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                                                acc.push('...');
                                            }
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((p, idx) => {
                                            if (typeof p === 'string') {
                                                return (
                                                    <span key={`dots-${idx}`} style={{ padding: '0 4px', color: '#94a3b8', fontSize: '12px' }}>
                                                        ...
                                                    </span>
                                                );
                                            }
                                            const isActive = p === safeHistoryPage;
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setHistoryPage(p)}
                                                    style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        minWidth: '32px',
                                                        height: '32px',
                                                        padding: '0 8px',
                                                        borderRadius: '6px',
                                                        border: isActive ? '1px solid #0f766e' : '1px solid #cbd5e1',
                                                        backgroundColor: isActive ? '#0f766e' : '#ffffff',
                                                        color: isActive ? '#ffffff' : '#334155',
                                                        fontSize: '13px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        boxShadow: isActive ? '0 1px 3px rgba(15, 118, 110, 0.25)' : 'none',
                                                        transition: 'all 0.15s ease',
                                                    }}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}

                                    <button
                                        type="button"
                                        onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                                        disabled={safeHistoryPage === historyTotalPages}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '0 10px',
                                            height: '32px',
                                            borderRadius: '6px',
                                            border: '1px solid #cbd5e1',
                                            backgroundColor: '#ffffff',
                                            color: safeHistoryPage === historyTotalPages ? '#94a3b8' : '#334155',
                                            fontSize: '13px',
                                            fontWeight: '500',
                                            cursor: safeHistoryPage === historyTotalPages ? 'not-allowed' : 'pointer',
                                            opacity: safeHistoryPage === historyTotalPages ? 0.6 : 1,
                                            transition: 'all 0.15s ease',
                                        }}
                                    >
                                        Sau ›
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="dealer-search-page">
            <div className="dealer-search-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                        <div>
                            <h2>
                                {isCustomer
                                    ? 'Hồ sơ & Trạng thái đại lý'
                                    : (isAdmin || isSalesManager ? 'Quản lý & Tra cứu đại lý' : 'Tra cứu đại lý & khách hàng')}
                            </h2>
                            <p>
                                {isCustomer
                                    ? 'Tra cứu thông tin đại lý, hạn mức công nợ và tình trạng giao dịch của bạn'
                                    : (isAdmin || isSalesManager
                                        ? 'Quản lý danh sách, phân công phụ trách và theo dõi hạn mức công nợ đại lý'
                                        : 'Tìm nhanh đại lý trong tuyến, liên hệ & chỉ đường trực tiếp khi đang di chuyển ngoài đường')}
                            </p>
                        </div>
                    </div>

                    {!isCustomer && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            {isSales && !isAdmin && !isSalesManager && currentUser && (
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
                                        ? 'Thêm mới đại lý hoặc khách hàng vào tuyến'
                                        : 'Bạn không có quyền thực hiện chức năng này (Yêu cầu quyền Quản trị viên hoặc Bộ phận Kinh doanh)'
                                }
                            >
                                <span>Thêm đại lý & khách hàng</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>


            {!isCustomer && (
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
                            onChange={(e) => setRegion(e.target.value)}
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
                            onChange={(e) => setCustomerGroup(e.target.value)}
                        >
                            <option value="">Tất cả nhóm</option>
                            {getUniqueFormattedGroups(customerGroups).map((group) => (
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
                            onChange={(e) => setAssignedSaleId(e.target.value)}
                        >
                            <option value="">Tất cả nhân viên</option>
                            {sales.map((sale) => (
                                <option key={sale.id} value={sale.id}>
                                    {sale.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="dealer-field">
                        <label>Trạng thái</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="">Tất cả trạng thái</option>
                            {statuses.map((st) => (
                                <option key={st} value={st}>
                                    {st}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="dealer-field">
                        <label>Cảnh báo công nợ</label>
                        <select
                            value={creditStatus}
                            onChange={(e) => {
                                setCreditStatus(e.target.value);
                                handleSearch({ creditStatus: e.target.value });
                            }}
                        >
                            <option value="">Tất cả công nợ</option>
                            <option value="flagged">Bị gắn cờ cảnh báo</option>
                            <option value="over_limit">Vượt hạn mức tiền</option>
                            <option value="overdue">Quá hạn thanh toán</option>
                            <option value="safe">Trong hạn mức an toàn</option>
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
            )}

            {error && (
                <div className="dealer-error">
                    {error}
                </div>
            )}

            {isCustomer ? (
                <div className="dealer-result" style={{ marginTop: '20px' }}>
                    {dealers.length === 0 && !loading ? (
                        <div style={{ background: '#fff', padding: '36px', borderRadius: '12px', textAlign: 'center', color: '#64748b', border: '1px solid #e2e8f0' }}>
                            Không tìm thấy hồ sơ đại lý liên kết với tài khoản của bạn.
                        </div>
                    ) : (
                        dealers.slice(0, 1).map((dealer) => {
                            const isLocked = isDealerStatusLocked(dealer.status);
                            return (
                                <div key={dealer.id} className="dealer-card-item" style={{ maxWidth: '680px', margin: '0 auto', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', padding: '24px' }}>
                                    <div className="dealer-card-header" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
                                        <div>
                                            <span className="dealer-code-badge">{dealer.code}</span>
                                            <h3 className="dealer-card-name" style={{ fontSize: '18px', marginTop: '6px' }}>{dealer.name}</h3>
                                        </div>
                                        <div className="dealer-status-cell">
                                            <span
                                                className={`dealer-status-toggle-btn read-only ${isLocked ? 'status-inactive' : 'status-active'}`}
                                            >
                                                <span>{isLocked ? 'Đã khóa' : 'Đang hoạt động'}</span>
                                            </span>
                                        </div>
                                    </div>

                                    {isLocked && (
                                        <div
                                            style={{
                                                background: '#fef2f2',
                                                border: '1.5px solid #ef4444',
                                                borderRadius: '8px',
                                                padding: '14px 18px',
                                                marginBottom: '20px',
                                                color: '#991b1b',
                                                fontSize: '14px',
                                                lineHeight: 1.5,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                boxShadow: '0 1px 3px rgba(239, 68, 68, 0.1)',
                                            }}
                                        >
                                            <div>
                                                <strong>Đại lý đã bị khóa giao dịch. Vui lòng liên hệ quản trị viên.</strong>
                                            </div>
                                        </div>
                                    )}

                                    <div className="dealer-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                                        {dealer.customer_group && (
                                            <div className="dealer-card-meta">
                                                <span className="meta-label">Nhóm khách hàng:</span>
                                                <span className="dealer-group-tag">{formatGroupName(dealer.customer_group)}</span>
                                            </div>
                                        )}
                                        {dealer.region && (
                                            <div className="dealer-card-meta">
                                                <span className="meta-label">Khu vực:</span>
                                                <span>{dealer.region}</span>
                                            </div>
                                        )}
                                        {dealer.phone && (
                                            <div className="dealer-card-meta">
                                                <span className="meta-label">Số điện thoại:</span>
                                                <span>{dealer.phone}</span>
                                            </div>
                                        )}
                                        {dealer.address && (
                                            <div className="dealer-card-meta address">
                                                <span className="meta-label">Địa chỉ:</span>
                                                <span>{dealer.address}</span>
                                            </div>
                                        )}
                                        <div className="dealer-card-meta">
                                            <span className="meta-label">Công nợ hiện tại:</span>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span>
                                                    <strong>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dealer.current_debt ?? 0)}</strong>
                                                    {' / Hạn mức: '}
                                                    <span style={{ color: '#64748b' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dealer.credit_limit ?? 50000000)}</span>
                                                </span>
                                                {(() => {
                                                    const creditInfo = getDealerCreditStatusInfo(dealer);
                                                    return (
                                                        <span style={{
                                                            fontSize: '0.8rem',
                                                            marginTop: '4px',
                                                            color: creditInfo.isWarning ? '#dc2626' : '#16a34a',
                                                            fontWeight: 600,
                                                        }}>
                                                            Trạng thái: {creditInfo.label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        {dealer.assigned_sale_name && (
                                            <div className="dealer-card-meta">
                                                <span className="meta-label">Nhân viên phụ trách:</span>
                                                <span>{dealer.assigned_sale_name}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="dealer-card-actions" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                        {isLocked ? (
                                            <button
                                                type="button"
                                                className="btn-search-primary"
                                                style={{
                                                    background: '#94a3b8',
                                                    borderColor: '#94a3b8',
                                                    cursor: 'not-allowed',
                                                    opacity: 0.9,
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                }}
                                                onClick={() => emitStatusToast({
                                                    title: 'Giao dịch bị khóa',
                                                    message: 'Đại lý của bạn hiện đã bị khóa giao dịch. Vui lòng liên hệ quản trị viên.',
                                                    type: 'warning',
                                                })}
                                                title="Đại lý hiện đã bị khóa giao dịch"
                                            >
                                                <span>Đã khóa tạo đơn</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                className="btn-search-primary"
                                                style={{
                                                    background: 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                                                    color: '#fff',
                                                    border: 'none',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    boxShadow: '0 2px 6px rgba(15, 186, 144, 0.3)',
                                                }}
                                                onClick={() => handleCustomerCreateOrder(dealer)}
                                            >
                                                <span>Tạo đơn hàng</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            ) : (
                <div className="dealer-result">
                    <div className="dealer-result-title">
                        <div>
                            <strong>{rawRoles.includes('sales_manager') || rawRoles.includes('admin') ? 'Danh sách đại lý & khách hàng' : 'Danh sách đại lý trong tuyến'}</strong>
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
                                className="btn-bulk-assign"
                                style={{
                                    fontFamily: 'inherit',
                                    fontSize: '13.5px',
                                    fontWeight: 600,
                                    height: '36px',
                                    padding: '0 16px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: '#0fad89',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                    whiteSpace: 'nowrap',
                                }}
                                onClick={() => {
                                    setNewSaleIdForAssign('');
                                    setAssignReason('');
                                    setIsBulkAssignModalOpen(true);
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                                <span>Chuyển giao hàng loạt</span>
                            </button>
                        )}
                    </div>

                    {/* Bảng danh sách cho màn hình Desktop / Tablet */}
                    <div className="dealer-table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    {canAssignDealer && (
                                        <th style={{ width: 36, textAlign: 'center', verticalAlign: 'middle' }}>
                                            <input
                                                type="checkbox"
                                                checked={dealers.length > 0 && selectedDealerIds.length === dealers.length}
                                                onChange={handleSelectAllDealers}
                                                style={{ cursor: 'pointer', verticalAlign: 'middle' }}
                                            />
                                        </th>
                                    )}
                                    <th style={{ whiteSpace: 'nowrap' }}>Mã đại lý</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Tên đại lý</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Số điện thoại / Liên hệ</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Địa chỉ</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Khu vực</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Công nợ</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Trạng thái công nợ</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Người phụ trách</th>
                                    <th style={{ whiteSpace: 'nowrap' }}>Trạng thái</th>
                                    <th style={{ whiteSpace: 'nowrap', textAlign: 'center', width: 56 }}>Thao tác</th>
                                </tr>
                            </thead>

                            <tbody>
                                {dealers.length === 0 && !loading ? (
                                    <tr>
                                        <td colSpan={canAssignDealer ? 11 : 10} className="dealer-empty">
                                            Không tìm thấy đại lý phù hợp với điều kiện lọc
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedDealers.map((dealer) => (
                                        <tr key={dealer.id}>
                                            {canAssignDealer && (
                                                <td style={{ width: 36, textAlign: 'center', verticalAlign: 'middle' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDealerIds.includes(dealer.id)}
                                                        onChange={() => toggleSelectDealer(dealer.id)}
                                                        style={{ cursor: 'pointer', verticalAlign: 'middle' }}
                                                    />
                                                </td>
                                            )}
                                            <td>
                                                <span className="dealer-code-badge">{dealer.code}</span>
                                            </td>
                                            <td>
                                                <div className="dealer-name-cell">
                                                    <strong>{dealer.name}</strong>
                                                    {dealer.customer_group && (
                                                        <span className="dealer-group-tag">
                                                            {formatGroupName(dealer.customer_group)}
                                                        </span>
                                                    )}
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
                                                    <span style={{ fontSize: '13px' }}>
                                                        <strong>Nợ:</strong>{' '}
                                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dealer.current_debt ?? 0)}
                                                    </span>
                                                    <span style={{ fontSize: '13px' }}>
                                                        <strong>Hạn mức:</strong>{' '}
                                                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(dealer.credit_limit ?? 50000000)}
                                                    </span>
                                                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                                                        Tối đa: {dealer.max_debt_days ?? 30} ngày
                                                    </span>
                                                </div>
                                            </td>
                                            <td>
                                                {(() => {
                                                    const creditInfo = getDealerCreditStatusInfo(dealer);
                                                    return (
                                                        <span
                                                            className={creditInfo.className}
                                                            style={creditInfo.style}
                                                            title={creditInfo.tooltip}
                                                        >
                                                            {creditInfo.label}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td>
                                                {dealer.assigned_sale_name ? (
                                                    <span className="dealer-sale-badge">
                                                        {dealer.assigned_sale_name}
                                                    </span>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td>
                                                <div className="dealer-status-cell">
                                                    {canManageStatus ? (
                                                        <button
                                                            type="button"
                                                            className={`dealer-status-toggle-btn ${isDealerStatusLocked(dealer.status) ? 'status-inactive' : 'status-active'}`}
                                                            onClick={() => handleOpenStatusModal(dealer)}
                                                            disabled={isSubmitting}
                                                            title={
                                                                isDealerStatusLocked(dealer.status)
                                                                    ? 'Bấm để mở khóa giao dịch'
                                                                    : 'Bấm để khóa giao dịch'
                                                            }
                                                        >
                                                            <span>
                                                                {formatDealerStatus(dealer.status)}
                                                            </span>
                                                        </button>
                                                    ) : (
                                                        <span
                                                            className={`dealer-status-toggle-btn read-only ${isDealerStatusLocked(dealer.status) ? 'status-inactive' : 'status-active'}`}
                                                        >
                                                            <span>{formatDealerStatus(dealer.status)}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td
                                                className={openDropdownId === dealer.id ? 'dropdown-active' : undefined}
                                                style={{
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    width: 56,
                                                    zIndex: openDropdownId === dealer.id ? 25 : undefined,
                                                }}
                                            >
                                                <div
                                                    className={`dealer-dropdown-container ${openDropdownId === dealer.id ? 'open' : ''}`}
                                                    style={{
                                                        display: 'inline-flex',
                                                        justifyContent: 'center',
                                                        position: 'relative',
                                                        zIndex: openDropdownId === dealer.id ? 30 : undefined,
                                                    }}
                                                >
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
                                                            {canUpdateCreditLimit && (
                                                                <button
                                                                    type="button"
                                                                    className="dealer-dropdown-item"
                                                                    onClick={(e) => { e.stopPropagation(); handleOpenCreditModal(dealer); setOpenDropdownId(null); }}
                                                                >
                                                                    Cập nhật hạn mức
                                                                </button>
                                                            )}
                                                            {canManageStatus && (
                                                                <button
                                                                    type="button"
                                                                    className="dealer-dropdown-item"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleOpenPolicyModal();
                                                                        setOpenDropdownId(null);
                                                                    }}
                                                                >
                                                                    Cấu hình cảnh báo
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
                                                                    Chuyển giao
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                className="dealer-dropdown-item"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setDeliveryPointTargetDealer(dealer);
                                                                    setIsDeliveryPointModalOpen(true);
                                                                    setOpenDropdownId(null);
                                                                }}
                                                            >
                                                                Điểm giao hàng
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="dealer-dropdown-item"
                                                                onClick={(e) => { e.stopPropagation(); handleViewHistory(dealer); setOpenDropdownId(null); }}
                                                            >
                                                                Lịch sử
                                                            </button>
                                                            {canAssignDealer && (
                                                                <button
                                                                    type="button"
                                                                    className="dealer-dropdown-item"
                                                                    onClick={(e) => { e.stopPropagation(); openDeleteDealerModal(dealer); setOpenDropdownId(null); }}
                                                                    style={{ color: '#ef4444' }}
                                                                >
                                                                    Xóa đại lý
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
                            paginatedDealers.map((dealer) => (
                                <div key={dealer.id} className="dealer-card-item">
                                    <div className="dealer-card-header">
                                        <div>
                                            <span className="dealer-code-badge">{dealer.code}</span>
                                            <h3 className="dealer-card-name">{dealer.name}</h3>
                                        </div>
                                        <div className="dealer-status-cell">
                                            {canManageStatus ? (
                                                <button
                                                    type="button"
                                                    className={`dealer-status-toggle-btn ${isDealerStatusLocked(dealer.status) ? 'status-inactive' : 'status-active'}`}
                                                    onClick={() => handleOpenStatusModal(dealer)}
                                                    disabled={isSubmitting}
                                                    title={
                                                        isDealerStatusLocked(dealer.status)
                                                            ? 'Bấm để mở khóa giao dịch'
                                                            : 'Bấm để khóa giao dịch'
                                                    }
                                                >
                                                    <span>
                                                        {formatDealerStatus(dealer.status)}
                                                    </span>
                                                </button>
                                            ) : (
                                                <span
                                                    className={`dealer-status-toggle-btn read-only ${isDealerStatusLocked(dealer.status) ? 'status-inactive' : 'status-active'}`}
                                                >
                                                    <span>{formatDealerStatus(dealer.status)}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="dealer-card-body">
                                        {dealer.customer_group && (
                                            <div className="dealer-card-meta">
                                                <span className="meta-label">Nhóm:</span>
                                                <span className="dealer-group-tag">{formatGroupName(dealer.customer_group)}</span>
                                            </div>
                                        )}

                                        <div className="dealer-card-meta">
                                            <span className="meta-label">Khu vực:</span>
                                            <span>{dealer.region || 'Chưa phân vùng'}</span>
                                        </div>

                                        {dealer.assigned_sale_name && (
                                            <div className="dealer-card-meta">
                                                <span className="meta-label">Phụ trách:</span>
                                                <span>{dealer.assigned_sale_name}</span>
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
                                                    const creditInfo = getDealerCreditStatusInfo(dealer);
                                                    return (
                                                        <span style={{
                                                            fontSize: '0.8rem',
                                                            marginTop: '4px',
                                                            color: creditInfo.isWarning ? '#dc2626' : '#16a34a',
                                                            fontWeight: 600,
                                                        }}>
                                                            Trạng thái: {creditInfo.label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="dealer-card-actions">
                                        {canUpdateCreditLimit && (
                                            <button
                                                onClick={() => handleOpenCreditModal(dealer)}
                                                className="dealer-btn-call"
                                                style={{ background: '#8b5cf6', color: '#fff', borderColor: '#8b5cf6' }}
                                            >
                                                Hạn mức
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleViewHistory(dealer)}
                                            className="dealer-btn-call"
                                            style={{ background: '#0f766e', color: '#fff', borderColor: '#0f766e' }}
                                        >
                                            Lịch sử
                                        </button>
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

                    {/* FOOTER PHÂN TRANG */}
                    {!loading && dealers.length > 0 && (
                        <div
                            style={{
                                padding: '10px 18px',
                                display: 'flex',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '12px',
                                borderTop: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                fontSize: '12.5px',
                                color: '#64748b',
                                flexShrink: 0,
                            }}
                        >
                            {/* Bộ nút số trang theo phong cách thương hiệu */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                                        if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                                            acc.push('...');
                                        }
                                        acc.push(p);
                                        return acc;
                                    }, [])
                                    .map((p, idx) => {
                                        if (typeof p === 'string') {
                                            return (
                                                <span key={`dots-${idx}`} style={{ padding: '0 4px', color: '#94a3b8', fontSize: '12px' }}>
                                                    ...
                                                </span>
                                            );
                                        }
                                        const isActive = p === safePage;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setCurrentPage(p)}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    minWidth: '30px',
                                                    height: '30px',
                                                    padding: '0 6px',
                                                    borderRadius: '6px',
                                                    border: isActive ? '1px solid #0fad89' : '1px solid #e2e8f0',
                                                    backgroundColor: isActive ? '#0fad89' : '#ffffff',
                                                    color: isActive ? '#ffffff' : '#334155',
                                                    fontSize: '13px',
                                                    fontWeight: '700',
                                                    cursor: 'pointer',
                                                    boxShadow: isActive ? '0 1px 3px rgba(15, 173, 137, 0.25)' : 'none',
                                                    transition: 'all 0.15s ease',
                                                }}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>
            )}



            {/* Modal Phân công lẻ */}
            {isAssignModalOpen && assignTargetDealer && (
                <ModalPortal>
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
                                    <p style={{ margin: '0' }}>Người phụ trách hiện tại: <strong style={{ color: '#64748b' }}>{assignTargetDealer.assigned_sale_name || 'Chưa có'}</strong></p>
                                </div>

                                <div className="dealer-modal-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                                    <div className="dealer-modal-field dealer-form-full">
                                        <label>Chọn nhân viên kinh doanh mới <span className="required">*</span></label>
                                        <select
                                            value={newSaleIdForAssign}
                                            onChange={(e) => setNewSaleIdForAssign(e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        >
                                            <option value="">-- Chọn nhân viên --</option>
                                            {sales.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
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
                </ModalPortal>
            )}

            {/* Modal Phân công hàng loạt */}
            {isBulkAssignModalOpen && (
                <ModalPortal>
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
                                        <label>Chọn nhân viên kinh doanh tiếp nhận <span className="required">*</span></label>
                                        <select
                                            value={newSaleIdForAssign}
                                            onChange={(e) => setNewSaleIdForAssign(e.target.value)}
                                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                        >
                                            <option value="">-- Chọn nhân viên --</option>
                                            {sales.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                        {(() => {
                                            if (!newSaleIdForAssign) return null;
                                            const alreadyCount = selectedDealerIds.filter(id => {
                                                const d = dealers.find(item => item.id === id);
                                                return d && d.assigned_sale_id === Number(newSaleIdForAssign);
                                            }).length;
                                            if (alreadyCount === selectedDealerIds.length) {
                                                return (
                                                    <div style={{ marginTop: '8px', padding: '8px 12px', background: '#fef3c7', borderRadius: '6px', color: '#92400e', fontSize: '13px' }}>
                                                        ⚠️ Tất cả {selectedDealerIds.length} đại lý được chọn đều đang do nhân viên này phụ trách. Vui lòng chọn nhân viên khác.
                                                    </div>
                                                );
                                            }
                                            if (alreadyCount > 0) {
                                                return (
                                                    <div style={{ marginTop: '8px', padding: '8px 12px', background: '#eff6ff', borderRadius: '6px', color: '#1e40af', fontSize: '13px' }}>
                                                        ℹ️ Có {alreadyCount} đại lý đã do nhân viên này phụ trách, hệ thống sẽ chuyển giao {selectedDealerIds.length - alreadyCount} đại lý còn lại.
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
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
                                {(() => {
                                    const alreadyCount = newSaleIdForAssign ? selectedDealerIds.filter(id => {
                                        const d = dealers.find(item => item.id === id);
                                        return d && d.assigned_sale_id === Number(newSaleIdForAssign);
                                    }).length : 0;
                                    const isAllAlreadyAssigned = Boolean(newSaleIdForAssign) && alreadyCount === selectedDealerIds.length;
                                    return (
                                        <button
                                            type="button"
                                            className="dealer-btn-save"
                                            onClick={handleAssignSubmit}
                                            disabled={isSubmitting || isAllAlreadyAssigned}
                                            style={isAllAlreadyAssigned ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                        >
                                            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận chuyển giao'}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}
            {/* Modal Cập nhật hạn mức công nợ */}
            {isCreditModalOpen && creditTargetDealer && (
                <ModalPortal>
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
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    border: '1px solid #cbd5e1',
                                                    borderRadius: '8px',
                                                    fontSize: '14px',
                                                    fontFamily: 'inherit',
                                                    color: '#0f172a',
                                                    backgroundColor: '#ffffff',
                                                    boxSizing: 'border-box',
                                                    resize: 'vertical',
                                                    minHeight: '80px',
                                                }}
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
                </ModalPortal>
            )}
            {/* Modal Xác Nhận Xóa Đại Lý (Thay cho window.confirm) */}
            {dealerToDelete && (
                <ModalPortal>
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            background: 'rgba(15, 23, 42, 0.45)',
                            backdropFilter: 'blur(6px)',
                            WebkitBackdropFilter: 'blur(6px)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 9999,
                            padding: '20px'
                        }}
                        onClick={() => {
                            if (!isDeletingDealer) setDealerToDelete(null);
                        }}
                    >
                        <div
                            style={{
                                background: '#ffffff',
                                border: '1px solid #fee2e2',
                                borderRadius: '16px',
                                width: '100%',
                                maxWidth: '480px',
                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                                overflow: 'hidden',
                                color: '#0f172a',
                                textAlign: 'center',
                                padding: '32px 28px',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Warning Icon */}
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                background: '#fee2e2',
                                border: '2px solid #fecaca',
                                color: '#dc2626',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '28px',
                                margin: '0 auto 18px',
                            }}>
                                ⚠️
                            </div>

                            <h3 style={{ fontSize: '18px', fontWeight: '700', fontFamily: "'Outfit', sans-serif", margin: '0 0 10px', color: '#0f172a' }}>
                                Xác Nhận Xóa Đại Lý?
                            </h3>

                            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 18px' }}>
                                Bạn có chắc chắn muốn xóa đại lý <strong style={{ color: '#b91c1c' }}>"{dealerToDelete.name}"</strong> ({dealerToDelete.code}) không?
                            </p>

                            <div style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                padding: '12px 16px',
                                marginBottom: '20px',
                                fontSize: '13px',
                                color: '#64748b',
                                textAlign: 'left',
                                lineHeight: '1.6'
                            }}>
                                <div>• Mã đại lý: <strong style={{ color: '#0f172a' }}>{dealerToDelete.code}</strong></div>
                                <div>• Tên đại lý: <strong style={{ color: '#0f172a' }}>{dealerToDelete.name}</strong></div>
                                <div>• Khu vực: <strong style={{ color: '#0f172a' }}>{dealerToDelete.region || 'Chưa cập nhật'}</strong></div>
                                <div>• Người phụ trách: <strong style={{ color: '#0f172a' }}>{dealerToDelete.assigned_sale_name || 'Chưa phân công'}</strong></div>
                            </div>

                            {deleteDealerError && (
                                <div style={{
                                    background: '#fee2e2',
                                    border: '1px solid #fecaca',
                                    color: '#b91c1c',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    fontSize: '13px',
                                    marginBottom: '16px'
                                }}>
                                    ⚠️ {deleteDealerError}
                                </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setDealerToDelete(null)}
                                    disabled={isDeletingDealer}
                                    style={{
                                        background: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '8px',
                                        color: '#475569',
                                        padding: '10px 22px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: isDeletingDealer ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDeleteDealer}
                                    disabled={isDeletingDealer}
                                    style={{
                                        background: isDeletingDealer ? '#f87171' : '#dc2626',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: '#ffffff',
                                        padding: '10px 22px',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: isDeletingDealer ? 'not-allowed' : 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}
                                >
                                    {isDeletingDealer ? 'Đang xóa...' : 'Xác nhận xóa'}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* Modal Khóa giao dịch (Bắt buộc nhập lý do) */}
            {lockTargetDealer && (
                <div className="dealer-modal-overlay" onClick={() => setLockTargetDealer(null)}>
                    <div className="dealer-modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="dealer-modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fff5f5' }}>
                            <div className="dealer-modal-title-wrap">
                                <div>
                                    <h3 style={{ color: '#b91c1c' }}>Khóa giao dịch đại lý</h3>
                                    <p style={{ color: '#7f1d1d' }}>Dừng bán hàng và chặn tạo đơn mới ngay lập tức</p>
                                </div>
                            </div>
                            <button type="button" className="dealer-modal-close-btn" onClick={() => setLockTargetDealer(null)} title="Đóng">✕</button>
                        </div>
                        <div className="dealer-modal-body">
                            <div style={{ padding: '0 0 14px 0', borderBottom: '1px solid #eaeaea', marginBottom: '16px' }}>
                                <p style={{ margin: '0 0 6px 0', fontSize: '14px' }}>
                                    Đại lý: <strong style={{ color: '#0f172a' }}>{lockTargetDealer.name}</strong> ({lockTargetDealer.code})
                                </p>
                                <p style={{ margin: '0', fontSize: '13px', color: '#64748b' }}>
                                    Công nợ hiện tại: <strong>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(lockTargetDealer.current_debt ?? 0)}</strong>
                                    {' / Hạn mức: '}
                                    <span>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(lockTargetDealer.credit_limit ?? 50000000)}</span>
                                </p>
                            </div>

                            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#991b1b', lineHeight: 1.5 }}>
                                <strong>Lưu ý:</strong> Khóa giao dịch dừng ngay việc tạo đơn hàng cho đại lý này. Đại lý vẫn có thể đăng nhập bình thường để xem hồ sơ và công nợ.
                            </div>

                            <div className="dealer-modal-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                                <div className="dealer-modal-field dealer-form-full">
                                    <label style={{ fontWeight: 600, color: '#1e293b' }}>
                                        Lý do khóa giao dịch <span className="required" style={{ color: '#dc2626' }}>*</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        placeholder="Bắt buộc nhập lý do (VD: Khách hàng chậm thanh toán, có dấu hiệu mất khả năng thanh toán...)"
                                        value={lockReasonInput}
                                        onChange={(e) => {
                                            setLockReasonInput(e.target.value);
                                            if (lockError) setLockError('');
                                        }}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: lockError ? '1.5px solid #dc2626' : '1px solid #cbd5e1', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                    {lockError && (
                                        <span style={{ color: '#dc2626', fontSize: '12.5px', marginTop: '4px', display: 'block', fontWeight: 500 }}>
                                            {lockError}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="dealer-modal-footer">
                            <button type="button" className="dealer-btn-cancel" onClick={() => setLockTargetDealer(null)} disabled={isSubmitting}>
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                className="dealer-btn-save"
                                style={{ background: '#dc2626', borderColor: '#dc2626' }}
                                onClick={handleConfirmLock}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận khóa giao dịch'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Mở khóa giao dịch (Hiển thị lịch sử khóa trước đó) */}
            {unlockTargetDealer && (
                <div className="dealer-modal-overlay" onClick={() => setUnlockTargetDealer(null)}>
                    <div className="dealer-modal-box" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="dealer-modal-header" style={{ borderBottom: '1px solid #dcfce7', background: '#f0fdf4' }}>
                            <div className="dealer-modal-title-wrap">
                                <div>
                                    <h3 style={{ color: '#15803d' }}>Mở khóa giao dịch đại lý</h3>
                                    <p style={{ color: '#166534' }}>Khôi phục quyền tạo đơn và giao dịch bình thường</p>
                                </div>
                            </div>
                            <button type="button" className="dealer-modal-close-btn" onClick={() => setUnlockTargetDealer(null)} title="Đóng">✕</button>
                        </div>
                        <div className="dealer-modal-body">
                            <div style={{ padding: '0 0 14px 0', borderBottom: '1px solid #eaeaea', marginBottom: '16px' }}>
                                <p style={{ margin: '0 0 6px 0', fontSize: '14px' }}>
                                    Đại lý: <strong style={{ color: '#0f172a' }}>{unlockTargetDealer.name}</strong> ({unlockTargetDealer.code})
                                </p>
                                <p style={{ margin: '0', fontSize: '13px', color: '#64748b' }}>
                                    Trạng thái hiện tại: <span style={{ color: '#dc2626', fontWeight: 600 }}>Đã khóa</span>
                                </p>
                            </div>

                            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400e', lineHeight: 1.6 }}>
                                <p style={{ margin: '0 0 4px 0' }}>
                                    <strong>Lý do đã khóa trước đó:</strong> {unlockTargetDealer.lock_reason || 'Không có ghi nhận cụ thể'}
                                </p>
                                <p style={{ margin: '0 0 4px 0' }}>
                                    <strong>Người thực hiện khóa:</strong> {unlockTargetDealer.locked_by || 'Chưa ghi nhận'}
                                </p>
                                <p style={{ margin: '0' }}>
                                    <strong>Thời gian khóa:</strong> {unlockTargetDealer.locked_at ? new Date(unlockTargetDealer.locked_at).toLocaleString('vi-VN') : 'Chưa ghi nhận'}
                                </p>
                            </div>

                            <p style={{ margin: '0', fontSize: '13.5px', color: '#334155', lineHeight: 1.5 }}>
                                Khi xác nhận mở khóa, đại lý sẽ chuyển về trạng thái <strong>Đang hoạt động</strong> và có thể tiếp tục đặt hàng trên hệ thống.
                            </p>
                        </div>
                        <div className="dealer-modal-footer">
                            <button type="button" className="dealer-btn-cancel" onClick={() => setUnlockTargetDealer(null)} disabled={isSubmitting}>
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                className="dealer-btn-save"
                                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                                onClick={handleConfirmUnlock}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận mở khóa'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Quản lý Điểm giao hàng */}
            {isDeliveryPointModalOpen && deliveryPointTargetDealer && (
                <div className="dealer-modal-overlay" onClick={() => setIsDeliveryPointModalOpen(false)}>
                    <div className="dealer-modal-box" style={{ maxWidth: '640px', width: '95%' }} onClick={(e) => e.stopPropagation()}>
                        <div className="dealer-modal-header" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <div className="dealer-modal-title-wrap">
                                <div>
                                    <h3 style={{ color: '#0f172a' }}>Điểm giao hàng — {deliveryPointTargetDealer.name}</h3>
                                    <p style={{ color: '#64748b' }}>Mã: {deliveryPointTargetDealer.code} | Địa chỉ đại lý: {deliveryPointTargetDealer.address || 'Chưa cập nhật'}</p>
                                </div>
                            </div>
                            <button type="button" className="dealer-modal-close-btn" onClick={() => setIsDeliveryPointModalOpen(false)} title="Đóng">✕</button>
                        </div>
                        <div className="dealer-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            <DeliveryPointManager
                                token={token || ''}
                                dealerId={deliveryPointTargetDealer.id}
                                onChanged={handleSearch}
                            />
                        </div>
                        <div className="dealer-modal-footer">
                            <button type="button" className="dealer-btn-cancel" onClick={() => setIsDeliveryPointModalOpen(false)}>
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Tạo đơn hàng cho Customer */}
            {isCreateOrderModalOpen && dealers.length > 0 && (
                <OrderCreateModal
                    isOpen={isCreateOrderModalOpen}
                    onClose={() => setIsCreateOrderModalOpen(false)}
                    token={token || ''}
                    products={productsForOrder}
                    currentUser={currentUser}
                    onSuccess={() => {
                        setIsCreateOrderModalOpen(false);
                        handleSearch();
                    }}
                    initialDealerId={dealers[0]?.id}
                />
            )}

            {/* Modal Cấu hình cảnh báo & khoá bán (S7-04) */}
            {isPolicyModalOpen && (
                <ModalPortal>
                    <div className="dealer-modal-overlay" onClick={() => setIsPolicyModalOpen(false)}>
                        <div
                            className="dealer-modal-box"
                            style={{
                                maxWidth: '560px',
                                width: '92%',
                                maxHeight: 'min(90vh, 600px)',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.28)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="dealer-modal-header" style={{
                                background: 'linear-gradient(135deg, #0fad89 0%, #0a8f70 100%)',
                                padding: '14px 20px',
                                flexShrink: 0,
                                borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <div className="dealer-modal-title-wrap">
                                    <div>
                                        <h3 style={{ color: '#ffffff', fontSize: '15px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                                            Cấu hình cảnh báo & kiểm soát rủi ro công nợ
                                        </h3>
                                        <p style={{ color: '#e6f7f2', fontSize: '12px', margin: '3px 0 0 0' }}>
                                            Thiết lập hành vi tự động khi đại lý vượt hạn mức hoặc quá số ngày nợ cho phép
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="dealer-modal-close-btn"
                                    onClick={() => setIsPolicyModalOpen(false)}
                                    title="Đóng"
                                    style={{
                                        color: '#ffffff',
                                        background: 'rgba(255, 255, 255, 0.15)',
                                        borderRadius: '6px',
                                        width: '28px',
                                        height: '28px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                        cursor: 'pointer',
                                        border: 'none',
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            <div className="dealer-modal-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 20px' }}>
                                {loadingPolicy ? (
                                    <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                                        Đang tải cấu hình chính sách...
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {/* 1. Xử lý khi vượt hạn mức tiền */}
                                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '3px' }}>
                                                1. Hành vi khi Đại lý VƯỢT HẠN MỨC TIỀN:
                                            </label>
                                            <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 8px 0' }}>
                                                Áp dụng khi tổng dư nợ hiện tại lớn hơn Hạn mức công nợ tối đa được cấp.
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12.5px' }}>
                                                    <input
                                                        type="radio"
                                                        name="over_limit_action"
                                                        value="REQUIRE_APPROVAL"
                                                        checked={policyConfig.over_limit_action === 'REQUIRE_APPROVAL'}
                                                        onChange={() => setPolicyConfig(prev => ({ ...prev, over_limit_action: 'REQUIRE_APPROVAL' }))}
                                                        style={{ marginTop: '2px', accentColor: '#0fad89' }}
                                                    />
                                                    <div>
                                                        <strong style={{ color: '#b45309', fontSize: '12.5px' }}>Chuyển sang Cần duyệt</strong>
                                                        <span style={{ display: 'block', fontSize: '11.5px', color: '#64748b', lineHeight: 1.35, marginTop: '2px' }}>
                                                            Cho phép lên đơn nhưng tự động chuyển trạng thái Chờ duyệt để Quản lý kinh doanh duyệt ngoại lệ.
                                                        </span>
                                                    </div>
                                                </label>

                                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12.5px' }}>
                                                    <input
                                                        type="radio"
                                                        name="over_limit_action"
                                                        value="BLOCK"
                                                        checked={policyConfig.over_limit_action === 'BLOCK'}
                                                        onChange={() => setPolicyConfig(prev => ({ ...prev, over_limit_action: 'BLOCK' }))}
                                                        style={{ marginTop: '2px', accentColor: '#0fad89' }}
                                                    />
                                                    <div>
                                                        <strong style={{ color: '#dc2626', fontSize: '12.5px' }}>Chặn tạo đơn hoàn toàn</strong>
                                                        <span style={{ display: 'block', fontSize: '11.5px', color: '#64748b', lineHeight: 1.35, marginTop: '2px' }}>
                                                            Chặn mọi đơn hàng mới và trả về thông báo lỗi yêu cầu thanh toán trước khi tiếp tục.
                                                        </span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>

                                        {/* 2. Xử lý khi quá số ngày nợ cho phép */}
                                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px 14px' }}>
                                            <label style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '3px' }}>
                                                2. Hành vi khi Đại lý CÓ NỢ QUÁ HẠN:
                                            </label>
                                            <p style={{ fontSize: '11.5px', color: '#64748b', margin: '0 0 8px 0' }}>
                                                Áp dụng khi đại lý có bất kỳ hóa đơn nào quá số ngày nợ cho phép (tuổi nợ vượt hạn).
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12.5px' }}>
                                                    <input
                                                        type="radio"
                                                        name="overdue_action"
                                                        value="BLOCK"
                                                        checked={policyConfig.overdue_action === 'BLOCK'}
                                                        onChange={() => setPolicyConfig(prev => ({ ...prev, overdue_action: 'BLOCK' }))}
                                                        style={{ marginTop: '2px', accentColor: '#0fad89' }}
                                                    />
                                                    <div>
                                                        <strong style={{ color: '#dc2626', fontSize: '12.5px' }}>Chặn tạo đơn hoàn toàn</strong>
                                                        <span style={{ display: 'block', fontSize: '11.5px', color: '#64748b', lineHeight: 1.35, marginTop: '2px' }}>
                                                            Khóa bán tự động, chặn không cho tạo đơn mới đến khi các hóa đơn quá hạn được thanh toán.
                                                        </span>
                                                    </div>
                                                </label>

                                                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12.5px' }}>
                                                    <input
                                                        type="radio"
                                                        name="overdue_action"
                                                        value="REQUIRE_APPROVAL"
                                                        checked={policyConfig.overdue_action === 'REQUIRE_APPROVAL'}
                                                        onChange={() => setPolicyConfig(prev => ({ ...prev, overdue_action: 'REQUIRE_APPROVAL' }))}
                                                        style={{ marginTop: '2px', accentColor: '#0fad89' }}
                                                    />
                                                    <div>
                                                        <strong style={{ color: '#b45309', fontSize: '12.5px' }}>Chuyển sang Cần duyệt</strong>
                                                        <span style={{ display: 'block', fontSize: '11.5px', color: '#64748b', lineHeight: 1.35, marginTop: '2px' }}>
                                                            Cho phép gửi đơn nhưng chuyển sang Chờ duyệt kèm cảnh báo tuổi nợ quá hạn.
                                                        </span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>

                                        {/* 3. Tác vụ Cron Job & Thông tin tự động */}
                                        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, color: '#166534' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={policyConfig.auto_eval_enabled}
                                                    onChange={(e) => setPolicyConfig(prev => ({ ...prev, auto_eval_enabled: e.target.checked }))}
                                                    style={{ accentColor: '#0fad89' }}
                                                />
                                                <span>Bật tác vụ tự động đánh giá công nợ định kỳ mỗi ngày</span>
                                            </label>
                                            <p style={{ fontSize: '11.5px', color: '#15803d', margin: '3px 0 8px 22px', lineHeight: 1.35 }}>
                                                Hệ thống tự động rà soát toàn bộ đại lý mỗi ngày 1 lần và gắn/gỡ cờ cảnh báo chính xác theo thực tế công nợ.
                                            </p>

                                            <div style={{ borderTop: '1px dashed #86efac', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                                <div style={{ fontSize: '11.5px', color: '#334155', lineHeight: 1.4 }}>
                                                    <div>• Đánh giá tự động gần nhất: <strong>{policyConfig.last_run_at ? new Date(policyConfig.last_run_at).toLocaleString('vi-VN') : 'Chưa chạy'}</strong></div>
                                                    {policyConfig.updated_at && (
                                                        <div>• Cập nhật lần cuối: <strong>{new Date(policyConfig.updated_at).toLocaleString('vi-VN')}</strong> ({policyConfig.updated_by || 'Hệ thống'})</div>
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={handleRunEvaluation}
                                                    disabled={evaluatingPolicy}
                                                    style={{
                                                        background: 'linear-gradient(135deg, #0fad89, #0a8f70)',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '6px 14px',
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        cursor: evaluatingPolicy ? 'not-allowed' : 'pointer',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '4px',
                                                        boxShadow: '0 2px 4px rgba(15, 173, 137, 0.25)',
                                                    }}
                                                >
                                                    <span>{evaluatingPolicy ? 'Đang đánh giá...' : 'Chạy đánh giá ngay'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="dealer-modal-footer" style={{ borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', flexShrink: 0 }}>
                                <button
                                    type="button"
                                    className="dealer-btn-cancel"
                                    onClick={() => setIsPolicyModalOpen(false)}
                                    disabled={savingPolicy}
                                    style={{ padding: '7px 16px', fontSize: '13px' }}
                                >
                                    Đóng
                                </button>
                                <button
                                    type="button"
                                    className="dealer-btn-save"
                                    onClick={handleSavePolicyConfig}
                                    disabled={savingPolicy || loadingPolicy}
                                    style={{
                                        background: '#0fad89',
                                        border: 'none',
                                        color: '#ffffff',
                                        padding: '7px 18px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        cursor: savingPolicy || loadingPolicy ? 'not-allowed' : 'pointer',
                                        boxShadow: 'none',
                                        transition: 'background-color 0.15s ease',
                                        animation: 'none',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!savingPolicy && !loadingPolicy) e.currentTarget.style.background = '#0c9576';
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!savingPolicy && !loadingPolicy) e.currentTarget.style.background = '#0fad89';
                                    }}
                                >
                                    {savingPolicy ? 'Đang lưu...' : 'Lưu cấu hình'}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* Modal Ghi nhận thanh toán & Đối trừ công nợ (S7-02 / S7-04) */}
            {isPaymentModalOpen && paymentTargetDealer && (
                <ModalPortal>
                    <div className="dealer-modal-overlay" onClick={() => setIsPaymentModalOpen(false)}>
                        <div
                            className="dealer-modal-box"
                            style={{
                                maxWidth: '500px',
                                width: '92%',
                                maxHeight: 'min(90vh, 580px)',
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '0 20px 45px rgba(0, 0, 0, 0.28)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="dealer-modal-header" style={{
                                background: 'linear-gradient(135deg, #0fad89 0%, #0a8f70 100%)',
                                padding: '14px 20px',
                                flexShrink: 0,
                                borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <div className="dealer-modal-title-wrap">
                                    <div>
                                        <h3 style={{ color: '#ffffff', fontSize: '15px', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                                            Ghi nhận thu tiền & đối trừ công nợ
                                        </h3>
                                        <p style={{ color: '#e6f7f2', fontSize: '12px', margin: '3px 0 0 0' }}>
                                            Thu tiền để trừ dần nợ và tự động cập nhật cảnh báo rủi ro công nợ
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="dealer-modal-close-btn"
                                    onClick={() => setIsPaymentModalOpen(false)}
                                    title="Đóng"
                                    style={{
                                        color: '#ffffff',
                                        background: 'rgba(255, 255, 255, 0.15)',
                                        borderRadius: '6px',
                                        width: '28px',
                                        height: '28px',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '16px',
                                        cursor: 'pointer',
                                        border: 'none',
                                    }}
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleSubmitPayment} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                                <div className="dealer-modal-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {/* Tóm tắt thông tin đại lý */}
                                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '12.5px', lineHeight: '1.5' }}>
                                        <div>• Đại lý: <strong style={{ color: '#0f172a' }}>{paymentTargetDealer.name}</strong> ({paymentTargetDealer.code})</div>
                                        <div>• Dư nợ hiện tại: <strong style={{ color: '#dc2626' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(paymentTargetDealer.current_debt ?? 0)}</strong></div>
                                        <div>• Hạn mức: <strong style={{ color: '#475569' }}>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(paymentTargetDealer.credit_limit ?? 50000000)}</strong></div>
                                        <div>• Trạng thái cờ: {paymentTargetDealer.credit_warning_flag ? (
                                            <span style={{ color: '#dc2626', fontWeight: 700 }}>Đang bị gắn cờ cảnh báo ({paymentTargetDealer.credit_flag_reason || 'Vi phạm công nợ'})</span>
                                        ) : (
                                            <span style={{ color: '#16a34a', fontWeight: 600 }}>An toàn / Trong hạn mức</span>
                                        )}</div>
                                    </div>

                                    <div className="dealer-field" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', marginBottom: '4px', display: 'block' }}>
                                            Số tiền thu (VND) <span style={{ color: '#ef4444' }}>*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            step="1000"
                                            required
                                            value={paymentAmount}
                                            onChange={(e) => setPaymentAmount(e.target.value)}
                                            placeholder="Nhập số tiền đã nhận..."
                                            style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                                        />
                                        {Number(paymentAmount) > 0 && (
                                            <div style={{ fontSize: '11.5px', color: '#0284c7', marginTop: '3px' }}>
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(paymentAmount))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="dealer-field" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', marginBottom: '4px', display: 'block' }}>Phương thức thanh toán</label>
                                        <select
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                                        >
                                            <option value="Chuyển khoản">Chuyển khoản ngân hàng</option>
                                            <option value="Tiền mặt">Tiền mặt tại quầy / thủ quỹ</option>
                                            <option value="Ủy nhiệm chi">Ủy nhiệm chi (UNC)</option>
                                            <option value="Ví điện tử / QR">Thanh toán điện tử / QR</option>
                                        </select>
                                    </div>

                                    <div className="dealer-field" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', marginBottom: '4px', display: 'block' }}>Số tham chiếu / Mã giao dịch / UNC</label>
                                        <input
                                            type="text"
                                            value={paymentRef}
                                            onChange={(e) => setPaymentRef(e.target.value)}
                                            placeholder="Ví dụ: UNC-20261015-001..."
                                            style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                                        />
                                    </div>

                                    <div className="dealer-field" style={{ marginBottom: 0 }}>
                                        <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a', marginBottom: '4px', display: 'block' }}>Ghi chú thu tiền</label>
                                        <textarea
                                            rows={2}
                                            value={paymentNote}
                                            onChange={(e) => setPaymentNote(e.target.value)}
                                            placeholder="Ghi chú chi tiết cho kế toán..."
                                            style={{ width: '100%', padding: '7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontFamily: 'inherit' }}
                                        />
                                    </div>

                                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', fontSize: '11.5px', color: '#166534', lineHeight: 1.4 }}>
                                        <strong>Tự động hóa:</strong> Ngay sau khi lưu phiếu thu, hệ thống sẽ tự động đối trừ các đơn nợ cũ nhất (FIFO), tính toán lại dư nợ và tự động gỡ bỏ cờ cảnh báo nếu đại lý không còn vi phạm.
                                    </div>
                                </div>

                                <div className="dealer-modal-footer" style={{ borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', flexShrink: 0 }}>
                                    <button
                                        type="button"
                                        className="dealer-btn-cancel"
                                        onClick={() => setIsPaymentModalOpen(false)}
                                        disabled={submittingPayment}
                                        style={{ padding: '7px 16px', fontSize: '13px' }}
                                    >
                                        Hủy
                                    </button>
                                    <button
                                        type="submit"
                                        className="dealer-btn-save"
                                        disabled={submittingPayment}
                                        style={{
                                            background: 'linear-gradient(135deg, #0fad89, #0a8f70)',
                                            border: 'none',
                                            color: '#ffffff',
                                            padding: '7px 18px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            borderRadius: '6px',
                                            cursor: submittingPayment ? 'not-allowed' : 'pointer',
                                            boxShadow: '0 2px 4px rgba(15, 173, 137, 0.25)',
                                        }}
                                    >
                                        {submittingPayment ? 'Đang lưu...' : 'Xác nhận thu tiền & đối trừ'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
}