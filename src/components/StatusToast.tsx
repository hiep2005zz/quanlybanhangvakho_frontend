// frontend/src/components/StatusToast.tsx
// ===== Thông báo nổi ở góc phải màn hình (dùng chung toàn hệ thống) =====
// Hiệu ứng: trượt ra từ mép phải màn hình -> dừng lại -> trượt ngược vào lại mép phải.
import React, { useEffect, useState } from 'react';

export const STATUS_TOAST_VISIBLE_MS = 5000; // Thời gian giữ thông báo trên màn hình
export const STATUS_TOAST_EXIT_MS = 460;     // BẮT BUỘC khớp với duration keyframes accountStatusToastExit

const STATUS_TOAST_EVENT = 'APP_STATUS_TOAST';

export interface StatusToastPayload {
  message: string;
  title?: string;
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
 * Chỉ cần mount MỘT lần duy nhất ở gốc giao diện đã đăng nhập (DashboardPage).
 */
export const StatusToastHost: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('Thông báo hệ thống');
  const [isExiting, setIsExiting] = useState<boolean>(false);
  // Số thứ tự thông báo: dùng làm "key" để buộc toast mount lại -> hiệu ứng trượt vào luôn phát lại
  const [seq, setSeq] = useState<number>(0);

  useEffect(() => {
    const handleToast = (e: Event) => {
      const d = (e as CustomEvent<StatusToastPayload>).detail;
      if (!d || !d.message) return;
      setMessage(d.message);
      setTitle(d.title ?? 'Thông báo hệ thống');
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

  if (!message) return null;

  return (
    <div
      key={seq}
      role="status"
      aria-live="polite"
      className={isExiting ? 'status-toast status-toast--exiting' : 'status-toast'}
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '20px',
        zIndex: 100000,
        width: 'min(340px, calc(100vw - 24px))',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '10px 12px',
        border: '1px solid #bbf7d0',
        borderLeft: '3px solid #16a34a',
        borderRadius: '10px',
        overflow: 'hidden',
        background: '#ffffff',
        color: '#166534',
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.16)',
        willChange: 'transform, opacity',
        animation: isExiting
          ? `accountStatusToastExit ${STATUS_TOAST_EXIT_MS}ms cubic-bezier(0.55, 0, 1, 0.45) forwards`
          : 'accountStatusToastEnter 620ms cubic-bezier(0.22, 1, 0.36, 1) both',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '2px' }}>
          {title}
        </div>
        <div style={{ fontSize: '12px', lineHeight: 1.45, overflowWrap: 'anywhere' }}>
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
          color: '#15803d',
          cursor: 'pointer',
          fontSize: '16px',
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
          background: 'linear-gradient(90deg, #34d399, #16a34a)',
          transformOrigin: 'left center',
          visibility: isExiting ? 'hidden' : 'visible',
          animation: `accountStatusToastProgress ${STATUS_TOAST_VISIBLE_MS}ms linear forwards`,
        }}
      />
    </div>
  );
};

export default StatusToastHost;
