import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export const STATUS_TOAST_VISIBLE_MS = 5000; // Thời gian giữ thông báo trên màn hình
export const STATUS_TOAST_EXIT_MS = 460;     // BẮT BUỘC khớp với duration keyframes accountStatusToastExit

const STATUS_TOAST_EVENT = 'APP_STATUS_TOAST';

export interface StatusToastPayload {
  message: string;
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
      if (!d || !d.message) return;
      setMessage(d.message);
      setTitle(d.title ?? 'Thông báo hệ thống');
      setToastType(d.type ?? 'success');
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
    // Gỡ khỏi DOM SAU khi hiệu ứng trượt ra đã chạy xong hoàn toàn (tránh bị cắt cụt hiệu ứng)
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

  const borderColor = isWarning ? '#fed7aa' : isError ? '#fecaca' : isInfo ? '#bfdbfe' : '#bbf7d0';
  const borderLeftColor = isWarning ? '#f59e0b' : isError ? '#ef4444' : isInfo ? '#3b82f6' : '#16a34a';
  const textColor = isWarning ? '#9a3412' : isError ? '#991b1b' : isInfo ? '#1e40af' : '#166534';
  const titleColor = isWarning ? '#7c2d12' : isError ? '#7f1d1d' : isInfo ? '#1e3a8a' : '#15803d';
  const closeColor = isWarning ? '#c2410c' : isError ? '#b91c1c' : isInfo ? '#2563eb' : '#15803d';
  const progressBg = isWarning
    ? 'linear-gradient(90deg, #fcd34d, #f59e0b)'
    : isError
    ? 'linear-gradient(90deg, #f87171, #ef4444)'
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
        background: isError ? '#fef2f2' : isWarning ? '#fffbeb' : '#ffffff',
        color: textColor,
        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.25), 0 2px 6px rgba(0, 0, 0, 0.08)',
        willChange: 'transform, opacity',
        animation: isExiting
          ? `accountStatusToastExit ${STATUS_TOAST_EXIT_MS}ms cubic-bezier(0.55, 0, 1, 0.45) forwards`
          : 'accountStatusToastEnter 620ms cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '3px', color: titleColor }}>
          {title}
        </div>
        <div style={{ fontSize: '12.5px', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
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
        }}
      >
        ×
      </button>
      {/* Thanh tiến trình đếm ngược thời gian tự ẩn của thông báo */}
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
