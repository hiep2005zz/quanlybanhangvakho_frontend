import { useEffect, useState, useCallback } from 'react';
import {
    DealerSearchItem,
    searchDealers,
    getDealerFilters,
    createDealer,
    CreateDealerPayload,
    updateDealerStatus,
    assignDealer,
    bulkAssignDealers,
    getDealerHistory,
} from '../services/dealerSearchApi';
import { User } from '../services/api';
import { emitStatusToast } from './StatusToast';
import './dealer-search.css';

const DEFAULT_CUSTOMER_GROUPS = [
    'dai_ly_cap_1',
    'dai_ly_cap_2',
    'khach_le',
];

const formatGroupName = (grp: string) => {
    if (grp === 'dai_ly_cap_1' || grp === 'CAP_1' || grp === 'Dai_ly_cap_1' || grp === 'Đại lý cấp 1') return 'Đại lý cấp 1';
    if (grp === 'dai_ly_cap_2' || grp === 'CAP_2' || grp === 'Dai_ly_cap_2' || grp === 'Đại lý cấp 2') return 'Đại lý cấp 2';
    if (grp === 'khach_le' || grp === 'RETAIL' || grp === 'Khach_le' || grp === 'Khách lẻ') return 'Khách lẻ';
    return grp;
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
        address: '',
        region: '',
        assigned_sale_id: '',
        customer_group: 'dai_ly_cap_1',
        status: 'Đang hoạt động',
    });
    const [addError, setAddError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    // Ràng buộc phân quyền: Chỉ Admin, Quản lý kinh doanh (sales_manager) và Nhân viên kinh doanh (sales) mới có quyền thêm đại lý/khách hàng & đổi trạng thái
    const rawRoles = currentUser?.roles && currentUser.roles.length > 0
        ? currentUser.roles
        : (currentUser?.role ? [currentUser.role] : []);
    const canAddDealer = rawRoles.some((r) => ['admin', 'sales_manager', 'sales'].includes(r))
        || Boolean(currentUser?.permissions && (currentUser.permissions.includes('user:manage') || currentUser.permissions.includes('*')))
        || !currentUser;
    const canManageStatus = canAddDealer;
    const canAssignDealer = rawRoles.includes('admin') || rawRoles.includes('sales_manager');

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
            setHistoryLogs(logs.filter((l: any) => l.action_type === 'DEALER_ASSIGNMENT'));
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
        const isSalesOnly = rawRoles.includes('sales') && !rawRoles.includes('admin') && !rawRoles.includes('sales_manager');
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
            // Khôi phục lại trạng thái cũ nếu lỗi
            setDealers((prev) =>
                prev.map((d) => (d.id === dealer.id ? { ...d, status: dealer.status } : d))
            );
            emitStatusToast({
                title: 'Thông báo quyền hạn',
                message: err instanceof Error ? err.message : 'Có lỗi khi cập nhật trạng thái đại lý',
                type: 'warning',
            });
        } finally {
            setTogglingId(null);
        }
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

        let defaultSaleId = '';
        const userRoles = currentUser?.roles && currentUser.roles.length > 0
            ? currentUser.roles
            : (currentUser?.role ? [currentUser.role] : []);
        // Chỉ tự động chọn nếu người dùng hiện tại có vai trò Nhân viên kinh doanh (sales), Quản lý/Admin không tự gán
        if (currentUser && userRoles.includes('sales')) {
            const matched = sales.find((s) => s.id === currentUser.id || s.name.toLowerCase() === (currentUser.full_name || '').toLowerCase());
            if (matched) {
                defaultSaleId = String(matched.id);
            }
        }

        setAddFormData({
            code: `DL-${Math.floor(1000 + Math.random() * 9000)}`,
            name: '',
            phone: '',
            address: '',
            region: regions[0] || 'Hà Nội',
            assigned_sale_id: defaultSaleId,
            customer_group: customerGroups.length > 0 ? customerGroups[0] : 'dai_ly_cap_1',
            status: 'Đang hoạt động',
        });
        setAddError('');
        setIsAddModalOpen(true);
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddError('');

        // 1. Ràng buộc phân quyền
        if (!canAddDealer) {
            setAddError('Bạn không có quyền thêm đại lý & khách hàng. Chức năng này yêu cầu quyền Quản trị viên hoặc Bộ phận Kinh doanh.');
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

        // 7. Ràng buộc bắt buộc phải chọn Nhân viên phụ trách
        if (!addFormData.assigned_sale_id) {
            setAddError('Vui lòng chọn Nhân viên kinh doanh (Sales) phụ trách đại lý / khách hàng.');
            return;
        }

        const selectedSale = sales.find((s) => String(s.id) === String(addFormData.assigned_sale_id));
        const saleName = selectedSale ? selectedSale.name : null;

        setIsSubmitting(true);
        try {
            const payload: CreateDealerPayload = {
                code: cleanCode,
                name: trimmedName,
                phone: cleanPhone,
                address: trimmedAddress,
                region: trimmedRegion,
                assigned_sale_id: addFormData.assigned_sale_id ? Number(addFormData.assigned_sale_id) : undefined,
                assigned_sale_name: saleName,
                customer_group: addFormData.customer_group || 'dai_ly_cap_1',
                status: addFormData.status || 'Đang hoạt động',
            };

            const created = await createDealer(payload, token);
            setDealers((prev) => [created, ...prev]);

            emitStatusToast({
                title: 'Đại lý & khách hàng',
                message: `Đã thêm thành công đại lý "${created.name}" (${created.code}).`,
                type: 'success',
            });

            setIsAddModalOpen(false);
        } catch (err) {
            setAddError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi thêm đại lý');
        } finally {
            setIsSubmitting(false);
        }
    };

    async function loadFilters() {
        try {
            const data = await getDealerFilters(token);

            if (data.regions && data.regions.length > 0) {
                setRegions(data.regions);
            }
            if (data.sales && data.sales.length > 0) {
                setSales(data.sales);
            }
            if (data.customer_groups && data.customer_groups.length > 0) {
                setCustomerGroups(data.customer_groups);
            }
            if (data.statuses && data.statuses.length > 0) {
                setStatuses(data.statuses);
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
                items = items.filter(
                    (d) => Boolean(d.customer_group && d.customer_group.toLowerCase() === searchGroup.toLowerCase())
                );
            }
            if (searchStatus) {
                items = items.filter(
                    (d) => Boolean(d.status && d.status.toLowerCase() === searchStatus.toLowerCase())
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
                            <h2>Tra cứu đại lý & khách hàng</h2>
                            <p>
                                Tìm nhanh đại lý trong tuyến, liên hệ & chỉ đường trực tiếp khi đang di chuyển ngoài đường
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                                    ? 'Thêm mới đại lý hoặc khách hàng vào tuyến'
                                    : 'Bạn không có quyền thực hiện chức năng này (Yêu cầu quyền Quản trị viên hoặc Bộ phận Kinh doanh)'
                            }
                        >
                            <span>Thêm đại lý & khách hàng</span>
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
                                {formatGroupName(group)}
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
                        onChange={(e) => {
                            const val = e.target.value;
                            setStatus(val);
                            handleSearch({ status: val });
                        }}
                    >
                        <option value="">Tất cả trạng thái</option>
                        {statuses.map((st) => (
                            <option key={st} value={st}>
                                {st}
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
                                <th>Người phụ trách</th>
                                <th>Trạng thái</th>
                                {canAssignDealer && <th>Thao tác</th>}
                            </tr>
                        </thead>

                        <tbody>
                            {dealers.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={7} className="dealer-empty">
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
                                                        className={`dealer-status-toggle-btn ${(dealer.status || '').toLowerCase().includes('ngừng') ||
                                                                (dealer.status || '').toLowerCase().includes('inactive')
                                                                ? 'status-inactive'
                                                                : 'status-active'
                                                            }`}
                                                        onClick={() => handleToggleStatus(dealer)}
                                                        disabled={togglingId === dealer.id}
                                                        title={
                                                            (dealer.status || '').toLowerCase().includes('ngừng') ||
                                                            (dealer.status || '').toLowerCase().includes('inactive')
                                                                ? 'Bấm để chuyển sang Đang hoạt động'
                                                                : 'Bấm để chuyển sang Tạm ngừng'
                                                        }
                                                    >
                                                        <span className="status-dot" />
                                                        <span>
                                                            {togglingId === dealer.id
                                                                ? 'Đang cập nhật...'
                                                                : dealer.status || 'Đang hoạt động'}
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <span
                                                        className={`dealer-status-toggle-btn read-only ${(dealer.status || '').toLowerCase().includes('ngừng') ||
                                                                (dealer.status || '').toLowerCase().includes('inactive')
                                                                ? 'status-inactive'
                                                                : 'status-active'
                                                            }`}
                                                    >
                                                        <span className="status-dot" />
                                                        <span>{dealer.status || 'Đang hoạt động'}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        {canAssignDealer && (
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    <button
                                                        type="button"
                                                        className="btn-search-primary"
                                                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                                        onClick={() => {
                                                            setAssignTargetDealer(dealer);
                                                            setNewSaleIdForAssign('');
                                                            setAssignReason('');
                                                            setIsAssignModalOpen(true);
                                                        }}
                                                    >
                                                        Chuyển giao
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-search-reset"
                                                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                                        onClick={() => handleViewHistory(dealer)}
                                                    >
                                                        Lịch sử
                                                    </button>
                                                </div>
                                            </td>
                                        )}
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
                                    </div>
                                    <div className="dealer-status-cell">
                                        {canManageStatus ? (
                                            <button
                                                type="button"
                                                className={`dealer-status-toggle-btn ${(dealer.status || '').toLowerCase().includes('ngừng') ||
                                                        (dealer.status || '').toLowerCase().includes('inactive')
                                                        ? 'status-inactive'
                                                        : 'status-active'
                                                    }`}
                                                onClick={() => handleToggleStatus(dealer)}
                                                disabled={togglingId === dealer.id}
                                                title={
                                                    (dealer.status || '').toLowerCase().includes('ngừng') ||
                                                    (dealer.status || '').toLowerCase().includes('inactive')
                                                        ? 'Bấm để chuyển sang Đang hoạt động'
                                                        : 'Bấm để chuyển sang Tạm ngừng'
                                                }
                                            >
                                                <span className="status-dot" />
                                                <span>
                                                    {togglingId === dealer.id
                                                        ? 'Đang cập nhật...'
                                                        : dealer.status || 'Đang hoạt động'}
                                                </span>
                                            </button>
                                        ) : (
                                            <span
                                                className={`dealer-status-toggle-btn read-only ${(dealer.status || '').toLowerCase().includes('ngừng') ||
                                                        (dealer.status || '').toLowerCase().includes('inactive')
                                                        ? 'status-inactive'
                                                        : 'status-active'
                                                    }`}
                                            >
                                                <span className="status-dot" />
                                                <span>{dealer.status || 'Đang hoạt động'}</span>
                                            </span>
                                        )}
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
                                            <span>{dealer.assigned_sale_name}</span>
                                        </div>
                                    )}

                                    {dealer.address && (
                                        <div className="dealer-card-meta address">
                                            <span className="meta-label">Địa chỉ:</span>
                                            <span>{dealer.address}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="dealer-card-actions">
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
                                    <h3>Thêm đại lý & khách hàng mới</h3>
                                    <p>Nhập thông tin đại lý hoặc khách hàng để đưa vào tuyến quản lý</p>
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
                                            placeholder="Ví dụ: Đại lý Toàn Thắng hoặc Cửa hàng Minh Tuấn"
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

                                    <div className="dealer-modal-field dealer-form-full">
                                        <label>
                                            Nhân viên phụ trách <span className="required">*</span>
                                        </label>
                                        <select
                                            required
                                            value={addFormData.assigned_sale_id}
                                            onChange={(e) => setAddFormData({ ...addFormData, assigned_sale_id: e.target.value })}
                                        >
                                            <option value="">-- Chọn nhân viên phụ trách * --</option>
                                            {sales.map((sale) => (
                                                <option key={sale.id} value={sale.id}>
                                                    {sale.name}
                                                </option>
                                            ))}
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
                                    {isSubmitting ? 'Đang lưu...' : 'Lưu đại lý & khách hàng'}
                                </button>
                            </div>
                        </form>
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
                                                <th style={{ padding: '8px' }}>Nhân viên cũ</th>
                                                <th style={{ padding: '8px' }}>Nhân viên mới</th>
                                                <th style={{ padding: '8px' }}>Lý do</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historyLogs.map(log => {
                                                let oldObj: any = {};
                                                let newObj: any = {};
                                                try { if (log.old_values) oldObj = JSON.parse(log.old_values); } catch {}
                                                try { if (log.new_values) newObj = JSON.parse(log.new_values); } catch {}
                                                return (
                                                <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                    <td style={{ padding: '8px' }}>{new Date(log.created_at).toLocaleString('vi-VN')}</td>
                                                    <td style={{ padding: '8px', color: '#0f172a', fontWeight: 'bold' }}>{log.user_name}</td>
                                                    <td style={{ padding: '8px', color: '#dc2626' }}>{oldObj.assigned_sale_name || 'Trống'}</td>
                                                    <td style={{ padding: '8px', color: '#16a34a' }}>{newObj.assigned_sale_name || 'Trống'}</td>
                                                    <td style={{ padding: '8px', color: '#64748b', fontStyle: 'italic' }}>{log.reason}</td>
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
        </div>
    );
}