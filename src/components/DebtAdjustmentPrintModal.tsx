// frontend/src/components/DebtAdjustmentPrintModal.tsx
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DebtAdjustment, DebtAdjustmentPrintDocument } from '../types/debtAdjustment';
import { getDebtAdjustmentPrintDocumentApi } from '../services/debtAdjustmentApi';
import { downloadElementAsPdf } from '../utils/pdfExport';
import './debt-adjustment-print.css';

interface DebtAdjustmentPrintModalProps {
  adjustmentId?: number;
  adjustment?: DebtAdjustment;
  token: string;
  onClose: () => void;
}

const formatCurrency = (val?: number | null) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(val || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('vi-VN');
};

// Hàm chuyển số thành chữ tiếng Việt chuẩn kế toán
function numberToVietnameseWords(num: number): string {
  if (!num || num === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const scales = ['', 'nghìn', 'triệu', 'tỷ'];

  function readGroup(group: number): string {
    const hundred = Math.floor(group / 100);
    const ten = Math.floor((group % 100) / 10);
    const unit = group % 10;
    let res = '';

    if (hundred > 0) {
      res += `${units[hundred]} trăm `;
    }
    if (ten > 1) {
      res += `${units[ten]} mươi `;
      if (unit === 1) res += 'mốt ';
      else if (unit === 5) res += 'lăm ';
      else if (unit > 0) res += `${units[unit]} `;
    } else if (ten === 1) {
      res += 'mười ';
      if (unit === 5) res += 'lăm ';
      else if (unit > 0) res += `${units[unit]} `;
    } else if (hundred > 0 && unit > 0) {
      res += `lẻ ${units[unit]} `;
    } else if (unit > 0) {
      res += `${units[unit]} `;
    }
    return res.trim();
  }

  const n = Math.abs(Math.round(num));
  const groups: number[] = [];
  let temp = n;
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g > 0) {
      const gText = readGroup(g);
      const scale = scales[i];
      parts.push(`${gText} ${scale}`.trim());
    }
  }

  const result = parts.join(' ').trim();
  return result.charAt(0).toUpperCase() + result.slice(1) + ' đồng chẵn./.';
}

export const DebtAdjustmentPrintModal: React.FC<DebtAdjustmentPrintModalProps> = ({
  adjustmentId,
  adjustment,
  token,
  onClose,
}) => {
  const [doc, setDoc] = useState<DebtAdjustmentPrintDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const paperRef = useRef<HTMLDivElement>(null);
  const modalRoot = document.getElementById('modal-root') || document.body;
  const targetId = adjustmentId ?? adjustment?.id;

  useEffect(() => {
    document.body.classList.add('has-debt-adj-print-modal');
    return () => {
      document.body.classList.remove('has-debt-adj-print-modal');
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!targetId) {
      setError('Không tìm thấy mã chứng từ để tải bản in.');
      setLoading(false);
      return;
    }
    setLoading(true);
    getDebtAdjustmentPrintDocumentApi(token, targetId)
      .then((data) => setDoc(data))
      .catch((err) => setError(err.message || 'Lỗi tải thông tin in chứng từ'))
      .finally(() => setLoading(false));
  }, [token, targetId]);

  // In chứng từ qua iframe độc lập - Loại bỏ 100% rủi ro in lẫn ứng dụng web hoặc lỗi CSS
  const executeIframePrint = () => {
    const paperEl = paperRef.current;
    if (!paperEl) {
      window.print();
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!frameDoc) {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      window.print();
      return;
    }

    const docTitle = doc ? `Chung_Tu_Giam_No_${doc.adjustment_code}` : 'Chung_Tu_Giam_No';
    const printStyles = `
      @page {
        size: A4 portrait;
        margin: 10mm 12mm;
      }
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      html, body {
        width: 100%;
        background-color: #ffffff;
        color: #000000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        font-size: 12px;
        line-height: 1.45;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .debt-adj-paper {
        width: 100%;
        max-width: 100%;
        padding: 0;
        margin: 0 auto;
        background: #ffffff;
        color: #000000;
      }
      .debt-adj-doc-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
        border-bottom: 1.5px solid #0f172a;
        padding-bottom: 8px;
      }
      .debt-adj-company-info h3 {
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        color: #0f172a;
        margin-bottom: 3px;
        letter-spacing: -0.01em;
      }
      .debt-adj-company-info p {
        font-size: 10.5px;
        color: #334155;
        margin: 1px 0;
        line-height: 1.35;
      }
      .debt-adj-meta-box {
        text-align: right;
        font-size: 11px;
      }
      .debt-adj-meta-box .code {
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
      }
      .debt-adj-title-section {
        text-align: center;
        margin: 10px 0 14px 0;
      }
      .debt-adj-title-section h1 {
        font-size: 18px;
        font-weight: 900;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 3px;
      }
      .debt-adj-title-section p {
        font-size: 11px;
        color: #475569;
        font-style: italic;
      }
      .debt-adj-info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px 16px;
        margin-bottom: 12px;
        font-size: 11.5px;
        background-color: #f8fafc;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid #cbd5e1;
      }
      .debt-adj-info-item {
        display: flex;
        gap: 8px;
      }
      .debt-adj-info-item .label {
        width: 140px;
        font-weight: 600;
        color: #475569;
        flex-shrink: 0;
      }
      .debt-adj-info-item .value {
        color: #0f172a;
        font-weight: 600;
      }
      .debt-adj-table {
        width: 100%;
        border-collapse: collapse;
        margin: 8px 0 10px 0;
        font-size: 11px;
      }
      .debt-adj-table th, .debt-adj-table td {
        border: 1px solid #94a3b8;
        padding: 5px 8px;
      }
      .debt-adj-table th {
        background-color: #f1f5f9;
        font-weight: 700;
        color: #0f172a;
        text-align: center;
      }
      .debt-adj-totals {
        margin-top: 8px;
        font-size: 11.5px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .debt-adj-total-row {
        display: flex;
        justify-content: flex-end;
        gap: 16px;
        padding: 2px 0;
      }
      .debt-adj-grand-total {
        font-weight: 800;
        font-size: 13px;
        color: #0f172a;
        border-top: 1.5px solid #0f172a;
        padding-top: 4px;
        margin-top: 2px;
      }
      .debt-adj-in-words {
        font-style: italic;
        color: #1e293b;
        margin: 6px 0 8px 0;
        font-size: 11.5px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .debt-adj-note-box {
        font-size: 10.5px;
        color: #475569;
        margin-bottom: 12px;
        padding: 6px 10px;
        background-color: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 4px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .debt-adj-signatures {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        text-align: center;
        margin-top: 14px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .debt-adj-sig-box h4 {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        color: #0f172a;
        margin-bottom: 2px;
      }
      .debt-adj-sig-box p {
        font-size: 10px;
        color: #64748b;
        font-style: italic;
        margin-bottom: 45px;
      }
      .debt-adj-sig-box .name {
        font-size: 11.5px;
        font-weight: 700;
        color: #0f172a;
      }
    `;

    frameDoc.open();
    frameDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${docTitle}</title>
          <style>${printStyles}</style>
        </head>
        <body>
          <div class="debt-adj-paper">
            ${paperEl.innerHTML}
          </div>
        </body>
      </html>
    `);
    frameDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Lỗi khi in qua iframe:', err);
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 1500);
      }
    }, 200);
  };

  // Tải file PDF trực tiếp về máy tính
  const handleDownloadPdf = async () => {
    const paperEl = paperRef.current;
    if (!paperEl || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      const fileName = doc?.adjustment_code
        ? `Chung_Tu_Giam_No_${doc.adjustment_code}.pdf`
        : 'Chung_Tu_Giam_No.pdf';
      await downloadElementAsPdf(paperEl, fileName);
    } catch (err) {
      console.error('Lỗi khi xuất file PDF:', err);
      // Fallback: nếu html2canvas lỗi, chuyển sang mở hộp thoại in
      executeIframePrint();
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (loading) {
    return createPortal(
      <div className="debt-adj-print-backdrop">
        <div className="bg-white p-6 rounded-lg text-center text-sm font-medium text-gray-700">
          Đang tải dữ liệu chứng từ giảm trừ công nợ...
        </div>
      </div>,
      modalRoot
    );
  }

  if (error || !doc) {
    return createPortal(
      <div className="debt-adj-print-backdrop">
        <div className="bg-white p-6 rounded-lg max-w-md text-center">
          <p className="text-red-600 text-sm mb-4 font-semibold">{error || 'Không tìm thấy chứng từ'}</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-xs font-semibold cursor-pointer border-0"
          >
            Đóng
          </button>
        </div>
      </div>,
      modalRoot
    );
  }

  const renderDocument = () => (
    <div className="debt-adj-paper" ref={paperRef}>
      {/* 1. Header Công ty & Số Chứng Từ */}
      <div className="debt-adj-doc-header">
        <div className="debt-adj-company-info">
          <h3>{doc.company.name}</h3>
          <p>Địa chỉ: {doc.company.address}</p>
          <p>Mã số thuế: {doc.company.tax_code} — Hotline: {doc.company.phone}</p>
        </div>
        <div className="debt-adj-meta-box">
          <div className="code">Số: {doc.adjustment_code}</div>
          <div className="text-xs text-gray-500">Ngày lập: {formatDate(doc.adjustment_date)}</div>
        </div>
      </div>

      {/* 2. Tiêu đề */}
      <div className="debt-adj-title-section">
        <h1>BIÊN BẢN ĐIỀU CHỈNH GIẢM TRỪ CÔNG NỢ</h1>
        <p>Căn cứ Phiếu xuất trả hàng và đối chiếu đơn giá xuất bán theo Hóa đơn gốc</p>
      </div>

      {/* 3. Thông tin đại lý & Căn cứ chứng từ */}
      <div className="debt-adj-info-grid">
        <div className="debt-adj-info-item">
          <span className="label">Đại lý thụ hưởng:</span>
          <span className="value">{doc.dealer.name} - {doc.dealer.code || `DL${doc.dealer.id}`}</span>
        </div>
        <div className="debt-adj-info-item">
          <span className="label">Căn cứ Hóa đơn gốc:</span>
          <span className="value font-bold text-blue-700">{doc.references.original_invoice_code}</span>
        </div>
        <div className="debt-adj-info-item">
          <span className="label">Địa chỉ đại lý:</span>
          <span className="value">{doc.dealer.address || '—'}</span>
        </div>
        <div className="debt-adj-info-item">
          <span className="label">Căn cứ Phiếu trả hàng:</span>
          <span className="value font-bold text-amber-700">{doc.references.return_order_code}</span>
        </div>
        <div className="debt-adj-info-item">
          <span className="label">Số điện thoại:</span>
          <span className="value">{doc.dealer.phone || '—'}</span>
        </div>
        <div className="debt-adj-info-item">
          <span className="label">Lý do điều chỉnh:</span>
          <span className="value">{doc.reason}</span>
        </div>
      </div>

      {/* 4. Bảng chi tiết mặt hàng hàng trả */}
      <table className="debt-adj-table">
        <thead>
          <tr>
            <th style={{ width: '40px' }}>STT</th>
            <th style={{ width: '90px' }}>Mã SP</th>
            <th>Tên Hàng Hóa / Quy Cách</th>
            <th style={{ width: '60px' }}>ĐVT</th>
            <th style={{ width: '70px' }}>SL Trả</th>
            <th style={{ width: '120px' }}>Đơn Giá Gốc</th>
            <th style={{ width: '140px' }}>Thành Tiền Giảm</th>
          </tr>
        </thead>
        <tbody>
          {doc.items.map((it, idx) => (
            <tr key={idx}>
              <td style={{ textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.product_code}</td>
              <td>{it.product_name}</td>
              <td style={{ textAlign: 'center' }}>{it.unit_name || 'Cái'}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{it.return_quantity}</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(it.original_unit_price)}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 5. Tổng kết tài chính */}
      <div className="debt-adj-totals">
        <div className="debt-adj-total-row">
          <span>Tổng tiền hàng trả lại theo giá bán gốc:</span>
          <span className="font-semibold">{formatCurrency(doc.financials.subtotal_amount)}</span>
        </div>
        {doc.financials.tax_amount > 0 && (
          <div className="debt-adj-total-row">
            <span>Thuế GTGT hoàn giảm:</span>
            <span>{formatCurrency(doc.financials.tax_amount)}</span>
          </div>
        )}
        <div className="debt-adj-total-row debt-adj-grand-total">
          <span>TỔNG SỐ TIỀN GIẢM TRỪ CÔNG NỢ:</span>
          <span className="text-emerald-800">{formatCurrency(doc.financials.total_adjusted_amount)}</span>
        </div>
      </div>

      <div className="debt-adj-in-words">
        <strong>Số tiền viết bằng chữ:</strong> {numberToVietnameseWords(doc.financials.total_adjusted_amount)}
      </div>

      <div className="debt-adj-note-box">
        <strong>Ghi chú kế toán:</strong> Hóa đơn gốc {doc.references.original_invoice_code} bảo toàn tổng giá trị xuất bán ban đầu. Số dư còn nợ của hóa đơn này sau khi giảm trừ còn lại: <strong>{formatCurrency(doc.references.invoice_remaining_debt_after)}</strong>.
      </div>

      {/* 6. Chữ ký 4 bên */}
      <div className="debt-adj-signatures">
        <div className="debt-adj-sig-box">
          <h4>Người Lập Biểu</h4>
          <p>Ký, họ tên</p>
          <div className="name">{doc.created_by_name || 'Người lập'}</div>
        </div>
        <div className="debt-adj-sig-box">
          <h4>Kế Toán Trưởng</h4>
          <p>Ký, họ tên</p>
          <div className="name">Nguyễn Văn Kế Toán</div>
        </div>
        <div className="debt-adj-sig-box">
          <h4>Đại Diện Đại Lý</h4>
          <p>Ký, ghi rõ họ tên</p>
          <div className="name">{doc.dealer.name}</div>
        </div>
        <div className="debt-adj-sig-box">
          <h4>Giám Đốc / Thủ Trưởng</h4>
          <p>Ký, đóng dấu</p>
          <div className="name">Ban Giám Đốc</div>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div className="debt-adj-print-backdrop">
      <div className="debt-adj-print-container">
        {/* Thanh công cụ Modal */}
        <div className="debt-adj-print-header">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-800 text-sm">
              Chứng từ giảm trừ công nợ: {doc.adjustment_code}
            </span>
            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-semibold">
              {doc.status === 'POSTED' ? 'Đã ghi sổ' : doc.status}
            </span>
          </div>

          <div className="debt-adj-print-actions">
            <button
              type="button"
              onClick={executeIframePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm border-0 cursor-pointer transition-colors"
              title="In trực tiếp ra máy in hoặc Lưu dưới dạng PDF qua trình duyệt"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              <span>In chứng từ</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-sm border-0 cursor-pointer disabled:opacity-50 transition-colors"
              title="Tải tệp PDF sắc nét trực tiếp về máy tính"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <span>{isExportingPdf ? 'Đang tạo PDF...' : 'Tải PDF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-semibold border-0 cursor-pointer transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Nội dung khổ giấy hiển thị preview */}
        <div className="debt-adj-print-body">
          {renderDocument()}
        </div>
      </div>
    </div>,
    modalRoot
  );
};
