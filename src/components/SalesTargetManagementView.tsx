// frontend/src/components/SalesTargetManagementView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { ModalPortal } from './ModalPortal';
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
}

const formatCurrency = (val: number | null | undefined): string => {
  if (val === null || val === undefined) return '0 đ';
  return `${Math.round(val).toLocaleString('vi-VN')} đ`;
};

const SELECTABLE_YEARS = [2025, 2026, 2027, 2028];
const SELECTABLE_MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

export const SalesTargetManagementView: React.FC<SalesTargetManagementViewProps> = ({
  currentUser: _currentUser,
  token,
}) => {
  // State bộ lọc
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-10');
  const [targetTypeFilter, setTargetTypeFilter] = useState<'all' | 'salesperson' | 'region'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Tách năm và tháng cho bộ lọc
  const [selectedYear, selectedMonthNum] = useMemo(() => {
    const parts = (selectedMonth || '2026-10').split('-');
    return [parts[0] || '2026', parts[1] || '10'];
  }, [selectedMonth]);

  const handlePrevMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setSelectedMonth(`${y}-${m.toString().padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [yStr, mStr] = selectedMonth.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setSelectedMonth(`${y}-${m.toString().padStart(2, '0')}`);
  };


  // Dữ liệu API
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [items, setItems] = useState<SalesTargetItem[]>([]);
  const [summary, setSummary] = useState<SalesTargetSummary | null>(null);
  const [canManage, setCanManage] = useState<boolean>(false);
  const [myProgress, setMyProgress] = useState<MyProgressResponse | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingTarget, setEditingTarget] = useState<SalesTargetItem | null>(null);
  const [viewingLogsTarget, setViewingLogsTarget] = useState<SalesTargetItem | null>(null);

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

  // Dữ liệu đồng bộ từ các module khác
  const [availableSalespersons, setAvailableSalespersons] = useState<SalespersonOption[]>([
    { id: 3, username: 'sales_user', full_name: 'Trần Bán Hàng', role: 'sales', role_label: 'Nhân viên kinh doanh' },
    { id: 2, username: 'sales_manager', full_name: 'Trưởng Phòng Kinh Doanh', role: 'sales_manager', role_label: 'Quản lý kinh doanh' },
    { id: 1, username: 'admin', full_name: 'Đào Ngọc Hiệp', role: 'admin', role_label: 'Admin' },
  ]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([
    'Hà Nội',
    'TP. HCM',
    'Miền Bắc',
    'Miền Trung',
    'Miền Nam',
  ]);

  // Form Edit State
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  // Tải dữ liệu từ máy chủ
  const loadData = async (isInitial: boolean = false) => {
    if (isInitial) {
      setLoading(true);
    }
    setErrorMsg(null);
    try {
      const resp = await fetchSalesTargets(token, selectedMonth, targetTypeFilter, '');
      setItems(resp.items);
      setSummary(resp.summary);
      setCanManage(resp.can_manage);

      // Đồng bộ thông tin danh sách nhân viên và khu vực từ hệ thống
      try {
        const meta = await fetchSalesTargetsMetadata(token);
        if (meta.salespersons && meta.salespersons.length > 0) {
          setAvailableSalespersons(meta.salespersons);
        }
        if (meta.regions && meta.regions.length > 0) {
          setAvailableRegions(meta.regions);
        }
      } catch {
        // Bỏ qua nếu lỗi metadata, dùng danh sách mặc định
      }

      // Nếu là nhân viên sale hoặc muốn xem tiến độ cá nhân
      try {
        const myProg = await fetchMySalesProgress(token);
        setMyProgress(myProg);
      } catch {
        // Bỏ qua nếu không lấy được
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ khi tải chỉ tiêu');
    } finally {
      setLoading(false);
    }
  };

  // Chỉ gọi API khi đổi tháng hoặc phân loại (Không gọi API khi gõ ô tìm kiếm)
  useEffect(() => {
    loadData(items.length === 0);
  }, [selectedMonth, targetTypeFilter]);

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

      setSuccessMsg('Đã cập nhật chỉ tiêu doanh số thành công.');
      setEditingTarget(null);
      loadData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setEditError(err.message || 'Lỗi khi cập nhật chỉ tiêu.');
    }
  };

  // Xóa chỉ tiêu
  const handleDelete = async (target: SalesTargetItem) => {
    if (target.is_locked) {
      alert('Không thể xóa chỉ tiêu của kỳ đã bị khoá.');
      return;
    }
    const targetLabel = target.target_type === 'salesperson' ? target.employee_name : target.region;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa chỉ tiêu cho "${targetLabel}" tháng ${target.month_year}?`)) {
      return;
    }

    try {
      await deleteSalesTarget(token, target.id);
      setSuccessMsg('Đã xóa chỉ tiêu thành công.');
      loadData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa chỉ tiêu.');
    }
  };

  // Lưu tạo mới
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createSalesTarget(token, createForm);
      setSuccessMsg('Đã thiết lập chỉ tiêu mới thành công.');
      setIsCreateModalOpen(false);
      loadData();
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tạo chỉ tiêu mới.');
    }
  };

  // Hàm chọn màu thanh tiến độ
  const getProgressColor = (pct: number) => {
    if (pct >= 100) return '#10b981'; // Xanh lá
    if (pct >= 70) return '#0ea5e9';  // Xanh dương
    if (pct >= 40) return '#f59e0b';  // Vàng
    return '#ef4444';                 // Đỏ
  };

  return (
    <div className="w-full flex flex-col p-4 md:p-6 bg-gray-50 min-h-screen text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Chỉ tiêu doanh số & Tiến độ kinh doanh
          </h1>
        </div>

        {canManage && (
          <div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
            >
              Thiết lập chỉ tiêu mới
            </button>
          </div>
        )}
      </div>

      {/* Thông báo Alert */}
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* Card Tiến độ Cá nhân (Dành cho nhân viên kinh doanh) */}
      {myProgress && (
        <div className="mb-6 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                Tiến độ của bạn
              </span>
              <h2 className="text-lg font-bold text-slate-900 mt-1">
                {myProgress.employee_name} — Tháng {myProgress.month_year}
              </h2>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-slate-400 block text-xs">Mục tiêu</span>
                <span className="font-bold text-slate-800">{formatCurrency(myProgress.target_amount)}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-xs">Đã đạt</span>
                <span className="font-bold text-emerald-600">{formatCurrency(myProgress.actual_amount)}</span>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-slate-400 block text-xs">Còn thiếu</span>
                <span className="font-bold text-rose-600">{formatCurrency(myProgress.remaining_amount)}</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1">
              <span>Tỷ lệ hoàn thành: {myProgress.progress_pct}%</span>
              {myProgress.projected_amount && (
                <span className="text-slate-500">
                  Dự báo cuối tháng: {formatCurrency(myProgress.projected_amount)}
                </span>
              )}
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, myProgress.progress_pct)}%`,
                  backgroundColor: getProgressColor(myProgress.progress_pct),
                }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Thời gian kỳ kinh doanh đang diễn ra. Bạn còn {myProgress.days_left} ngày để hoàn thành mục tiêu tháng!
            </p>
          </div>
        </div>
      )}

      {/* Summary KPI Cards (Dành cho Quản lý & Admin) */}
      {summary && canManage && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-400">Tổng chỉ tiêu toàn đội</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {formatCurrency(summary.total_target_amount)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Kỳ tháng {summary.month_year}</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-400">Doanh số thực tế đạt</div>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {formatCurrency(summary.total_actual_amount)}
            </div>
            <div className="text-xs text-slate-500 mt-1">Cập nhật theo đơn hàng</div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-400">Tiến độ trung bình</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {summary.average_progress_pct}%
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, summary.average_progress_pct)}%`,
                  backgroundColor: getProgressColor(summary.average_progress_pct),
                }}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="text-xs font-medium text-slate-400">Đạt mục tiêu (≥ 100%)</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {summary.completed_count} / {summary.total_count}
            </div>
            <div className="text-xs text-slate-500 mt-1">Số nhân viên / khu vực về đích</div>
          </div>
        </div>
      )}

      {/* Control Bar (Lọc tháng, loại chỉ tiêu, tìm kiếm) */}
      <div
        className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm mb-6 flex items-center justify-between gap-4 overflow-x-auto"
        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
      >
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex items-center gap-3 shrink-0"
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
        >
          {/* Chọn tháng & năm tối ưu gọn gàng */}
          <div
            className="flex items-center gap-1.5 shrink-0"
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
          >
            <span className="text-xs font-semibold text-slate-600 whitespace-nowrap">Tháng:</span>

            {/* Nút lùi 1 tháng */}
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Kỳ tháng trước"
              className="h-8 w-6 inline-flex items-center justify-center border border-slate-300 rounded-lg bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
            >
              ‹
            </button>

            {/* Chọn Tháng (chỉ 12 giá trị) */}
            <select
              value={selectedMonthNum}
              onChange={(e) => setSelectedMonth(`${selectedYear}-${e.target.value}`)}
              className="h-8 px-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              title="Chọn tháng"
            >
              {SELECTABLE_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <span className="text-xs font-semibold text-slate-400">/</span>

            {/* Chọn Năm (chỉ các năm) */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedMonth(`${e.target.value}-${selectedMonthNum}`)}
              className="h-8 px-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              title="Chọn năm"
            >
              {SELECTABLE_YEARS.map((y) => (
                <option key={y} value={y.toString()}>
                  {y}
                </option>
              ))}
            </select>

            {/* Nút tiến 1 tháng */}
            <button
              type="button"
              onClick={handleNextMonth}
              title="Kỳ tháng kế tiếp"
              className="h-8 w-6 inline-flex items-center justify-center border border-slate-300 rounded-lg bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold transition-colors cursor-pointer"
            >
              ›
            </button>
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
              className="h-8 px-2.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Tất cả đối tượng</option>
              <option value="salesperson">Theo nhân viên</option>
              <option value="region">Theo khu vực</option>
            </select>
          </div>

          {/* Ô tìm kiếm tự động khi nhập */}
          <div
            className="flex items-center shrink-0"
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' }}
          >
            <input
              type="text"
              placeholder="Tìm nhân viên, khu vực..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 px-3 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 w-56 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </form>

        <div
          className="flex items-center gap-1.5 text-xs text-slate-500 whitespace-nowrap shrink-0"
          style={{ whiteSpace: 'nowrap' }}
        >
          <span>Kỳ tháng hiện tại: <strong>2026-10</strong></span>
        </div>
      </div>

      {/* Table danh sách chỉ tiêu */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="w-full overflow-hidden">
          <table className="w-full table-fixed text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className={`py-2.5 px-3 ${canManage ? 'w-[18%]' : 'w-[20%]'}`}>Đối tượng</th>
                <th className={`py-2.5 px-1.5 text-center ${canManage ? 'w-[9%]' : 'w-[10%]'}`}>Phân loại</th>
                <th className={`py-2.5 px-2 text-right ${canManage ? 'w-[11%]' : 'w-[12%]'}`}>Chỉ tiêu (VNĐ)</th>
                <th className={`py-2.5 px-2 text-right ${canManage ? 'w-[11%]' : 'w-[12%]'}`}>Thực tế đạt</th>
                <th className={`py-2.5 px-2 text-right ${canManage ? 'w-[10%]' : 'w-[11%]'}`}>Còn thiếu</th>
                <th className={`py-2.5 px-2 ${canManage ? 'w-[14%]' : 'w-[15%]'}`}>Tiến độ</th>
                <th className={`py-2.5 px-2 text-right ${canManage ? 'w-[11%]' : 'w-[12%]'}`}>Dự báo cuối</th>
                <th className={`py-2.5 px-1.5 text-center ${canManage ? 'w-[8%]' : 'w-[8%]'}`}>Trạng thái</th>
                {canManage && <th className="py-2.5 px-1.5 text-center w-[8%]">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="py-8 text-center text-slate-400">
                    Đang tải dữ liệu chỉ tiêu...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 9 : 8} className="py-8 text-center text-slate-400">
                    {searchTerm.trim()
                      ? `Không tìm thấy chỉ tiêu nào phù hợp với từ khóa "${searchTerm}".`
                      : 'Không có chỉ tiêu nào trong kỳ tháng đã chọn.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const targetName =
                    item.target_type === 'salesperson'
                      ? item.employee_name || `Nhân viên #${item.employee_id}`
                      : item.region || 'Chưa đặt khu vực';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      {/* Đối tượng */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900 truncate" title={targetName}>
                          {targetName}
                        </div>
                        {item.note && (
                          <div className="text-[11px] text-slate-400 font-normal truncate" title={item.note}>
                            {item.note}
                          </div>
                        )}
                      </td>

                      {/* Phân loại */}
                      <td className="py-2.5 px-1.5 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 text-[11px] font-semibold rounded whitespace-nowrap ${
                            item.target_type === 'salesperson'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {item.target_type === 'salesperson' ? 'Nhân viên' : 'Khu vực'}
                        </span>
                      </td>

                      {/* Chỉ tiêu */}
                      <td className="py-2.5 px-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {formatCurrency(item.target_amount)}
                      </td>

                      {/* Thực tế đạt */}
                      <td className="py-2.5 px-2 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        {formatCurrency(item.actual_amount)}
                      </td>

                      {/* Còn thiếu */}
                      <td className="py-2.5 px-2 text-right font-medium text-rose-600 whitespace-nowrap">
                        {formatCurrency(item.remaining_amount)}
                      </td>

                      {/* Tiến độ */}
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold w-11 text-slate-700 shrink-0">
                            {item.progress_pct}%
                          </span>
                          <div className="flex-1 min-w-0 bg-slate-100 rounded-full h-1.5 overflow-hidden">
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

                      {/* Dự báo cuối tháng */}
                      <td className="py-2.5 px-2 text-right text-xs font-medium text-slate-600 whitespace-nowrap">
                        {item.projected_amount ? formatCurrency(item.projected_amount) : '—'}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-2.5 px-1.5 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-full whitespace-nowrap ${
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
                        <td className="py-2.5 px-1.5 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              Sửa
                            </button>

                            {!item.is_locked && (
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors"
                              >
                                Xóa
                              </button>
                            )}

                            {item.audit_logs && item.audit_logs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setViewingLogsTarget(item)}
                                className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors"
                                title="Xem nhật ký điều chỉnh"
                              >
                                Log ({item.audit_logs.length})
                              </button>
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
      </div>

      {/* Modal Thiết lập Chỉ Tiêu Mới */}
      {isCreateModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
              <div className="px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base">Thiết lập chỉ tiêu doanh số mới</h3>
              </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Loại chỉ tiêu
                </label>
                <select
                  value={createForm.target_type}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, target_type: e.target.value as any })
                  }
                  className="w-full h-9 px-3 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="salesperson">Theo nhân viên</option>
                  <option value="region">Theo khu vực</option>
                </select>
              </div>

              {createForm.target_type === 'salesperson' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Nhân viên kinh doanh (Đồng bộ người dùng hệ thống)
                  </label>
                  <select
                    value={createForm.employee_id || (availableSalespersons[0]?.id ?? 3)}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      const found = availableSalespersons.find((u) => u.id === id);
                      setCreateForm({
                        ...createForm,
                        employee_id: id,
                        employee_name: found ? found.full_name : 'Nhân viên',
                      });
                    }}
                    className="w-full h-9 px-3 text-sm border border-slate-300 rounded-lg bg-white"
                  >
                    {availableSalespersons.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.full_name} ({sp.role_label})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Tên khu vực (Đồng bộ từ danh bạ đại lý)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      list="sales-target-regions-list"
                      required
                      value={createForm.region || ''}
                      onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })}
                      placeholder="Chọn hoặc nhập khu vực (Hà Nội, TP. HCM...)"
                      className="w-full h-9 px-3 text-sm border border-slate-300 rounded-lg"
                    />
                    <datalist id="sales-target-regions-list">
                      {availableRegions.map((r) => (
                        <option key={r} value={r} />
                      ))}
                    </datalist>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Khu vực có sẵn: {availableRegions.join(', ')}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Kỳ áp dụng (Tháng / Năm)
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <select
                      value={createFormMonth}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, month_year: `${createFormYear}-${e.target.value}` })
                      }
                      className="w-full h-9 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium cursor-pointer"
                    >
                      {SELECTABLE_MONTHS.map((m) => (
                        <option key={m} value={m}>
                          Tháng {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-slate-400 font-bold">/</span>
                  <div className="flex-1">
                    <select
                      value={createFormYear}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, month_year: `${e.target.value}-${createFormMonth}` })
                      }
                      className="w-full h-9 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium cursor-pointer"
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

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Chỉ tiêu doanh số (VNĐ)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000000"
                  required
                  value={createForm.target_amount}
                  onFocus={(e) => {
                    e.target.select();
                  }}
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
                  className="w-full h-9 px-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Ghi chú
                </label>
                <textarea
                  rows={2}
                  value={createForm.note || ''}
                  onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })}
                  placeholder="Ghi chú kế hoạch, mục tiêu..."
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  Lưu chỉ tiêu
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalPortal>
      )}

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

              {editError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs font-medium">
                  {editError}
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
    </div>
  );
};

export default SalesTargetManagementView;
