import React, { useState, useEffect, useCallback } from 'react';
import {
  getDebtAgingReportApi,
  DebtAgingReportResponse,
  DebtAgingReportParams,
  User,
} from '../services/api';

interface DebtAgingReportViewProps {
  token: string;
  currentUser?: User;
  onBackToHome?: () => void;
}

export const DebtAgingReportView: React.FC<DebtAgingReportViewProps> = ({
  token,
  currentUser: _currentUser,
  onBackToHome: _onBackToHome,
}) => {
  const [data, setData] = useState<DebtAgingReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc
  const [selectedSaleId, setSelectedSaleId] = useState<string>('all');
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('selected_debt_dealer_code') || '';
      if (saved) {
        sessionStorage.removeItem('selected_debt_dealer_code');
      }
      return saved;
    } catch {
      return '';
    }
  });
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Phân trang (Chuẩn theo phong cách Hình 2)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Debounce tìm kiếm 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    setError(null);
    try {
      const params: DebtAgingReportParams = {
        assigned_sale_id: selectedSaleId !== 'all' ? selectedSaleId : undefined,
        risk_level: selectedRiskLevel !== 'all' ? selectedRiskLevel : undefined,
        search: debouncedSearch.trim() || undefined,
      };
      const res = await getDebtAgingReportApi(token, params);
      setData(res);
    } catch (err: any) {
      console.error('Error fetching debt aging report:', err);
      setError(err?.message || 'Không thể tải báo cáo công nợ theo tuổi nợ.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token, selectedSaleId, selectedRiskLevel, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '0 đ';
    return `${Number(val).toLocaleString('vi-VN')} đ`;
  };

  const summary = data?.summary || {
    total_debt: 0,
    total_overdue: 0,
    total_current: 0,
    total_overdue_1_30: 0,
    total_overdue_31_60: 0,
    total_overdue_61_90: 0,
    total_overdue_over_90: 0,
    total_dealers_count: 0,
    overdue_dealers_count: 0,
    highest_risk_dealer: null,
  };

  const items = data?.items || [];
  const salesList = data?.sales_list || [];
  const highestRisk = summary.highest_risk_dealer;

  // Tính toán dữ liệu phân trang
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageItems = items.slice(startIndex, endIndex);

  // Xuất Excel
  const handleExportExcel = () => {
    try {
      setIsExporting(true);
      if (items.length === 0) {
        alert('Không có dữ liệu công nợ để xuất theo bộ lọc hiện tại.');
        return;
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const saleLabel = selectedSaleId === 'all'
        ? 'Tất cả nhân viên'
        : (salesList.find(s => String(s.id) === selectedSaleId)?.name || selectedSaleId);
      const riskLabel = selectedRiskLevel === 'all'
        ? 'Tất cả mức độ'
        : selectedRiskLevel === 'critical'
        ? 'Báo động đỏ (>90 ngày)'
        : selectedRiskLevel === 'high'
        ? 'Rủi ro cao (61-90 ngày)'
        : selectedRiskLevel === 'warning'
        ? 'Cảnh báo (1-60 ngày)'
        : 'An toàn';

      const rowsHtml = items.map((it, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="mso-number-format:'\\@'; font-weight: 600; text-align: center;">${it.dealer_code}</td>
          <td>${it.dealer_name}</td>
          <td>${it.assigned_sale_name || 'Chưa phân công'}</td>
          <td style="text-align: right;">${it.credit_limit.toLocaleString('vi-VN')}</td>
          <td style="text-align: right; font-weight: 700;">${it.current_debt.toLocaleString('vi-VN')}</td>
          <td style="text-align: right; color: #16a34a;">${it.debt_current.toLocaleString('vi-VN')}</td>
          <td style="text-align: right; color: #ca8a04;">${it.debt_overdue_1_30.toLocaleString('vi-VN')}</td>
          <td style="text-align: right; color: #ea580c;">${it.debt_overdue_31_60.toLocaleString('vi-VN')}</td>
          <td style="text-align: right; color: #dc2626; font-weight: 600;">${it.debt_overdue_61_90.toLocaleString('vi-VN')}</td>
          <td style="text-align: right; color: #991b1b; font-weight: 700; background-color: #fee2e2;">${it.debt_overdue_over_90.toLocaleString('vi-VN')}</td>
          <td style="text-align: right; font-weight: 700; color: #dc2626;">${it.total_overdue.toLocaleString('vi-VN')}</td>
          <td style="text-align: center; font-weight: 600;">${it.risk_level_label}</td>
        </tr>
      `).join('');

      const excelTemplate = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>BaoCaoTuoiNo</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            th { background-color: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 8px 10px; font-weight: bold; }
            td { border: 1px solid #e2e8f0; padding: 6px 8px; }
            .title { font-size: 18px; font-weight: bold; color: #0f172a; text-align: center; }
            .meta { font-size: 12px; color: #475569; }
            .sum-row { background-color: #f8fafc; font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td colspan="13" class="title" style="padding: 14px 0; font-size: 18px; font-weight: bold; text-align: center;">
                BÁO CÁO CÔNG NỢ QUÁ HẠN THEO TUỔI NỢ
              </td>
            </tr>
            <tr>
              <td colspan="13" class="meta" style="color: #475569;">
                <strong>Nhân viên phụ trách:</strong> ${saleLabel} | 
                <strong>Mức độ rủi ro:</strong> ${riskLabel} | 
                <strong>Ngày xuất:</strong> ${todayStr}
              </td>
            </tr>
            ${highestRisk ? `
            <tr>
              <td colspan="13" style="background-color: #fef2f2; color: #991b1b; padding: 8px; font-weight: bold; border: 1px solid #fecaca;">
                ĐẠI LÝ RỦI RO CAO NHẤT: ${highestRisk.dealer_name} (${highestRisk.dealer_code}) - Nợ quá hạn: ${highestRisk.total_overdue.toLocaleString('vi-VN')} đ - Lý do: ${highestRisk.reason}
              </td>
            </tr>
            ` : ''}
            <tr><td colspan="13"></td></tr>
            <thead>
              <tr>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: center;">STT</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: center;">Mã ĐL</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: left;">Tên đại lý</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: left;">NV phụ trách</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: right;">Hạn mức</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: right;">Tổng nợ</th>
                <th style="background-color: #dcfce7; border: 1px solid #16a34a; text-align: right;">Trong hạn</th>
                <th style="background-color: #fef9c3; border: 1px solid #ca8a04; text-align: right;">Quá hạn 1-30 ngày</th>
                <th style="background-color: #ffedd5; border: 1px solid #ea580c; text-align: right;">Quá hạn 31-60 ngày</th>
                <th style="background-color: #fee2e2; border: 1px solid #dc2626; text-align: right;">Quá hạn 61-90 ngày</th>
                <th style="background-color: #fecaca; border: 1px solid #b91c1c; text-align: right;">Quá hạn &gt;90 ngày</th>
                <th style="background-color: #f87171; color: #ffffff; border: 1px solid #991b1b; text-align: right;">Tổng nợ quá hạn</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: center;">Mức độ rủi ro</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="sum-row" style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #64748b;">
                <td colspan="4" style="text-align: right; padding: 8px 10px;">TỔNG CỘNG:</td>
                <td></td>
                <td style="text-align: right; padding: 8px 10px;">${summary.total_debt.toLocaleString('vi-VN')}</td>
                <td style="text-align: right; color: #16a34a; padding: 8px 10px;">${summary.total_current.toLocaleString('vi-VN')}</td>
                <td style="text-align: right; color: #ca8a04; padding: 8px 10px;">${summary.total_overdue_1_30.toLocaleString('vi-VN')}</td>
                <td style="text-align: right; color: #ea580c; padding: 8px 10px;">${summary.total_overdue_31_60.toLocaleString('vi-VN')}</td>
                <td style="text-align: right; color: #dc2626; padding: 8px 10px;">${summary.total_overdue_61_90.toLocaleString('vi-VN')}</td>
                <td style="text-align: right; color: #991b1b; padding: 8px 10px;">${summary.total_overdue_over_90.toLocaleString('vi-VN')}</td>
                <td style="text-align: right; color: #dc2626; padding: 8px 10px;">${summary.total_overdue.toLocaleString('vi-VN')}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\uFEFF' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `bao_cao_tuoi_no_dai_ly_${todayStr}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error exporting debt aging report:', err);
      alert('Lỗi xuất báo cáo tuổi nợ ra Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const getRiskBadge = (level: string, label: string) => {
    switch (level) {
      case 'CRITICAL':
        return (
          <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        );
      case 'HIGH':
        return (
          <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        );
      case 'WARNING':
        return (
          <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', backgroundColor: '#fef9c3', color: '#a16207', border: '1px solid #fef08a', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-block', padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        );
    }
  };

  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: '#f8fafc',
        height: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* Tiêu đề trang */}
      <div style={{ marginBottom: '12px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
          Báo Cáo Công Nợ Quá Hạn Theo Tuổi Nợ
        </h1>
      </div>

      {/* BANNER NỔI BẬT: ĐẠI LÝ CÓ RỦI RO CAO NHẤT */}
      {highestRisk && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px rgba(239,68,68,0.1)',
            flexShrink: 0,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
              }}
            >
              ⚠️
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#991b1b', letterSpacing: '0.05em' }}>
                  Đại lý rủi ro cao nhất cần xử lý trước:
                </span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>
                  {highestRisk.dealer_name}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>
                  ({highestRisk.dealer_code})
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#7f1d1d' }}>
                <strong>Lý do cảnh báo:</strong> {highestRisk.reason} | <strong>NV phụ trách:</strong> {highestRisk.assigned_sale_name || 'Chưa phân công'}
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#991b1b' }}>Tổng nợ quá hạn</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>
              {formatCurrency(highestRisk.total_overdue)}
            </div>
          </div>
        </div>
      )}

      {/* 4 Thẻ KPI */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '12px',
          flexShrink: 0,
        }}
      >
        {/* KPI 1: Tổng công nợ */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '12px 16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Tổng công nợ toàn hệ thống</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>{formatCurrency(summary.total_debt)}</div>
        </div>

        {/* KPI 2: Nợ quá hạn */}
        <div style={{ borderRadius: '10px', padding: '12px 16px', border: '1px solid #fed7aa', backgroundColor: '#fffbeb', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#b45309', marginBottom: '4px' }}>Tổng nợ quá hạn</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706' }}>{formatCurrency(summary.total_overdue)}</div>
        </div>

        {/* KPI 3: Nợ > 90 ngày (Nguy hiểm) */}
        <div style={{ borderRadius: '10px', padding: '12px 16px', border: '1px solid #fecaca', backgroundColor: '#fef2f2', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#991b1b', marginBottom: '4px' }}>Nợ khó đòi (Quá hạn &gt; 90 ngày)</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626' }}>{formatCurrency(summary.total_overdue_over_90)}</div>
        </div>

        {/* KPI 4: Đại lý quá hạn */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', padding: '12px 16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Số đại lý vi phạm hạn nợ</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>
            {summary.overdue_dealers_count} <span style={{ fontSize: '13px', fontWeight: '500', color: '#94a3b8' }}>/ {summary.total_dealers_count} đại lý</span>
          </div>
        </div>
      </div>

      {/* Thanh bộ lọc */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          padding: '10px 16px',
          border: '1px solid #e2e8f0',
          marginBottom: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          flexShrink: 0,
        }}
      >
        {/* 1. Lọc theo Nhân viên phụ trách */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '180px', flex: '1 1 180px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
            Nhân viên kinh doanh phụ trách
          </label>
          <select
            value={selectedSaleId}
            onChange={(e) => {
              setSelectedSaleId(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#1e293b',
              backgroundColor: '#f8fafc',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả nhân viên</option>
            {salesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* 2. Lọc theo Mức độ rủi ro */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '160px', flex: '1 1 160px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
            Mức độ rủi ro công nợ
          </label>
          <select
            value={selectedRiskLevel}
            onChange={(e) => {
              setSelectedRiskLevel(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color:
                selectedRiskLevel === 'critical'
                  ? '#dc2626'
                  : selectedRiskLevel === 'high'
                  ? '#ea580c'
                  : selectedRiskLevel === 'warning'
                  ? '#ca8a04'
                  : selectedRiskLevel === 'safe'
                  ? '#16a34a'
                  : '#1e293b',
              fontWeight: selectedRiskLevel !== 'all' ? '600' : 'normal',
              backgroundColor: '#f8fafc',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all" style={{ color: '#1e293b', fontWeight: 'normal' }}>Tất cả mức độ</option>
            <option value="critical" style={{ color: '#dc2626', fontWeight: '600' }}>Báo động đỏ (&gt;90 ngày)</option>
            <option value="high" style={{ color: '#ea580c', fontWeight: '600' }}>Rủi ro cao (61-90 ngày)</option>
            <option value="warning" style={{ color: '#ca8a04', fontWeight: '600' }}>Cảnh báo (1-60 ngày)</option>
            <option value="safe" style={{ color: '#16a34a', fontWeight: '600' }}>An toàn / Trong hạn</option>
          </select>
        </div>

        {/* 3. Tìm kiếm theo Đại lý */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '220px', flex: '2 1 220px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
            Tìm kiếm theo Mã / Tên đại lý / SĐT
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Nhập mã đại lý hoặc tên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#1e293b',
                backgroundColor: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: '9px', top: '9px' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                style={{ position: 'absolute', right: '8px', top: '7px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Nút Làm mới & Xuất Excel */}
        <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            style={{
              padding: '0 16px',
              height: '35px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              opacity: isRefreshing ? 0.7 : 1,
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
              transition: 'background-color 0.15s ease',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isRefreshing ? 'Đang cập nhật...' : 'Làm mới'}
          </button>

          <button
            id="btn-export-debt-aging-excel"
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting}
            title="Xuất báo cáo tuổi nợ ra file Excel"
            style={{
              padding: '0 16px',
              height: '35px',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isExporting ? 'not-allowed' : 'pointer',
              opacity: isExporting ? 0.7 : 1,
              boxShadow: '0 2px 4px rgba(22,163,74,0.2)',
              transition: 'background-color 0.15s ease',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              justifyContent: 'center',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {isExporting ? 'Đang xuất Excel...' : 'Xuất Excel'}
          </button>
        </div>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px', marginBottom: '10px', flexShrink: 0 }}>
          {error}
        </div>
      )}

      {/* Bảng dữ liệu ma trận tuổi nợ */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#334155', fontSize: '11.5px' }}>
                <th style={{ padding: '8px 4px', fontWeight: '700', width: '34px', textAlign: 'center', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>STT</th>
                <th style={{ padding: '8px 6px', fontWeight: '700', width: '62px', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>Mã ĐL</th>
                <th style={{ padding: '8px 8px', fontWeight: '700', minWidth: '120px', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>Tên đại lý</th>
                <th style={{ padding: '8px 6px', fontWeight: '700', width: '85px', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>NV phụ trách</th>
                <th style={{ padding: '8px 6px', fontWeight: '700', width: '75px', textAlign: 'right', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>Hạn mức</th>
                <th style={{ padding: '8px 6px', fontWeight: '800', width: '75px', textAlign: 'right', backgroundColor: '#f1f5f9', color: '#0f172a', borderRight: '1px solid #e2e8f0' }}>Tổng nợ</th>
                <th style={{ padding: '8px 4px', fontWeight: '700', width: '72px', textAlign: 'right', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>Trong hạn</th>
                <th style={{ padding: '8px 4px', fontWeight: '700', width: '72px', textAlign: 'right', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>1-30 ngày</th>
                <th style={{ padding: '8px 4px', fontWeight: '700', width: '72px', textAlign: 'right', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>31-60 ngày</th>
                <th style={{ padding: '8px 4px', fontWeight: '700', width: '72px', textAlign: 'right', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>61-90 ngày</th>
                <th style={{ padding: '8px 4px', fontWeight: '700', width: '72px', textAlign: 'right', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>&gt;90 ngày</th>
                <th style={{ padding: '8px 6px', fontWeight: '800', width: '80px', textAlign: 'right', backgroundColor: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>Tổng nợ quá hạn</th>
                <th style={{ padding: '8px 4px', fontWeight: '700', width: '75px', textAlign: 'center', backgroundColor: '#f1f5f9' }}>Mức độ rủi ro</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                    Đang tải dữ liệu phân tích tuổi nợ...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
                    Không có bản ghi công nợ nào khớp với bộ lọc.
                  </td>
                </tr>
              ) : (
                pageItems.map((it, idx) => (
                  <tr
                    key={it.dealer_id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: it.risk_level === 'CRITICAL' ? '#fff5f5' : idx % 2 === 0 ? '#ffffff' : '#fafafa',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <td style={{ padding: '6px 4px', textAlign: 'center', color: '#64748b' }}>{startIndex + idx + 1}</td>
                    <td style={{ padding: '6px 6px', fontWeight: '700', color: '#2563eb', whiteSpace: 'nowrap' }}>{it.dealer_code}</td>
                    <td style={{ padding: '6px 8px', fontWeight: '600', color: '#1e293b' }}>
                      <div style={{ wordBreak: 'break-word', lineHeight: '1.25' }}>{it.dealer_name}</div>
                      {it.phone && <div style={{ fontSize: '10.5px', color: '#94a3b8' }}>ĐT: {it.phone}</div>}
                    </td>
                    <td style={{ padding: '6px 6px', color: '#475569', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{it.assigned_sale_name || '—'}</td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {Number(it.credit_limit).toLocaleString('vi-VN')}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {Number(it.current_debt).toLocaleString('vi-VN')}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: '600', color: '#16a34a', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {it.debt_current > 0 ? Number(it.debt_current).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: '600', color: '#ca8a04', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {it.debt_overdue_1_30 > 0 ? Number(it.debt_overdue_1_30).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: '600', color: '#ea580c', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {it.debt_overdue_31_60 > 0 ? Number(it.debt_overdue_31_60).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: '700', color: '#dc2626', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {it.debt_overdue_61_90 > 0 ? Number(it.debt_overdue_61_90).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: '800', color: it.debt_overdue_over_90 > 0 ? '#991b1b' : '#64748b', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {it.debt_overdue_over_90 > 0 ? Number(it.debt_overdue_over_90).toLocaleString('vi-VN') : '—'}
                    </td>
                    <td style={{ padding: '6px 6px', textAlign: 'right', fontWeight: '800', color: it.total_overdue > 0 ? '#dc2626' : '#94a3b8', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {it.total_overdue > 0 ? Number(it.total_overdue).toLocaleString('vi-VN') : '0'}
                    </td>
                    <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                      {getRiskBadge(it.risk_level, it.risk_level_label)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot style={{ position: 'sticky', bottom: 0, backgroundColor: '#f8fafc', borderTop: '2px solid #cbd5e1', zIndex: 5 }}>
                <tr style={{ fontWeight: '800', color: '#0f172a', fontSize: '11.5px' }}>
                  <td colSpan={4} style={{ padding: '7px 8px', textAlign: 'right' }}>TỔNG CỘNG:</td>
                  <td></td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Number(summary.total_debt).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#16a34a', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Number(summary.total_current).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#ca8a04', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Number(summary.total_overdue_1_30).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#ea580c', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Number(summary.total_overdue_31_60).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#dc2626', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Number(summary.total_overdue_61_90).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#991b1b', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Number(summary.total_overdue_over_90).toLocaleString('vi-VN')}</td>
                  <td style={{ padding: '7px 6px', textAlign: 'right', color: '#dc2626', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{Number(summary.total_overdue).toLocaleString('vi-VN')}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Chân trang bảng: Khối phân trang liền thanh chuẩn theo thiết kế Hình 2 */}
        <div
          style={{
            padding: '8px 18px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748b',
            flexShrink: 0,
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
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
                const isLastItem = idx === arr.length - 1;
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
          </div>
        </div>
      </div>
    </div>
  );
};
