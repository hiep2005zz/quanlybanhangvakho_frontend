import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const STATUS_TOAST_VISIBLE_MS = 5000; // Thời gian giữ thông báo trên màn hình
export const STATUS_TOAST_EXIT_MS = 460;     // BẮT BUỘC khớp với duration keyframes accountStatusToastExit

const STATUS_TOAST_EVENT = 'APP_STATUS_TOAST';

export interface StatusToastPayload {
  message: string | any;
  title?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
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
 * "Ổ" hiển thị thông báo nổi.
 * Dùng createPortal gắn trực tiếp vào document.body với z-index cao nhất để không bao giờ bị modal/phiếu đè.
 */
export const StatusToastHost: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Thông báo hệ thống');
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error' | 'info'>('success');
  const [isExiting, setIsExiting] = useState<boolean>(false);
  // Số thứ tự thông báo: dùng làm "key" để buộc toast mount lại -> hiệu ứng trượt vào luôn phát lại
  const [seq, setSeq] = useState<number>(0);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const d = (e as CustomEvent<StatusToastPayload>).detail;
      if (!d) return;

      const cleanedMsg = cleanToastMessage(d.message);
      if (!cleanedMsg) return;

      const rawTitle = d.title ?? 'Thông báo hệ thống';
      const lowerTitle = rawTitle.toLowerCase();
      const lowerMsg = cleanedMsg.toLowerCase();

      // Tự động nhận diện loại thông báo nếu chưa truyền hoặc có dấu hiệu lỗi / cảnh báo
      let determinedType = d.type;
      if (!determinedType) {
        if (
          lowerTitle.includes('lỗi') ||
          lowerTitle.includes('thất bại') ||
          lowerTitle.includes('từ chối') ||
          lowerTitle.includes('error') ||
          lowerTitle.includes('fail') ||
          lowerTitle.includes('hỏng') ||
          lowerMsg.includes('lỗi') ||
          lowerMsg.includes('thất bại')
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
      setToastType(determinedType);
      setIsExiting(false);
      setSeq((s) => s + 1);
    };

    window.addEventListener(STATUS_TOAST_EVENT, handleToast);
    return () => window.removeEventListener(STATUS_TOAST_EVENT, handleToast);
  }, []);

  // Tự động ẩn: hiển thị 5s -> trượt ra về mép phải -> gỡ khỏi DOM.
  useEffect(() => {
    if (!message) return;
    const hideTimer = setTimeout(() => {
      setIsExiting(true);
    }, STATUS_TOAST_VISIBLE_MS);
    const removeTimer = setTimeout(() => {
      setMessage(null);
      setIsExiting(false);
    }, STATUS_TOAST_VISIBLE_MS + STATUS_TOAST_EXIT_MS + 60);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [seq, message]);

  if (!message || typeof document === 'undefined') return null;

  const isWarning = toastType === 'warning';
  const isError = toastType === 'error';
  const isInfo = toastType === 'info';

  // Màu sắc thiết kế: khi lỗi thì ĐỎ RỰC RỠ rõ ràng
  const borderColor = isError ? '#fca5a5' : isWarning ? '#fed7aa' : isInfo ? '#bfdbfe' : '#bbf7d0';
  const borderLeftColor = isError ? '#dc2626' : isWarning ? '#f59e0b' : isInfo ? '#3b82f6' : '#16a34a';
  const titleColor = isError ? '#dc2626' : isWarning ? '#c2410c' : isInfo ? '#1d4ed8' : '#15803d';
  const textColor = isError ? '#991b1b' : isWarning ? '#9a3412' : isInfo ? '#1e40af' : '#166534';
  const bgColor = isError ? '#fef2f2' : isWarning ? '#fffbeb' : isInfo ? '#eff6ff' : '#ffffff';
  const closeColor = isError ? '#dc2626' : isWarning ? '#c2410c' : isInfo ? '#2563eb' : '#15803d';
  const progressBg = isError
    ? 'linear-gradient(90deg, #f87171, #dc2626)'
    : isWarning
    ? 'linear-gradient(90deg, #fcd34d, #f59e0b)'
    : isInfo
    ? 'linear-gradient(90deg, #60a5fa, #3b82f6)'
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
        borderLeft: `4px solid ${borderLeftColor}`,
        borderRadius: '10px',
        overflow: 'hidden',
        background: bgColor,
        color: textColor,
        boxShadow: isError
          ? '0 10px 25px rgba(220, 38, 38, 0.18), 0 4px 10px rgba(0, 0, 0, 0.05)'
          : '0 12px 32px rgba(15, 23, 42, 0.25), 0 2px 6px rgba(0, 0, 0, 0.08)',
        willChange: 'transform, opacity',
        animation: isExiting
          ? `accountStatusToastExit ${STATUS_TOAST_EXIT_MS}ms cubic-bezier(0.55, 0, 1, 0.45) forwards`
          : 'accountStatusToastEnter 620ms cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      {/* Icon trạng thái */}
      <div style={{ flexShrink: 0, marginTop: '1px' }}>
        {isError && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
        {isWarning && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        )}
        {!isError && !isWarning && !isInfo && (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
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
