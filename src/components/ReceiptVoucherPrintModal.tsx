import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ReceiptVoucherData } from '../services/dealerSearchApi';
import { User } from '../services/api';
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    // Kích hoạt hộp thoại in của trình duyệt để người dùng chọn Lưu dạng PDF (Save as PDF)
    window.print();
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
              title="Mở hộp thoại in chứng từ"
            >
              In phiếu thu
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="receipt-btn receipt-btn-pdf"
              title="Lưu hoặc tải chứng từ dạng PDF"
            >
              Tải PDF
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
