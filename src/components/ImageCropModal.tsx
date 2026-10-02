import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  fileName: string;
  onClose: () => void;
  onConfirmCrop: (cropData: {
    croppedBlob: Blob;
    cropCoords: { x: number; y: number; width: number; height: number };
  }) => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onConfirmCrop,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Kích thước vùng crop vuông hiển thị trên modal
  const CROP_BOX_SIZE = 280;

  // Reset trạng thái khi đổi ảnh
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  // Xử lý zoom qua con lăn chuột
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setScale((prev) => Math.min(Math.max(prev * zoomFactor, 0.5), 4));
  };

  // Kéo di chuyển ảnh (Mouse)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Hỗ trợ Touch trên thiết bị di động (360px)
  const touchStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      touchStartRef.current = {
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    setPosition({
      x: e.touches[0].clientX - touchStartRef.current.x,
      y: e.touches[0].clientY - touchStartRef.current.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Cắt ảnh bằng HTML5 Canvas và xuất Blob + tọa độ
  const handleApplyCrop = () => {
    if (!imageRef.current) return;
    const img = imageRef.current;

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;

    // Chiều rộng & chiều cao hiển thị của ảnh trên màn hình sau zoom
    const displayedWidth = img.width * scale;
    const displayedHeight = img.height * scale;

    // Tỷ lệ giữa kích thước thật của ảnh so với kích thước render
    const ratioX = naturalWidth / displayedWidth;
    const ratioY = naturalHeight / displayedHeight;

    // Tọa độ tâm khung cắt cố định
    const cropBoxCenterX = CROP_BOX_SIZE / 2;
    const cropBoxCenterY = CROP_BOX_SIZE / 2;

    // Tọa độ tâm ảnh so với khung cắt
    const imgCenterX = CROP_BOX_SIZE / 2 + position.x;
    const imgCenterY = CROP_BOX_SIZE / 2 + position.y;

    // Tọa độ góc trên bên trái của khung cắt so với ảnh
    const cropLeftInRender = cropBoxCenterX - imgCenterX + displayedWidth / 2 - CROP_BOX_SIZE / 2;
    const cropTopInRender = cropBoxCenterY - imgCenterY + displayedHeight / 2 - CROP_BOX_SIZE / 2;

    // Quy đổi tọa độ sang kích thước gốc của ảnh (Natural coordinates)
    const naturalCropX = Math.max(0, Math.round(cropLeftInRender * ratioX));
    const naturalCropY = Math.max(0, Math.round(cropTopInRender * ratioY));
    const naturalCropSide = Math.min(
      Math.round(CROP_BOX_SIZE * ratioX),
      naturalWidth - naturalCropX,
      naturalHeight - naturalCropY
    );

    // Vẽ lên Canvas để tạo Blob chất lượng cao
    const canvas = document.createElement('canvas');
    const targetSide = Math.min(naturalCropSide, 600);
    canvas.width = targetSide;
    canvas.height = targetSide;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      img,
      naturalCropX,
      naturalCropY,
      naturalCropSide,
      naturalCropSide,
      0,
      0,
      targetSide,
      targetSide
    );

    canvas.toBlob(
      (blob) => {
        if (blob) {
          onConfirmCrop({
            croppedBlob: blob,
            cropCoords: {
              x: naturalCropX,
              y: naturalCropY,
              width: naturalCropSide,
              height: naturalCropSide,
            },
          });
        }
      },
      'image/jpeg',
      0.92
    );
  };

  if (!isOpen) return null;

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
        zIndex: 100001,
        padding: '16px',
        animation: 'fadeInCard 0.2s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Cắt ảnh đại diện
            </h3>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '3px 0 0 0' }}>
              Cố định tỷ lệ vuông 1:1. Kéo để căn chỉnh hoặc dùng thanh trượt để phóng to.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Khung cắt cố định tỷ lệ 1:1 có Grid lưới */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            position: 'relative',
            width: `${CROP_BOX_SIZE}px`,
            height: `${CROP_BOX_SIZE}px`,
            borderRadius: '16px',
            overflow: 'hidden',
            backgroundColor: '#0f172a',
            cursor: isDragging ? 'grabbing' : 'grab',
            boxShadow: 'inset 0 0 0 2px #3b82f6, 0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          {/* Ảnh được kéo và zoom */}
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Crop Preview"
            draggable={false}
            style={{
              maxWidth: 'none',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.05s ease',
              pointerEvents: 'none',
            }}
          />

          {/* Lưới Grid 3x3 cắt ảnh cố định tỷ lệ 1:1 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: '2px solid rgba(255, 255, 255, 0.9)',
              borderRadius: '14px',
              pointerEvents: 'none',
              boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
            }}
          >
            <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.4)' }} />
            <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.4)' }} />
            <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.4)' }} />
            <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.4)' }} />
          </div>
        </div>

        {/* Thanh điều khiển Zoom in / Zoom out */}
        <div style={{ width: '100%', marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>🔍 -</span>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            style={{
              flex: 1,
              accentColor: '#2563eb',
              cursor: 'pointer',
            }}
          />
          <span style={{ fontSize: '13px', color: '#64748b' }}>+ 🔎</span>
          <button
            type="button"
            onClick={() => {
              setScale(1);
              setPosition({ x: 0, y: 0 });
            }}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: '600',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#f8fafc',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Mặc định
          </button>
        </div>

        {/* Hàng nút Hành động: Xác nhận cắt & Hủy */}
        <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '20px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleApplyCrop}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
            }}
          >
            Xác nhận cắt ảnh
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
