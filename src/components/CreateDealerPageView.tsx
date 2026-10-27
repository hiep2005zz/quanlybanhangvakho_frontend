import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from '../services/api';
import {
    DealerSearchItem,
    createDealer,
    CreateDealerPayload,
    getDealerFilters,
} from '../services/dealerSearchApi';
import { emitStatusToast } from './StatusToast';

const DEFAULT_CUSTOMER_GROUPS = [
    'Đại lý cấp 1',
    'Đại lý cấp 2',
    'Khách sỉ',
    'Khách lẻ',
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
        return a.localeCompare(b);
    });
};

export interface CreateDealerPageViewProps {
    token?: string;
    currentUser?: User;
    regions?: string[];
    sales?: { id: number; name: string }[];
    customerGroups?: string[];
    dealers?: DealerSearchItem[];
    onSuccess: (newDealer: DealerSearchItem) => void;
    onBack: () => void;
}

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

const PRIORITY_REGIONS = ['Hà Nội', 'Đà Nẵng', 'TP. Hồ Chí Minh', 'Hải Phòng', 'Cần Thơ'];

const getSortedRegions = (regions: string[]): string[] => {
    const list = Array.from(new Set([...PRIORITY_REGIONS, ...DEFAULT_REGIONS, ...regions].filter(Boolean)));
    return list.sort((a, b) => {
        const ia = PRIORITY_REGIONS.indexOf(a);
        const ib = PRIORITY_REGIONS.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b, 'vi');
    });
};

export const CreateDealerPageView: React.FC<CreateDealerPageViewProps> = ({
    token,
    currentUser,
    regions: initialRegions = [],
    sales: initialSales = [],
    customerGroups: initialCustomerGroups = DEFAULT_CUSTOMER_GROUPS,
    dealers = [],
    onSuccess,
    onBack,
}) => {
    // 1. Phân quyền
    const rawRoles = currentUser?.roles && currentUser.roles.length > 0
        ? currentUser.roles
        : (currentUser?.role ? [currentUser.role] : []);
    const isAdmin = rawRoles.includes('admin');
    const isSalesManager = rawRoles.includes('sales_manager');
    const isSales = rawRoles.includes('sales');
    const canAddDealer = isAdmin || isSalesManager || isSales;

    // 2. Dữ liệu bộ lọc (Khu vực, Sales, Nhóm khách hàng)
    const [localRegions, setLocalRegions] = useState<string[]>(() => {
        return getSortedRegions(initialRegions);
    });
    const [localSales, setLocalSales] = useState<{ id: number; name: string }[]>(initialSales);
    const [localCustomerGroups, setLocalCustomerGroups] = useState<string[]>(initialCustomerGroups);

    useEffect(() => {
        if (initialRegions.length > 0) {
            setLocalRegions(getSortedRegions(initialRegions));
        }
        if (initialSales.length > 0) setLocalSales(initialSales);
        if (initialCustomerGroups.length > 0) setLocalCustomerGroups(initialCustomerGroups);

        getDealerFilters(token)
            .then((data) => {
                if (data.regions && data.regions.length > 0) {
                    setLocalRegions(getSortedRegions(data.regions));
                }
                if (data.sales && data.sales.length > 0) {
                    setLocalSales(data.sales);
                }
                if (data.customer_groups && data.customer_groups.length > 0) {
                    setLocalCustomerGroups(getUniqueFormattedGroups(data.customer_groups));
                }
            })
            .catch(() => {});
    }, [token, initialRegions, initialSales, initialCustomerGroups]);

    // 3. Form States
    const [customerGroup, setCustomerGroup] = useState<string>('Đại lý cấp 1');
    const [code, setCode] = useState<string>(() => `DL-${Math.floor(1000 + Math.random() * 9000)}`);
    const [name, setName] = useState<string>('');
    const [phone, setPhone] = useState<string>('');
    const [address, setAddress] = useState<string>('');
    const [status] = useState<string>('Đang hoạt động');

    // 4. Searchable Combobox: Khu vực
    const [selectedRegion, setSelectedRegion] = useState<string>(() => initialRegions[0] || 'Hà Nội');
    const [regionInput, setRegionInput] = useState<string>(() => initialRegions[0] || 'Hà Nội');
    const [isRegionOpen, setIsRegionOpen] = useState<boolean>(false);
    const regionWrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!regionInput && localRegions.length > 0) {
            setRegionInput(localRegions[0]);
            setSelectedRegion(localRegions[0]);
        }
    }, [localRegions, regionInput]);

    const filteredRegions = useMemo(() => {
        const query = regionInput.trim().toLowerCase();
        // Nếu query rỗng hoặc đang bằng đúng giá trị đã chọn -> hiển thị toàn bộ danh sách để người dùng chọn khu vực khác
        if (!query || query === selectedRegion.toLowerCase()) {
            return localRegions;
        }
        return localRegions.filter((reg) => reg.toLowerCase().includes(query));
    }, [localRegions, regionInput, selectedRegion]);

    // 5. Searchable Combobox: Nhân viên phụ trách
    const [assignedSaleId, setAssignedSaleId] = useState<string>('');
    const [saleSearchText, setSaleSearchText] = useState<string>('');
    const [isSaleOpen, setIsSaleOpen] = useState<boolean>(false);
    const saleWrapperRef = useRef<HTMLDivElement>(null);

    // Tự động gán người phụ trách nếu người dùng hiện tại là sales
    useEffect(() => {
        if (isSales && !isAdmin && !isSalesManager && currentUser && localSales.length > 0 && !assignedSaleId) {
            const matched = localSales.find(
                (s) => s.id === currentUser.id || s.name.toLowerCase() === (currentUser.full_name || '').toLowerCase()
            );
            if (matched) {
                setAssignedSaleId(String(matched.id));
                setSaleSearchText(matched.name);
            }
        }
    }, [isSales, isAdmin, isSalesManager, currentUser, localSales, assignedSaleId]);

    const filteredSales = useMemo(() => {
        const query = saleSearchText.trim().toLowerCase();
        if (!query) return localSales;
        return localSales.filter((s) => s.name.toLowerCase().includes(query));
    }, [localSales, saleSearchText]);

    // 6. Xử lý đóng Dropdown khi click ra ngoài
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (regionWrapperRef.current && !regionWrapperRef.current.contains(target)) {
                setIsRegionOpen(false);
            }
            if (saleWrapperRef.current && !saleWrapperRef.current.contains(target)) {
                setIsSaleOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 7. Validation & Submit
    const [formError, setFormError] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        // 1. Quyền
        if (!canAddDealer) {
            setFormError('Bạn không có quyền thêm đại lý & khách hàng. Yêu cầu quyền Quản trị viên hoặc Bộ phận Kinh doanh.');
            return;
        }

        // 2. Tên đại lý
        const trimmedName = name.trim();
        if (!trimmedName) {
            setFormError('Vui lòng nhập tên đại lý hoặc khách hàng.');
            return;
        }
        if (trimmedName.length < 2) {
            setFormError('Tên đại lý / khách hàng quá ngắn (tối thiểu 2 ký tự).');
            return;
        }
        if (/^\d+$/.test(trimmedName)) {
            setFormError('Tên không hợp lệ! Tên đại lý / khách hàng không được chỉ bao gồm chữ số.');
            return;
        }
        const isDuplicateName = dealers.some(
            (d) => d.name && d.name.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (isDuplicateName) {
            setFormError(`Tên đại lý / khách hàng "${trimmedName}" đã tồn tại trên hệ thống! Vui lòng đặt tên khác.`);
            return;
        }

        // 3. Mã đại lý
        const cleanCode = (code.trim() || `DL-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase();
        if (cleanCode.length < 3) {
            setFormError('Mã đại lý / khách hàng quá ngắn (tối thiểu 3 ký tự, ví dụ: DL-1024).');
            return;
        }
        const isDuplicateCode = dealers.some(
            (d) => d.code && d.code.trim().toUpperCase() === cleanCode
        );
        if (isDuplicateCode) {
            setFormError(`Mã đại lý/khách hàng "${cleanCode}" đã tồn tại trên hệ thống! Vui lòng nhập mã khác.`);
            return;
        }

        // 4. Số điện thoại (chuẩn 10 số VN)
        const trimmedPhone = phone.trim();
        if (!trimmedPhone) {
            setFormError('Vui lòng nhập số điện thoại liên hệ.');
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
            setFormError('Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 chữ số (bắt đầu bằng 03, 05, 07, 08, 09, ví dụ: 0987654321).');
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
            setFormError(`Số điện thoại "${cleanPhone}" đã được sử dụng cho một đại lý/khách hàng khác!`);
            return;
        }

        // 5. Khu vực
        const trimmedRegion = regionInput.trim();
        if (!trimmedRegion) {
            setFormError('Vui lòng chọn hoặc nhập khu vực cho đại lý.');
            return;
        }

        // 6. Nhân viên phụ trách
        if (!assignedSaleId) {
            setFormError('Vui lòng chọn Nhân viên kinh doanh (Sales) phụ trách đại lý / khách hàng.');
            return;
        }
        const selectedSale = localSales.find((s) => String(s.id) === String(assignedSaleId));
        const saleName = selectedSale ? selectedSale.name : (saleSearchText || null);

        // 7. Địa chỉ
        const trimmedAddress = address.trim();
        if (!trimmedAddress) {
            setFormError('Vui lòng nhập địa chỉ cụ thể để phục vụ việc định vị và chỉ đường.');
            return;
        }
        if (trimmedAddress.length < 5) {
            setFormError('Địa chỉ quá ngắn (tối thiểu 5 ký tự). Vui lòng nhập rõ số nhà/đường, phường, quận/huyện.');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: CreateDealerPayload = {
                code: cleanCode,
                name: trimmedName,
                phone: cleanPhone,
                address: trimmedAddress,
                region: trimmedRegion,
                assigned_sale_id: assignedSaleId ? Number(assignedSaleId) : undefined,
                assigned_sale_name: saleName,
                customer_group: formatGroupName(customerGroup) || 'Đại lý cấp 1',
                status: status || 'Đang hoạt động',
            };

            const created = await createDealer(payload, token);

            emitStatusToast({
                title: 'Đại lý & khách hàng',
                message: `Đã thêm thành công đại lý "${created.name}" (${created.code}).`,
                type: 'success',
            });

            onSuccess(created);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo đại lý');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="dealer-search-page dealer-create-page-wrap">
            {/* Thanh tiêu đề trang với nút Quay lại danh sách */}
            <div className="dealer-create-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="dealer-back-btn"
                        onClick={onBack}
                        title="Quay lại danh sách tra cứu đại lý"
                    >
                        Quay lại danh sách
                    </button>
                    <div>
                        <h2>Thêm đại lý & khách hàng mới</h2>
                        <p>Nhập thông tin đại lý hoặc khách hàng để đưa vào tuyến quản lý</p>
                    </div>
                </div>
            </div>

            {/* Khung Form Thẻ Độc Lập (Unified Card) */}
            <div className="dealer-create-card-container">
                <form onSubmit={handleSubmit} className="dealer-create-card">
                    {formError && (
                        <div className="dealer-modal-error" style={{ marginBottom: '20px' }}>
                            {formError}
                        </div>
                    )}

                    <div className="dealer-create-form-grid">
                        {/* 1. Nhóm khách hàng */}
                        <div className="dealer-modal-field">
                            <label>
                                Nhóm khách hàng <span className="required">*</span>
                            </label>
                            <select
                                value={customerGroup}
                                onChange={(e) => setCustomerGroup(e.target.value)}
                            >
                                {getUniqueFormattedGroups(localCustomerGroups).map((group) => (
                                    <option key={group} value={group}>
                                        {group}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Mã đại lý / khách hàng */}
                        <div className="dealer-modal-field">
                            <label>Mã đại lý / khách hàng</label>
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="Ví dụ: DL-9535 hoặc KH-01"
                            />
                        </div>

                        {/* 3. Tên đại lý / Khách hàng */}
                        <div className="dealer-modal-field dealer-form-full">
                            <label>
                                Tên đại lý / Khách hàng <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ví dụ: Đại lý Toàn Thắng hoặc Cửa hàng Minh Tuấn"
                            />
                        </div>

                        {/* 4. Số điện thoại liên hệ */}
                        <div className="dealer-modal-field">
                            <label>
                                Số điện thoại liên hệ <span className="required">*</span>
                            </label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Ví dụ: 0987654321"
                            />
                        </div>

                        {/* 5. Khu vực - Searchable Combobox */}
                        <div className="dealer-modal-field" ref={regionWrapperRef}>
                            <label>
                                Khu vực <span className="required">*</span>
                            </label>
                            <div className="dealer-combobox-wrapper">
                                <div className="dealer-combobox-input-wrap">
                                    <input
                                        type="text"
                                        required
                                        value={regionInput}
                                        onChange={(e) => {
                                            setRegionInput(e.target.value);
                                            setIsRegionOpen(true);
                                        }}
                                        onFocus={(e) => {
                                            setIsRegionOpen(true);
                                            e.target.select();
                                        }}
                                        placeholder="Nhập tìm kiếm hoặc chọn khu vực..."
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        className="dealer-combobox-toggle-btn"
                                        onClick={() => setIsRegionOpen((prev) => !prev)}
                                        tabIndex={-1}
                                        title="Mở danh sách khu vực"
                                    >
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{
                                                transform: isRegionOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease',
                                            }}
                                        >
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </button>
                                </div>

                                {isRegionOpen && (
                                    <div className="dealer-combobox-menu">
                                        {filteredRegions.length > 0 ? (
                                            filteredRegions.map((reg) => (
                                                <div
                                                    key={reg}
                                                    className={`dealer-combobox-item ${reg === selectedRegion ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setSelectedRegion(reg);
                                                        setRegionInput(reg);
                                                        setIsRegionOpen(false);
                                                    }}
                                                    title={reg}
                                                >
                                                    <span>{reg}</span>
                                                    {reg === selectedRegion && (
                                                        <span style={{ marginLeft: 'auto', color: '#0fba90', fontSize: '13px', fontWeight: 700 }}>✓</span>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div
                                                className="dealer-combobox-item custom-choice"
                                                onClick={() => {
                                                    setSelectedRegion(regionInput.trim());
                                                    setIsRegionOpen(false);
                                                }}
                                                title={`Sử dụng "${regionInput.trim()}"`}
                                            >
                                                Sử dụng khu vực: <strong>{regionInput.trim()}</strong>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 6. Nhân viên phụ trách - Searchable Combobox */}
                        <div className="dealer-modal-field dealer-form-full" ref={saleWrapperRef}>
                            <label>
                                Nhân viên phụ trách <span className="required">*</span>
                            </label>
                            <div className="dealer-combobox-wrapper">
                                <div className="dealer-combobox-input-wrap">
                                    <input
                                        type="text"
                                        required
                                        value={saleSearchText}
                                        onChange={(e) => {
                                            setSaleSearchText(e.target.value);
                                            setIsSaleOpen(true);
                                            // Reset id nếu người dùng xóa trắng
                                            if (!e.target.value.trim()) {
                                                setAssignedSaleId('');
                                            }
                                        }}
                                        onFocus={() => setIsSaleOpen(true)}
                                        placeholder="Nhập tìm kiếm hoặc chọn nhân viên kinh doanh phụ trách..."
                                        autoComplete="off"
                                    />
                                    <button
                                        type="button"
                                        className="dealer-combobox-toggle-btn"
                                        onClick={() => setIsSaleOpen(!isSaleOpen)}
                                        tabIndex={-1}
                                        title="Mở danh sách nhân viên"
                                    >
                                        <svg
                                            width="14"
                                            height="14"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            style={{
                                                transform: isSaleOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease',
                                            }}
                                        >
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </button>
                                </div>

                                {isSaleOpen && (
                                    <div className="dealer-combobox-menu">
                                        {filteredSales.length > 0 ? (
                                            filteredSales.map((s) => (
                                                <div
                                                    key={s.id}
                                                    className={`dealer-combobox-item ${String(s.id) === String(assignedSaleId) ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setAssignedSaleId(String(s.id));
                                                        setSaleSearchText(s.name);
                                                        setIsSaleOpen(false);
                                                    }}
                                                    title={s.name}
                                                >
                                                    <span>{s.name}</span>
                                                    {String(s.id) === String(assignedSaleId) && (
                                                        <span style={{ marginLeft: 'auto', color: '#0fba90', fontSize: '13px' }}>✓</span>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="dealer-combobox-empty">
                                                Không tìm thấy nhân viên phù hợp
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 7. Địa chỉ */}
                        <div className="dealer-modal-field dealer-form-full">
                            <label>
                                Địa chỉ <span className="required">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Số nhà, tên đường, phường/xã, quận/huyện..."
                            />
                            <span className="dealer-modal-field-hint">
                                Địa chỉ chi tiết (tối thiểu 5 ký tự) phục vụ định vị và chỉ đường trên Google Maps
                            </span>
                        </div>
                    </div>

                    {/* Nút hành động Lưu */}
                    <div className="dealer-create-footer">
                        <button
                            type="submit"
                            className="dealer-create-btn-save"
                            disabled={isSubmitting}
                            title="Lưu thông tin đại lý & khách hàng mới"
                        >
                            {isSubmitting ? 'Đang lưu...' : 'Lưu'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateDealerPageView;
