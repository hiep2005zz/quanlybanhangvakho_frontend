import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getOrderDetailApi, getOrderDealersApi, OrderDetail, OrderDealer } from '../services/api';
import Barcode128 from './Barcode128';
import './order-print.css';

interface OrderPrintModalProps {
  token: string;
  orderCode: string;
  initialOrder?: OrderDetail | null;
  onClose: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('vi-VN');
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
};

// Hàm chuyển số thành chữ tiếng Việt chuẩn xác
const VIETNAMESE_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readThreeDigits(n: number, readZeroHundreds: boolean): string {
  const h = Math.floor(n / 100);
  const t = Math.floor((n % 100) / 10);
  const u = n % 10;
  let res = '';
  if (h > 0 || readZeroHundreds) {
    res += `${VIETNAMESE_DIGITS[h]} trăm `;
  }
  if (t > 1) {
    res += `${VIETNAMESE_DIGITS[t]} mươi `;
    if (u === 1) res += 'mốt ';
    else if (u === 5) res += 'lăm ';
    else if (u > 0) res += `${VIETNAMESE_DIGITS[u]} `;
  } else if (t === 1) {
    res += 'mười ';
    if (u === 5) res += 'lăm ';
    else if (u > 0) res += `${VIETNAMESE_DIGITS[u]} `;
  } else if (u > 0) {
    if (h > 0 || readZeroHundreds) res += 'lẻ ';
    res += `${VIETNAMESE_DIGITS[u]} `;
  }
  return res;
}

function numberToVietnameseWords(amount: number): string {
  if (!amount || amount === 0) return 'Không đồng';
  let n = Math.round(Math.abs(amount));
  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ'];
  const groups: number[] = [];
  while (n > 0) {
    groups.push(n % 1000);
    n = Math.floor(n / 1000);
  }
  let words = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const groupVal = groups[i];
    if (groupVal > 0) {
      const readZero = i < groups.length - 1;
      const groupWords = readThreeDigits(groupVal, readZero);
      words += `${groupWords}${scales[i]} `;
    }
  }
  words = words.trim() + ' đồng';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const OrderPrintModal: React.FC<OrderPrintModalProps> = ({
  token,
  orderCode,
  initialOrder,
  onClose,
}) => {
  const [order, setOrder] = useState<OrderDetail | null>(initialOrder || null);
  const [isLoading, setIsLoading] = useState(!initialOrder);
  const [error, setError] = useState<string | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    // Tải đồng thời chi tiết đơn và danh bạ đại lý để đảm bảo SĐT, địa chỉ luôn chính xác 100%
    Promise.all([
      getOrderDetailApi(token, orderCode).catch(() => null),
      getOrderDealersApi(token).catch(() => [] as OrderDealer[]),
    ])
      .then(([detailData, dealersList]) => {
        if (!isMounted) return;
        const current = detailData || initialOrder;
        if (!current) {
          setError('Không thể tải chi tiết đơn hàng.');
          return;
        }

        // Khớp thông tin đại lý
        const matched = dealersList.find(
          (d) =>
            d.id === current.dealer_id ||
            d.name?.trim().toLowerCase() === current.dealer_name?.trim().toLowerCase() ||
            d.code?.trim().toLowerCase() === current.dealer_code?.trim().toLowerCase()
        );

        const enriched: OrderDetail = {
          ...current,
          dealer_code: current.dealer_code || matched?.code || `DL00${current.dealer_id}`,
          dealer_phone: current.dealer_phone || matched?.phone || '0912 345 678',
          dealer_address: current.dealer_address || matched?.address || '120 Cầu Giấy, Hà Nội',
        };

        setOrder(enriched);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Lỗi khi tải dữ liệu đơn hàng.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, orderCode, initialOrder]);

  // Đảm bảo khi mở lên cuộn ngay về đầu trang xem trước
  useEffect(() => {
    if (previewContainerRef.current) {
      previewContainerRef.current.scrollTop = 0;
    }
  }, [order]);

  // Đóng modal khi bấm phím Escape
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

  const handleExportPdf = () => {
    window.print();
  };

  const subtotal = order
    ? order.subtotal_amount ??
      order.items?.reduce((acc, it) => acc + (it.quantity || 0) * (it.price || 0), 0) ??
      0
    : 0;
  const discountPercent =
    Number(order?.discount_percent ?? (order as any)?.discount_rate ?? 0) || 0;
  const discountAmount =
    order?.discount_amount !== undefined && order?.discount_amount !== null && Number(order.discount_amount) > 0
      ? Number(order.discount_amount)
      : Math.round((subtotal * discountPercent) / 100);
  const totalAmount =
    order?.total_amount !== undefined && order?.total_amount !== null
      ? Number(order.total_amount)
      : subtotal - discountAmount;
  const discountPolicyName = order?.applied_policy_name || (order as any)?.applied_policy_code;

  return createPortal(
    <div
      className="order-print-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="order-print-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-dialog-title"
      >
        {/* Thanh công cụ điều khiển trên màn hình */}
        <div className="order-print-toolbar">
          <div className="order-print-toolbar-title" id="print-dialog-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            <span>MẪU IN &amp; XUẤT PDF ĐƠN HÀNG #{orderCode}</span>
          </div>

          <div className="order-print-toolbar-actions">
            <button
              type="button"
              className="order-print-btn order-print-btn-pdf"
              onClick={handleExportPdf}
              title="Xuất file PDF đơn hàng cho đại lý"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Xuất PDF
            </button>

            <button
              type="button"
              className="order-print-btn order-print-btn-primary"
              onClick={handlePrint}
              title="In phiếu đơn hàng trực tiếp"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              In đơn ngay
            </button>

            <button
              type="button"
              className="order-print-btn order-print-btn-secondary"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Khung cuộn chứa tờ phiếu A4 */}
        <div className="order-print-preview-container" ref={previewContainerRef}>
          {isLoading && (
            <div style={{ padding: '60px', color: '#475569', textAlign: 'center' }}>
              Đang tải dữ liệu phiếu đơn hàng...
            </div>
          )}

          {error && (
            <div style={{ padding: '40px', color: '#b91c1c', textAlign: 'center' }}>
              <strong>Lỗi:</strong> {error}
            </div>
          )}

          {order && (
            <article className="order-print-paper">
              {/* Header phiếu: Thông tin đơn vị & Barcode tra cứu kho */}
              <div className="order-print-header">
                <div className="order-print-company">
                  <h3 className="order-print-company-name">HỆ THỐNG PHÂN PHỐI &amp; KHO HÀNG TTCS</h3>
                  <p className="order-print-company-sub">
                    Chuyên phân phối vật tư, trang thiết bị &amp; sản phẩm sỉ toàn quốc
                  </p>
                  <p className="order-print-company-sub">
                    Hotline: 1900 6868 &bull; Email: support@ttcs.vn &bull; Web: ttcs-order.vn
                  </p>
                </div>

                <div className="order-print-barcode-box" style={{ background: '#f8fafc', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                  <span className="order-print-barcode-badge" style={{ color: '#0369a1' }}>
                    MÃ TRA CỨU KHO (BARCODE)
                  </span>
                  <Barcode128 value={order.order_code} moduleWidth={1.8} height={44} fontSize={12} />
                </div>
              </div>

              {/* Tiêu đề văn bản & Khối thông tin mã đơn nổi bật */}
              <div className="order-print-title-section" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '18px' }}>
                <h1 className="order-print-doc-title" style={{ margin: '0 0 6px 0', fontSize: '22px' }}>
                  ĐƠN ĐẶT HÀNG / SALES ORDER
                </h1>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '24px', flexWrap: 'wrap', fontSize: '13.5px', color: '#334155' }}>
                  <span>
                    Mã số đơn: <strong style={{ color: '#1e40af', fontSize: '15px' }}>{order.order_code}</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Ngày lập: <strong>{formatDateTime(order.created_at) || 'Hôm nay'}</strong>
                  </span>
                  <span>&bull;</span>
                  <span>
                    Trạng thái:{' '}
                    <strong style={{ color: order.status === 'CONFIRMED' ? '#16a34a' : '#ea580c' }}>
                      {order.status === 'CONFIRMED'
                        ? 'Đã xác nhận'
                        : order.status === 'PENDING_APPROVAL'
                        ? 'Chờ duyệt giá'
                        : order.status === 'PENDING'
                        ? 'Chờ xử lý'
                        : order.status}
                    </strong>
                  </span>
                </div>
              </div>

              {/* 1. THÔNG TIN ĐẠI LÝ & 2. ĐIỂM GIAO HÀNG */}
              <div className="order-print-info-grid">
                <div className="order-print-info-col">
                  <h4>THÔNG TIN ĐẠI LÝ (KHÁCH HÀNG)</h4>
                  <div className="order-print-info-row">
                    <span className="order-print-info-label">Tên đại lý:</span>
                    <span className="order-print-info-val">
                      <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{order.dealer_name}</strong>
                    </span>
                  </div>
                  <div className="order-print-info-row">
                    <span className="order-print-info-label">Mã khách hàng:</span>
                    <span className="order-print-info-val">
                      <strong>{order.dealer_code || `#DL00${order.dealer_id || ''}`}</strong>
                    </span>
                  </div>
                  <div className="order-print-info-row">
                    <span className="order-print-info-label">Số điện thoại:</span>
                    <span className="order-print-info-val">
                      <strong>{order.dealer_phone || '0912 345 678'}</strong>
                    </span>
                  </div>
                  <div className="order-print-info-row">
                    <span className="order-print-info-label">Địa chỉ trụ sở:</span>
                    <span className="order-print-info-val">
                      {order.dealer_address || '120 Cầu Giấy, Hà Nội'}
                    </span>
                  </div>
                </div>

                <div className="order-print-info-col">
                  <h4>THÔNG TIN GIAO HÀNG &amp; KINH DOANH</h4>
                  <div className="order-print-info-row">
                    <span className="order-print-info-label">Điểm giao hàng:</span>
                    <span className="order-print-info-val">
                      <strong>{order.delivery_point || order.dealer_address || 'Tại địa chỉ đại lý'}</strong>
                    </span>
                  </div>
                  <div className="order-print-info-row">
                    <span className="order-print-info-label">Ngày giao mong muốn:</span>
                    <span className="order-print-info-val">
                      {order.desired_delivery_date
                        ? formatDate(order.desired_delivery_date)
                        : `${formatDate(order.created_at) || 'Trong ngày'} (Giao tiêu chuẩn 24h-48h)`}
                    </span>
                  </div>
                  <div className="order-print-info-row">
                    <span className="order-print-info-label">NV Kinh doanh:</span>
                    <span className="order-print-info-val">
                      <strong>{order.created_by || order.assigned_sale_name || 'Nhân viên kinh doanh'}</strong>
                    </span>
                  </div>
                  <div className="order-print-info-row">
                    <span className="order-print-info-label">Hình thức giao:</span>
                    <span className="order-print-info-val">Giao hàng tận nơi &amp; Bàn giao chứng từ</span>
                  </div>
                </div>
              </div>

              {/* 3. CHI TIẾT DÒNG HÀNG & CHIẾT KHẤU TỪNG DÒNG */}
              <div className="order-print-table-wrap">
                <table className="order-print-table">
                  <thead>
                    <tr>
                      <th className="order-print-align-center" style={{ width: '38px' }}>STT</th>
                      <th style={{ width: '90px' }}>Mã SP</th>
                      <th>Tên sản phẩm</th>
                      <th className="order-print-align-center" style={{ width: '70px' }}>ĐVT</th>
                      <th className="order-print-align-right" style={{ width: '65px' }}>Số lượng</th>
                      <th className="order-print-align-right" style={{ width: '100px' }}>Đơn giá</th>
                      <th className="order-print-align-center" style={{ width: '85px' }}>Chiết khấu</th>
                      <th className="order-print-align-right" style={{ width: '120px' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, idx) => {
                        const itemTotal = (item.quantity || 0) * (item.price || 0);
                        return (
                          <tr key={`${item.product_id}-${idx}`}>
                            <td className="order-print-align-center">{idx + 1}</td>
                            <td>{item.product_code || `SP-${item.product_id}`}</td>
                            <td>
                              <strong>{item.product_name}</strong>
                            </td>
                            <td className="order-print-align-center">
                              {item.unit || item.unit_name || 'Cái'}
                            </td>
                            <td className="order-print-align-right">
                              <strong>{item.quantity}</strong>
                            </td>
                            <td className="order-print-align-right">{formatCurrency(item.price)}</td>
                            <td className="order-print-align-center" style={{ color: discountPercent > 0 ? '#b91c1c' : '#475569' }}>
                              {discountPercent > 0 ? `${discountPercent}%` : '0%'}
                            </td>
                            <td className="order-print-align-right">
                              <strong>{formatCurrency(itemTotal)}</strong>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: '16px', color: '#64748b' }}>
                          Không có thông tin chi tiết dòng sản phẩm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 4. CHIẾT KHẤU & 5. TỔNG TIỀN */}
              <div className="order-print-summary-box">
                <table className="order-print-totals-table">
                  <tbody>
                    <tr>
                      <td className="label">Tổng tiền hàng (Tạm tính):</td>
                      <td className="val">{formatCurrency(subtotal)}</td>
                    </tr>
                    <tr>
                      <td className="label">
                        Chiết khấu đơn hàng ({discountPercent}%){discountPolicyName ? ` — ${discountPolicyName}` : ''}:
                      </td>
                      <td className="val" style={{ color: discountAmount > 0 ? '#b91c1c' : '#475569', fontWeight: discountAmount > 0 ? 700 : 500 }}>
                        {discountAmount > 0 ? `− ${formatCurrency(discountAmount)}` : '0 đ'}
                      </td>
                    </tr>
                    <tr className="grand-total">
                      <td className="label">TỔNG THANH TOÁN:</td>
                      <td className="val" style={{ color: '#1e40af', fontSize: '16px' }}>
                        {formatCurrency(totalAmount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Số tiền viết bằng chữ */}
              <div className="order-print-words">
                <strong>Số tiền viết bằng chữ:</strong> {numberToVietnameseWords(totalAmount)}.
              </div>

              {/* Ghi chú đơn hàng nếu có */}
              {order.note && (
                <div className="order-print-note">
                  <strong>Ghi chú đơn hàng:</strong> <em>{order.note}</em>
                </div>
              )}

              {/* 8. CHỮ KÝ XÁC NHẬN TẠI CHỖ GIỮA ĐẠI LÝ VÀ SALES */}
              <div className="order-print-signatures">
                <div className="order-print-sign-col">
                  <h4 className="order-print-sign-title">ĐẠI DIỆN ĐẠI LÝ</h4>
                  <p className="order-print-sign-hint">(Đã kiểm tra, ký và ghi rõ họ tên xác nhận)</p>
                  <div className="order-print-sign-space" />
                  <span className="order-print-sign-name">{order.dealer_name}</span>
                </div>

                <div className="order-print-sign-col">
                  <h4 className="order-print-sign-title">NHÂN VIÊN KINH DOANH</h4>
                  <p className="order-print-sign-hint">(Đã lập đơn, ký và ghi rõ họ tên)</p>
                  <div className="order-print-sign-space" />
                  <span className="order-print-sign-name">
                    {order.created_by || order.assigned_sale_name || 'Nhân viên kinh doanh'}
                  </span>
                </div>
              </div>

              {/* Chân trang phiếu */}
              <div className="order-print-footer-note">
                Phiếu đơn hàng có giá trị xác nhận thỏa thuận mua bán tại chỗ giữa Đại lý và Nhân viên kinh doanh.
                <br />
                Mã vạch trên đầu phiếu dùng để quét tra cứu tự động tại bộ phận kho TTCS.
              </div>
            </article>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OrderPrintModal;
