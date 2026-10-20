import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  DealerSearchItem,
  searchDealers,
  DebtStatementData,
  DebtStatementItem,
  getDealerDebtStatementApi,
  exportDealerDebtStatementExcelApi,
  ReceiptVoucherData,
  resyncAllDealerDebts,
} from '../services/dealerSearchApi';
import { User } from '../services/api';
import { emitStatusToast } from './StatusToast';
import { DebtStatementPrintModal } from './DebtStatementPrintModal';
import { CreateReceiptVoucherModal } from './CreateReceiptVoucherModal';
import { ReceiptVoucherPrintModal } from './ReceiptVoucherPrintModal';
import { downloadBlobFile } from '../utils/downloadHelper';
import './dealer-debt-statement.css';

interface DealerDebtStatementViewProps {
  currentUser?: User;
  token?: string;
  initialDealerId?: number;
  onBack?: () => void;
}

export const DealerDebtStatementView: React.FC<DealerDebtStatementViewProps> = ({
  currentUser,
  token,
  initialDealerId,
  onBack,
}) => {
  // Danh sách đại lý để lựa chọn
  const [dealers, setDealers] = useState<DealerSearchItem[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<number | null>(initialDealerId || null);

  // Searchable combobox state cho đại lý
  const [dealerSearchQuery, setDealerSearchQuery] = useState<string>('');
  const [isDealerDropdownOpen, setIsDealerDropdownOpen] = useState<boolean>(false);
  const dealerDropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi nhấp ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dealerDropdownRef.current &&
        !dealerDropdownRef.current.contains(e.target as Node)
      ) {
        setIsDealerDropdownOpen(false);
      }
    };
    if (isDealerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDealerDropdownOpen]);

  // Bộ lọc khoảng thời gian
  const getInitialDates = () => {
    const now = new Date();
    // Đầu tháng hiện tại
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return {
      start: formatDateStr(firstDay),
      end: formatDateStr(now),
    };
  };

  const initialRange = getInitialDates();
  const [fromDate, setFromDate] = useState<string>(initialRange.start);
  const [toDate, setToDate] = useState<string>(initialRange.end);
  const [activePreset, setActivePreset] = useState<string>('this-month');

  // Dữ liệu sổ công nợ
  const [statementData, setStatementData] = useState<DebtStatementData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  // Modals
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isCreateReceiptOpen, setIsCreateReceiptOpen] = useState<boolean>(false);
  const [createdVoucher, setCreatedVoucher] = useState<ReceiptVoucherData | null>(null);
  const [isPrintVoucherOpen, setIsPrintVoucherOpen] = useState<boolean>(false);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // 1. Tải danh sách đại lý
  const fetchDealers = useCallback(async () => {
    try {
      const res = await searchDealers({ page_size: 100 }, token);
      const items = res.items || [];
      setDealers(items);
      if (!selectedDealerId && items.length > 0) {
        const defaultDealer = initialDealerId
          ? items.find((d) => d.id === initialDealerId) || items[0]
          : items[0];
        setSelectedDealerId(defaultDealer.id);
      }
    } catch (err: any) {
      console.error('Error fetching dealers for statement:', err);
    }
  }, [token, initialDealerId, selectedDealerId]);

  useEffect(() => {
    fetchDealers();
  }, [fetchDealers]);

  useEffect(() => {
    if (initialDealerId) {
      setSelectedDealerId(initialDealerId);
    }
  }, [initialDealerId]);

  // 2. Tải dữ liệu Sổ chi tiết công nợ
  const loadDebtStatement = useCallback(async () => {
    if (!selectedDealerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getDealerDebtStatementApi(
        selectedDealerId,
        fromDate || undefined,
        toDate || undefined,
        token
      );
      setStatementData(res);
    } catch (err: any) {
      console.error('Error fetching debt statement:', err);
      setError(err?.message || 'Không thể tải sổ chi tiết công nợ.');
      setStatementData(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDealerId, fromDate, toDate, token]);

  useEffect(() => {
    if (selectedDealerId) {
      loadDebtStatement();
    }
  }, [selectedDealerId, loadDebtStatement]);

  // Tự động đồng bộ số dư nợ hiện tại vào combobox đại lý khi số liệu sổ công nợ cập nhật
  useEffect(() => {
    if (
      statementData?.dealer?.id &&
      statementData?.summary &&
      typeof statementData.summary.closing_balance === 'number'
    ) {
      setDealers((prev) =>
        prev.map((d) =>
          d.id === statementData.dealer.id
            ? { ...d, current_debt: statementData.summary.closing_balance }
            : d
        )
      );
    }
  }, [statementData]);

  // Đồng bộ và làm mới toàn bộ số liệu công nợ
  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      try {
        await resyncAllDealerDebts(selectedDealerId || undefined, token);
      } catch (syncErr) {
        console.warn('Sync debt notice:', syncErr);
      }
      await Promise.all([loadDebtStatement(), fetchDealers()]);
      emitStatusToast({
        title: 'Đồng bộ dữ liệu thành công',
        message: 'Đã làm mới và đồng bộ dữ liệu sổ công nợ theo thời gian thực.',
      });
    } catch (err: any) {
      console.error('Error refreshing debt statement:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // 3. Xử lý bộ chọn nhanh khoảng thời gian
  const handleApplyPreset = (preset: 'today' | 'this-week' | 'this-month' | 'this-quarter' | 'this-year' | 'all') => {
    setActivePreset(preset);
    const now = new Date();
    const formatDateStr = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    if (preset === 'today') {
      const todayStr = formatDateStr(now);
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'this-week') {
      const dayOfWeek = now.getDay() || 7; // Monday = 1
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayOfWeek + 1);
      setFromDate(formatDateStr(monday));
      setToDate(formatDateStr(now));
    } else if (preset === 'this-month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(formatDateStr(firstDay));
      setToDate(formatDateStr(now));
    } else if (preset === 'this-quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const firstQuarterDay = new Date(now.getFullYear(), currentQuarter * 3, 1);
      setFromDate(formatDateStr(firstQuarterDay));
      setToDate(formatDateStr(now));
    } else if (preset === 'this-year') {
      const firstYearDay = new Date(now.getFullYear(), 0, 1);
      setFromDate(formatDateStr(firstYearDay));
      setToDate(formatDateStr(now));
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  };

  // 4. Xuất file Excel (.xlsx)
  const handleExportExcel = async () => {
    const targetDealerId = selectedDealerId || statementData?.dealer?.id;
    if (!targetDealerId) {
      emitStatusToast({
        title: 'Chưa chọn đại lý',
        message: 'Vui lòng chọn đại lý cần xuất sổ chi tiết công nợ.',
      });
      return;
    }
    setIsExportingExcel(true);
    try {
      const blob = await exportDealerDebtStatementExcelApi(
        targetDealerId,
        fromDate || undefined,
        toDate || undefined,
        token
      );
      const safeCode = ((statementData?.dealer?.code || `DL${targetDealerId}`)).replace(/[^a-zA-Z0-9_-]/g, '_');
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const filename = `So_Chi_Tiet_Cong_No_${safeCode}_${datePart}.xlsx`;

      downloadBlobFile(
        blob,
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );

      emitStatusToast({
        title: 'Xuất Excel thành công',
        message: `Đã tải về Sổ chi tiết công nợ (${filename}) của đại lý ${statementData?.dealer?.name || targetDealerId}.`,
      });
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi xuất Excel',
        message: err?.message || 'Không thể tạo file Excel.',
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const currentDealer = statementData?.dealer || dealers.find((d) => d.id === selectedDealerId);
  const summary = statementData?.summary;
  const transactions = statementData?.transactions || [];

  // Lọc danh sách đại lý theo từ khóa tìm kiếm (mã, tên, SĐT, địa chỉ)
  const filteredDealers = useMemo(() => {
    if (!dealerSearchQuery.trim()) return dealers;
    const q = dealerSearchQuery.toLowerCase().trim();
    return dealers.filter(
      (d) =>
        (d.code && d.code.toLowerCase().includes(q)) ||
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.phone && d.phone.toLowerCase().includes(q)) ||
        (d.address && d.address.toLowerCase().includes(q))
    );
  }, [dealers, dealerSearchQuery]);

  const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return '0 đ';
    return Number(val).toLocaleString('vi-VN') + ' đ';
  };

  const formatDate = (val?: string | null) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch {
      return val;
    }
  };

  return (
    <div className="statement-container">
      {/* 1. Header Card */}
      <div className="statement-header-card">
        <div className="statement-header-left">
          <div className="statement-title-wrap">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="stmt-btn stmt-btn-outline"
                style={{ padding: '6px 12px' }}
                title="Quay lại danh sách đại lý"
              >
                ← Quay lại
              </button>
            )}
            <h1 className="statement-title">Sổ Chi Tiết Công Nợ Đại Lý</h1>
            <span className="statement-badge-role">Mẫu số: S31-DN</span>
          </div>
          <p className="statement-subtitle">
            Biểu mẫu chuẩn Kế toán đối chiếu và xác nhận số dư công nợ phát sinh theo thời gian thực.
          </p>
        </div>

        <div className="statement-header-actions">
          {statementData && (
            <>
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                className="stmt-btn stmt-btn-primary"
                title="Mở bản in hoặc xuất PDF sổ chi tiết công nợ"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                In & Xuất PDF
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={isExportingExcel}
                className="stmt-btn stmt-btn-excel"
                title="Tải sổ chi tiết dạng bảng tính Excel (.xlsx)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <path d="M8 13h8M8 17h8M8 9h2" />
                </svg>
                {isExportingExcel ? 'Đang xuất Excel...' : 'Xuất Excel (.xlsx)'}
              </button>
            </>
          )}

          {currentDealer && (
            <button
              type="button"
              onClick={() => setIsCreateReceiptOpen(true)}
              className="stmt-btn stmt-btn-receipt"
              title="Lập phiếu thu tiền thanh toán nợ cho đại lý này"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Lập phiếu thu
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading || isSyncing}
            className={`stmt-btn stmt-btn-outline ${isSyncing ? 'syncing' : ''}`}
            title="Đồng bộ lại công nợ và làm mới số liệu"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              className={isLoading || isSyncing ? 'spin-icon' : ''}
            >
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {isSyncing ? 'Đang đồng bộ...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* 2. Interactive Filter Bar */}
      <div className="statement-filter-card">
        <div className="statement-filter-row">
          {/* Dropdown Chọn Đại lý có Tìm kiếm (Searchable Combobox) */}
          <div className="stmt-input-group" style={{ flex: 1.5, minWidth: '320px' }}>
            <label className="stmt-input-label">Chọn đại lý đối chiếu *</label>
            <div className="stmt-combobox-wrapper" ref={dealerDropdownRef}>
              <div
                className={`stmt-combobox-trigger ${isDealerDropdownOpen ? 'open' : ''}`}
                onClick={() => setIsDealerDropdownOpen((prev) => !prev)}
                title="Nhấp để tìm kiếm hoặc chọn đại lý khác"
              >
                <div className="stmt-combobox-display">
                  {currentDealer ? (
                    <span>
                      <strong className="stmt-item-code">[{currentDealer.code || `DL${currentDealer.id}`}]</strong>{' '}
                      <span style={{ fontWeight: 600 }}>{currentDealer.name}</span>
                      {currentDealer.phone ? ` — ĐT: ${currentDealer.phone}` : ''}
                    </span>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>-- Chọn đại lý để đối chiếu --</span>
                  )}
                </div>
                <span className="stmt-combobox-arrow">▼</span>
              </div>

              {isDealerDropdownOpen && (
                <div className="stmt-combobox-dropdown">
                  <div className="stmt-combobox-search-bar">
                    <input
                      type="text"
                      placeholder="Tìm theo tên đại lý, mã [DL...], SĐT..."
                      value={dealerSearchQuery}
                      onChange={(e) => setDealerSearchQuery(e.target.value)}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    {dealerSearchQuery && (
                      <button
                        type="button"
                        className="stmt-combobox-clear-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDealerSearchQuery('');
                        }}
                        title="Xóa tìm kiếm"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="stmt-combobox-menu">
                    {filteredDealers.length === 0 ? (
                      <div className="stmt-combobox-empty">
                        Không tìm thấy đại lý nào khớp với "{dealerSearchQuery}"
                      </div>
                    ) : (
                      filteredDealers.map((d) => {
                        const isSelected = d.id === selectedDealerId;
                        return (
                          <div
                            key={d.id}
                            className={`stmt-combobox-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedDealerId(d.id);
                              setIsDealerDropdownOpen(false);
                              setDealerSearchQuery('');
                            }}
                          >
                            <div className="stmt-item-header">
                              <div>
                                <span className="stmt-item-code">[{d.code || `DL${d.id}`}]</span>
                                <span className="stmt-item-name">{d.name}</span>
                              </div>
                              {isSelected && (
                                <span style={{ color: '#0f766e', fontWeight: 700, fontSize: '13px' }}>✓</span>
                              )}
                            </div>
                            <div className="stmt-item-sub">
                              <span>
                                {d.phone ? `ĐT: ${d.phone}` : 'Chưa có SĐT'}
                                {d.address ? ` • ${d.address}` : ''}
                              </span>
                              {typeof d.current_debt === 'number' && (
                                <span className="stmt-item-debt">
                                  Nợ: {formatCurrency(d.current_debt)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lọc Từ ngày */}
          <div className="stmt-input-group" style={{ flex: 1, minWidth: '160px' }}>
            <label className="stmt-input-label">Từ ngày</label>
            <input
              type="date"
              className="stmt-date-input"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setActivePreset('custom');
              }}
            />
          </div>

          {/* Lọc Đến ngày */}
          <div className="stmt-input-group" style={{ flex: 1, minWidth: '160px' }}>
            <label className="stmt-input-label">Đến ngày</label>
            <input
              type="date"
              className="stmt-date-input"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setActivePreset('custom');
              }}
            />
          </div>

          {/* Nút Xem sổ */}
          <div style={{ alignSelf: 'flex-end', paddingTop: '18px' }}>
            <button
              type="button"
              onClick={loadDebtStatement}
              className="stmt-btn stmt-btn-primary"
              style={{ height: '38px' }}
            >
              Áp dụng lọc
            </button>
          </div>
        </div>

        {/* Quick Range Chips */}
        <div className="statement-filter-row" style={{ alignItems: 'center', paddingTop: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Chọn nhanh:</span>
          <div className="stmt-preset-chips">
            <button
              type="button"
              className={`stmt-chip ${activePreset === 'today' ? 'active' : ''}`}
              onClick={() => handleApplyPreset('today')}
            >
              Hôm nay
            </button>
            <button
              type="button"
              className={`stmt-chip ${activePreset === 'this-week' ? 'active' : ''}`}
              onClick={() => handleApplyPreset('this-week')}
            >
              Tuần này
            </button>
            <button
              type="button"
              className={`stmt-chip ${activePreset === 'this-month' ? 'active' : ''}`}
              onClick={() => handleApplyPreset('this-month')}
            >
              Tháng này
            </button>
            <button
              type="button"
              className={`stmt-chip ${activePreset === 'this-quarter' ? 'active' : ''}`}
              onClick={() => handleApplyPreset('this-quarter')}
            >
              Quý này
            </button>
            <button
              type="button"
              className={`stmt-chip ${activePreset === 'this-year' ? 'active' : ''}`}
              onClick={() => handleApplyPreset('this-year')}
            >
              Năm nay
            </button>
            <button
              type="button"
              className={`stmt-chip ${activePreset === 'all' ? 'active' : ''}`}
              onClick={() => handleApplyPreset('all')}
            >
              Toàn bộ thời gian
            </button>
          </div>
        </div>
      </div>

      {/* 3. Dealer Info Summary Banner */}
      {currentDealer && (
        <div className="statement-dealer-banner">
          <div className="stmt-dealer-field">
            <span className="stmt-dealer-lbl">Đại lý / Doanh nghiệp</span>
            <span className="stmt-dealer-val highlight">
              {currentDealer.name} ({currentDealer.code})
            </span>
          </div>

          <div className="stmt-dealer-field">
            <span className="stmt-dealer-lbl">Mã số thuế / SĐT</span>
            <span className="stmt-dealer-val">
              {(() => {
                const clean = (val?: string | null) => {
                  if (!val) return '';
                  const t = val.trim();
                  return t === '-' || t === '—' ? '' : t;
                };
                const tax = clean(currentDealer.tax_code);
                const phone = clean(currentDealer.phone);
                if (tax && phone) return `${tax} | ${phone}`;
                return tax || phone || '—';
              })()}
            </span>
          </div>

          <div className="stmt-dealer-field">
            <span className="stmt-dealer-lbl">Địa chỉ giao dịch</span>
            <span className="stmt-dealer-val" title={currentDealer.address || ''}>
              {currentDealer.address || '—'}
            </span>
          </div>

          <div className="stmt-dealer-field">
            <span className="stmt-dealer-lbl">Hạn mức tín dụng / Hạn nợ</span>
            <span className="stmt-dealer-val">
              {formatCurrency(currentDealer.credit_limit)} ({currentDealer.max_debt_days || 30} ngày)
            </span>
          </div>
        </div>
      )}

      {/* 4. 4 Thẻ KPI Tài Chính */}
      {summary && (
        <div className="statement-kpi-grid">
          {/* KPI 1: Số dư đầu kỳ */}
          <div className="stmt-kpi-card">
            <span className="stmt-kpi-title">1. Số dư nợ đầu kỳ</span>
            <div className="stmt-kpi-value">{formatCurrency(summary.opening_balance)}</div>
            <span className="stmt-kpi-sub">Số nợ luỹ kế chuyển từ các kỳ trước</span>
          </div>

          {/* KPI 2: Tổng phát sinh Tăng (Bán hàng) */}
          <div className="stmt-kpi-card">
            <span className="stmt-kpi-title">2. Phát sinh Tăng trong kỳ (Tiền hàng mua)</span>
            <div className="stmt-kpi-value inc">+ {formatCurrency(summary.total_increase)}</div>
            <span className="stmt-kpi-sub">Tổng giá trị đơn hàng / hóa đơn xuất bán</span>
          </div>

          {/* KPI 3: Tổng phát sinh Giảm (Đã thu) */}
          <div className="stmt-kpi-card">
            <span className="stmt-kpi-title">3. Phát sinh Giảm trong kỳ (Đã thanh toán)</span>
            <div className="stmt-kpi-value dec">- {formatCurrency(summary.total_decrease)}</div>
            <span className="stmt-kpi-sub">Tổng tiền mặt / chuyển khoản đại lý đã trả</span>
          </div>

          {/* KPI 4: Số dư nợ cuối kỳ */}
          <div
            className={`stmt-kpi-card closing ${
              currentDealer?.credit_limit && summary.closing_balance > currentDealer.credit_limit
                ? 'overdue'
                : ''
            }`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="stmt-kpi-title" style={{ fontWeight: 700 }}>
                4. Số dư nợ cuối kỳ (Phải thu)
              </span>
              {currentDealer?.credit_limit && summary.closing_balance > currentDealer.credit_limit && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                  }}
                >
                  Vượt hạn mức
                </span>
              )}
            </div>
            <div
              className={`stmt-kpi-value ${
                currentDealer?.credit_limit && summary.closing_balance > currentDealer.credit_limit
                  ? 'overdue'
                  : 'closing'
              }`}
            >
              {formatCurrency(summary.closing_balance)}
            </div>
            <span className="stmt-kpi-sub">
              {summary.closing_balance > 0 ? 'Đại lý cần đối chiếu và thanh toán' : 'Đại lý đã thanh toán đủ số dư'}
            </span>
          </div>
        </div>
      )}

      {/* 5. Detailed Table Card */}
      <div className="statement-table-card">
        <div className="stmt-table-header-bar">
          <div>
            <h3 className="stmt-table-title">Bảng Kê Chi Tiết Toàn Bộ Nghiệp Vụ Phát Sinh</h3>
            <span className="stmt-table-count">
              Hiển thị {transactions.length} nghiệp vụ phát sinh theo trình tự thời gian kèm số dư luỹ kế
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
              Kỳ:{' '}
              <strong>
                {statementData?.period.from_date || 'Từ đầu kỳ'} → {statementData?.period.to_date || 'Hiện tại'}
              </strong>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="stmt-state-box">
            <div className="stmt-state-icon animate-spin">⏳</div>
            <p style={{ margin: 0, fontWeight: 600 }}>Đang trích xuất sổ chi tiết công nợ đại lý...</p>
          </div>
        ) : error ? (
          <div className="stmt-state-box" style={{ color: '#dc2626' }}>
            <div className="stmt-state-icon">⚠️</div>
            <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
          </div>
        ) : (
          <>
            <div className="stmt-table-wrap">
              <table className="stmt-table">
                <thead>
                  <tr>
                    <th style={{ width: '45px', textAlign: 'center' }}>STT</th>
                    <th style={{ width: '135px', textAlign: 'center' }}>Ngày chứng từ</th>
                    <th style={{ width: '135px', textAlign: 'center' }}>Số chứng từ</th>
                    <th style={{ width: '135px', textAlign: 'center' }}>Loại chứng từ</th>
                    <th style={{ minWidth: '240px' }}>Diễn giải nghiệp vụ kinh tế</th>
                    <th style={{ width: '145px', textAlign: 'right' }}>Phát sinh Tăng (Nợ)</th>
                    <th style={{ width: '145px', textAlign: 'right' }}>Phát sinh Giảm (Có)</th>
                    <th style={{ width: '155px', textAlign: 'right' }}>Số dư nợ luỹ kế</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Hình thức / Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Dòng Số dư đầu kỳ - Bắt đầu STT là 1, bỏ dấu gạch, để trống */}
                  <tr className="stmt-tr-opening">
                    <td style={{ textAlign: 'center' }}>1</td>
                    <td style={{ textAlign: 'center' }}></td>
                    <td style={{ textAlign: 'center' }}></td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: '#e2e8f0',
                          color: '#334155',
                        }}
                      >
                        ĐẦU KỲ
                      </span>
                    </td>
                    <td>
                      <strong>Số dư công nợ phải thu chuyển sang từ kỳ trước</strong>
                    </td>
                    <td style={{ textAlign: 'right' }}></td>
                    <td style={{ textAlign: 'right' }}></td>
                    <td className="stmt-num-bal" style={{ fontSize: '14px' }}>
                      {formatCurrency(summary?.opening_balance)}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '11.5px', color: '#64748b' }}>Đầu kỳ</td>
                  </tr>

                  {/* Danh sách các dòng nghiệp vụ phát sinh */}
                  {transactions.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        style={{ textAlign: 'center', padding: '36px', color: '#64748b', fontStyle: 'italic' }}
                      >
                        Không có đơn hàng hoặc phiếu thu nào phát sinh trong khoảng thời gian đã chọn.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx: DebtStatementItem, idx: number) => (
                      <tr key={tx.id || idx}>
                        <td style={{ textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{idx + 2}</td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{formatDate(tx.date)}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#1e40af' }}>
                          {tx.doc_code}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={tx.doc_type === 'ORDER' ? 'badge-doc-order' : 'badge-doc-voucher'}
                          >
                            {tx.doc_type_label}
                          </span>
                        </td>
                        <td style={{ wordBreak: 'break-word' }}>{tx.description}</td>
                        <td className="stmt-num-inc">
                          {tx.increase_amount > 0 ? `+ ${formatCurrency(tx.increase_amount)}` : ''}
                        </td>
                        <td className="stmt-num-dec">
                          {tx.decrease_amount > 0 ? `- ${formatCurrency(tx.decrease_amount)}` : ''}
                        </td>
                        <td className="stmt-num-bal">{formatCurrency(tx.running_balance)}</td>
                        <td style={{ textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
                          {tx.payment_method || tx.status || ''}
                        </td>
                      </tr>
                    ))
                  )}

                  {/* Dòng Tổng cộng phát sinh trong kỳ */}
                  <tr className="stmt-tr-subtotal">
                    <td colSpan={5} style={{ textAlign: 'center', fontWeight: 800 }}>
                      TỔNG CỘNG PHÁT SINH TRONG KỲ
                    </td>
                    <td className="stmt-num-inc" style={{ fontSize: '13.5px', fontWeight: 800 }}>
                      + {formatCurrency(summary?.total_increase)}
                    </td>
                    <td className="stmt-num-dec" style={{ fontSize: '13.5px', fontWeight: 800 }}>
                      - {formatCurrency(summary?.total_decrease)}
                    </td>
                    <td style={{ textAlign: 'center', color: '#94a3b8' }}></td>
                    <td style={{ textAlign: 'center' }}></td>
                  </tr>

                  {/* Dòng Số dư nợ cuối kỳ */}
                  <tr className="stmt-tr-closing">
                    <td colSpan={5} style={{ textAlign: 'center', fontWeight: 800, color: '#0f766e' }}>
                      SỐ DƯ NỢ CUỐI KỲ PHẢI THU (TÍNH ĐẾN NGÀY {statementData?.period.to_date || 'HIỆN TẠI'})
                    </td>
                    <td style={{ textAlign: 'center' }}></td>
                    <td style={{ textAlign: 'center' }}></td>
                    <td
                      className="stmt-num-bal"
                      style={{ color: '#b91c1c', fontSize: '15px', fontWeight: 900 }}
                    >
                      {formatCurrency(summary?.closing_balance)}
                    </td>
                    <td style={{ textAlign: 'center', color: '#0f766e', fontWeight: 700 }}>Chốt kỳ</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Dòng tóm tắt chữ ký & bằng chữ */}
            {summary && (
              <div className="statement-words-bar">
                <div>
                  <strong>Số dư nợ cuối kỳ bằng chữ:</strong>{' '}
                  <span style={{ fontStyle: 'italic', fontWeight: 600, color: '#0f766e' }}>
                    {summary.closing_balance_words}
                  </span>
                </div>
                <div style={{ marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                  * Kế toán công nợ có thể nhấp <strong>"In & Xuất PDF"</strong> để in hoặc lưu tệp PDF biên bản đối
                  chiếu S31-DN có đầy đủ chữ ký 4 bên, hoặc nhấp <strong>"Xuất Excel (.xlsx)"</strong> để gửi file cho
                  đại lý qua email/Zalo.
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODALS */}
      {/* 1. Modal In / Tải PDF */}
      {isPrintModalOpen && statementData && (
        <DebtStatementPrintModal
          statement={statementData}
          currentUser={currentUser}
          onClose={() => setIsPrintModalOpen(false)}
          onExportExcel={handleExportExcel}
          isExportingExcel={isExportingExcel}
        />
      )}

      {/* 2. Modal Lập phiếu thu tiền nhanh */}
      {isCreateReceiptOpen && currentDealer && (
        <CreateReceiptVoucherModal
          isOpen={isCreateReceiptOpen}
          dealer={currentDealer}
          currentUser={currentUser}
          token={token}
          onClose={() => setIsCreateReceiptOpen(false)}
          onSuccess={(voucher) => {
            setIsCreateReceiptOpen(false);
            setCreatedVoucher(voucher);
            setIsPrintVoucherOpen(true);
            emitStatusToast({
              title: 'Lập phiếu thu thành công',
              message: `Đã ghi nhận phiếu thu ${voucher.receipt_code} (${(voucher.amount || 0).toLocaleString(
                'vi-VN'
              )} đ).`,
            });
            loadDebtStatement();
            fetchDealers();
          }}
        />
      )}

      {/* 3. Modal In phiếu thu vừa lập */}
      {isPrintVoucherOpen && createdVoucher && (
        <ReceiptVoucherPrintModal
          voucher={createdVoucher}
          currentUser={currentUser}
          onClose={() => {
            setIsPrintVoucherOpen(false);
            setCreatedVoucher(null);
          }}
        />
      )}
    </div>
  );
};

export default DealerDebtStatementView;
