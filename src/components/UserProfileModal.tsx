import React, { useState, useRef } from 'react';
import { User, uploadAvatarApi, updateProfileApi } from '../services/api';
import ImageCropModal from './ImageCropModal';
import { emitStatusToast } from './StatusToast';
import { broadcastAvatarUpdate, preloadAvatarImage } from '../utils/avatarCache';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  token: string;
  onProfileUpdated: (updatedUser: User) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  token,
  onProfileUpdated,
}) => {
  const [fullName, setFullName] = useState(currentUser.full_name || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(currentUser.avatar_url || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Trạng thái cho Crop Modal & Xem ảnh
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>('');
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isViewingFullAvatar, setIsViewingFullAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Đóng avatar context menu khi click ra ngoài
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    if (isAvatarMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isAvatarMenuOpen]);

  if (!isOpen) return null;


  // Xử lý khi người dùng chọn file ảnh từ máy
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMessage(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // 1. AC-01: Kiểm tra định dạng đuôi tệp
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));
    const validMimes = ['image/jpeg', 'image/png', 'image/pjpeg'];
    const hasValidMime = validMimes.includes(file.type.toLowerCase());

    if (!hasValidExt || (!hasValidMime && file.type)) {
      setErrorMessage('Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh JPG/PNG.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. AC-02: Kiểm tra dung lượng tệp (<= 2MB = 2,097,152 bytes)
    const MAX_SIZE_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setErrorMessage('Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Mở khung cắt ảnh 1:1
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setSelectedImageSrc(reader.result as string);
        setSelectedFileName(file.name);
        setCropModalOpen(true);
      }
    };
    reader.readAsDataURL(file);

    // Reset input để có thể chọn lại cùng 1 file nếu muốn
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Xác nhận cắt ảnh từ CropModal và tiến hành tải lên Server
  const handleConfirmCrop = async ({
    croppedBlob,
    cropCoords,
  }: {
    croppedBlob: Blob;
    cropCoords: { x: number; y: number; width: number; height: number };
  }) => {
    setCropModalOpen(false);
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await uploadAvatarApi(token, croppedBlob, cropCoords);
      if (res.avatar_url) preloadAvatarImage(res.avatar_url);
      if (res.avatar_thumbnail_url) preloadAvatarImage(res.avatar_thumbnail_url);
      setCurrentAvatarUrl(res.avatar_url);
      onProfileUpdated(res.user);
      broadcastAvatarUpdate({
        avatar_url: res.avatar_url,
        avatar_thumbnail_url: res.avatar_thumbnail_url,
        username: currentUser.username,
      });
      emitStatusToast({
        title: 'Tải ảnh thành công',
        message: 'Ảnh đại diện đã được cập nhật đồng bộ.',
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi tải ảnh lên máy chủ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lưu thay đổi thông tin chung (Họ tên, SĐT)
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('Họ và tên không được để trống.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const updatedUser = await updateProfileApi(token, {
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      onProfileUpdated({
        ...updatedUser,
        avatar_url: currentAvatarUrl || updatedUser.avatar_url,
      });
      emitStatusToast({
        title: 'Cập nhật thành công',
        message: 'Thông tin hồ sơ cá nhân đã được lưu.',
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể cập nhật hồ sơ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '16px',
          animation: 'fadeInCard 0.2s ease-out',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Header Modal */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(to right, #f8fafc, #ffffff)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                👤
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                  Hồ sơ cá nhân
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Cập nhật thông tin & ảnh đại diện
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSaveProfile} style={{ padding: '24px' }}>
            {/* 1. VÙNG AVATAR PREVIEW & NÚT TẢI LÊN */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '24px',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '104px',
                  height: '104px',
                  borderRadius: '50%',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
                  border: '3px solid #ffffff',
                  outline: '2px solid #e2e8f0',
                  overflow: 'hidden',
                  backgroundColor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {currentAvatarUrl ? (
                  <img
                    src={currentAvatarUrl}
                    alt={currentUser.full_name || currentUser.username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: '#ffffff',
                    }}
                  >
                    <span style={{ fontSize: '32px', fontWeight: '800' }}>
                      {(currentUser.full_name || currentUser.username).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}

                {/* Upload / Context Trigger: Click vào Avatar mở Menu hoặc chọn ảnh */}
                <button
                  type="button"
                  onClick={() => setIsAvatarMenuOpen((prev) => !prev)}
                  disabled={isSubmitting}
                  title="Nhấp để xem hoặc đổi ảnh đại diện"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)',
                    opacity: isAvatarMenuOpen ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#ffffff',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={(e) => {
                    if (!isAvatarMenuOpen) e.currentTarget.style.opacity = '0';
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(0,0,0,0.65)',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}
                  >
                    📷
                  </div>
                </button>
              </div>

              {/* Context menu nhỏ khi click vào Avatar */}
              {isAvatarMenuOpen && (
                <div
                  ref={avatarMenuRef}
                  style={{
                    marginTop: '10px',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '6px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    zIndex: 20,
                    minWidth: '180px',
                    animation: 'fadeInCard 0.15s ease-out'
                  }}
                >
                  {currentAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAvatarMenuOpen(false);
                        setIsViewingFullAvatar(true);
                      }}
                      style={{
                        padding: '8px 12px',
                        background: '#f8fafc',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#0f172a',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                    >
                      <span>🔍</span> Xem ảnh đại diện
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    style={{
                      padding: '8px 12px',
                      background: '#eff6ff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#2563eb',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#dbeafe')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                  >
                    <span>📷</span> Đổi ảnh đại diện
                  </button>
                </div>
              )}

              {/* Input file ẩn */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>


            {/* Thông báo lỗi nếu có */}
            {errorMessage && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Các trường thông tin cơ bản */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  disabled
                  value={currentUser.username}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#64748b',
                    fontSize: '13.5px',
                    cursor: 'not-allowed',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  Họ và tên <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên"
                  required
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Nhập số điện thoại"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  Chi nhánh / Kho
                </label>
                <input
                  type="text"
                  disabled
                  value={currentUser.branch || 'Chưa phân công'}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#64748b',
                    fontSize: '13.5px',
                    cursor: 'not-allowed',
                  }}
                />
              </div>
            </div>

            {/* Action Row: Nút "Lưu thay đổi" và "Hủy" */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                }}
              >
                {isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Pop-up cắt ảnh cố định tỷ lệ vuông 1:1 */}
      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={selectedImageSrc}
        fileName={selectedFileName}
        onClose={() => setCropModalOpen(false)}
        onConfirmCrop={handleConfirmCrop}
      />

      {/* Pop-up Xem ảnh đại diện kích thước đầy đủ */}
      {isViewingFullAvatar && currentAvatarUrl && (
        <div
          onClick={() => setIsViewingFullAvatar(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100005,
            padding: '20px',
            animation: 'fadeInCard 0.2s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              maxWidth: '480px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() => setIsViewingFullAvatar(false)}
              style={{
                position: 'absolute',
                top: '-42px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: '#ffffff',
                fontSize: '20px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.4)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)')}
              title="Đóng"
            >
              ✕
            </button>
            <img
              src={currentAvatarUrl}
              alt="Ảnh đại diện đầy đủ"
              style={{
                width: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                border: '2px solid rgba(255, 255, 255, 0.2)',
              }}
            />
          </div>
        </div>
      )}
    </>

  );
};

export default UserProfileModal;
