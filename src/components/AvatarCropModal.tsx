import React, { useState, useRef, useEffect } from 'react';

export interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onConfirmCrop: (cropData: { crop_x: number; crop_y: number; crop_width: number; crop_height: number }) => void;
  isUploading?: boolean;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onConfirmCrop,
  isUploading = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Vị trí và kích thước của crop box (tính theo pixel hiển thị trên màn hình)
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, size: 150 });
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0, initialSize: 0 });

  // Reset crop box khi load ảnh xong
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    setImgLayout({
      width: w,
      height: h,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    });

    const initialSize = Math.min(w, h) * 0.8;
    setCropBox({
      x: (w - initialSize) / 2,
      y: (h - initialSize) / 2,
      size: initialSize,
    });
  };

  // Kéo di chuyển vùng chọn
  const handleMouseDownDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setIsDragging(true);
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      initialX: cropBox.x,
      initialY: cropBox.y,
      initialSize: cropBox.size,
    };
  };

  // Co giãn vùng chọn (giữ cố định tỷ lệ 1:1)
  const handleMouseDownResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setIsResizing(true);
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      initialX: cropBox.x,
      initialY: cropBox.y,
      initialSize: cropBox.size,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging && !isResizing) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const deltaX = clientX - dragStartRef.current.mouseX;
      const deltaY = clientY - dragStartRef.current.mouseY;

      if (isDragging) {
        let newX = dragStartRef.current.initialX + deltaX;
        let newY = dragStartRef.current.initialY + deltaY;

        // Giới hạn trong kích thước ảnh hiển thị
        newX = Math.max(0, Math.min(newX, imgLayout.width - cropBox.size));
        newY = Math.max(0, Math.min(newY, imgLayout.height - cropBox.size));

        setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
      } else if (isResizing) {
        // Tỷ lệ vuông 1:1: lấy delta lớn nhất giữa X và Y
        const delta = Math.max(deltaX, deltaY);
        let newSize = dragStartRef.current.initialSize + delta;
        const minSize = 40;
        const maxSize = Math.min(imgLayout.width - cropBox.x, imgLayout.height - cropBox.y);

        newSize = Math.max(minSize, Math.min(newSize, maxSize));
        setCropBox((prev) => ({ ...prev, size: newSize }));
      }
    };

    const handleUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging, isResizing, imgLayout, cropBox.size, cropBox.x, cropBox.y]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (!imgLayout.width || !imgLayout.height || !imgLayout.naturalWidth) return;

    // Chuyển đổi tọa độ từ pixel hiển thị sang pixel gốc của ảnh
    const scaleX = imgLayout.naturalWidth / imgLayout.width;
    const scaleY = imgLayout.naturalHeight / imgLayout.height;

    const realCrop = {
      crop_x: Math.round(cropBox.x * scaleX),
      crop_y: Math.round(cropBox.y * scaleY),
      crop_width: Math.round(cropBox.size * scaleX),
      crop_height: Math.round(cropBox.size * scaleY),
    };

    onConfirmCrop(realCrop);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '16px',
        animation: 'fadeInCard 0.2s ease-out',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '460px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '16.5px', fontWeight: '700', color: '#0f172a' }}>
              Cắt ảnh đại diện
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Cố định tỷ lệ vuông 1:1 · Kéo khung hoặc góc dưới để chỉnh vùng
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Image & Crop Viewport */}
        <div
          style={{
            padding: '20px',
            background: '#090d16',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '280px',
            maxHeight: '380px',
            overflow: 'hidden',
            userSelect: 'none',
          }}
        >
          <div
            ref={containerRef}
            style={{
              position: 'relative',
              display: 'inline-block',
              maxWidth: '100%',
              maxHeight: '340px',
            }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop target"
              onLoad={handleImageLoad}
              style={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: '340px',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
            />

            {/* Lớp phủ tối mờ ngoài vùng crop */}
            {imgLayout.width > 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.55)',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Khung cắt tỷ lệ 1:1 với Grid lưới 3x3 và tay cầm co giãn */}
            {imgLayout.width > 0 && (
              <div
                onMouseDown={handleMouseDownDrag}
                onTouchStart={handleMouseDownDrag}
                style={{
                  position: 'absolute',
                  left: `${cropBox.x}px`,
                  top: `${cropBox.y}px`,
                  width: `${cropBox.size}px`,
                  height: `${cropBox.size}px`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                  border: '2px solid #3b82f6',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  boxSizing: 'border-box',
                }}
              >
                {/* Lưới Grid 3x3 */}
                <div
                  style={{
                    position: 'absolute',
                    top: '33.33%',
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: 'rgba(255, 255, 255, 0.45)',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '66.66%',
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: 'rgba(255, 255, 255, 0.45)',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '33.33%',
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    backgroundColor: 'rgba(255, 255, 255, 0.45)',
                    pointerEvents: 'none',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: '66.66%',
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    backgroundColor: 'rgba(255, 255, 255, 0.45)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Vòng tròn gợi ý xem trước Avatar */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    border: '1px dashed rgba(255, 255, 255, 0.65)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Tay cầm co giãn góc dưới bên phải (Resize Handle) */}
                <div
                  onMouseDown={handleMouseDownResize}
                  onTouchStart={handleMouseDownResize}
                  style={{
                    position: 'absolute',
                    right: '-7px',
                    bottom: '-7px',
                    width: '16px',
                    height: '16px',
                    backgroundColor: '#2563eb',
                    border: '2px solid #ffffff',
                    borderRadius: '3px',
                    cursor: 'nwse-resize',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    zIndex: 2,
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
            background: '#ffffff',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isUploading || imgLayout.width === 0}
            style={{
              padding: '9px 22px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: isUploading ? '#93c5fd' : '#2563eb',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: isUploading || imgLayout.width === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'background 0.15s ease',
            }}
          >
            {isUploading ? (
              <>
                <span
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid #ffffff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Đang xử lý & lưu...
              </>
            ) : (
              'Áp dụng & Lưu'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
