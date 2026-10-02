import React, { useState, useEffect } from 'react';
import { preloadAvatarImage, isAvatarPreloaded, isAvatarFailed, AVATAR_UPDATED_EVENT } from '../utils/avatarCache';

interface SmoothAvatarProps {
  src?: string | null;
  fallbackText: string;
  size?: number;
  borderRadius?: string;
  bgGradient?: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Component Avatar chuẩn hoá hiệu năng cao:
 * 1. Image Preload: Sử dụng in-memory cache, nạp trước ảnh.
 * 2. Smooth Loading State: Spinner siêu nhẹ trong khi ảnh đang nạp.
 * 3. Graceful Error Fallback: Tự động lùi về chữ cái đầu nếu link 404/trống.
 * 4. Real-time Reactive: Lắng nghe sự kiện AVATAR_UPDATED_EVENT để cập nhật tức thì.
 */
export const SmoothAvatar: React.FC<SmoothAvatarProps> = ({
  src,
  fallbackText,
  size = 36,
  borderRadius = '50%',
  bgGradient = 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
  alt = 'Avatar',
  className = '',
  style = {},
}) => {
  const [currentSrc, setCurrentSrc] = useState<string | null | undefined>(src);
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'loaded' | 'error'>(() => {
    if (!src || !src.trim()) return 'error';
    if (isAvatarPreloaded(src)) return 'loaded';
    if (isAvatarFailed(src)) return 'error';
    return 'loading';
  });

  // Đồng bộ khi prop src thay đổi
  useEffect(() => {
    setCurrentSrc(src);
    if (!src || !src.trim()) {
      setLoadStatus('error');
      return;
    }

    if (isAvatarPreloaded(src)) {
      setLoadStatus('loaded');
      return;
    }

    if (isAvatarFailed(src)) {
      setLoadStatus('error');
      return;
    }

    setLoadStatus('loading');
    let isCurrent = true;

    preloadAvatarImage(src).then((success) => {
      if (!isCurrent) return;
      setLoadStatus(success ? 'loaded' : 'error');
    });

    return () => {
      isCurrent = false;
    };
  }, [src]);

  // Lắng nghe sự kiện đồng bộ Avatar real-time
  useEffect(() => {
    const handleAvatarUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ avatar_url?: string | null; avatar_thumbnail_url?: string | null }>;
      const nextUrl = customEvent.detail?.avatar_thumbnail_url || customEvent.detail?.avatar_url;
      if (nextUrl) {
        setCurrentSrc(nextUrl);
        setLoadStatus('loading');
        preloadAvatarImage(nextUrl).then((success) => {
          setLoadStatus(success ? 'loaded' : 'error');
        });
      }
    };

    window.addEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdate);
    return () => {
      window.removeEventListener(AVATAR_UPDATED_EVENT, handleAvatarUpdate);
    };
  }, []);

  const firstChar = (fallbackText || 'U').charAt(0).toUpperCase();

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius,
        background: loadStatus === 'loaded' ? '#f8fafc' : bgGradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontWeight: '700',
        fontSize: `${Math.round(size * 0.42)}px`,
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* 1. Trạng thái ĐÃ TẢI XONG: Hiển thị hình ảnh mượt mà */}
      {loadStatus === 'loaded' && currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            animation: 'fadeIn 0.15s ease',
          }}
          onError={() => setLoadStatus('error')}
        />
      )}

      {/* 2. Trạng thái ĐANG TẢI (Loading): Spinner nhẹ trên nền gradient và fallback chữ cái */}
      {loadStatus === 'loading' && (
        <>
          <span style={{ opacity: 0.7 }}>{firstChar}</span>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(15, 23, 42, 0.25)',
              backdropFilter: 'blur(1px)',
            }}
          >
            <div
              style={{
                width: `${Math.max(12, Math.round(size * 0.32))}px`,
                height: `${Math.max(12, Math.round(size * 0.32))}px`,
                border: '2px solid rgba(255, 255, 255, 0.4)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'avatarSpin 0.7s linear infinite',
              }}
            />
          </div>
        </>
      )}

      {/* 3. Trạng thái LỖI / TRỐNG: Fallback về chữ cái đầu hiển thị ngay lập tức */}
      {loadStatus === 'error' && (
        <span>{firstChar}</span>
      )}
    </div>
  );
};
