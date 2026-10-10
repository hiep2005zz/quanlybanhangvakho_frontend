import React from 'react';

export interface OrderLifecycleTimelineProps {
  status: string;
  cancelReason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  approvalReason?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
}

interface StepDefinition {
  id: string;
  label: string;
  description: string;
  aliases: string[];
}

const LIFECYCLE_STEPS: StepDefinition[] = [
  { id: 'DRAFT', label: 'Nháp', description: 'Đang tạo đơn', aliases: ['DRAFT'] },
  { id: 'PENDING_APPROVAL', label: 'Chờ duyệt', description: 'Chờ quản lý xét duyệt', aliases: ['PENDING_APPROVAL', 'PENDING'] },
  { id: 'CONFIRMED', label: 'Đã duyệt', description: 'Đã phê duyệt / xác nhận', aliases: ['CONFIRMED', 'APPROVED'] },
  { id: 'PICKING', label: 'Đang soạn hàng', description: 'Kho đang lấy & đóng gói', aliases: ['PICKING', 'PREPARING', 'PACKING'] },
  { id: 'EXPORTED', label: 'Đã xuất', description: 'Đã xuất kho vận chuyển', aliases: ['EXPORTED', 'DISPATCHED', 'SHIPPED'] },
  { id: 'DELIVERED', label: 'Đã giao', description: 'Đã giao tới đại lý', aliases: ['DELIVERED'] },
  { id: 'CLOSED', label: 'Đóng', description: 'Hoàn tất đơn hàng', aliases: ['CLOSED', 'COMPLETED'] },
];

const formatDate = (val?: string | null) => {
  if (!val) return '—';
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? val : d.toLocaleString('vi-VN');
};

export const OrderLifecycleTimeline: React.FC<OrderLifecycleTimelineProps> = ({
  status,
  cancelReason,
  cancelledBy,
  cancelledAt,
  approvalReason,
  approvedBy,
  approvedAt,
}) => {
  const normalizedStatus = (status || '').toUpperCase().trim();
  const isCancelled = normalizedStatus === 'CANCELLED';
  const isRejected = normalizedStatus === 'REJECTED';
  const isInterrupted = isCancelled || isRejected;

  // Xác định bước hiện tại trong 7 bước
  let currentStepIndex = -1;
  LIFECYCLE_STEPS.forEach((step, idx) => {
    if (step.aliases.includes(normalizedStatus)) {
      currentStepIndex = idx;
    }
  });

  // Nếu là đơn mới tạo CONFIRMED thì đã qua DRAFT (0) và PENDING_APPROVAL (1), hiện tại là CONFIRMED (2)
  if (currentStepIndex === -1 && !isInterrupted) {
    currentStepIndex = 2; // mặc định đã duyệt nếu không khớp
  }

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
          paddingBottom: '12px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#64748b',
              display: 'block',
              marginBottom: '2px',
            }}
          >
            TIẾN ĐỘ ĐƠN HÀNG
          </span>
          <h4
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 700,
              color: '#0f172a',
            }}
          >
            Vòng đời xử lý đơn hàng
          </h4>
        </div>

        {/* Badge trạng thái chính */}
        <div>
          {isCancelled ? (
            <span
              style={{
                display: 'inline-block',
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fca5a5',
                borderRadius: '999px',
                padding: '4px 14px',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              Trạng thái: ĐÃ HỦY
            </span>
          ) : isRejected ? (
            <span
              style={{
                display: 'inline-block',
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fca5a5',
                borderRadius: '999px',
                padding: '4px 14px',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              Trạng thái: TỪ CHỐI
            </span>
          ) : (
            <span
              style={{
                display: 'inline-block',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                borderRadius: '999px',
                padding: '4px 14px',
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              Bước {Math.min(currentStepIndex + 1, LIFECYCLE_STEPS.length)} / {LIFECYCLE_STEPS.length}:{' '}
              {LIFECYCLE_STEPS[currentStepIndex]?.label || normalizedStatus}
            </span>
          )}
        </div>
      </div>

      {/* Stepper ngang (HOÀN TOÀN BỎ CÁC ICON, CHỈ DÙNG SỐ VÀ CHỮ THEO YÊU CẦU) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          position: 'relative',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {LIFECYCLE_STEPS.map((step, idx) => {
          const isPassed = !isInterrupted && idx < currentStepIndex;
          const isCurrent = !isInterrupted && idx === currentStepIndex;
          const isInterruptedStep = isInterrupted && idx >= 2;

          let circleBg = '#f1f5f9';
          let circleColor = '#64748b';
          let circleBorder = '2px solid #cbd5e1';
          let textColor = '#64748b';
          let stateLabel = 'Chưa tới';

          if (isPassed) {
            circleBg = '#16a34a';
            circleColor = '#ffffff';
            circleBorder = '2px solid #16a34a';
            textColor = '#15803d';
            stateLabel = 'Hoàn thành';
          } else if (isCurrent) {
            circleBg = '#2563eb';
            circleColor = '#ffffff';
            circleBorder = '2px solid #1d4ed8';
            textColor = '#1e40af';
            stateLabel = 'Hiện tại';
          } else if (isInterruptedStep) {
            circleBg = '#f8fafc';
            circleColor = '#94a3b8';
            circleBorder = '2px dashed #cbd5e1';
            textColor = '#94a3b8';
            stateLabel = 'Dừng luồng';
          }

          return (
            <div
              key={step.id}
              style={{
                flex: 1,
                minWidth: '100px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {/* Thanh kết nối giữa các bước */}
              {idx > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '16px',
                    left: '-50%',
                    width: '100%',
                    height: '3px',
                    background: isPassed ? '#16a34a' : isCurrent ? '#93c5fd' : '#e2e8f0',
                    zIndex: 1,
                  }}
                />
              )}

              {/* Vòng tròn số thứ tự bước (KHÔNG DÙNG ICON) */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: circleBg,
                  color: circleColor,
                  border: circleBorder,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  position: 'relative',
                  zIndex: 2,
                  boxShadow: isCurrent ? '0 0 0 4px rgba(37, 99, 235, 0.15)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                {idx + 1}
              </div>

              {/* Tên bước */}
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: isCurrent ? 700 : isPassed ? 600 : 500,
                  color: isCurrent ? '#0f172a' : textColor,
                  marginBottom: '2px',
                }}
              >
                {step.label}
              </span>

              {/* Trạng thái bước */}
              <span
                style={{
                  fontSize: '10.5px',
                  color: isCurrent ? '#2563eb' : isPassed ? '#16a34a' : '#94a3b8',
                  fontWeight: isCurrent || isPassed ? 600 : 400,
                }}
              >
                {stateLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Nhánh Huỷ: Hiển thị nổi bật chi tiết lý do hủy & người thực hiện */}
      {isCancelled && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px 18px',
            background: '#fef2f2',
            border: '1.5px solid #ef4444',
            borderRadius: '10px',
            color: '#991b1b',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #fecaca',
              paddingBottom: '8px',
              marginBottom: '4px',
            }}
          >
            <strong style={{ fontSize: '13.5px', color: '#b91c1c' }}>
              NHÁNH HUỶ ĐƠN HÀNG: ĐÃ HỦY
            </strong>
            <span style={{ fontSize: '12px', color: '#7f1d1d' }}>
              Thời gian hủy: {formatDate(cancelledAt)}
            </span>
          </div>

          <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
            <span style={{ fontWeight: 600 }}>Lý do hủy: </span>
            <span style={{ color: '#7f1d1d' }}>{cancelReason || 'Không có lý do chi tiết'}</span>
          </div>

          <div style={{ fontSize: '12px', color: '#991b1b' }}>
            <span>Người thực hiện hủy: </span>
            <strong style={{ color: '#0f172a' }}>{cancelledBy || 'Hệ thống'}</strong>
            <span style={{ marginLeft: '12px', fontStyle: 'italic', color: '#047857' }}>
              [Đã tự động nhả số lượng tồn giữ chỗ về kho khả dụng]
            </span>
          </div>
        </div>
      )}

      {/* Trường hợp bị từ chối */}
      {isRejected && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px 18px',
            background: '#fffbeb',
            border: '1.5px solid #f59e0b',
            borderRadius: '10px',
            color: '#92400e',
          }}
        >
          <strong style={{ display: 'block', marginBottom: '4px', fontSize: '13.5px' }}>
            ĐƠN HÀNG BỊ TỪ CHỐI DUYỆT
          </strong>
          <span style={{ fontSize: '13px' }}>
            Lý do từ chối: {approvalReason || 'Quản lý từ chối duyệt đơn hàng này.'}
          </span>
        </div>
      )}

      {/* Thông tin phê duyệt nếu đơn đã qua duyệt */}
      {!isCancelled && approvedBy && (
        <div
          style={{
            marginTop: '14px',
            fontSize: '12px',
            color: '#15803d',
            background: '#f0fdf4',
            padding: '8px 14px',
            borderRadius: '6px',
            border: '1px solid #bbf7d0',
          }}
        >
          <span>Đơn đã được phê duyệt bởi: </span>
          <strong>@{approvedBy}</strong>
          {approvedAt && <span> vào {formatDate(approvedAt)}</span>}
        </div>
      )}
    </div>
  );
};

export default OrderLifecycleTimeline;
