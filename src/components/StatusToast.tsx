import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const STATUS_TOAST_VISIBLE_MS = 5000; // Thời gian giữ thông báo trên màn hình
export const STATUS_TOAST_EXIT_MS = 460;     // BẮT BUỘC khớp với duration keyframes accountStatusToastExit

const STATUS_TOAST_EVENT = 'APP_STATUS_TOAST';

export interface StatusToastPayload {
  message: string | any;
  title?: string;
  actionType?: 'create' | 'update' | 'delete' | 'export';
  durationMs?: number;
}

/**
 * Phát một thông báo nổi ở góc phải màn hình.
 * Có thể gọi từ bất kỳ component nào (không phụ thuộc React Context).
 */
export const emitStatusToast = (payload: StatusToastPayload) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<StatusToastPayload>(STATUS_TOAST_EVENT, { detail: payload }));
};

/**
 * Format error message nếu nhận vào object hoặc string [object Object]
 */
function cleanToastMessage(raw: any): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') {
    if (raw.includes('[object Object]')) {
      return 'Dữ liệu không hợp lệ hoặc đã xảy ra lỗi từ hệ thống.';
    }
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'object' ? item?.msg || item?.message || JSON.stringify(item) : String(item)))
      .join('; ');
  }
  if (typeof raw === 'object') {
    return raw.detail || raw.message || raw.msg || JSON.stringify(raw);
  }
  return String(raw);
}

/**
 * "Ổ" hiển thị thông báo nổi ở góc dưới màn hình.
 * Dùng createPortal gắn trực tiếp vào document.body với z-index cao nhất để không bao giờ bị modal/phiếu đè.
 */
export const StatusToastHost: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Thông báo hệ thống');
  const [actionCategory, setActionCategory] = useState<'create' | 'update' | 'delete' | null>(null);
  const [durationMs, setDurationMs] = useState<number>(STATUS_TOAST_VISIBLE_MS);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  // Số thứ tự thông báo: dùng làm "key" để buộc toast mount lại -> hiệu ứng trượt vào luôn phát lại
  const [seq, setSeq] = useState<number>(0);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const d = (e as CustomEvent<StatusToastPayload>).detail;
      if (!d) return;

      const cleanedMsg = cleanToastMessage(d.message);
      if (!cleanedMsg) return;

      let rawTitle = d.title ?? 'Thông báo hệ thống';
      const lowerTitle = rawTitle.toLowerCase();
      const lowerMsg = cleanedMsg.toLowerCase();

      // Nhận diện hành động Thêm mới, Chỉnh sửa, hoặc Xóa
      let detectedAction: 'create' | 'update' | 'delete' | null = d.actionType && d.actionType !== 'export' ? d.actionType : null;
      if (!detectedAction) {
        if (lowerTitle.includes('xóa') || lowerMsg.includes('đã xóa') || lowerMsg.includes('xóa thành công')) {
          detectedAction = 'delete';
        } else if (lowerTitle.includes('thêm') || lowerTitle.includes('tạo') || lowerMsg.includes('thêm mới') || lowerMsg.includes('đã tạo')) {
          detectedAction = 'create';
        } else if (lowerTitle.includes('sửa') || lowerTitle.includes('cập nhật') || lowerMsg.includes('đã cập nhật') || lowerMsg.includes('cập nhật')) {
          detectedAction = 'update';
        }
      }

      // Kiểm tra xem có phải là thông báo thành công hay không
      const isExplicitSuccess =
        (lowerTitle.includes('thành công') ||
          lowerTitle.includes('success') ||
          lowerTitle.includes('hoàn tất') ||
          lowerTitle.includes('đã tạo') ||
          lowerTitle.includes('đã thêm') ||
          lowerTitle.includes('đã lưu') ||
          lowerTitle.includes('đã cập nhật') ||
          lowerTitle.includes('đã xóa') ||
          lowerMsg.includes('thành công') ||
          lowerMsg.includes('đã thêm mới')) &&
        !lowerTitle.includes('không thành công') &&
        !lowerMsg.includes('không thành công');

      // Tự động nhận diện loại thông báo nếu chưa truyền hoặc có dấu hiệu lỗi / cảnh báo
      let determinedType = d.type;

      if (isExplicitSuccess) {
        determinedType = 'success';
      } else if (!determinedType) {
        if (
          lowerTitle.includes('lỗi') ||
          lowerTitle.includes('thất bại') ||
          lowerTitle.includes('từ chối') ||
          lowerTitle.includes('error') ||
          lowerTitle.includes('fail') ||
          lowerTitle.includes('hỏng') ||
          lowerTitle.includes('không thể') ||
          lowerTitle.includes('chặn') ||
          lowerMsg.includes('thất bại') ||
          (lowerMsg.includes('lỗi') &&
            !lowerMsg.includes('0 lỗi') &&
            !lowerMsg.includes('không có lỗi') &&
            !lowerMsg.includes('bỏ qua lỗi'))
        ) {
          determinedType = 'error';
        } else if (
          lowerTitle.includes('cảnh báo') ||
          lowerTitle.includes('chú ý') ||
          lowerTitle.includes('warning')
        ) {
          determinedType = 'warning';
        } else if (lowerTitle.includes('thông tin') || lowerTitle.includes('info')) {
          determinedType = 'info';
        } else {
          determinedType = 'success';
        }
      }

      setMessage(cleanedMsg);
      setTitle(rawTitle);
      setActionCategory(detectedAction);
      setDurationMs(d.durationMs && d.durationMs > 0 ? d.durationMs : STATUS_TOAST_VISIBLE_MS);
      setIsExiting(false);
      setSeq((s) => s + 1);
    };

    window.addEventListener(STATUS_TOAST_EVENT, handleToast);
    return () => window.removeEventListener(STATUS_TOAST_EVENT, handleToast);
  }, []);

  // Tự động ẩn: hiển thị durationMs -> trượt ra về mép phải -> gỡ khỏi DOM.
  useEffect(() => {
    if (!message) return;
    const hideTimer = setTimeout(() => {
      setIsExiting(true);
    }, durationMs);
    const removeTimer = setTimeout(() => {
      setMessage(null);
      setIsExiting(false);
    }, durationMs + STATUS_TOAST_EXIT_MS + 60);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [seq, message, durationMs]);

  if (!message || typeof document === 'undefined') return null;

  const isWarning = toastType === 'warning';
  const isError = toastType === 'error';
  const isInfo = toastType === 'info';

  // Phân bổ màu sắc trực quan theo quy định:
  // - THÊM MỚI (Create / Success): Xanh lá cây (#16a34a, #dcfce7, #f0fdf4)
  // - CHỈNH SỬA / CẬP NHẬT (Update): Xanh dương tươi (#2563eb, #dbeafe, #eff6ff)
  // - XÓA / NGUY HIỂM (Delete / Error): Đỏ thắm (#dc2626, #fee2e2, #fef2f2)
  // - CẢNH BÁO (Warning): Vàng cam / Hổ phách (#d97706, #fef3c7, #fffbeb)
  let borderColor = '#86efac';
  let borderLeftColor = '#16a34a';
  let titleColor = '#15803d';
  let textColor = '#14532d';
  let bgColor = '#f0fdf4';
  let closeColor = '#16a34a';

  if (isError || actionCategory === 'delete') {
    borderColor = '#fca5a5';
    borderLeftColor = '#dc2626';
    titleColor = '#dc2626';
    textColor = '#991b1b';
    bgColor = '#fef2f2';
    closeColor = '#dc2626';
  } else if (isWarning) {
    borderColor = '#fed7aa';
    borderLeftColor = '#f59e0b';
    titleColor = '#c2410c';
    textColor = '#9a3412';
    bgColor = '#fffbeb';
    closeColor = '#c2410c';
  } else if (actionCategory === 'update' || isInfo) {
    borderColor = '#93c5fd';
    borderLeftColor = '#2563eb';
    titleColor = '#1d4ed8';
    textColor = '#1e40af';
    bgColor = '#eff6ff';
    closeColor = '#2563eb';
  } else {
    // actionCategory === 'create' hoặc success chung
    borderColor = '#86efac';
    borderLeftColor = '#16a34a';
    titleColor = '#15803d';
    textColor = '#14532d';
    bgColor = '#f0fdf4';
    closeColor = '#16a34a';
  }

  const isDeleteTheme = isError || actionCategory === 'delete';
  const isUpdateTheme = !isError && actionCategory === 'update';

  const progressBg = isDeleteTheme
    ? 'linear-gradient(90deg, #f87171, #dc2626)'
    : isWarning
    ? 'linear-gradient(90deg, #fcd34d, #f59e0b)'
    : isUpdateTheme
    ? 'linear-gradient(90deg, #60a5fa, #2563eb)'
    : 'linear-gradient(90deg, #34d399, #16a34a)';

  return createPortal(
    <div
      key={seq}
      role="status"
      aria-live="polite"
      className={isExiting ? 'status-toast status-toast--exiting' : 'status-toast'}
      style={{
        position: 'fixed',
        right: '24px',
        bottom: '24px',
        zIndex: 9999999,
        width: 'min(420px, calc(100vw - 32px))',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        border: `1px solid ${borderColor}`,
        borderLeft: `5px solid ${borderLeftColor}`,
        borderRadius: '10px',
        overflow: 'hidden',
        background: bgColor,
        color: textColor,
        boxShadow: isDeleteTheme
          ? '0 10px 25px rgba(220, 38, 38, 0.18), 0 4px 10px rgba(0, 0, 0, 0.05)'
          : isWarning
          ? '0 10px 25px rgba(245, 158, 11, 0.18), 0 4px 10px rgba(0, 0, 0, 0.05)'
          : isUpdateTheme
          ? '0 10px 25px rgba(37, 99, 235, 0.18), 0 4px 10px rgba(0, 0, 0, 0.05)'
          : '0 10px 25px rgba(22, 163, 74, 0.18), 0 4px 10px rgba(0, 0, 0, 0.05)',
        willChange: 'transform, opacity',
        animation: isExiting
          ? `accountStatusToastExit ${STATUS_TOAST_EXIT_MS}ms cubic-bezier(0.55, 0, 1, 0.45) forwards`
          : 'accountStatusToastEnter 620ms cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      {/* Icon trạng thái */}
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        {isDeleteTheme && (
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#fee2e2',
              border: '1px solid #fecaca',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </div>
        )}
        {isWarning && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
        {isUpdateTheme && (
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#dbeafe',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
        )}
        {!isDeleteTheme && !isWarning && !isUpdateTheme && (
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: '#dcfce7',
              border: '1px solid #bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
        {isInfo && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '3px', color: titleColor }}>
          {title}
        </div>
        <div style={{ fontSize: '12.5px', lineHeight: 1.45, overflowWrap: 'anywhere', color: textColor }}>
          {message}
        </div>
      </div>

      <button
        type="button"
        aria-label="Đóng thông báo"
        onClick={() => setMessage(null)}
        style={{
          flexShrink: 0,
          padding: '0 4px',
          border: 'none',
          background: 'transparent',
          color: closeColor,
          cursor: 'pointer',
          fontSize: '18px',
          lineHeight: 1,
          fontWeight: 700,
        }}
      >
        ×
      </button>

      {/* Thanh tiến trình đếm ngược thời gian tự ẩn */}
      <span
        aria-hidden="true"
        className="status-toast-progress"
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: '3px',
          width: '100%',
          background: progressBg,
          transformOrigin: 'left center',
          visibility: isExiting ? 'hidden' : 'visible',
          animation: `accountStatusToastProgress ${STATUS_TOAST_VISIBLE_MS}ms linear forwards`,
        }}
      />
    </div>,
    document.body
  );
};

export default StatusToastHost;
