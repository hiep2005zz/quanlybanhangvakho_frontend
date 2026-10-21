import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DebtReconciliationItemResponse } from '../services/api';

interface DebtReconciliationPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  reconciliation: DebtReconciliationItemResponse | null;
  companyInfo?: {
    name?: string;
    address?: string;
    taxCode?: string;
    phone?: string;
    representative?: string;
  };
}

// Hàm đọc số tiền bằng chữ tiếng Việt
function numberToWordsVietnamese(n: number): string {
  if (n === 0) return 'Không đồng';
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const scales = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  function readThreeDigits(num: number, isHighest: boolean = false): string {
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;
    let res = '';

    if (h > 0 || !isHighest) {
      res += units[h] + ' trăm ';
    }
    if (t > 1) {
      res += units[t] + ' mươi ';
      if (u === 1) res += 'mốt ';
      else if (u === 5) res += 'lăm ';
      else if (u > 0) res += units[u] + ' ';
    } else if (t === 1) {
      res += 'mười ';
      if (u === 5) res += 'lăm ';
      else if (u > 0) res += units[u] + ' ';
    } else if (t === 0 && u > 0) {
      if (!isHighest || h > 0) res += 'lẻ ';
      res += units[u] + ' ';
    }
    return res;
  }

  let num = Math.abs(Math.round(n));
  const groups: number[] = [];
  while (num > 0) {
    groups.push(num % 1000);
    num = Math.floor(num / 1000);
  }

  let words = '';
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g > 0) {
      const gWords = readThreeDigits(g, i === groups.length - 1);
      words += gWords + scales[i] + ' ';
    }
  }

  words = words.trim();
  if (!words) return 'Không đồng';
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} đồng chẵn${n < 0 ? ' (âm)' : ''}`;
}

export const DebtReconciliationPrintModal: React.FC<DebtReconciliationPrintModalProps> = ({
  isOpen,
  onClose,
  reconciliation,
  companyInfo = {
    name: 'CÔNG TY CỔ PHẦN PHÂN PHỐI & BÁN LẺ TOÀN QUỐC',
    address: 'Số 123 Đường Giải Phóng, Quận Hai Bà Trưng, TP. Hà Nội',
    taxCode: '0108998899',
    phone: '1900 6868',
    representative: 'Nguyễn Văn Giám Đốc',
  },
}) => {
  if (!isOpen || !reconciliation) return null;

  const formatMoney = (val?: number) => {
    return (val || 0).toLocaleString('vi-VN') + ' đ';
  };

  const handlePrint = () => {
    window.print();
  };

  const moneyInWords = useMemo(() => {
    return numberToWordsVietnamese(reconciliation.closing_balance);
  }, [reconciliation.closing_balance]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      {/* Modal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          width: '100%',
          maxWidth: '860px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header Action Bar (Ẩn khi in) */}
        <div
          className="no-print"
          style={{
            padding: '14px 20px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #334155',
          }}
        >
          <div>
            <div style={{ fontWeight: '700', fontSize: '15px' }}>Xem & In Biên bản đối chiếu công nợ</div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Mã biên bản: {reconciliation.code}</div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                padding: '7px 16px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              In / Lưu PDF (A4)
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '7px 14px',
                backgroundColor: '#334155',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>

        {/* Khung nội dung in ấn chuẩn A4 */}
        <div
          id="reconciliation-print-area"
          style={{
            padding: '36px 48px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '14px',
            lineHeight: 1.5,
          }}
        >
          {/* Quốc hiệu - Tiêu ngữ */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', letterSpacing: '0.05em' }}>
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div style={{ fontWeight: 'bold', fontSize: '14px', textDecoration: 'underline' }}>
              Độc lập - Tự do - Hạnh phúc
            </div>
            <div style={{ fontStyle: 'italic', fontSize: '12px', marginTop: '6px', color: '#475569' }}>
              --------o0o--------
            </div>
          </div>

          {/* Tiêu đề biên bản */}
          <div style={{ textAlign: 'center', marginBottom: '22px' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a' }}>
              BIÊN BẢN ĐỐI CHIẾU VÀ XÁC NHẬN CÔNG NỢ
            </div>
            <div style={{ fontStyle: 'italic', fontSize: '13.5px', marginTop: '4px' }}>
              Kỳ đối chiếu: <strong>{reconciliation.period_label}</strong> (Từ ngày {reconciliation.from_date} đến ngày {reconciliation.to_date})
            </div>
            <div style={{ fontSize: '12.5px', color: '#64748b' }}>
              Số: <strong>{reconciliation.code}</strong>
            </div>
          </div>

          {/* Căn cứ pháp lý */}
          <div style={{ fontStyle: 'italic', marginBottom: '16px', fontSize: '13px' }}>
            - Căn cứ vào Hợp đồng mua bán và thỏa thuận cung cấp hàng hóa giữa hai bên;<br />
            - Căn cứ vào tình hình giao nhận hàng hóa và thanh toán thực tế phát sinh trong kỳ;
          </div>

          <div style={{ marginBottom: '16px' }}>
            Hôm nay, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}, chúng tôi gồm có:
          </div>

          {/* BÊN A */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a' }}>
              BÊN A (BÊN BÁN): {companyInfo.name}
            </div>
            <div style={{ paddingLeft: '14px' }}>
              <div>• Địa chỉ: {companyInfo.address}</div>
              <div>• Mã số thuế: {companyInfo.taxCode} &nbsp;&nbsp;&nbsp;&nbsp; • Điện thoại: {companyInfo.phone}</div>
              <div>• Đại diện: {companyInfo.representative}</div>
            </div>
          </div>

          {/* BÊN B */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontWeight: 'bold', textTransform: 'uppercase', color: '#0f172a' }}>
              BÊN B (BÊN MUA): {reconciliation.dealer_name}
            </div>
            <div style={{ paddingLeft: '14px' }}>
              <div>• Mã đại lý: <strong>{reconciliation.dealer_code}</strong></div>
              <div>• Địa chỉ: {reconciliation.dealer_address || 'Theo hồ sơ hợp đồng'}</div>
              <div>• Điện thoại: {reconciliation.dealer_phone || '---'}</div>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            Hai bên đã cùng nhau kiểm tra, đối chiếu tình hình công nợ trong kỳ như sau:
          </div>

          {/* 1. BẢNG TỔNG HỢP CÔNG NỢ */}
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>1. BẢNG TỔNG HỢP CÔNG NỢ TRONG KỲ:</div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '20px',
              fontSize: '13.5px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ border: '1px solid #94a3b8', padding: '8px 10px', textAlign: 'center', width: '50px' }}>STT</th>
                <th style={{ border: '1px solid #94a3b8', padding: '8px 12px', textAlign: 'left' }}>Chỉ tiêu</th>
                <th style={{ border: '1px solid #94a3b8', padding: '8px 14px', textAlign: 'right', width: '200px' }}>Số tiền (VNĐ)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>1</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>
                  <strong>Số dư nợ đầu kỳ</strong> (Tính đến hết ngày {reconciliation.from_date})
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 14px', textAlign: 'right', fontWeight: 'bold' }}>
                  {formatMoney(reconciliation.opening_balance)}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>2</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>
                  <strong>Phát sinh TĂNG trong kỳ</strong> (Tiền mua hàng theo hóa đơn xuất kho)
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 14px', textAlign: 'right', color: '#b91c1c', fontWeight: 'bold' }}>
                  +{formatMoney(reconciliation.total_increase)}
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px', textAlign: 'center' }}>3</td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px' }}>
                  <strong>Phát sinh GIẢM trong kỳ</strong> (Đại lý đã thanh toán / chuyển khoản)
                </td>
                <td style={{ border: '1px solid #cbd5e1', padding: '8px 14px', textAlign: 'right', color: '#15803d', fontWeight: 'bold' }}>
                  -{formatMoney(reconciliation.total_decrease)}
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f8fafc' }}>
                <td style={{ border: '2px solid #0f172a', padding: '10px 8px', textAlign: 'center', fontWeight: 'bold' }}>4</td>
                <td style={{ border: '2px solid #0f172a', padding: '10px 8px', fontWeight: 'bold' }}>
                  SỐ DƯ NỢ CUỐI KỲ BÊN B PHẢI THANH TOÁN (1 + 2 - 3)
                </td>
                <td style={{ border: '2px solid #0f172a', padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', fontSize: '15px', color: '#0f172a' }}>
                  {formatMoney(reconciliation.closing_balance)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* 2. BẢNG KÊ CHI TIẾT CHỨNG TỪ */}
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>2. BẢNG KÊ CHI TIẾT CÁC GIAO DỊCH PHÁT SINH TRONG KỲ:</div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '20px',
              fontSize: '12.5px',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9' }}>
                <th style={{ border: '1px solid #94a3b8', padding: '6px', textAlign: 'center', width: '35px' }}>STT</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 8px', textAlign: 'center', width: '110px' }}>Ngày CT</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 8px', textAlign: 'center', width: '120px' }}>Mã chứng từ</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 8px', textAlign: 'left' }}>Diễn giải / Nội dung</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 8px', textAlign: 'right', width: '110px' }}>Tăng nợ (VNĐ)</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 8px', textAlign: 'right', width: '110px' }}>Giảm nợ (VNĐ)</th>
                <th style={{ border: '1px solid #94a3b8', padding: '6px 8px', textAlign: 'right', width: '110px' }}>Dư nợ (VNĐ)</th>
              </tr>
            </thead>
            <tbody>
              {reconciliation.items.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ border: '1px solid #cbd5e1', padding: '12px', textAlign: 'center', color: '#64748b' }}>
                    Không có giao dịch phát sinh mua hàng hay thanh toán trong khoảng thời gian này.
                  </td>
                </tr>
              ) : (
                reconciliation.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center' }}>{item.doc_date}</td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px', textAlign: 'center', fontWeight: '600' }}>
                      {item.doc_code}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>
                      {item.description}
                      {item.payment_method && <span style={{ color: '#64748b', fontSize: '11px' }}> ({item.payment_method})</span>}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', color: item.increase_amount ? '#b91c1c' : undefined }}>
                      {item.increase_amount ? formatMoney(item.increase_amount) : '-'}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', color: item.decrease_amount ? '#15803d' : undefined }}>
                      {item.decrease_amount ? formatMoney(item.decrease_amount) : '-'}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>
                      {formatMoney(item.running_balance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* 3. KẾT LUẬN */}
          <div style={{ marginBottom: '14px', lineHeight: 1.6 }}>
            <div>
              <strong>3. KẾT LUẬN:</strong> Tính đến hết ngày <strong>{reconciliation.to_date}</strong>, Bên B (Đại lý {reconciliation.dealer_name}) còn nợ Bên A số tiền là:
            </div>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: '4px 0 2px 14px' }}>
              {formatMoney(reconciliation.closing_balance)}
            </div>
            <div style={{ fontStyle: 'italic', margin: '0 0 10px 14px' }}>
              (Số tiền viết bằng chữ: <strong>{moneyInWords}</strong>)
            </div>
            <div>
              Hai bên cam kết số liệu đối chiếu trên là hoàn toàn chính xác. Bên B có trách nhiệm thanh toán số tiền nợ trên đúng thời hạn cam kết.
            </div>
            <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '4px' }}>
              Biên bản này được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để làm căn cứ hạch toán kế toán.
            </div>
          </div>

          {/* KHUNG KÝ TÊN HAI BÊN */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '32px',
              pageBreakInside: 'avoid',
            }}
          >
            {/* Đại diện bên B */}
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>ĐẠI DIỆN BÊN B</div>
              <div style={{ fontSize: '12px', fontStyle: 'italic' }}>(Ký, ghi rõ họ tên và đóng dấu)</div>

              <div style={{ height: '100px' }} />
            </div>

            {/* Đại diện bên A */}
            <div style={{ textAlign: 'center', width: '45%' }}>
              <div style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>ĐẠI DIỆN BÊN A</div>
              <div style={{ fontSize: '12px', fontStyle: 'italic' }}>(Kế toán công nợ / Giám đốc ký)</div>

              <div style={{ height: '100px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Style Print CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          #reconciliation-print-area, #reconciliation-print-area * {
            visibility: visible;
          }
          #reconciliation-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
            font-size: 13pt !important;
          }
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
        }
      `}</style>
    </div>,
    document.body
  );
};
