import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { DeliveryTrip, User } from '../services/api';
import { downloadElementAsPdf } from '../utils/pdfExport';
import './receipt-voucher-print.css';

interface DeliveryTripPrintModalProps {
  trip: DeliveryTrip;
  currentUser?: User;
  onClose: () => void;
}

export const DeliveryTripPrintModal: React.FC<DeliveryTripPrintModalProps> = ({
  trip,
  currentUser,
  onClose,
}) => {
  const paperRef = useRef<HTMLDivElement>(null);

  // Khóa cuộn trang nền và hỗ trợ phím Esc để đóng modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // Thực hiện in qua isolated iframe chuẩn A4 (chống vỡ trang in và tương thích hoàn toàn với tính năng Lưu PDF)
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

    const title = `Phieu-Giao-Hang-${trip.trip_code}`;
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
        font-size: 13px;
        line-height: 1.45;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .trip-print-paper {
        width: 100%;
        max-width: 100%;
        padding: 0;
        margin: 0 auto;
        background: #ffffff;
        color: #000000;
      }
      .trip-header-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 16px;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 10px;
      }
      .trip-company-title {
        font-size: 13.5px;
        font-weight: 800;
        text-transform: uppercase;
        color: #0f172a;
        margin-bottom: 2px;
      }
      .trip-company-sub {
        font-size: 11.5px;
        color: #475569;
      }
      .trip-code-box {
        text-align: right;
        font-size: 12.5px;
        color: #475569;
      }
      .trip-code-box strong {
        font-family: monospace;
        color: #2563eb;
        font-size: 13.5px;
        font-weight: 700;
      }
      .trip-print-date {
        font-size: 11px;
        color: #64748b;
        font-style: italic;
        margin-top: 2px;
      }
      .trip-title-section {
        text-align: center;
        margin-bottom: 18px;
      }
      .trip-main-title {
        font-size: 22px;
        font-weight: 900;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin: 0 0 6px 0;
      }
      .trip-subtitle {
        font-size: 12px;
        font-style: italic;
        color: #334155;
      }
      .trip-driver-box {
        border: 1px solid #000000;
        background-color: #fafafa;
        padding: 10px 14px;
        margin-bottom: 16px;
      }
      .trip-driver-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        font-size: 12.5px;
      }
      .trip-driver-note {
        margin-top: 8px;
        padding-top: 6px;
        border-top: 1px dashed #cccccc;
        font-size: 11.5px;
        color: #475569;
      }
      table.trip-stops-table {
        width: 100% !important;
        border-collapse: collapse !important;
        font-size: 11.5px;
        margin-bottom: 24px;
        page-break-inside: auto;
      }
      table.trip-stops-table th,
      table.trip-stops-table td {
        border: 1px solid #000000 !important;
        padding: 6px 8px;
      }
      table.trip-stops-table th {
        background-color: #eeeeee !important;
        font-weight: 700;
        text-align: center;
      }
      table.trip-stops-table tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      .trip-signatures-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        text-align: center;
        margin-top: 28px;
        font-size: 12.5px;
        page-break-inside: avoid;
      }
      .trip-sig-title {
        font-weight: 700;
        text-transform: uppercase;
        color: #0f172a;
      }
      .trip-sig-sub {
        font-size: 11px;
        color: #64748b;
        font-style: italic;
        margin-bottom: 60px;
      }
      .trip-sig-name {
        font-weight: 700;
        color: #0f172a;
      }
    `;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>${printStyles}</style>
      </head>
      <body>
        <div class="trip-print-paper">
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
        }, 2000);
      }
    }, 200);
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!paperRef.current || isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      await downloadElementAsPdf(paperRef.current, `Phieu-Giao-Hang-${trip.trip_code}.pdf`);
    } catch (err: any) {
      console.error('Lỗi khi xuất PDF:', err);
      window.alert('Không thể tải PDF: ' + (err?.message || 'Vui lòng thử lại'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const printDateStr = new Date().toLocaleDateString('vi-VN');
  const creatorName =
    trip.created_by ||
    currentUser?.full_name ||
    currentUser?.username ||
    'Người lập phiếu';

  return createPortal(
    <div
      className="receipt-print-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="receipt-print-dialog">
        {/* THANH CÔNG CỤ (TOOLBAR) - THIẾT KẾ ĐEN CHUẨN ĐẸP NHƯ PHIẾU THU */}
        <div className="receipt-print-toolbar">
          <div className="receipt-print-toolbar-title">
            Phiếu Giao Hàng Theo Chuyến — {trip.trip_code}
          </div>

          <div className="receipt-print-toolbar-actions">
            <button
              type="button"
              onClick={executeIframePrint}
              className="receipt-btn receipt-btn-primary"
              title="In phiếu giao hàng hoặc lưu dưới dạng PDF qua trình duyệt"
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

        {/* VÙNG CUỘN XEM TRƯỚC VỚI NỀN XÁM ĐẬM VÀ TỜ GIẤY A4 Ở GIỮA */}
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
              border: '1px solid #cbd5e1',
              borderRadius: '2px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
              fontSize: '13px',
              lineHeight: 1.45,
              boxSizing: 'border-box',
            }}
          >
            {/* 1. Header Đơn vị phát hành & Mã chuyến */}
            <div
              className="trip-header-row"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '16px',
                borderBottom: '2px solid #0f172a',
                paddingBottom: '10px',
              }}
            >
              <div>
                <div
                  className="trip-company-title"
                  style={{
                    fontSize: '13.5px',
                    fontWeight: '800',
                    textTransform: 'uppercase',
                    color: '#0f172a',
                    marginBottom: '2px',
                    letterSpacing: '-0.01em',
                  }}
                >
                  HỆ THỐNG QUẢN LÝ KHO & BÁN HÀNG
                </div>
                <div
                  className="trip-company-sub"
                  style={{
                    fontSize: '11.5px',
                    color: '#475569',
                  }}
                >
                  Kho xuất: <strong style={{ color: '#0f172a' }}>{trip.warehouse_name || 'Kho Tổng Hà Nội'}</strong>
                </div>
              </div>

              <div
                className="trip-code-box"
                style={{
                  textAlign: 'right',
                  fontSize: '12.5px',
                  color: '#475569',
                }}
              >
                <div>
                  Mã chuyến:{' '}
                  <strong style={{ fontFamily: 'monospace', color: '#2563eb', fontSize: '13.5px', fontWeight: '700' }}>
                    {trip.trip_code}
                  </strong>
                </div>
                <div
                  className="trip-print-date"
                  style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginTop: '2px' }}
                >
                  Ngày in: {printDateStr}
                </div>
              </div>
            </div>

            {/* 2. Tiêu đề phiếu in */}
            <div
              className="trip-title-section"
              style={{
                textAlign: 'center',
                marginBottom: '18px',
              }}
            >
              <h1
                className="trip-main-title"
                style={{
                  fontSize: '22px',
                  fontWeight: '900',
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  margin: '0 0 6px 0',
                }}
              >
                PHIẾU GIAO HÀNG THEO CHUYẾN
              </h1>
              <div
                className="trip-subtitle"
                style={{
                  fontSize: '12px',
                  fontStyle: 'italic',
                  color: '#334155',
                }}
              >
                Ngày giao hàng: <strong style={{ color: '#0f172a' }}>{trip.delivery_date}</strong> | Tổng số điểm giao:{' '}
                <strong style={{ color: '#0f172a' }}>{trip.total_stops}</strong> điểm | Tổng số phiếu xuất:{' '}
                <strong style={{ color: '#0f172a' }}>{trip.total_dispatches}</strong> phiếu
              </div>
            </div>

            {/* 3. Khung thông tin tài xế & phương tiện */}
            <div
              className="trip-driver-box"
              style={{
                border: '1px solid #000000',
                backgroundColor: '#fafafa',
                padding: '10px 14px',
                marginBottom: '16px',
              }}
            >
              <div
                className="trip-driver-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  fontSize: '12.5px',
                }}
              >
                <div>
                  Tài xế phụ trách: <strong style={{ color: '#0f172a' }}>{trip.driver_name || 'Chưa phân công'}</strong>
                </div>
                <div>
                  Số điện thoại tài xế: <strong style={{ color: '#0f172a' }}>{trip.driver_phone || '—'}</strong>
                </div>
                <div>
                  Phương tiện / Biển số:{' '}
                  <strong style={{ color: '#0f172a' }}>{trip.vehicle_plate || 'Chưa phân công'}</strong>
                </div>
                <div>
                  Loại xe: <strong style={{ color: '#0f172a' }}>{trip.vehicle_type || '—'}</strong>
                </div>
              </div>

              {trip.note && (
                <div
                  className="trip-driver-note"
                  style={{
                    marginTop: '8px',
                    paddingTop: '6px',
                    borderTop: '1px dashed #cccccc',
                    fontSize: '11.5px',
                    color: '#475569',
                  }}
                >
                  Ghi chú điều phối: <em style={{ color: '#0f172a' }}>{trip.note}</em>
                </div>
              )}
            </div>

            {/* 4. Bảng danh sách điểm giao theo thứ tự */}
            <table
              className="trip-stops-table"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '11.5px',
                marginBottom: '24px',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#eeeeee' }}>
                  <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', width: '35px' }}>
                    STT
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'left', width: '150px' }}>
                    Người nhận / Đại lý
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', width: '90px' }}>
                    Số điện thoại
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'left' }}>
                    Địa chỉ giao hàng
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'left', width: '120px' }}>
                    Phiếu xuất
                  </th>
                  <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', width: '90px' }}>
                    Ký nhận
                  </th>
                </tr>
              </thead>
              <tbody>
                {(trip.stops || []).map((st: any) => (
                  <tr key={st.id}>
                    <td
                      style={{
                        border: '1px solid #000000',
                        padding: '6px',
                        textAlign: 'center',
                        fontWeight: '800',
                      }}
                    >
                      {st.stop_order}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '6px' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{st.receiver_name}</div>
                      <div style={{ fontSize: '10.5px', color: '#555555' }}>{st.dealer_name}</div>
                    </td>
                    <td
                      style={{
                        border: '1px solid #000000',
                        padding: '6px',
                        textAlign: 'center',
                        fontWeight: '600',
                      }}
                    >
                      {st.receiver_phone}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '6px' }}>
                      <div>{st.address}</div>
                      {st.route_note && (
                        <div style={{ fontSize: '10.5px', color: '#555555', fontStyle: 'italic', marginTop: '2px' }}>
                          Lưu ý: {st.route_note}
                        </div>
                      )}
                    </td>
                    <td style={{ border: '1px solid #000000', padding: '6px' }}>
                      {(st.dispatches || []).map((d: any) => (
                        <div key={d.id} style={{ fontWeight: '600', color: '#0f172a' }}>
                          {d.dispatch_code}
                        </div>
                      ))}
                    </td>
                    <td
                      style={{
                        border: '1px solid #000000',
                        padding: '6px',
                        textAlign: 'center',
                        height: '46px',
                      }}
                    >
                      {/* Ô trống ký nhận */}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* 5. Phần chữ ký xác nhận 3 bên */}
            <div
              className="trip-signatures-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                textAlign: 'center',
                marginTop: '30px',
                fontSize: '12.5px',
              }}
            >
              <div>
                <div
                  className="trip-sig-title"
                  style={{ fontWeight: '700', textTransform: 'uppercase', color: '#0f172a' }}
                >
                  NGƯỜI LẬP PHIẾU
                </div>
                <div
                  className="trip-sig-sub"
                  style={{ fontSize: '11px', color: '#666666', fontStyle: 'italic', marginBottom: '55px' }}
                >
                  (Ký, họ tên)
                </div>
                <div className="trip-sig-name" style={{ fontWeight: '700', color: '#0f172a' }}>
                  {creatorName}
                </div>
              </div>

              <div>
                <div
                  className="trip-sig-title"
                  style={{ fontWeight: '700', textTransform: 'uppercase', color: '#0f172a' }}
                >
                  TÀI XẾ NHẬN HÀNG
                </div>
                <div
                  className="trip-sig-sub"
                  style={{ fontSize: '11px', color: '#666666', fontStyle: 'italic', marginBottom: '55px' }}
                >
                  (Ký, họ tên)
                </div>
                <div className="trip-sig-name" style={{ fontWeight: '700', color: '#0f172a' }}>
                  {trip.driver_name || '................................'}
                </div>
              </div>

              <div>
                <div
                  className="trip-sig-title"
                  style={{ fontWeight: '700', textTransform: 'uppercase', color: '#0f172a' }}
                >
                  QUẢN LÝ KHO DUYỆT
                </div>
                <div
                  className="trip-sig-sub"
                  style={{ fontSize: '11px', color: '#666666', fontStyle: 'italic', marginBottom: '55px' }}
                >
                  (Ký, họ tên)
                </div>
                <div className="trip-sig-name" style={{ fontWeight: '700', color: '#0f172a' }}>
                  ................................
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
