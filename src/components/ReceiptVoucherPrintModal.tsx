import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ReceiptVoucherData } from '../services/dealerSearchApi';
import { User } from '../services/api';
import { downloadElementAsPdf } from '../utils/pdfExport';
import './receipt-voucher-print.css';

interface ReceiptVoucherPrintModalProps {
  voucher: ReceiptVoucherData;
  currentUser?: User | null;
  onClose: () => void;
}

export const ReceiptVoucherPrintModal: React.FC<ReceiptVoucherPrintModalProps> = ({
  voucher,
  currentUser,
  onClose,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Thêm class vào body khi mở modal in
  useEffect(() => {
    document.body.classList.add('has-receipt-print-modal');
    return () => {
      document.body.classList.remove('has-receipt-print-modal');
    };
  }, []);

  // Đóng bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Hàm in chứng từ qua iframe độc lập - Triệt tiêu 100% rủi ro xung đột CSS, không bao giờ bị trang trắng
  const executeIframePrint = () => {
    const paperEl = printAreaRef.current?.querySelector('.receipt-print-paper') as HTMLElement | null;
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

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      window.print();
      return;
    }

    const title = `Phieu-Thu-${voucher.receipt_code}`;
    const printStyles = `
      @page {
        size: A4 portrait;
        margin: 10mm 15mm;
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
        font-size: 13.5px;
        line-height: 1.55;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .receipt-print-paper {
        width: 100%;
        max-width: 100%;
        padding: 0;
        margin: 0 auto;
        background: #ffffff;
        color: #000000;
      }
      .receipt-header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
        border-bottom: 1.5px solid #0f172a;
        padding-bottom: 10px;
      }
      .receipt-company-info {
        flex: 1;
        padding-right: 20px;
      }
      .receipt-company-title {
        font-size: 13.5px;
        font-weight: 800;
        text-transform: uppercase;
        color: #0f172a;
        margin-bottom: 3px;
        letter-spacing: -0.01em;
      }
      .receipt-company-text {
        font-size: 11.5px;
        color: #475569;
        line-height: 1.4;
      }
      .receipt-template-info {
        text-align: right;
        flex-shrink: 0;
      }
      .receipt-code-box {
        font-size: 12px;
        color: #0f172a;
      }
      .receipt-code-box strong {
        font-family: monospace;
        color: #1e40af;
        font-size: 13.5px;
        font-weight: bold;
      }
      .receipt-template-desc {
        font-size: 10.5px;
        color: #64748b;
        font-style: italic;
        line-height: 1.3;
        margin-top: 2px;
      }
      .receipt-title-section {
        text-align: center;
        margin: 12px 0 20px 0;
      }
      .receipt-main-title {
        font-size: 24px;
        font-weight: 900;
        color: #000000;
        letter-spacing: 2px;
        margin: 0 0 6px 0;
      }
      .receipt-date-line {
        font-size: 12.5px;
        color: #334155;
        font-style: italic;
      }
      .receipt-details-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 22px;
      }
      .receipt-detail-item {
        display: flex;
        align-items: baseline;
        gap: 12px;
      }
      .receipt-detail-label {
        font-size: 13px;
        font-weight: 600;
        color: #334155;
        white-space: nowrap;
        flex-shrink: 0;
        min-width: 185px;
      }
      .receipt-detail-value {
        font-size: 13px;
        color: #0f172a;
        flex: 1;
      }
      .receipt-amount-digits {
        font-size: 17px;
        font-weight: 900;
        color: #b91c1c;
        letter-spacing: 0.5px;
      }
      .receipt-amount-words {
        font-size: 13px;
        font-style: italic;
        font-weight: 700;
        color: #0f172a;
      }
      .receipt-signatures-table {
        width: 100%;
        border-collapse: collapse;
        text-align: center;
        margin-top: 22px;
        margin-bottom: 35px;
        table-layout: fixed;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .receipt-signatures-table th,
      .receipt-signatures-table td {
        padding: 0 12px;
        text-align: center;
        vertical-align: top;
        border: none;
      }
      .receipt-sig-roles-row th {
        font-size: 12.5px;
        font-weight: 700;
        text-transform: uppercase;
        color: #000000;
        line-height: 1.35;
        letter-spacing: -0.01em;
        padding-bottom: 4px;
      }
      .receipt-sig-subs-row td {
        font-size: 11px;
        color: #64748b;
        font-style: italic;
        line-height: 1.3;
      }
      .receipt-sig-spaces-row td {
        height: 75px;
        min-height: 75px;
        padding: 0 !important;
      }
      .receipt-sig-names-row td {
        font-size: 12.5px;
        font-weight: 700;
        color: #0f172a;
        vertical-align: bottom !important;
        padding-top: 6px;
        white-space: nowrap;
      }
      .receipt-print-footer {
        margin-top: 24px;
        border-top: 1px dashed #cbd5e1;
        padding-top: 8px;
        font-size: 10px;
        color: #64748b;
        text-align: center;
        font-style: italic;
      }
      .font-semibold { font-weight: 600; }
      .font-bold { font-weight: 700; }
      .font-medium { font-weight: 500; }
    `;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>${printStyles}</style>
      </head>
      <body>
        <div class="receipt-print-paper">
          ${paperEl.innerHTML}
        </div>
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Lỗi khi in qua iframe, fallback window.print:', err);
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

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handlePrint = () => {
    executeIframePrint();
  };

  const handleDownloadPdf = async () => {
    const paperEl = printAreaRef.current?.querySelector('.receipt-print-paper') as HTMLElement | null;
    if (!paperEl || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      await downloadElementAsPdf(paperEl, `Phieu-Thu-${voucher.receipt_code}.pdf`);
    } catch (err) {
      console.error('Lỗi khi xuất PDF phiếu thu:', err);
      executeIframePrint();
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Định dạng ngày chứng từ
  const voucherDate = voucher.created_at ? new Date(voucher.created_at) : new Date();
  const dayStr = String(voucherDate.getDate()).padStart(2, '0');
  const monthStr = String(voucherDate.getMonth() + 1).padStart(2, '0');
  const yearStr = String(voucherDate.getFullYear());
  const timeStr = voucherDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const collectorName =
    voucher.collector_name ||
    currentUser?.full_name ||
    currentUser?.username ||
    'Kế toán công nợ';

  return createPortal(
    <div className="receipt-print-backdrop" role="dialog" aria-modal="true">
      <div className="receipt-print-dialog">
        {/* THANH CÔNG CỤ (TOOLBAR) - THIẾT KẾ GỌN GÀNG, KHÔNG DÙNG ICON THEO YÊU CẦU */}
        <div className="receipt-print-toolbar">
          <div className="receipt-print-toolbar-title">
            Chứng từ Phiếu Thu — {voucher.receipt_code}
          </div>

          <div className="receipt-print-toolbar-actions">
            <button
              type="button"
              onClick={handlePrint}
              className="receipt-btn receipt-btn-primary"
              title="In phiếu thu hoặc lưu dưới dạng PDF qua trình duyệt"
            >
              In PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="receipt-btn receipt-btn-secondary"
              title="Đóng cửa sổ xem trước"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* VÙNG HIỂN THỊ TRANG IN KHỔ A4 */}
        <div className="receipt-print-preview-container" ref={printAreaRef}>
          <div className="receipt-print-paper">
            {/* 1. Header Đơn vị phát hành & Mã phiếu thu */}
            <div className="receipt-header-row">
              <div className="receipt-company-info">
                <div className="receipt-company-title">HỆ THỐNG PHÂN PHỐI & BÁN HÀNG TTCS</div>
                <div className="receipt-company-text">Địa chỉ: Trụ sở văn phòng chính & Chi nhánh giao dịch</div>
                <div className="receipt-company-text">Bộ phận: Kế toán Tài chính — Quản lý Công nợ</div>
              </div>

              <div className="receipt-template-info">
                <div className="receipt-code-box">
                  Mã phiếu thu: <strong>{voucher.receipt_code}</strong>
                </div>
                <div className="receipt-template-desc">
                  Chứng từ thu tiền công nợ đại lý
                </div>
              </div>
            </div>

            {/* 2. Tiêu đề PHIẾU THU */}
            <div className="receipt-title-section">
              <h1 className="receipt-main-title">PHIẾU THU</h1>
              <div className="receipt-date-line">
                Ngày {dayStr} tháng {monthStr} năm {yearStr} ({timeStr})
              </div>
            </div>

            {/* 3. Nội dung chi tiết phiếu thu - Tối giản theo đúng yêu cầu */}
            <div className="receipt-details-list">
              <div className="receipt-detail-item">
                <span className="receipt-detail-label">Họ và tên người nộp:</span>
                <span className="receipt-detail-value font-semibold">
                  {voucher.payer_name || `Đại diện ${voucher.dealer_name}`}
                </span>
              </div>

              <div className="receipt-detail-item">
                <span className="receipt-detail-label">Đơn vị / Đại lý nộp tiền:</span>
                <span className="receipt-detail-value font-bold">
                  {voucher.dealer_name} (Mã đại lý: {voucher.dealer_code})
                </span>
              </div>

              <div className="receipt-detail-item">
                <span className="receipt-detail-label">Địa chỉ đại lý:</span>
                <span className="receipt-detail-value">{voucher.dealer_address || '—'}</span>
              </div>

              <div className="receipt-detail-item">
                <span className="receipt-detail-label">Điện thoại liên hệ:</span>
                <span className="receipt-detail-value">
                  {voucher.dealer_phone ? `ĐT: ${voucher.dealer_phone}` : ''}
                  {voucher.dealer_phone && voucher.dealer_tax_code ? ' — ' : ''}
                  {voucher.dealer_tax_code ? `MST: ${voucher.dealer_tax_code}` : ''}
                  {!voucher.dealer_phone && !voucher.dealer_tax_code ? '—' : ''}
                </span>
              </div>

              <div className="receipt-detail-item">
                <span className="receipt-detail-label">Lý do nộp:</span>
                <span className="receipt-detail-value font-medium">
                  {voucher.reason || 'Thu tiền thanh toán công nợ đơn hàng'}
                  {voucher.order_code ? ` (Kèm đơn hàng: ${voucher.order_code})` : ''}
                </span>
              </div>

              <div className="receipt-detail-item highlight-amount">
                <span className="receipt-detail-label">Số tiền thu:</span>
                <span className="receipt-detail-value receipt-amount-digits">
                  {(voucher.amount || 0).toLocaleString('vi-VN')} đ
                </span>
              </div>

              <div className="receipt-detail-item">
                <span className="receipt-detail-label">Viết bằng chữ:</span>
                <span className="receipt-detail-value receipt-amount-words">
                  {voucher.amount_in_words || '—'}
                </span>
              </div>

              <div className="receipt-detail-item">
                <span className="receipt-detail-label">Hình thức thanh toán:</span>
                <span className="receipt-detail-value font-semibold">
                  {voucher.payment_method || 'Tiền mặt'}
                </span>
              </div>

              <div className="receipt-detail-item">
                <span className="receipt-detail-label">Người thu tiền:</span>
                <span className="receipt-detail-value font-medium">
                  {collectorName}
                </span>
              </div>
            </div>

            {/* 4. Khối 2 chữ ký tối giản: Người nộp tiền & Người thu tiền (Người lập phiếu) */}
            <table className="receipt-signatures-table">
              <thead>
                <tr className="receipt-sig-roles-row">
                  <th className="receipt-sig-role" style={{ width: '50%' }}>
                    Người nộp tiền
                  </th>
                  <th className="receipt-sig-role" style={{ width: '50%' }}>
                    Người thu tiền (Người lập phiếu)
                  </th>
                </tr>
                <tr className="receipt-sig-subs-row">
                  <td className="receipt-sig-sub">(Ký, ghi rõ họ tên)</td>
                  <td className="receipt-sig-sub">(Ký, ghi rõ họ tên)</td>
                </tr>
              </thead>
              <tbody>
                <tr className="receipt-sig-spaces-row">
                  <td>&nbsp;</td>
                  <td>&nbsp;</td>
                </tr>
                <tr className="receipt-sig-names-row">
                  <td className="receipt-sig-name">
                    {voucher.payer_name || `Đại diện ${voucher.dealer_name}`}
                  </td>
                  <td className="receipt-sig-name">{collectorName}</td>
                </tr>
              </tbody>
            </table>

            {/* Footer chân trang in */}
            <div className="receipt-print-footer">
              Chứng từ điện tử được khởi tạo từ Hệ thống Quản trị Bán hàng & Phân phối TTCS • Mã xác thực: {voucher.receipt_code}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ReceiptVoucherPrintModal;
