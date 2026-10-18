// frontend/src/components/DebtStatementPrintModal.tsx
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DebtStatementData } from '../services/dealerSearchApi';
import { User } from '../services/api';
import './debt-statement-print.css';

interface DebtStatementPrintModalProps {
  statement: DebtStatementData;
  currentUser?: User | null;
  onClose: () => void;
  onExportExcel?: () => void;
  isExportingExcel?: boolean;
}

export const DebtStatementPrintModal: React.FC<DebtStatementPrintModalProps> = ({
  statement,
  currentUser,
  onClose,
  onExportExcel,
  isExportingExcel = false,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.classList.add('has-debt-print-modal');
    return () => {
      document.body.classList.remove('has-debt-print-modal');
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePrint = () => {
    const originalTitle = document.title;
    try {
      document.body.classList.add('has-debt-print-modal');
      const safeCode = (statement.dealer.code || `DL${statement.dealer.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      document.title = `So_Chi_Tiet_Cong_No_${safeCode}_${dateStr}`;
      window.print();
    } finally {
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }
  };

  const { dealer, period, summary, transactions } = statement;

  const formatDate = (val?: string | null) => {
    if (!val) return '';
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

  const formatCurrency = (amount?: number | null) => {
    if (amount === undefined || amount === null) return '';
    return Number(amount).toLocaleString('vi-VN') + ' đ';
  };

  const now = new Date();
  const dayStr = String(now.getDate()).padStart(2, '0');
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const yearStr = now.getFullYear();

  return createPortal(
    <div className="debt-print-backdrop" role="dialog" aria-modal="true">
      <div className="debt-print-dialog">
        {/* THANH CÔNG CỤ TOOLBAR */}
        <div className="debt-print-toolbar">
          <div className="debt-print-toolbar-title">
            Chứng từ Sổ Chi Tiết Công Nợ — {dealer.code} ({dealer.name})
          </div>

          <div className="debt-print-toolbar-actions">
            <button
              type="button"
              onClick={handlePrint}
              className="debt-btn debt-btn-primary"
              title="Mở hộp thoại in chứng từ sổ công nợ"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              In sổ công nợ
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="debt-btn debt-btn-pdf"
              title="Lưu hoặc xuất chứng từ dạng tệp PDF (Save as PDF)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              Tải PDF
            </button>

            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                disabled={isExportingExcel}
                className="debt-btn debt-btn-excel"
                title="Tải sổ chi tiết dạng bảng tính Excel (.xlsx)"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <path d="M8 13h8M8 17h8M8 9h2" />
                </svg>
                {isExportingExcel ? 'Đang xuất Excel...' : 'Xuất Excel (.xlsx)'}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="debt-btn debt-btn-secondary"
              title="Đóng cửa sổ xem trước"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* VÙNG HIỂN THỊ TRANG IN A4 */}
        <div className="debt-print-preview-container" ref={printAreaRef}>
          <div className="debt-statement-print-paper">
            {/* 1. Header Row */}
            <div className="debt-header-row">
              <div>
                <div className="debt-company-title">HỆ THỐNG PHÂN PHỐI & BÁN HÀNG VÀ QUẢN LÝ KHO TTCS</div>
                <div className="debt-company-sub">Phòng Kế toán Tài chính — Bộ phận Quản lý Công nợ Đại lý</div>
                <div className="debt-company-sub">Hotline: 1900 6868 | Email: ketoan@congty.vn</div>
              </div>

              <div className="debt-template-badge">
                <strong>Mẫu số: S31-DN</strong>
                <span>(Ban hành theo Thông tư số 200/2014/TT-BTC)</span>
              </div>
            </div>

            {/* 2. Tiêu đề chính */}
            <div className="debt-main-title-block">
              <h1 className="debt-main-title">SỔ CHI TIẾT CÔNG NỢ ĐẠI LÝ</h1>
              <p className="debt-sub-title">
                (BIÊN BẢN ĐỐI CHIẾU VÀ XÁC NHẬN CÔNG NỢ BÁN HÀNG)
              </p>
              <p className="debt-sub-title" style={{ marginTop: '2px', fontWeight: 600 }}>
                Kỳ đối chiếu: {period.from_date ? `Từ ngày ${period.from_date}` : 'Từ đầu kỳ'}{' '}
                {period.to_date ? `đến ngày ${period.to_date}` : 'đến nay'}
              </p>
            </div>

            {/* 3. Thông tin đại lý */}
            <div className="debt-dealer-info-box">
              <div className="debt-info-row">
                <span className="debt-info-label">Tên đại lý:</span>
                <span className="debt-info-val">
                  <strong>{dealer.name}</strong>
                </span>
              </div>
              <div className="debt-info-row">
                <span className="debt-info-label">Mã đại lý:</span>
                <span className="debt-info-val">
                  <strong>{dealer.code}</strong>
                </span>
              </div>

              <div className="debt-info-row">
                <span className="debt-info-label">Địa chỉ liên hệ:</span>
                <span className="debt-info-val">{dealer.address || ''}</span>
              </div>
              <div className="debt-info-row">
                <span className="debt-info-label">Mã số thuế:</span>
                <span className="debt-info-val">{dealer.tax_code || ''}</span>
              </div>

              <div className="debt-info-row">
                <span className="debt-info-label">Số điện thoại:</span>
                <span className="debt-info-val">{dealer.phone || ''}</span>
              </div>
              <div className="debt-info-row">
                <span className="debt-info-label">Hạn mức tín dụng:</span>
                <span className="debt-info-val">
                  {Number(dealer.credit_limit || 0).toLocaleString('vi-VN')} đ (Thời hạn nợ:{' '}
                  {dealer.max_debt_days || 30} ngày)
                </span>
              </div>
            </div>

            {/* 4. Bảng chi tiết phát sinh công nợ */}
            <table className="debt-ledger-table">
              <thead>
                <tr>
                  <th style={{ width: '4%' }}>STT</th>
                  <th style={{ width: '13%' }}>Ngày ghi sổ</th>
                  <th style={{ width: '13%' }}>Số chứng từ</th>
                  <th style={{ width: '13%' }}>Loại nghiệp vụ</th>
                  <th style={{ width: '25%' }}>Diễn giải nội dung kinh tế</th>
                  <th style={{ width: '11%' }}>Phát sinh Tăng (Nợ)</th>
                  <th style={{ width: '11%' }}>Phát sinh Giảm (Có)</th>
                  <th style={{ width: '12%' }}>Số dư nợ luỹ kế</th>
                </tr>
              </thead>
              <tbody>
                {/* Dòng Số dư đầu kỳ - Bắt đầu STT là 1, bỏ dấu gạch, chữ đỏ ở tiền nợ */}
                <tr className="debt-row-opening">
                  <td style={{ textAlign: 'center' }}>1</td>
                  <td style={{ textAlign: 'center' }}></td>
                  <td style={{ textAlign: 'center' }}></td>
                  <td style={{ textAlign: 'center', fontWeight: 700 }}>SỐ DƯ ĐẦU KỲ</td>
                  <td>Số dư công nợ phải thu chuyển sang từ kỳ trước</td>
                  <td style={{ textAlign: 'right' }}></td>
                  <td style={{ textAlign: 'right' }}></td>
                  <td style={{ textAlign: 'right', fontWeight: 800, color: '#dc2626' }}>
                    {Number(summary.opening_balance || 0).toLocaleString('vi-VN')} đ
                  </td>
                </tr>

                {/* Các dòng phát sinh trong kỳ */}
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontStyle: 'italic' }}>
                      Không có nghiệp vụ mua bán hoặc thanh toán nào phát sinh trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx, idx) => (
                    <tr key={tx.id || idx}>
                      <td style={{ textAlign: 'center' }}>{idx + 2}</td>
                      <td style={{ textAlign: 'center' }}>{formatDate(tx.date)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{tx.doc_code}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 500 }}>
                          {tx.doc_type_label}
                        </span>
                      </td>
                      <td>{tx.description}</td>
                      <td className="debt-amount-inc" style={{ color: '#dc2626' }}>
                        {tx.increase_amount > 0 ? `${Number(tx.increase_amount).toLocaleString('vi-VN')} đ` : ''}
                      </td>
                      <td className="debt-amount-dec" style={{ color: '#000000' }}>
                        {tx.decrease_amount > 0 ? `${Number(tx.decrease_amount).toLocaleString('vi-VN')} đ` : ''}
                      </td>
                      <td className="debt-amount-bal" style={{ color: tx.running_balance > 0 ? '#dc2626' : '#000000' }}>
                        {Number(tx.running_balance).toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  ))
                )}

                {/* Dòng Tổng cộng phát sinh trong kỳ - Bỏ màu nền, chỉ chữ đỏ ở tiền nợ tăng, để trống khoảng trắng */}
                <tr className="debt-row-subtotal">
                  <td colSpan={5} style={{ textAlign: 'center', fontWeight: 700, color: '#000000' }}>
                    TỔNG CỘNG PHÁT SINH TRONG KỲ
                  </td>
                  <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 800 }}>
                    {summary.total_increase > 0 ? `${Number(summary.total_increase).toLocaleString('vi-VN')} đ` : ''}
                  </td>
                  <td style={{ textAlign: 'right', color: '#000000', fontWeight: 800 }}>
                    {summary.total_decrease > 0 ? `${Number(summary.total_decrease).toLocaleString('vi-VN')} đ` : ''}
                  </td>
                  <td style={{ textAlign: 'center' }}></td>
                </tr>

                {/* Dòng Số dư nợ cuối kỳ - Bỏ màu nền, chỉ chữ đỏ ở tiền nợ cuối kỳ, để trống khoảng trắng */}
                <tr className="debt-row-closing">
                  <td colSpan={5} style={{ textAlign: 'center', fontWeight: 800, color: '#000000' }}>
                    SỐ DƯ NỢ CUỐI KỲ PHẢI THU (TÍNH ĐẾN NGÀY {period.to_date || 'HIỆN TẠI'})
                  </td>
                  <td style={{ textAlign: 'center' }}></td>
                  <td style={{ textAlign: 'center' }}></td>
                  <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 900, fontSize: '13px' }}>
                    {Number(summary.closing_balance || 0).toLocaleString('vi-VN')} đ
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 5. Số tiền bằng chữ và cam kết đối chiếu */}
            <div className="debt-conclusion-section">
              <div className="debt-words-line">
                * Số dư nợ cuối kỳ bằng chữ: {summary.closing_balance_words || 'Không đồng chẵn.'}
              </div>
              <div className="debt-pledge-line">
                Hai bên đã cùng nhau kiểm tra, đối chiếu và thống nhất các hóa đơn bán hàng cùng các khoản thanh toán
                phát sinh trong kỳ. Đại lý <strong>{dealer.name}</strong> xác nhận số dư nợ còn lại cần thanh toán cho
                Công ty là <strong style={{ color: '#dc2626' }}>{formatCurrency(summary.closing_balance)}</strong> và cam kết thanh toán đúng hạn quy
                định.
              </div>
            </div>

            {/* 6. Chữ ký 4 bên */}
            <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '11px', marginBottom: '8px' }}>
              Ngày {dayStr} tháng {monthStr} năm {yearStr}
            </div>

            <div className="debt-signatures-grid">
              <div className="debt-sig-block">
                <div className="debt-sig-role">ĐẠI DIỆN ĐẠI LÝ</div>
                <div className="debt-sig-hint">(Ký, ghi rõ họ tên & đóng dấu)</div>
                <div className="debt-sig-space" />
                <div className="debt-sig-name">Đại diện {dealer.name}</div>
              </div>

              <div className="debt-sig-block">
                <div className="debt-sig-role">NGƯỜI LẬP BIỂU</div>
                <div className="debt-sig-hint">(Ký, ghi rõ họ tên)</div>
                <div className="debt-sig-space" />
                <div className="debt-sig-name">{currentUser?.full_name || currentUser?.username || 'Kế toán viên'}</div>
              </div>

              <div className="debt-sig-block">
                <div className="debt-sig-role">KẾ TOÁN CÔNG NỢ</div>
                <div className="debt-sig-hint">(Ký, ghi rõ họ tên)</div>
                <div className="debt-sig-space" />
                <div className="debt-sig-name">Dang Ke Toan</div>
              </div>

              <div className="debt-sig-block">
                <div className="debt-sig-role">GIÁM ĐỐC / KTT</div>
                <div className="debt-sig-hint">(Ký, ghi rõ họ tên & đóng dấu)</div>
                <div className="debt-sig-space" />
                <div className="debt-sig-name">Ban Lãnh Đạo Công Ty</div>
              </div>
            </div>

            {/* Footer chân trang */}
            <div className="debt-footer-note">
              Chứng từ được trích xuất tự động từ Hệ thống Quản Lý Bán Hàng & Kho TTCS vào lúc{' '}
              {new Date().toLocaleString('vi-VN')}.
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
