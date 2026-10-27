// frontend/src/components/SalesTargetManagementView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { ModalPortal } from './ModalPortal';
import { emitStatusToast } from './StatusToast';
import { SalespersonSelectDropdown } from './SalespersonSelectDropdown';
import { RegionSelectDropdown } from './RegionSelectDropdown';
import {
  fetchSalesTargets,
  fetchMySalesProgress,
  fetchSalesTargetsMetadata,
  createSalesTarget,
  updateSalesTarget,
  deleteSalesTarget,
  SalesTargetItem,
  SalesTargetSummary,
  MyProgressResponse,
  SalesTargetCreatePayload,
  SalespersonOption,
} from '../services/salesTargetApi';

interface SalesTargetManagementViewProps {
  currentUser: {
    id?: number;
    username: string;
    full_name?: string;
    role?: string;
    roles?: string[];
  };
  token: string;
  onNavigateTab?: (tab: string) => void;
}

const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '0 đ';
  return `${Math.round(val).toLocaleString('vi-VN')} đ`;
};

const SELECTABLE_YEARS = [2025, 2026, 2027, 2028];
const SELECTABLE_MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

export const SalesTargetManagementView: React.FC<SalesTargetManagementViewProps> = ({
  currentUser,
  token,
  onNavigateTab,
}) => {
  // Kiểm tra vai trò Admin
  const isAdmin = useMemo(() => {
    if (!currentUser) {
      try {
        const storedRole = localStorage.getItem('user_role');
        return storedRole === 'admin';
      } catch {
        return false;
      }
    }
    if (currentUser.role === 'admin') return true;
    if (currentUser.username === 'admin') return true;
    if (Array.isArray(currentUser.roles) && currentUser.roles.includes('admin')) return true;
    try {
      const storedRole = localStorage.getItem('user_role');
      if (storedRole === 'admin') return true;
    } catch {}
    return false;
  }, [currentUser]);

  // State bộ lọc
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [targetTypeFilter, setTargetTypeFilter] = useState<'all' | 'salesperson' | 'region'>('all');
  const [searchTerm, setSearchTerm] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('selected_sales_target_employee') || '';
      if (saved) {
        sessionStorage.removeItem('selected_sales_target_employee');
      }
      return saved;
    } catch {
      return '';
    }
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Tách năm và tháng cho bộ lọc
  const [selectedYear, selectedMonthNum] = useMemo(() => {
    const parts = (selectedMonth || '2026-10').split('-');
    return [parts[0] || '2026', parts[1] || '10'];
  }, [selectedMonth]);


  // Dữ liệu API
  const [loading, setLoading] = useState<boolean>(true);

  const [items, setItems] = useState<SalesTargetItem[]>([]);
  const [summary, setSummary] = useState<SalesTargetSummary | null>(null);
  const [canManage, setCanManage] = useState<boolean>(false);
  const [myProgress, setMyProgress] = useState<MyProgressResponse | null>(null);

  // Modals / Page state
  const [isCreatingPage, setIsCreatingPage] = useState<boolean>(false);
  const [editingTarget, setEditingTarget] = useState<SalesTargetItem | null>(null);
  const [viewingLogsTarget, setViewingLogsTarget] = useState<SalesTargetItem | null>(null);
  const [targetToDelete, setTargetToDelete] = useState<SalesTargetItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Dropdown menu 3 chấm Thao tác
  const [activeDropdownTargetId, setActiveDropdownTargetId] = useState<number | null>(null);

  // Form Create State
  const [createForm, setCreateForm] = useState<SalesTargetCreatePayload>({
    target_type: 'salesperson',
    employee_id: 3,
    employee_name: 'Trần Bán Hàng',
    region: 'Hà Nội',
    month_year: '2026-10',
    target_amount: 50000000,
    note: '',
  });

  // Tách năm và tháng cho Form tạo mới
  const [createFormYear, createFormMonth] = useMemo(() => {
    const parts = (createForm.month_year || '2026-10').split('-');
    return [parts[0] || '2026', parts[1] || '10'];
  }, [createForm.month_year]);

  // Dữ liệu đồng bộ từ các module khác (chỉ bao gồm nhân sự kinh doanh, loại bỏ Admin)
  const [availableSalespersons, setAvailableSalespersons] = useState<SalespersonOption[]>([
    { id: 3, username: 'sales_user', full_name: 'Trần Bán Hàng', role: 'sales', role_label: 'Nhân viên kinh doanh' },
    { id: 2, username: 'sales_manager', full_name: 'Trưởng Phòng Kinh Doanh', role: 'sales_manager', role_label: 'Quản lý kinh doanh' },
  ]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([
    'Hà Nội',
    'Hải Phòng',
    'TP. HCM',
    'Đà Nẵng',
  ]);

  // Form Edit State
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const setEditError = (msg: string | null) => {
    if (msg) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: msg,
        type: 'warning',
      });
    }
  };

  // Tải dữ liệu từ máy chủ
  const loadData = async (isInitial: boolean = false) => {
    if (isInitial) {
      setLoading(true);
    }
    try {
      const resp = await fetchSalesTargets(token, selectedMonth, targetTypeFilter, '');
      setItems(resp.items);
      setSummary(resp.summary);
      setCanManage(resp.can_manage);

      // Đồng bộ thông tin danh sách nhân viên và khu vực từ hệ thống
      try {
        const meta = await fetchSalesTargetsMetadata(token);
        if (meta.salespersons && meta.salespersons.length > 0) {
          const nonAdminSalespersons = meta.salespersons.filter(
            (s) =>
              (s.role || '').toLowerCase() !== 'admin' &&
              (s.username || '').toLowerCase() !== 'admin' &&
              (s.role_label || '').toLowerCase() !== 'admin'
          );
          setAvailableSalespersons(nonAdminSalespersons);
        }
        if (meta.regions && meta.regions.length > 0) {
          setAvailableRegions(meta.regions);
        }
      } catch {
        // Bỏ qua nếu lỗi metadata, dùng danh sách mặc định
      }

      // Nếu là nhân viên sale hoặc muốn xem tiến độ cá nhân (bỏ qua nếu là vai trò Admin)
      if (!isAdmin) {
        try {
          const myProg = await fetchMySalesProgress(token);
          setMyProgress(myProg);
        } catch {
          // Bỏ qua nếu không lấy được
        }
      } else {
        setMyProgress(null);
      }
    } catch (err: any) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: err.message || 'Lỗi kết nối máy chủ khi tải chỉ tiêu',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Chỉ gọi API khi đổi tháng hoặc phân loại (Không gọi API khi gõ ô tìm kiếm)
  useEffect(() => {
    loadData(items.length === 0);
  }, [selectedMonth, targetTypeFilter, isAdmin]);

  // Thiết lập cơ chế tự động đồng bộ theo thời gian thực (Real-time auto sync)
  useEffect(() => {
    // 1. Lắng nghe các sự kiện nghiệp vụ nội bộ ứng dụng
    const handleSystemSync = () => {
      loadData(false);
    };

    window.addEventListener('ORDERS_UPDATED', handleSystemSync);
    window.addEventListener('RETURN_ORDERS_UPDATED', handleSystemSync);
    window.addEventListener('DEALER_DATA_CHANGED', handleSystemSync);
    window.addEventListener('USER_ACCOUNTS_CHANGED', handleSystemSync);
    window.addEventListener('USER_ROLE_UPDATED', handleSystemSync);

    // 2. Lắng nghe thay đổi giữa các tab/cửa sổ khác (cross-tab sync qua localStorage)
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'orders_last_updated' ||
        e.key === 'return_orders_last_updated' ||
        e.key === 'dealers_last_updated' ||
        e.key === 'auth_user'
      ) {
        loadData(false);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Tự động đồng bộ lại khi người dùng quay lại tab (focus / visibility)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Chu kỳ đồng bộ tự động mỗi 60 giây khi đang xem màn hình
    const intervalTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadData(false);
      }
    }, 60000);

    return () => {
      window.removeEventListener('ORDERS_UPDATED', handleSystemSync);
      window.removeEventListener('RETURN_ORDERS_UPDATED', handleSystemSync);
      window.removeEventListener('DEALER_DATA_CHANGED', handleSystemSync);
      window.removeEventListener('USER_ACCOUNTS_CHANGED', handleSystemSync);
      window.removeEventListener('USER_ROLE_UPDATED', handleSystemSync);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalTimer);
    };
  }, [selectedMonth, targetTypeFilter]);

  // Đóng dropdown 3 chấm khi bấm ra ngoài hoặc nhấn phím Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.target-action-dropdown-container')) {
        setActiveDropdownTargetId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdownTargetId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Phân trang danh sách chỉ tiêu (20 bản ghi / trang)
  const pageSize = 20;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Tìm kiếm tức thì trong bộ nhớ (Zero latency, không giật nháy màn hình)
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      const name = (item.employee_name || '').toLowerCase();
      const reg = (item.region || '').toLowerCase();
      const note = (item.note || '').toLowerCase();
      return name.includes(term) || reg.includes(term) || note.includes(term);
    });
  }, [items, searchTerm]);

  // Reset trang về 1 khi thay đổi điều kiện tìm kiếm hoặc bộ lọc
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedMonth, targetTypeFilter]);

  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageItems = filteredItems.slice(startIndex, endIndex);

  // Mở modal sửa
  const handleOpenEdit = (target: SalesTargetItem) => {
    setEditingTarget(target);
    setEditAmount(target.target_amount);
    setEditNote(target.note || '');
    setEditReason('');
    setEditError(null);
  };

  // Lưu chỉnh sửa
  const handleSaveEdit = async () => {
    if (!editingTarget) return;
    setEditError(null);

    if (editAmount < 0) {
      setEditError('Chỉ tiêu doanh số không được là số âm.');
      return;
    }

    if (editingTarget.is_locked && (!editReason || editReason.trim().length < 3)) {
      setEditError('Chỉ tiêu của kỳ đã qua bị khoá. Vui lòng nhập lý do điều chỉnh để ghi nhật ký.');
      return;
    }

    try {
      await updateSalesTarget(token, editingTarget.id, {
        target_amount: editAmount,
        note: editNote,
        reason: editingTarget.is_locked ? editReason : undefined,
      });

      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: 'Đã cập nhật chỉ tiêu doanh số thành công.',
        type: 'success',
      });
      setEditingTarget(null);
      loadData();
    } catch (err: any) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: err.message || 'Lỗi khi cập nhật chỉ tiêu.',
        type: 'error',
      });
    }
  };

  // Xóa chỉ tiêu - Mở modal xác nhận hệ thống
  const handleDelete = (target: SalesTargetItem) => {
    if (target.is_locked) {
      emitStatusToast({
        title: 'Chỉ tiêu đã khóa',
        message: 'Không thể xóa chỉ tiêu của kỳ đã bị khoá.',
        type: 'warning',
      });
      return;
    }
    setTargetToDelete(target);
  };

  // Xác nhận xóa thực tế từ modal hệ thống
  const handleConfirmDelete = async () => {
    if (!targetToDelete) return;
    setIsDeleting(true);
    const targetLabel = targetToDelete.target_type === 'salesperson' ? targetToDelete.employee_name : targetToDelete.region;
    try {
      await deleteSalesTarget(token, targetToDelete.id);
      emitStatusToast({
        title: 'Xóa chỉ tiêu',
        message: `Đã xóa chỉ tiêu cho "${targetLabel}" thành công.`,
        type: 'success',
      });
      setTargetToDelete(null);
      loadData();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi xóa chỉ tiêu',
        message: err.message || 'Lỗi khi xóa chỉ tiêu.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Lưu tạo mới
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSalesTarget(token, createForm);
      emitStatusToast({
        title: 'Thiết lập chỉ tiêu thành công',
        message: 'Đã thiết lập chỉ tiêu mới thành công.',
        type: 'success',
      });
      setIsCreatingPage(false);
      loadData();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi thiết lập chỉ tiêu',
        message: err.message || 'Lỗi khi tạo chỉ tiêu mới.',
        type: 'error',
      });
    }
  };

  // Hàm chọn màu thanh tiến độ
  const getProgressColor = (pct: number) => {
    if (pct >= 100) return '#10b981'; // Xanh lá
    if (pct >= 70) return '#0ea5e9';  // Xanh dương
    if (pct >= 40) return '#f59e0b';  // Vàng
    return '#ef4444';                 // Đỏ
  };

  // NẾU ĐANG Ở CHẾ ĐỘ THIẾT LẬP CHỈ TIÊU MỚI (CHUYỂN THÀNH TRANG RIÊNG BIỆT THAY VÌ CỬA SỔ POPUP)
  if (isCreatingPage) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          maxHeight: '100%',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
        className="flex-1 flex flex-col p-3 sm:p-4 md:p-6 bg-slate-100/60 font-sans"
      >
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col w-full shrink-0 mb-12">
          {/* Header Bar */}
          <div className="px-6 py-4.5 border-b border-slate-200/80 bg-gradient-to-r from-slate-50/90 via-white to-emerald-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 flex-wrap">
              <button
                type="button"
                onClick={() => setIsCreatingPage(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-full shadow-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span>Quay lại</span>
              </button>
              <span className="text-slate-300 text-lg">/</span>
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-xs shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Thiết lập chỉ tiêu doanh số mới
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Khai báo chỉ tiêu kinh doanh theo nhân sự hoặc khu vực thị trường • Người lập: <strong className="text-slate-700">{currentUser?.full_name || currentUser?.username || 'admin'}</strong> • Ngày lập: <strong className="text-slate-700">{new Date().toLocaleDateString('vi-VN')}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleCreateSubmit} className="p-6 md:p-8 space-y-6">
            {/* 1. ĐỐI TƯỢNG ÁP DỤNG */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-extrabold">1</span>
                <h2 className="text-sm font-bold text-slate-800">Đối tượng áp dụng chỉ tiêu</h2>
              </div>

              {/* 2 Card chọn loại chỉ tiêu */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div
                  onClick={() => setCreateForm({ ...createForm, target_type: 'salesperson' })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                    createForm.target_type === 'salesperson'
                      ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${createForm.target_type === 'salesperson' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">Theo nhân viên</h3>
                      <input
                        type="radio"
                        name="page_target_type"
                        checked={createForm.target_type === 'salesperson'}
                        onChange={() => setCreateForm({ ...createForm, target_type: 'salesperson' })}
                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Giao chỉ tiêu doanh số trực tiếp cho từng nhân viên bán hàng
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setCreateForm({ ...createForm, target_type: 'region' })}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                    createForm.target_type === 'region'
                      ? 'border-emerald-500 bg-emerald-50/40 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${createForm.target_type === 'region' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-800">Theo khu vực</h3>
                      <input
                        type="radio"
                        name="page_target_type"
                        checked={createForm.target_type === 'region'}
                        onChange={() => setCreateForm({ ...createForm, target_type: 'region' })}
                        className="text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Giao chỉ tiêu doanh số tổng theo địa bàn, khu vực hoặc chi nhánh
                    </p>
                  </div>
                </div>
              </div>

              {/* Chi tiết đối tượng */}
              <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/80">
                {createForm.target_type === 'salesperson' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                      Nhân viên kinh doanh <span className="text-rose-500">*</span>
                    </label>
                    <div className="max-w-xl">
                      <SalespersonSelectDropdown
                        options={availableSalespersons}
                        selectedId={createForm.employee_id || (availableSalespersons[0]?.id ?? 3)}
                        onSelect={(sp) => {
                          setCreateForm({
                            ...createForm,
                            employee_id: sp.id,
                            employee_name: sp.full_name,
                          });
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                      Tên khu vực thị trường <span className="text-rose-500">*</span>
                    </label>
                    <div className="max-w-xl">
                      <RegionSelectDropdown
                        regions={availableRegions}
                        selectedRegion={createForm.region || (availableRegions[0] ?? 'Hà Nội')}
                        onSelect={(reg) => {
                          setCreateForm({ ...createForm, region: reg });
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. THỜI GIAN & MỨC CHỈ TIÊU */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-extrabold">2</span>
                <h2 className="text-sm font-bold text-slate-800">Thời gian & Mức chỉ tiêu</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Kỳ áp dụng */}
                <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                      Kỳ áp dụng (Tháng / Năm) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <select
                          value={createFormMonth}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, month_year: `${createFormYear}-${e.target.value}` })
                          }
                          className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium cursor-pointer"
                        >
                          {SELECTABLE_MONTHS.map((m) => (
                            <option key={m} value={m}>
                              Tháng {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="text-slate-400 font-bold text-xl">/</span>
                      <div className="flex-1">
                        <select
                          value={createFormYear}
                          onChange={(e) =>
                            setCreateForm({ ...createForm, month_year: `${e.target.value}-${createFormMonth}` })
                          }
                          className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium cursor-pointer"
                        >
                          {SELECTABLE_YEARS.map((y) => (
                            <option key={y} value={y.toString()}>
                              Năm {y}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mức chỉ tiêu */}
                <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700 uppercase">
                        Chỉ tiêu doanh số (VNĐ) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded border border-emerald-200">
                        {formatCurrency(createForm.target_amount)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1000000"
                      required
                      value={createForm.target_amount}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setCreateForm({ ...createForm, target_amount: 0 });
                          return;
                        }
                        const cleaned = raw.replace(/^0+(?=\d)/, '');
                        e.target.value = cleaned;
                        setCreateForm({ ...createForm, target_amount: Number(cleaned) });
                      }}
                      className="w-full h-10 px-3 text-sm font-semibold text-slate-800 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="Nhập số tiền chỉ tiêu..."
                    />
                  </div>
                </div>
              </div>

              {/* Ghi chú */}
              <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200/80">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">
                  Ghi chú kế hoạch & định hướng (tùy chọn)
                </label>
                <textarea
                  rows={3}
                  value={createForm.note || ''}
                  onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                  placeholder="Ghi chú kế hoạch, mục tiêu, chỉ dẫn bán hàng..."
                  className="w-full p-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="pt-4 border-t border-slate-200/80 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreatingPage(false)}
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Hủy / Quay lại
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer border-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Lưu chỉ tiêu</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col -mt-3 sm:-mt-4 md:-mt-6 pt-2 md:pt-2.5 pb-6 bg-gray-50 min-h-screen text-slate-800">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Chỉ tiêu doanh số & Tiến độ kinh doanh
        </h1>
      </div>

      {/* Card Tiến độ Cá nhân (Dành cho nhân viên kinh doanh - ẩn đối với vai trò Admin) */}
      {!isAdmin && myProgress && (
        <div className="mb-5 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-md">
                Tiến độ của bạn
              </span>
              <span className="text-base font-bold text-slate-900">
                {myProgress.employee_name} — Tháng {myProgress.month_year}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                (Còn {myProgress.days_left} ngày)
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-slate-400 mr-1.5 text-xs">Mục tiêu:</span>
                <span className="font-bold text-slate-900">{formatCurrency(myProgress.target_amount)}</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 mr-1.5 text-xs">Đã đạt:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(myProgress.actual_amount)}</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 mr-1.5 text-xs">Còn thiếu:</span>
                <span className="font-bold text-rose-600">{formatCurrency(myProgress.remaining_amount)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-700 shrink-0">
              Tỷ lệ hoàn thành: <strong className="text-emerald-700">{myProgress.progress_pct}%</strong>
            </span>
            <div className="flex-1 min-w-0 bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, myProgress.progress_pct)}%`,
                  backgroundColor: getProgressColor(myProgress.progress_pct),
                }}
              />
            </div>
            {myProgress.projected_amount && (
              <span className="text-xs text-slate-500 shrink-0">
                Dự báo cuối tháng: <strong className="text-slate-800">{formatCurrency(myProgress.projected_amount)}</strong>
              </span>
            )}
          </div>
        </div>
      )}

      {/* Summary KPI Cards (Dành cho Quản lý & Admin) - Kích thước rộng rãi rõ ràng */}
      {summary && canManage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng chỉ tiêu toàn đội</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(summary.total_target_amount)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Kỳ tháng {summary.month_year}</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Doanh số thực tế đạt</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">
              {formatCurrency(summary.total_actual_amount)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Cập nhật theo đơn hàng</div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tiến độ trung bình</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {summary.average_progress_pct}%
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 mt-2 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, summary.average_progress_pct)}%`,
                  backgroundColor: getProgressColor(summary.average_progress_pct),
                }}
              />
            </div>
          </div>

          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đạt mục tiêu (≥ 100%)</div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {summary.completed_count} / {summary.total_count}
            </div>
            <div className="text-xs text-slate-500 mt-1">Số nhân viên / khu vực về đích</div>
          </div>
        </div>
      )}

      {/* Khối Bảng danh sách gộp chung thanh điều khiển */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
        {/* Control Bar (Lọc tháng, loại chỉ tiêu, tìm kiếm) */}
        <div
          className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-4 overflow-x-auto bg-white rounded-t-xl"
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
        >
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex items-center gap-3.5 shrink-0"
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
          >
            {/* Ô tìm kiếm tự động khi nhập - Đặt trước chữ Tháng (mở rộng chiều dài) */}
            <div
              className="relative flex items-center shrink-0"
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
            >
              <input
                type="text"
                placeholder="Tìm nhân viên, khu vực..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '34px', paddingRight: searchTerm ? '28px' : '12px' }}
                className="h-8 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 w-80 md:w-96 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
              <svg
                className="w-4 h-4 text-slate-400 absolute left-2.5 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer font-bold px-1"
                  title="Xóa tìm kiếm"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Chọn tháng & năm */}
            <div
              className="flex items-center gap-1.5 shrink-0"
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
            >
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap mr-0.5">Tháng:</span>

              {/* Chọn Tháng */}
              <select
                value={selectedMonthNum}
                onChange={(e) => setSelectedMonth(`${selectedYear}-${e.target.value}`)}
                className="h-8 px-2.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                title="Chọn tháng"
              >
                {SELECTABLE_MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <span className="text-xs font-semibold text-slate-400">/</span>

              {/* Chọn Năm */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedMonth(`${e.target.value}-${selectedMonthNum}`)}
                className="h-8 px-2.5 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                title="Chọn năm"
              >
                {SELECTABLE_YEARS.map((y) => (
                  <option key={y} value={y.toString()}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Chọn loại chỉ tiêu */}
            <div
              className="flex items-center gap-2 shrink-0"
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
            >
              <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Phân loại:</span>
              <select
                value={targetTypeFilter}
                onChange={(e) => setTargetTypeFilter(e.target.value as any)}
                className="h-8 px-3 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="all">Tất cả đối tượng</option>
                <option value="salesperson">Theo nhân viên</option>
                <option value="region">Theo khu vực</option>
              </select>
            </div>
          </form>

          {/* 2 nút thao tác đưa vào vị trí của Kỳ tháng hiện tại */}
          <div
            className="flex items-center gap-2 shrink-0 ml-auto"
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
          >
            <button
              type="button"
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await loadData(false);
                } finally {
                  setIsRefreshing(false);
                }
              }}
              disabled={isRefreshing || loading}
              className="h-8 flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-700 transition-colors border border-slate-300 disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
              title="Làm mới số liệu ngay lập tức"
            >
              <svg
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : 'text-slate-500'}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{isRefreshing ? 'Đang tải...' : 'Làm mới'}</span>
            </button>

            {canManage && (
              <button
                type="button"
                onClick={() => {
                  const firstSp = availableSalespersons[0];
                  setCreateForm((prev) => ({
                    ...prev,
                    employee_id: availableSalespersons.some((s) => s.id === prev.employee_id)
                      ? prev.employee_id
                      : (firstSp?.id ?? 3),
                    employee_name:
                      availableSalespersons.find((s) => s.id === prev.employee_id)?.full_name ||
                      (firstSp?.full_name ?? 'Trần Bán Hàng'),
                  }));
                  setIsCreatingPage(true);
                }}
                className="h-8 inline-flex items-center px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Thiết lập chỉ tiêu mới</span>
              </button>
            )}
          </div>
        </div>

        {/* Table danh sách chỉ tiêu */}
        <div className="w-full">
          <table className="w-full table-fixed text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className={`py-3 px-3.5 ${canManage ? 'w-[22%]' : 'w-[24%]'}`}>Đối tượng</th>
                <th className={`py-3 px-2 text-center ${canManage ? 'w-[10%]' : 'w-[11%]'}`}>Phân loại</th>
                <th className={`py-3 px-3 text-right ${canManage ? 'w-[13%]' : 'w-[14%]'}`}>Chỉ tiêu (VNĐ)</th>
                <th className={`py-3 px-3 text-right ${canManage ? 'w-[13%]' : 'w-[14%]'}`}>Thực tế đạt</th>
                <th className={`py-3 px-3 text-right ${canManage ? 'w-[12%]' : 'w-[13%]'}`}>Còn thiếu</th>
                <th className={`py-3 px-3 ${canManage ? 'w-[16%]' : 'w-[16%]'}`}>Tiến độ</th>
                <th className={`py-3 px-2 text-center ${canManage ? 'w-[7%]' : 'w-[8%]'}`}>Trạng thái</th>
                {canManage && <th className="py-3 px-2 text-center w-[7%]">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="py-8 text-center text-slate-400 text-sm">
                    Đang tải dữ liệu chỉ tiêu...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 8 : 7} className="py-8 text-center text-slate-400 text-sm">
                    {searchTerm.trim()
                      ? `Không tìm thấy chỉ tiêu nào phù hợp với từ khóa "${searchTerm}".`
                      : 'Không có chỉ tiêu nào trong kỳ tháng đã chọn.'}
                  </td>
                </tr>
              ) : (
                pageItems.map((item, index) => {
                  const targetName =
                    item.target_type === 'salesperson'
                      ? item.employee_name || `Nhân viên #${item.employee_id}`
                      : item.region || 'Chưa đặt khu vực';
                  const openUpward = pageItems.length > 3 && index >= pageItems.length - 2;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      {/* Đối tượng */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                if (item.target_type === 'salesperson') {
                                  sessionStorage.setItem('sales_report_search', item.employee_name || '');
                                  sessionStorage.setItem('sales_report_dimension', 'salesperson');
                                } else {
                                  sessionStorage.setItem('sales_report_search', item.region || '');
                                  sessionStorage.setItem('sales_report_dimension', 'region');
                                }
                                sessionStorage.setItem('sales_report_preset', 'this_month');
                              } catch {}
                              onNavigateTab?.('sales-report');
                            }}
                            className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors text-left truncate cursor-pointer text-sm"
                            title={`Nhấn để mở Báo cáo doanh số đa chiều cho ${targetName}`}
                          >
                            {targetName}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                if (item.target_type === 'salesperson') {
                                  sessionStorage.setItem('sales_report_search', item.employee_name || '');
                                  sessionStorage.setItem('sales_report_dimension', 'salesperson');
                                } else {
                                  sessionStorage.setItem('sales_report_search', item.region || '');
                                  sessionStorage.setItem('sales_report_dimension', 'region');
                                }
                                sessionStorage.setItem('sales_report_preset', 'this_month');
                              } catch {}
                              onNavigateTab?.('sales-report');
                            }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline font-semibold shrink-0"
                            title={`Xem chi tiết doanh số trong Báo cáo đa chiều`}
                          >
                            [Doanh số]
                          </button>
                        </div>
                        {item.note && (
                          <div className="text-xs text-slate-400 font-normal truncate mt-0.5" title={item.note}>
                            {item.note}
                          </div>
                        )}
                      </td>

                      {/* Phân loại */}
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap ${
                            item.target_type === 'salesperson'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : 'bg-purple-50 text-purple-700 border border-purple-100'
                          }`}
                        >
                          {item.target_type === 'salesperson' ? 'Nhân viên' : 'Khu vực'}
                        </span>
                      </td>

                      {/* Chỉ tiêu */}
                      <td className="py-3 px-3 text-right font-semibold text-slate-800 whitespace-nowrap text-sm">
                        {formatCurrency(item.target_amount)}
                      </td>

                      {/* Thực tế đạt */}
                      <td className="py-3 px-3 text-right font-bold text-emerald-600 whitespace-nowrap text-sm">
                        {formatCurrency(item.actual_amount)}
                      </td>

                      {/* Còn thiếu */}
                      <td className="py-3 px-3 text-right font-semibold text-rose-600 whitespace-nowrap text-sm">
                        {formatCurrency(item.remaining_amount)}
                      </td>

                      {/* Tiến độ */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold w-12 text-slate-700 shrink-0">
                            {item.progress_pct}%
                          </span>
                          <div className="flex-1 min-w-0 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, item.progress_pct)}%`,
                                backgroundColor: getProgressColor(item.progress_pct),
                              }}
                            />
                          </div>
                        </div>
                      </td>


                      {/* Trạng thái */}
                      <td className="py-3 px-2 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full whitespace-nowrap ${
                            item.is_locked
                              ? 'bg-slate-100 text-slate-600 border border-slate-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {item.is_locked ? 'Đã khóa' : 'Đang mở'}
                        </span>
                      </td>

                      {/* Thao tác */}
                      {canManage && (
                        <td className="py-3 px-2 text-center whitespace-nowrap">
                          <div className="relative inline-block text-left target-action-dropdown-container">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownTargetId((prev) => (prev === item.id ? null : item.id));
                              }}
                              className={`w-7 h-7 inline-flex items-center justify-center rounded-lg border transition-all cursor-pointer ${
                                activeDropdownTargetId === item.id
                                  ? 'bg-slate-100 border-slate-300 text-slate-800 shadow-xs'
                                  : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-500 hover:text-slate-700'
                              }`}
                              title="Thao tác"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                              </svg>
                            </button>

                            {/* Dropdown Menu */}
                            {activeDropdownTargetId === item.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  ...(openUpward
                                    ? { bottom: 'calc(100% + 4px)' }
                                    : { top: 'calc(100% + 4px)' }),
                                  minWidth: '110px',
                                  zIndex: 50,
                                }}
                                className="bg-white border border-slate-200 rounded shadow-lg p-1 text-left"
                              >
                                {/* Nút Sửa */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDropdownTargetId(null);
                                    handleOpenEdit(item);
                                  }}
                                  className="w-full flex items-center px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                                >
                                  <span>Sửa</span>
                                </button>

                                {/* Nút Xóa */}
                                {!item.is_locked ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveDropdownTargetId(null);
                                      handleDelete(item);
                                    }}
                                    className="w-full flex items-center px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  >
                                    <span>Xóa</span>
                                  </button>
                                ) : (
                                  <div className="px-3 py-1 text-[11px] text-slate-400 italic">
                                    Đã khóa (không thể xóa)
                                  </div>
                                )}

                                {/* Nút Xem log nếu có */}
                                {item.audit_logs && item.audit_logs.length > 0 && (
                                  <>
                                    <div className="h-px bg-slate-100 my-1" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDropdownTargetId(null);
                                        setViewingLogsTarget(item);
                                      }}
                                      className="w-full flex items-center px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                                      title="Xem nhật ký điều chỉnh"
                                    >
                                      <span>Nhật ký ({item.audit_logs.length})</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Khối phân trang chuẩn giao diện liền thanh */}
        {totalItems > 0 && (
          <div
            style={{
              padding: '8px 18px',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '12px',
              color: '#64748b',
              flexShrink: 0,
              borderBottomLeftRadius: '0.75rem',
              borderBottomRightRadius: '0.75rem',
            }}
          >
            {/* Khối phân trang liền thanh */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'stretch',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                height: '24px',
              }}
            >
              {/* Nút trang trước (<) - hiển thị khi trang > 1 */}
              {safePage > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                  style={{
                    minWidth: '24px',
                    height: '100%',
                    padding: '0 6px',
                    border: 'none',
                    borderRight: '1px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#4b5563',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  title="Trang trước"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}

              {/* Danh sách các số trang */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                    acc.push('...');
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx, arr) => {
                  const hasNext = safePage < totalPages;
                  const isLastItem = idx === arr.length - 1 && !hasNext;
                  if (typeof p === 'string') {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        style={{
                          minWidth: '22px',
                          height: '100%',
                          padding: '0 4px',
                          borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                          background: '#ffffff',
                          color: '#6b7280',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          userSelect: 'none',
                        }}
                      >
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
                        minWidth: '24px',
                        height: '100%',
                        padding: '0 7px',
                        border: 'none',
                        borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                        background: isActive ? '#2ba1f4' : '#ffffff',
                        color: isActive ? '#ffffff' : '#374151',
                        cursor: isActive ? 'default' : 'pointer',
                        fontSize: '11.5px',
                        fontWeight: isActive ? '700' : '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = '#ffffff';
                      }}
                    >
                      {p}
                    </button>
                  );
                })}

              {/* Nút trang sau (>) - hiển thị khi chưa tới trang cuối */}
              {safePage < totalPages && (
                <button
                  type="button"
                  onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                  style={{
                    minWidth: '24px',
                    height: '100%',
                    padding: '0 6px',
                    border: 'none',
                    background: '#ffffff',
                    color: '#4b5563',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  title="Trang sau"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>



      {/* Modal Sửa Chỉ Tiêu (Kèm Ràng Buộc Khóa Kỳ & Lý Do) */}
      {editingTarget && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Điều chỉnh chỉ tiêu doanh số</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingTarget.target_type === 'salesperson'
                    ? editingTarget.employee_name
                    : editingTarget.region}{' '}
                  — Tháng {editingTarget.month_year}
                </p>
              </div>

            <div className="p-6 space-y-4">
              {editingTarget.is_locked && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
                  <strong>Kỳ này đã qua và đã bị khóa sổ.</strong> Việc điều chỉnh chỉ tiêu bắt buộc phải nhập lý do và sẽ được hệ thống ghi vết nhật ký kiểm toán.
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Chỉ tiêu doanh số mới (VNĐ)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000000"
                  value={editAmount}
                  onFocus={(e) => {
                    e.target.select();
                  }}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '') {
                      setEditAmount(0);
                      return;
                    }
                    const cleaned = raw.replace(/^0+(?=\d)/, '');
                    e.target.value = cleaned;
                    setEditAmount(Number(cleaned));
                  }}
                  className="w-full h-9 px-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {editingTarget.is_locked && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1 text-rose-700">
                    Lý do điều chỉnh (Bắt buộc) *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Nêu rõ lý do thay đổi chỉ tiêu đã khóa..."
                    className="w-full p-2.5 text-sm border border-rose-300 rounded-lg focus:ring-rose-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Ghi chú bổ sung
                </label>
                <textarea
                  rows={2}
                  value={editNote}
                  onChange={(e) => setEditNote(e.target.value)}
                  placeholder="Ghi chú thêm..."
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTarget(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Xác nhận lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* Modal Lịch sử Điều Chỉnh (Audit Logs) */}
      {viewingLogsTarget && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fadeIn">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Nhật ký điều chỉnh chỉ tiêu</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {viewingLogsTarget.target_type === 'salesperson'
                      ? viewingLogsTarget.employee_name
                      : viewingLogsTarget.region}{' '}
                    — Tháng {viewingLogsTarget.month_year}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingLogsTarget(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
                >
                  Đóng
                </button>
              </div>

            <div className="p-6 max-h-96 overflow-y-auto">
              {viewingLogsTarget.audit_logs.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Chưa có lần chỉnh sửa nào.</p>
              ) : (
                <div className="space-y-3">
                  {viewingLogsTarget.audit_logs.map((log, index) => (
                    <div
                      key={index}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center text-slate-500">
                        <span className="font-semibold text-slate-700">{log.modified_by_name}</span>
                        <span>{new Date(log.modified_at).toLocaleString('vi-VN')}</span>
                      </div>
                      <div className="flex items-center gap-2 font-bold">
                        <span className="text-slate-400 line-through">
                          {formatCurrency(log.old_target_amount)}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-emerald-600">
                          {formatCurrency(log.new_target_amount)}
                        </span>
                      </div>
                      <div className="text-slate-700 bg-white p-2 rounded border border-slate-200 font-medium">
                        Lý do: {log.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingLogsTarget(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* Modal Xác Nhận Xóa Chỉ Tiêu (Hộp thoại hệ thống) */}
      {targetToDelete && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0 text-rose-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-slate-900">
                      Xác nhận xóa chỉ tiêu
                    </h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      Bạn có chắc chắn muốn xóa chỉ tiêu của{' '}
                      <strong className="text-slate-900 font-semibold">
                        {targetToDelete.target_type === 'salesperson'
                          ? targetToDelete.employee_name
                          : targetToDelete.region}
                      </strong>{' '}
                      (Kỳ tháng <strong className="text-slate-900 font-semibold">{targetToDelete.month_year}</strong>, mức chỉ tiêu{' '}
                      <strong className="text-emerald-700 font-semibold">{formatCurrency(targetToDelete.target_amount)}</strong>)?
                    </p>
                    <p className="text-xs text-rose-500 mt-2 font-medium">
                      Hành động này sẽ xóa dữ liệu chỉ tiêu khỏi hệ thống và không thể hoàn tác.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setTargetToDelete(null)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default SalesTargetManagementView;
