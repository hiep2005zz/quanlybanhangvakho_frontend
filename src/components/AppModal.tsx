import React, { useEffect } from 'react';
import { ModalPortal } from './ModalPortal';

export interface AppModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string | number;
  maxHeight?: string | number;
  isLoading?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  className?: string;
  bodyStyle?: React.CSSProperties;
  headerStyle?: React.CSSProperties;
  footerStyle?: React.CSSProperties;
  contentStyle?: React.CSSProperties;
}

/**
 * AppModal: Base Modal chuẩn hóa cho toàn bộ hệ thống
 * - Mount trực tiếp vào document.body qua ModalPortal (tránh triệt để Header che z-index)
 * - maxHeight an toàn: calc(100vh - 48px) với margin: auto (chống tràn màn hình & kẹt scroll)
 * - Hỗ trợ Header đồng bộ icon X, Body cuộn độc lập và Footer cố định
 */
export const AppModal: React.FC<AppModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = '560px',
  maxHeight = 'calc(100vh - 48px)',
  isLoading = false,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  className = '',
  bodyStyle,
  headerStyle,
  footerStyle,
  contentStyle,
}) => {
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, isLoading, onClose]);

  if (!isOpen) return null;

  const resolvedMaxWidth = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  const resolvedMaxHeight = typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight;

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          padding: '24px 16px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && closeOnOverlayClick && !isLoading) {
            onClose();
          }
        }}
      >
        <div
          className={className}
          style={{
            width: '100%',
            maxWidth: resolvedMaxWidth,
            maxHeight: resolvedMaxHeight,
            margin: 'auto',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            color: '#0f172a',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeInModal 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            ...contentStyle,
          }}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 16px',
                borderBottom: '1px solid #f1f5f9',
                flexShrink: 0,
                ...headerStyle,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {icon && <div>{icon}</div>}
                <div>
                  {typeof title === 'string' ? (
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {subtitle && (
                    <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>

              {showCloseButton && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '18px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Đóng (Esc)"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Body Content */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              flex: 1,
              ...bodyStyle,
            }}
          >
            {children}
          </div>

          {/* Footer (nếu có) */}
          {footer && (
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #f1f5f9',
                background: '#fafbfc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '12px',
                flexShrink: 0,
                ...footerStyle,
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};

export default AppModal;
