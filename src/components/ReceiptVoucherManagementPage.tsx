import React, { useState, useEffect } from 'react';
import {
  DealerSearchItem,
  ReceiptVoucherData,
  createReceiptVoucherApi,
} from '../services/dealerSearchApi';
import { User, formatErrorMessage } from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ReceiptVoucherPrintModal } from './ReceiptVoucherPrintModal';
import { DealerSelectDropdown } from './DealerSelectDropdown';

interface ReceiptVoucherManagementPageProps {
  currentUser?: User;
  token?: string;
  initialDealerId?: number | null;
  initialOrderCode?: string | null;
  initialAmount?: number | null;
  onBack?: () => void;
}

export const ReceiptVoucherManagementPage: React.FC<ReceiptVoucherManagementPageProps> = ({
  currentUser,
  token,
  initialDealerId,
  initialOrderCode,
  initialAmount,
  onBack,
}) => {
  // 1. Quản lý đại lý được chọn
  const [selectedDealerId, setSelectedDealerId] = useState<number | null>(initialDealerId || null);
  const [currentDealer, setCurrentDealer] = useState<DealerSearchItem | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleSelectDealer = React.useCallback((d: DealerSearchItem) => {
    setSelectedDealerId(d?.id || null);
    setCurrentDealer(d || null);
  }, []);

  // 2. Form lập phiếu thu mới
  const [amountStr, setAmountStr] = useState<string>(
    initialAmount && initialAmount > 0 ? String(initialAmount) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('Tiền mặt');
  const [payerName, setPayerName] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 3. Modal in phiếu thu
  const [printVoucher, setPrintVoucher] = useState<ReceiptVoucherData | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);

  // Khi đổi đại lý, điền tự động người nộp và lý do mặc định
  useEffect(() => {
    if (currentDealer) {
      setPayerName(`Đại diện ${currentDealer.name}`);
      setReason(
        initialOrderCode
          ? `Thu tiền thanh toán đơn hàng ${initialOrderCode}`
          : `Thu tiền công nợ đại lý ${currentDealer.code}`
      );
    }
  }, [currentDealer, initialOrderCode]);

  // Tính toán số tiền nhập vào
  const cleanDigits = amountStr.replace(/\D/g, '');
  const numAmount = cleanDigits ? parseInt(cleanDigits, 10) : 0;
  const isInvalidAmount = amountStr === '' || isNaN(numAmount) || numAmount <= 0;

  // Xử lý gửi form lập phiếu thu
  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentDealer) {
      emitStatusToast({
        title: 'Chưa chọn đại lý',
        message: 'Vui lòng chọn đại lý cần lập phiếu thu tiền.',
        type: 'warning',
      });
      return;
    }

    if (isInvalidAmount) {
      emitStatusToast({
        title: 'Số tiền không hợp lệ',
        message: 'Số tiền thu phải lớn hơn 0 (tối thiểu 1 đ).',
        type: 'warning',
      });
      return;
    }

    if (!payerName.trim()) {
      emitStatusToast({
        title: 'Thiếu người nộp',
        message: 'Vui lòng nhập tên người nộp tiền.',
        type: 'warning',
      });
      return;
    }

    setSubmitting(true);
    try {
      const newVoucher = await createReceiptVoucherApi(
        currentDealer.id,
        {
          amount: numAmount,
          payment_method: paymentMethod,
          reason: reason.trim() || undefined,
          order_code: initialOrderCode || undefined,
          payer_name: payerName.trim() || undefined,
          note: note.trim() || undefined,
        },
        token
      );

      emitStatusToast({
        title: 'Lập phiếu thu thành công',
        message: `Đã tạo phiếu thu ${newVoucher.receipt_code} (${(newVoucher.amount || 0).toLocaleString(
          'vi-VN'
        )} đ).`,
        type: 'success',
      });

      // Reset form sau khi tạo
      setAmountStr('');
      setNote('');
      if (currentDealer) {
        setReason(`Thu tiền công nợ đại lý ${currentDealer.code}`);
      }

      // Mở ngay modal in phiếu thu
      setPrintVoucher(newVoucher);
      setIsPrintOpen(true);
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi lập phiếu thu',
        message: formatErrorMessage(err?.message || err, 'Không thể ghi nhận phiếu thu.'),
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const collectorName = currentUser?.full_name || currentUser?.username || 'Kế toán công nộp';

  return (
    <div style={{ padding: '20px 24px', width: '100%', boxSizing: 'border-box', color: '#0f172a' }}>
      {/* KHỐI BẢNG FORM DUY NHẤT TRÊN 1 TRANG */}
      <div
        style={{
          width: '100%',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -2px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Header tích hợp gọn gàng trong bảng */}
        <div
          style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                title="Quay lại danh sách đại lý"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Quay lại
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div>
                <h1 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                  Lập Phiếu Thu Tiền Đại Lý
                </h1>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Ghi nhận số tiền thanh toán thực tế và in phiếu thu kẹp chứng từ kế toán
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                padding: '5px 12px',
                borderRadius: '999px',
                background: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                fontSize: '12px',
                fontWeight: '700',
              }}
            >
              Kế toán lập: {collectorName}
            </div>

            <button
              type="button"
              onClick={() => setRefreshKey((prev) => prev + 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 12px',
                borderRadius: '7px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
              title="Làm mới dữ liệu đại lý"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              Làm mới
            </button>
          </div>
        </div>

        {/* Nội dung Bảng Form Lập Phiếu Thu */}
        <form onSubmit={handleCreateVoucher} style={{ padding: '24px' }}>
          {/* Hàng 1: Chọn đại lý & Thông tin đối tác */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr',
              gap: '20px',
              marginBottom: '20px',
              background: '#f8fafc',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            {/* Cột chọn đại lý với tìm kiếm, infinite scroll và reset khi bấm ra ngoài */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Đại lý / Khách hàng nộp tiền <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <DealerSelectDropdown
                token={token}
                selectedDealerId={selectedDealerId}
                onSelectDealer={handleSelectDealer}
                autoSelectFirst={true}
                refreshKey={refreshKey}
                placeholder="Chọn đại lý / khách hàng nộp tiền..."
              />
            </div>

            {/* Chi tiết liên hệ đại lý */}
            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
              <div>
                <span style={{ color: '#64748b' }}>Địa chỉ: </span>
                <strong style={{ color: '#1e293b' }}>{currentDealer?.address || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b' }}>Điện thoại / MST: </span>
                <strong style={{ color: '#1e293b' }}>
                  {currentDealer?.phone || '—'} {currentDealer?.tax_code ? ` | MST: ${currentDealer.tax_code}` : ''}
                </strong>
              </div>
            </div>
          </div>

          {/* Hàng 2: Số tiền thu & Hình thức thanh toán */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Số tiền thu (VNĐ) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  autoFocus
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="Ví dụ: 10000000"
                  style={{
                    width: '100%',
                    height: '46px',
                    padding: '0 52px 0 14px',
                    borderRadius: '8px',
                    border: isInvalidAmount && amountStr !== '' ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    background: isInvalidAmount && amountStr !== '' ? '#fef2f2' : '#ffffff',
                    fontSize: '17px',
                    fontWeight: '800',
                    color: isInvalidAmount && amountStr !== '' ? '#b91c1c' : '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                  onFocus={(e) => {
                    if (!isInvalidAmount || amountStr === '') {
                      e.currentTarget.style.borderColor = '#2563eb';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(37, 99, 235, 0.2)';
                    }
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#64748b',
                    pointerEvents: 'none',
                  }}
                >
                  VND
                </span>
              </div>

              {numAmount > 0 && (
                <div style={{ marginTop: '6px', fontSize: '13px', color: '#15803d', fontWeight: '700' }}>
                  Quy đổi: {numAmount.toLocaleString('vi-VN')} đ
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Hình thức thanh toán <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                style={{
                  width: '100%',
                  height: '46px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  fontWeight: '600',
                  background: '#ffffff',
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                <option value="Tiền mặt">Tiền mặt</option>
                <option value="Chuyển khoản ngân hàng">Chuyển khoản ngân hàng</option>
              </select>
            </div>
          </div>

          {/* Hàng 3: Người nộp tiền & Lý do thu */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Người nộp tiền <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Họ tên người nộp tiền..."
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Lý do thu tiền <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Thu tiền thanh toán công nợ đơn hàng..."
                style={{
                  width: '100%',
                  height: '42px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Hàng 4: Ghi chú chứng từ */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Ghi chú chứng từ
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ghi chú thêm về khoản thu nếu có (số chứng từ ngân hàng, nội dung chi tiết...)"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                outline: 'none',
                resize: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Hàng 5: Nút Thao tác Cuối Bảng Form */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
            )}

            <button
              type="submit"
              disabled={submitting || isInvalidAmount}
              style={{
                padding: '10px 28px',
                height: '44px',
                borderRadius: '8px',
                border: 'none',
                background: submitting || isInvalidAmount ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: submitting || isInvalidAmount ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: submitting || isInvalidAmount ? 'none' : '0 2px 4px rgba(37,99,235,0.2)',
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <path d="M6 14h12v8H6z" />
              </svg>
              {submitting ? 'Đang ghi nhận...' : 'Ghi nhận & In phiếu thu'}
            </button>
          </div>
        </form>
      </div>

      {/* 3. Modal In Phiếu Thu khi ghi nhận thành công */}
      {isPrintOpen && printVoucher && (
        <ReceiptVoucherPrintModal
          voucher={printVoucher}
          currentUser={currentUser}
          onClose={() => {
            setIsPrintOpen(false);
            setPrintVoucher(null);
          }}
        />
      )}
    </div>
  );
};

export default ReceiptVoucherManagementPage;
