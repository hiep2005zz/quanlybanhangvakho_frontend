import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BatchPickingPreviewResponse, User } from '../services/api';
import Barcode128 from './Barcode128';
import './order-print.css';

interface WarehousePickingPrintModalProps {
  batch: BatchPickingPreviewResponse;
  currentUser?: User | null;
  itemsState?: Record<number, { picked_quantity: number; shortage_reason: string; is_done: boolean }>;
  onClose: () => void;
}

export const WarehousePickingPrintModal: React.FC<WarehousePickingPrintModalProps> = ({
  batch,
  currentUser,
  itemsState,
  onClose,
}) => {
  // Thêm class has-print-modal vào body để CSS @media print kích hoạt chuẩn xác
  useEffect(() => {
    document.body.classList.add('has-print-modal');
    return () => {
      document.body.classList.remove('has-print-modal');
    };
  }, []);

  // Đóng modal khi nhấn Escape
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

  const nowFormatted = new Date().toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return createPortal(
    <div className="order-print-backdrop" style={{ zIndex: 100002 }}>
      <div className="order-print-dialog" role="dialog" aria-modal="true">
        {/* THANH CÔNG CỤ XEM TRƯỚC VÀ IN */}
        <div className="order-print-toolbar">
          <div className="order-print-toolbar-title">
            <span>Xem trước và in phiếu soạn hàng</span>
          </div>

          <div className="order-print-toolbar-actions">
            <div className="order-print-actions-left">
              <button
                type="button"
                onClick={handlePrint}
                className="order-print-btn order-print-btn-primary"
                title="Mở hộp thoại in"
              >
                <span>In ngay</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="order-print-btn order-print-btn-pdf"
                title="Lưu file PDF"
              >
                <span>Xuất PDF</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="order-print-btn order-print-btn-secondary"
              title="Đóng cửa sổ xem trước"
            >
              Đóng
            </button>
          </div>
        </div>

        {/* VÙNG CHỨA KHUNG GIẤY IN A4 */}
        <div className="order-print-preview-container">
          <div className="order-print-paper">
            {/* Header thông tin doanh nghiệp & Mã vạch */}
            <div className="order-print-header">
              <div className="order-print-company">
                <h2 className="order-print-company-name">HỆ THỐNG PHÂN PHỐI & QUẢN TRỊ KHO TTCS</h2>
                <p className="order-print-company-sub">
                  Phân hệ Vận hành Kho vận
                  <br />
                  Hotline điều phối kho: 1900-8888 • Hệ thống Quản trị Doanh nghiệp
                </p>
              </div>

              <div className="order-print-barcode-box">
                <span className="order-print-barcode-badge">MÃ PHIẾU SOẠN HÀNG</span>
                <Barcode128
                  value={batch.batch_code}
                  height={38}
                  moduleWidth={1.4}
                  displayValue={true}
                  fontSize={11}
                />
              </div>
            </div>

            {/* Tiêu đề phiếu */}
            <div className="order-print-title-section">
              <h1 className="order-print-doc-title">PHIẾU SOẠN HÀNG TỔNG HỢP</h1>
            </div>

            {/* Thông tin đợt soạn hàng */}
            <div className="order-print-info-grid">
              <div className="order-print-info-col">
                <h4>Thông tin phiếu soạn</h4>
                <div className="order-print-info-row">
                  <span className="order-print-info-label">Mã phiếu:</span>
                  <span className="order-print-info-val" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                    {batch.batch_code}
                  </span>
                </div>
                <div className="order-print-info-row">
                  <span className="order-print-info-label">Thời gian in:</span>
                  <span className="order-print-info-val">{nowFormatted}</span>
                </div>
                <div className="order-print-info-row">
                  <span className="order-print-info-label">Người lập phiếu:</span>
                  <span className="order-print-info-val">
                    {currentUser?.full_name || currentUser?.username || 'Thủ kho'}
                  </span>
                </div>
              </div>

              <div className="order-print-info-col">
                <h4>Phạm vi đơn hàng gộp</h4>
                <div className="order-print-info-row">
                  <span className="order-print-info-label">Số lượng đơn:</span>
                  <span className="order-print-info-val" style={{ fontWeight: 700 }}>
                    {batch.total_orders} đơn hàng đã duyệt
                  </span>
                </div>
                <div className="order-print-info-row">
                  <span className="order-print-info-label">Danh sách đơn:</span>
                  <span className="order-print-info-val" style={{ fontWeight: 600, color: '#1e40af' }}>
                    {batch.selected_order_codes.join(', ')}
                  </span>
                </div>
                <div className="order-print-info-row">
                  <span className="order-print-info-label">Tổng quy mô:</span>
                  <span className="order-print-info-val">
                    <strong>{batch.total_unique_items}</strong> dòng hàng — Tổng: <strong>{batch.total_pick_units}</strong> sản phẩm
                  </span>
                </div>
              </div>
            </div>

            {/* Hướng dẫn lộ trình kho */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px dashed #94a3b8',
                borderRadius: '4px',
                padding: '6px 10px',
                marginBottom: '14px',
                fontSize: '11px',
                color: '#334155',
                lineHeight: 1.4,
              }}
            >
              <strong>Hướng dẫn đường đi trong kho:</strong> Danh sách sản phẩm bên dưới đã được máy chủ tính toán và gom nhóm theo thứ tự tuần tự của các dãy kệ. Thủ kho cầm phiếu đi theo một chiều từ <strong>Khu vực &rarr; Dãy kệ &rarr; Ô chứa</strong> để lấy hàng cho toàn bộ các đơn cùng lúc.
            </div>

            {/* BẢNG DÒNG HÀNG THEO LỘ TRÌNH KHO */}
            <div className="order-print-table-wrap">
              <table className="order-print-table order-print-picking-table">
                <thead>
                  <tr>
                    <th className="order-print-col-stt" style={{ width: '32px', textAlign: 'center' }}>STT</th>
                    <th className="order-print-col-loc" style={{ width: '145px' }}>VỊ TRÍ LƯU KHO</th>
                    <th className="order-print-col-sku" style={{ width: '85px' }}>MÃ SKU</th>
                    <th className="order-print-col-product">TÊN SẢN PHẨM & ĐVT</th>
                    <th className="order-print-col-breakdown" style={{ width: '135px' }}>
                      <span className="order-print-desktop-only">PHÂN BỔ ĐƠN HÀNG</span>
                      <span className="order-print-mobile-only">ĐƠN GỘP</span>
                    </th>
                    <th className="order-print-col-qty" style={{ width: '55px', textAlign: 'center' }}>SL CẦN</th>
                    <th className="order-print-col-picked" style={{ width: '60px', textAlign: 'center' }}>THỰC LẤY</th>
                    <th className="order-print-col-note" style={{ width: '85px', textAlign: 'center' }}>KÝ / GHI CHÚ</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.route_items.map((item, idx) => {
                    // Chuẩn hóa tên vị trí kho, chống lặp từ (ví dụ: Khu Khu A -> Khu A, Dãy Dãy 3 -> Dãy 3)
                    const formatLocPart = (val: string | undefined, prefix: string) => {
                      if (!val) return '';
                      const trimmed = val.trim();
                      if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
                        return trimmed;
                      }
                      return `${prefix} ${trimmed}`;
                    };

                    const locLabel = item.location_code
                      ? [
                          formatLocPart(item.zone, 'Khu'),
                          formatLocPart(item.aisle, 'Dãy'),
                          formatLocPart(item.rack, 'Kệ'),
                          formatLocPart(item.bin, 'Ô'),
                        ].filter(Boolean).join(' • ')
                      : 'Chưa xếp vị trí kệ';

                    const itemState = itemsState ? itemsState[item.product_id] : undefined;
                    const pickedQty = itemState ? itemState.picked_quantity : undefined;
                    const shortageReason = itemState ? itemState.shortage_reason : undefined;

                    return (
                      <tr key={`print-route-item-${item.product_id}-${idx}`}>
                        <td className="order-print-col-stt" style={{ textAlign: 'center', fontWeight: 600 }}>
                          {item.step_number || idx + 1}
                        </td>
                        <td className="order-print-col-loc">
                          <div style={{ fontWeight: 800, fontSize: '11.5px', color: '#0f172a', fontFamily: 'monospace' }}>
                            {item.location_code || 'CHƯA ĐẶT'}
                          </div>
                          <div style={{ fontSize: '10px', color: '#64748b', lineHeight: 1.3 }}>
                            {locLabel}
                          </div>
                        </td>
                        <td className="order-print-col-sku" style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '11.5px' }}>
                          {item.product_code}
                        </td>
                        <td className="order-print-col-product">
                          <div style={{ fontWeight: 700, fontSize: '12px', color: '#0f172a' }}>
                            {item.product_name}
                          </div>
                          <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>
                            <span className="order-print-mobile-only order-print-mobile-sku">
                              SKU: <strong>{item.product_code}</strong> &bull;{' '}
                            </span>
                            <span>ĐVT: <strong>{item.unit_name || 'Cái'}</strong></span>
                          </div>
                        </td>
                        <td className="order-print-col-breakdown" style={{ fontSize: '11px', color: '#1e293b' }}>
                          {item.order_breakdown && item.order_breakdown.length > 0 ? (
                            item.order_breakdown.map((b, bIdx) => (
                              <div key={`order-b-${bIdx}`} className="order-print-breakdown-row" style={{ lineHeight: 1.35 }}>
                                <strong>{b.order_code}</strong>: {b.quantity}
                                <span className="order-print-desktop-only"> {item.unit_name || 'Cái'}</span>
                              </div>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          )}
                        </td>
                        <td className="order-print-col-qty" style={{ textAlign: 'center', fontWeight: 800, fontSize: '13px', color: '#0f172a' }}>
                          {item.total_ordered_quantity}
                        </td>
                        <td className="order-print-col-picked" style={{ textAlign: 'center' }}>
                          {/* Ô vuông để thủ kho ghi tay hoặc hiển thị số thực soạn */}
                          <div
                            style={{
                              display: 'inline-block',
                              minWidth: '38px',
                              height: '24px',
                              lineHeight: '22px',
                              border: '1.5px solid #0f172a',
                              borderRadius: '3px',
                              fontWeight: 700,
                              fontSize: '12px',
                              color: pickedQty !== undefined && pickedQty < item.total_ordered_quantity ? '#dc2626' : '#047857',
                              backgroundColor: '#ffffff',
                            }}
                          >
                            {pickedQty !== undefined && pickedQty > 0 ? pickedQty : ''}
                          </div>
                        </td>
                        <td className="order-print-col-note" style={{ fontSize: '10px', color: '#64748b', textAlign: 'center' }}>
                          {shortageReason ? (
                            <span style={{ color: '#b91c1c', fontWeight: 600 }}>Thiếu: {shortageReason}</span>
                          ) : (
                            <span style={{ color: '#cbd5e1' }}>[ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bảng tổng kết */}
            <div className="order-print-summary-box">
              <table className="order-print-totals-table">
                <tbody>
                  <tr>
                    <td className="label">Tổng số đơn hàng gộp:</td>
                    <td className="val">{batch.total_orders} đơn</td>
                  </tr>
                  <tr>
                    <td className="label">Tổng số vị trí kệ cần ghé:</td>
                    <td className="val">{batch.route_items.length} điểm lấy</td>
                  </tr>
                  <tr className="grand-total">
                    <td className="label" style={{ fontWeight: 800 }}>TỔNG SỐ LƯỢNG HÀNG:</td>
                    <td className="val" style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>
                      {batch.total_pick_units} sản phẩm
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Khung chữ ký 3 bên */}
            <div
              className="order-print-signatures order-print-picking-signatures"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '16px',
                marginTop: '24px',
                pageBreakInside: 'avoid',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a' }}>
                  Người lập phiếu
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '45px' }}>
                  Ký, ghi rõ họ tên
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', borderTop: '1px dashed #94a3b8', display: 'inline-block', minWidth: '130px', paddingTop: '4px' }}>
                  {currentUser?.full_name || currentUser?.username || '.....................'}
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a' }}>
                  Thủ kho soạn hàng
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '45px' }}>
                  Ký, ghi rõ họ tên
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', borderTop: '1px dashed #94a3b8', display: 'inline-block', minWidth: '130px', paddingTop: '4px' }}>
                  .....................
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#0f172a' }}>
                  Kiểm soát / Đóng gói
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic', marginBottom: '45px' }}>
                  Ký, ghi rõ họ tên
                </div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a', borderTop: '1px dashed #94a3b8', display: 'inline-block', minWidth: '130px', paddingTop: '4px' }}>
                  .....................
                </div>
              </div>
            </div>

            {/* Ghi chú chân trang */}
            <div className="order-print-footer-note">
              Phiếu soạn hàng được tạo tự động bởi Hệ thống Quản trị Kho TTCS Enterprise. Vui lòng đối chiếu vị trí kệ thực tế và bàn giao đủ số lượng cho tổ đóng gói xuất hàng.
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default WarehousePickingPrintModal;
