import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { InvoiceAdjustmentItem, User } from '../services/api';
import { downloadElementAsPdf } from '../utils/pdfExport';
import './receipt-voucher-print.css';

interface InvoiceAdjustmentDetailModalProps {
  adjustment: InvoiceAdjustmentItem;
  currentUser?: User;
  onClose: () => void;
  onOpenOriginalInvoice?: (invoiceId: number) => void;
}

export const InvoiceAdjustmentDetailModal: React.FC<InvoiceAdjustmentDetailModalProps> = ({
  adjustment,
  currentUser,
  onClose,
  onOpenOriginalInvoice,
}) => {
  const paperRef = useRef<HTMLDivElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    const title = `Chung-Tu-Dieu-Chinh-${adjustment.adjustment_code}`;
    const printStyles = `
      @page {
        size: A4 portrait;
        margin: 12mm 15mm;
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
        font-size: 13px;
        line-height: 1.45;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .adj-print-paper {
        width: 100%;
        max-width: 100%;
        padding: 0;
        margin: 0 auto;
        background: #ffffff;
        color: #000000;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 6px 10px;
        border: 1px solid #cbd5e1;
      }
    `;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="vi">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <style>${printStyles}</style>
        </head>
        <body>
          <div class="adj-print-paper">
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
      } catch {
        window.print();
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 2000);
      }
    }, 200);
  };

  const handleDownloadPdf = async () => {
    if (!paperRef.current || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      await downloadElementAsPdf(paperRef.current, `Chung-Tu-Dieu-Chinh-${adjustment.adjustment_code}.pdf`);
    } catch (err) {
      console.error('Lỗi khi xuất PDF chứng từ điều chỉnh:', err);
      executeIframePrint();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const creatorName =
    adjustment.created_by ||
    currentUser?.full_name ||
    currentUser?.username ||
    'Người lập chứng từ';

  const typeBadgeLabel =
    adjustment.adjustment_type === 'INCREASE'
      ? 'Điều chỉnh tăng'
      : adjustment.adjustment_type === 'DECREASE'
      ? 'Điều chỉnh giảm'
      : 'Điều chỉnh thông tin';

  return createPortal(
    <div
      className="receipt-print-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="receipt-print-dialog">
        {/* THANH CÔNG CỤ (TOOLBAR) */}
        <div className="receipt-print-toolbar">
          <div className="receipt-print-toolbar-title flex items-center gap-2">
            <span>Chứng Từ Điều Chỉnh — {adjustment.adjustment_code}</span>
            <span className="text-xs px-2 py-0.5 rounded font-normal bg-slate-800 text-slate-300">
              Gốc: {adjustment.invoice_code}
            </span>
          </div>

          <div className="receipt-print-toolbar-actions">
            {onOpenOriginalInvoice && (
              <button
                type="button"
                onClick={() => onOpenOriginalInvoice(adjustment.invoice_id)}
                className="receipt-btn bg-slate-700 hover:bg-slate-600 text-white"
                title="Mở xem hóa đơn bán hàng gốc"
              >
                Mở hóa đơn gốc
              </button>
            )}

            <button
              type="button"
              onClick={executeIframePrint}
              className="receipt-btn receipt-btn-primary"
              title="Mở hộp thoại in chứng từ"
            >
              In chứng từ
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className="receipt-btn receipt-btn-pdf"
              title="Tải trực tiếp chứng từ dạng tệp PDF"
              style={{ opacity: isExportingPdf ? 0.7 : 1, cursor: isExportingPdf ? 'wait' : 'pointer' }}
            >
              {isExportingPdf ? 'Đang tạo PDF...' : 'Tải PDF'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="receipt-btn receipt-btn-secondary"
              title="Đóng cửa sổ"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* VÙNG CUỘN XEM TRƯỚC GIẤY A4 */}
        <div className="receipt-print-preview-container">
          <div
            ref={paperRef}
            className="receipt-print-paper"
            style={{
              width: '100%',
              maxWidth: '794px',
              minHeight: 'auto',
              padding: '36px 44px',
              backgroundColor: '#ffffff',
              color: '#000000',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
              borderRadius: '2px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              fontSize: '13px',
              lineHeight: 1.45,
              boxSizing: 'border-box',
            }}
          >
            {/* Header Đơn vị */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: '12px', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a' }}>
                  HỆ THỐNG QUẢN LÝ KHO & BÁN HÀNG
                </div>
                <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>
                  Phân hệ Kế toán & Quản lý Hóa đơn Bán Hàng
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '11.5px', color: '#334155' }}>
                <div>Mã chứng từ: <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '13px' }}>{adjustment.adjustment_code}</strong></div>
                <div style={{ marginTop: '2px' }}>Ngày lập: {adjustment.created_at || new Date().toLocaleDateString('vi-VN')}</div>
              </div>
            </div>

            {/* Tiêu đề chính */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.02em', margin: 0 }}>
                CHỨNG TỪ ĐIỀU CHỈNH HÓA ĐƠN
              </h1>
              <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '4px' }}>
                Căn cứ theo quy định về quản lý hóa đơn thương mại và biên bản điều chỉnh sai sót
              </div>
            </div>

            {/* Khung thông tin hóa đơn gốc */}
            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px 18px', marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' }}>
                1. Thông tin hóa đơn bị điều chỉnh
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Hóa đơn gốc: </span>
                  <strong style={{ fontFamily: 'monospace', color: '#0369a1' }}>{adjustment.invoice_code}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Khách hàng / Đại lý: </span>
                  <strong>{adjustment.dealer_name || 'Khách hàng mua lẻ'}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Phân loại điều chỉnh: </span>
                  <span style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: adjustment.adjustment_type === 'INCREASE' ? '#dcfce7' : adjustment.adjustment_type === 'DECREASE' ? '#ffe4e6' : '#e0f2fe',
                    color: adjustment.adjustment_type === 'INCREASE' ? '#166534' : adjustment.adjustment_type === 'DECREASE' ? '#991b1b' : '#075985',
                  }}>
                    {typeBadgeLabel}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Người lập: </span>
                  <strong>{creatorName}</strong>
                </div>
              </div>
            </div>

            {/* Nội dung và lý do điều chỉnh */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}>
                2. Lý do & Nội dung điều chỉnh
              </div>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', padding: '10px 14px', backgroundColor: '#ffffff', minHeight: '50px', fontSize: '12.5px', color: '#1e293b' }}>
                {adjustment.reason || 'Điều chỉnh sai sót theo thỏa thuận đối soát giao nhận thực tế.'}
              </div>
            </div>

            {/* Bảng chênh lệch tài chính */}
            {adjustment.adjustment_type !== 'INFO' && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a', marginBottom: '8px' }}>
                  3. Giá trị chênh lệch điều chỉnh
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#334155' }}>
                      <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1' }}>Khoản mục điều chỉnh</th>
                      <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Tiền trước thuế</th>
                      <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Tiền thuế GTGT</th>
                      <th style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'right' }}>Tổng tiền thanh toán</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', fontWeight: 600 }}>
                        {adjustment.adjustment_type === 'INCREASE' ? 'Số tiền điều chỉnh TĂNG (+)' : 'Số tiền điều chỉnh GIẢM (-)'}
                      </td>
                      <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }}>
                        {formatVND(Math.abs(adjustment.difference_subtotal))}
                      </td>
                      <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 600 }}>
                        {formatVND(Math.abs(adjustment.difference_vat))}
                      </td>
                      <td style={{ padding: '8px 10px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 700, color: adjustment.adjustment_type === 'INCREASE' ? '#166534' : '#991b1b', fontSize: '13px' }}>
                        {adjustment.adjustment_type === 'INCREASE' ? '+' : '-'}{formatVND(Math.abs(adjustment.difference_total))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Phần ký tên 3 bên */}
            <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', fontSize: '12px' }}>
              <div>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#0f172a' }}>NGƯỜI LẬP CHỨNG TỪ</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>(Ký, họ tên)</div>
                <div style={{ height: '70px' }}></div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{creatorName}</div>
              </div>

              <div>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#0f172a' }}>KẾ TOÁN TRƯỞNG</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>(Ký, họ tên)</div>
                <div style={{ height: '70px' }}></div>
                <div style={{ color: '#94a3b8' }}>..........................................</div>
              </div>

              <div>
                <div style={{ fontWeight: 700, textTransform: 'uppercase', color: '#0f172a' }}>ĐẠI DIỆN ĐẠI LÝ / KHÁCH</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}>(Ký, ghi rõ họ tên)</div>
                <div style={{ height: '70px' }}></div>
                <div style={{ color: '#94a3b8' }}>..........................................</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
