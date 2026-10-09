import React from 'react';
import type { DealerCreditInfo } from '../services/api';

interface DealerCreditBadgeProps {
  creditInfo: DealerCreditInfo | null;
  currentOrderAmount?: number;
  isLoading?: boolean;
}

const formatVND = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const DealerCreditBadge: React.FC<DealerCreditBadgeProps> = ({
  creditInfo,
  currentOrderAmount = 0,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div
        style={{
          padding: '12px 16px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          color: '#64748b',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          margin: '10px 0',
        }}
      >
        <span>Đang kiểm tra hạn mức & công nợ đại lý...</span>
      </div>
    );
  }

  if (!creditInfo) return null;

  const currentDebt = creditInfo.current_debt || 0;
  const creditLimit = creditInfo.credit_limit || 0;
  const remaining = Math.max(0, creditLimit - currentDebt);
  const maxDebtAge = creditInfo.max_debt_age || 0;
  const allowedDays = creditInfo.overdue_days_allowed || creditInfo.max_debt_days || 30;
  const isOverdue = creditInfo.is_overdue || maxDebtAge > allowedDays;

  // Tính toán trạng thái nếu cộng thêm đơn hàng hiện tại
  const totalDebtAfterOrder = currentDebt + (currentOrderAmount > 0 ? currentOrderAmount : 0);
  const isOrderExceedingLimit = currentOrderAmount > 0 && totalDebtAfterOrder > creditLimit;
  const isCurrentlyOverLimit = currentDebt > creditLimit;

  return (
    <div
      className="dealer-credit-control-box"
      id="dealer-credit-control-box"
      style={{
        marginTop: '10px',
        marginBottom: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {/* 1. LƯỚI THẺ CHỈ SỐ CÔNG NỢ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '10px',
        }}
      >
        {/* Thẻ 1: Công nợ hiện tại */}
        <div
          style={{
            background: '#ffffff',
            border: isCurrentlyOverLimit ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Công Nợ Hiện Tại
          </div>
          <div
            id="badge-current-debt"
            style={{
              fontSize: '15.5px',
              fontWeight: '800',
              color: isCurrentlyOverLimit ? '#dc2626' : currentDebt > 0 ? '#b45309' : '#0f172a',
              marginTop: '4px',
            }}
          >
            {formatVND(currentDebt)}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Tuổi nợ: <strong style={{ color: isOverdue ? '#dc2626' : '#475569' }}>{maxDebtAge} ngày</strong>
          </div>
        </div>

        {/* Thẻ 2: Hạn mức công nợ */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Hạn Mức Công Nợ
          </div>
          <div
            id="badge-credit-limit"
            style={{
              fontSize: '15.5px',
              fontWeight: '800',
              color: '#2563eb',
              marginTop: '4px',
            }}
          >
            {formatVND(creditLimit)}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
            Cho phép nợ: <strong>{allowedDays} ngày</strong>
          </div>
        </div>

        {/* Thẻ 3: Hạn mức còn lại */}
        <div
          style={{
            background: remaining === 0 ? '#fff1f2' : '#f0fdf4',
            border: remaining === 0 ? '1px solid #fecdd3' : '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '600', color: remaining === 0 ? '#9f1239' : '#166534', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Hạn Mức Còn Lại
          </div>
          <div
            id="badge-remaining-credit"
            style={{
              fontSize: '15.5px',
              fontWeight: '800',
              color: remaining === 0 ? '#e11d48' : '#15803d',
              marginTop: '4px',
            }}
          >
            {formatVND(remaining)}
          </div>
          <div style={{ fontSize: '11px', color: remaining === 0 ? '#be123c' : '#15803d', marginTop: '2px' }}>
            {remaining === 0 ? 'Đã hết hạn mức' : 'Khả dụng đặt hàng'}
          </div>
        </div>
      </div>

      {/* 2. AC 3: CẢNH BÁO NỢ QUÁ HẠN (BLOCK HOÀN TOÀN) */}
      {isOverdue && (
        <div
          id="alert-overdue-debt-blocked"
          role="alert"
          style={{
            background: '#fef2f2',
            border: '1.5px solid #f87171',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.1)',
          }}
        >
          <div style={{ flex: 1, fontSize: '13px', color: '#991b1b', lineHeight: '1.5' }}>
            <strong style={{ display: 'block', fontSize: '13.5px', marginBottom: '2px', color: '#7f1d1d' }}>
              CHẶN TẠO ĐƠN HÀNG DO CÔNG NỢ QUÁ HẠN
            </strong>
            Đại lý đang có khoản nợ quá hạn <strong>{maxDebtAge} ngày</strong> (vượt quá mức cho phép tối đa <strong>{allowedDays} ngày</strong>).
            Hệ thống <strong>chặn tạo đơn hàng hoàn toàn</strong>. Vui lòng hướng dẫn đại lý thanh toán công nợ quá hạn trước khi tiếp tục lên đơn.
          </div>
        </div>
      )}

      {/* 3. AC 2: CẢNH BÁO VƯỢT HẠN MỨC (SET STATUS CẦN DUYỆT) */}
      {!isOverdue && (isOrderExceedingLimit || isCurrentlyOverLimit) && (
        <div
          id="alert-credit-limit-approval-needed"
          role="alert"
          style={{
            background: '#fffbeb',
            border: '1.5px solid #fcd34d',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            boxShadow: '0 2px 6px rgba(245, 158, 11, 0.1)',
          }}
        >
          <div style={{ flex: 1, fontSize: '13px', color: '#92400e', lineHeight: '1.5' }}>
            <strong style={{ display: 'block', fontSize: '13.5px', marginBottom: '2px', color: '#78350f' }}>
              CẢNH BÁO: ĐƠN HÀNG VƯỢT HẠN MỨC CÔNG NỢ (CẦN PHÊ DUYỆT)
            </strong>
            {currentOrderAmount > 0 ? (
              <>
                Tổng tiền đơn hàng hiện tại cộng với công nợ ({formatVND(totalDebtAfterOrder)}) vượt hạn mức cho phép ({formatVND(creditLimit)}).
                Vượt: <strong>{formatVND(totalDebtAfterOrder - creditLimit)}</strong>.
              </>
            ) : (
              <>
                Đại lý hiện đang vượt hạn mức công nợ ({formatVND(currentDebt)} &gt; {formatVND(creditLimit)}).
              </>
            )}{' '}
            Đơn hàng sau khi lưu sẽ được đánh dấu <strong>Cần duyệt (Chờ duyệt)</strong> và cần Quản lý kinh doanh phê duyệt trước khi xuất kho.
          </div>
        </div>
      )}
    </div>
  );
};
