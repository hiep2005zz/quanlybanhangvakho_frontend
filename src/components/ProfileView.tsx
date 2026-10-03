import React, { useState, useEffect, useRef } from 'react';
import { User, UserProfile, getMyProfileApi, updateMyProfileApi, uploadProfileAvatarApi, getAvatarUrl } from '../services/api';
import { emitStatusToast } from './StatusToast';

interface ProfileViewProps {
  currentUser: User;
  token: string;
  onBackToHome: () => void;
  onUserUpdated?: (updatedUser: User) => void;
}

// Regex chuẩn số điện thoại nhà mạng Việt Nam (10 số, đầu 03, 05, 07, 08, 09)
const VIETNAM_PHONE_REGEX = /^(0)(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;

const ROLE_COLOR_MAP: Record<string, string> = {
  admin: '#dc2626',
  sales_manager: '#2563eb',
  sales: '#0284c7',
  warehouse_mgr: '#d97706',
  warehouse_manager: '#d97706',
  kho: '#ea580c',
  warehouse: '#ea580c',
  ketoan: '#7c3aed',
  accountant: '#7c3aed',
  muahang: '#059669',
  purchasing: '#059669',
  customer: '#0284c7',
};

const ROLE_TITLE_MAP: Record<string, string> = {
  admin: 'Quản trị hệ thống (Admin)',
  sales_manager: 'Quản lý kinh doanh',
  sales: 'Nhân viên kinh doanh',
  warehouse_mgr: 'Quản lý kho',
  warehouse_manager: 'Quản lý kho',
  kho: 'Thủ kho',
  warehouse: 'Thủ kho',
  ketoan: 'Kế toán viên',
  accountant: 'Kế toán viên',
  muahang: 'Nhân viên mua hàng',
  purchasing: 'Nhân viên mua hàng',
  customer: 'Đại lý',
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  token,
  onBackToHome,
  onUserUpdated,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [fullNameInput, setFullNameInput] = useState(currentUser.full_name || '');
  const [phoneInput, setPhoneInput] = useState(currentUser.phone || currentUser.phone_number || '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Avatar upload & resize states
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal chỉnh kích thước & vùng cắt ảnh đại diện (Interactive Square Cropper)
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [rawImageFileName, setRawImageFileName] = useState('avatar.png');
  const [rawImageMime, setRawImageMime] = useState('image/png');
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);

  // Vùng cắt vuông (Crop Box) trên không gian ảnh hiển thị (DISPLAY CONTAINER: max 380x380)
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, size: 200 });
  const [displayedImgSize, setDisplayedImgSize] = useState({ width: 300, height: 300 });

  // Tương tác kéo khung (move) hoặc kéo góc đổi kích thước (resize)
  const [dragAction, setDragAction] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | null>(null);
  const dragInfoRef = useRef({ startX: 0, startY: 0, initialBox: { x: 0, y: 0, size: 200 } });

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input để có thể chọn lại cùng 1 file nếu muốn
    e.target.value = '';

    setAvatarError(null);
    setErrorMsg(null);

    // 1. Kiểm tra định dạng (JPG, PNG)
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const lowerName = file.name.toLowerCase();
    const isExtensionValid = validExtensions.some((ext) => lowerName.endsWith(ext));
    const isMimeValid = file.type === 'image/jpeg' || file.type === 'image/png';

    if (!isExtensionValid || !isMimeValid) {
      const err = 'Định dạng ảnh không hợp lệ. Chỉ chấp nhận tệp JPG hoặc PNG.';
      setAvatarError(err);
      emitStatusToast({ message: err, title: 'Ảnh đại diện' });
      return;
    }

    // 2. Kiểm tra dung lượng tối đa 10MB cho ảnh gốc trước khi crop
    const MAX_RAW_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_RAW_SIZE) {
      const err = `Dung lượng tệp (${(file.size / (1024 * 1024)).toFixed(1)}MB) vượt quá mức cho phép tối đa 10MB.`;
      setAvatarError(err);
      emitStatusToast({ message: err, title: 'Ảnh đại diện' });
      return;
    }

    if (file.size === 0) {
      const err = 'Tệp hình ảnh rỗng hoặc bị lỗi.';
      setAvatarError(err);
      emitStatusToast({ message: err, title: 'Ảnh đại diện' });
      return;
    }

    // Đọc ảnh và khởi tạo kích thước khung cắt vuông
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const testImg = new Image();
      testImg.onload = () => {
        const natW = testImg.naturalWidth || testImg.width || 400;
        const natH = testImg.naturalHeight || testImg.height || 400;
        setNaturalWidth(natW);
        setNaturalHeight(natH);

        // Khung container hiển thị tối đa là 380px x 380px
        const MAX_BOX = 380;
        let dispW = MAX_BOX;
        let dispH = MAX_BOX;
        if (natW > natH) {
          dispH = (natH / natW) * MAX_BOX;
        } else {
          dispW = (natW / natH) * MAX_BOX;
        }
        setDisplayedImgSize({ width: dispW, height: dispH });

        // Khởi tạo khung vuông crop nằm chính giữa bức ảnh
        const initialCropSize = Math.min(dispW, dispH) * 0.85;
        setCropBox({
          x: (dispW - initialCropSize) / 2,
          y: (dispH - initialCropSize) / 2,
          size: initialCropSize,
        });

        setRawImageSrc(result);
        setRawImageFileName(file.name);
        setRawImageMime(file.type || 'image/png');
        setCropModalOpen(true);
      };
      testImg.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Xác nhận cắt và upload ảnh vuông tự chọn
  const handleConfirmCropAndUpload = async () => {
    if (!rawImageSrc) return;
    setUploadingAvatar(true);

    try {
      // Dùng HTML Canvas để trích xuất chính xác vùng vuông được người dùng chọn
      const canvas = document.createElement('canvas');
      const TARGET_OUTPUT = 500; // Kích thước chuẩn sắc nét
      canvas.width = TARGET_OUTPUT;
      canvas.height = TARGET_OUTPUT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Không thể khởi tạo bộ xử lý hình ảnh.');

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = rawImageSrc;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Không thể tải hình ảnh.'));
      });

      // Quy đổi tọa độ từ khung hiển thị sang kích thước ảnh gốc thực tế
      const scaleX = naturalWidth / displayedImgSize.width;
      const scaleY = naturalHeight / displayedImgSize.height;

      const sourceX = cropBox.x * scaleX;
      const sourceY = cropBox.y * scaleY;
      const sourceSize = cropBox.size * scaleX;

      // Tô nền trắng đề phòng ảnh trong suốt PNG/JPG
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, TARGET_OUTPUT, TARGET_OUTPUT);

      // Cắt đúng vùng vuông người dùng định vị
      ctx.drawImage(
        img,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        TARGET_OUTPUT,
        TARGET_OUTPUT
      );

      // Chuyển đổi thành blob file
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), rawImageMime === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.95);
      });

      if (!blob) throw new Error('Lỗi xuất dữ liệu hình ảnh.');

      const finalFile = new File([blob], rawImageFileName, { type: blob.type });

      // Gọi API tải ảnh lên server
      const res = await uploadProfileAvatarApi(token, finalFile);
      setProfile(res.user);
      emitStatusToast({ message: 'Cắt và cập nhật ảnh đại diện thành công!', title: 'Hồ sơ cá nhân' });

      // Cập nhật State người dùng toàn cục
      if (onUserUpdated) {
        onUserUpdated({
          ...currentUser,
          avatar_url: res.avatar_url,
          full_name: res.user.full_name || currentUser.full_name,
        });
      }

      // Phát sự kiện đồng bộ toàn hệ thống
      window.dispatchEvent(new CustomEvent('USER_ROLE_UPDATED', { detail: res.user }));
      window.dispatchEvent(new CustomEvent('USER_ACCOUNTS_CHANGED', { detail: res.user }));

      setCropModalOpen(false);
      setRawImageSrc(null);
    } catch (err: any) {
      const msg = err.message || 'Lỗi khi tải ảnh đại diện lên máy chủ.';
      setAvatarError(msg);
      emitStatusToast({ message: msg, title: 'Ảnh đại diện' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Tải dữ liệu hồ sơ mới nhất từ API /api/v1/me
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    getMyProfileApi(token)
      .then((data) => {
        if (!isMounted) return;
        setProfile(data);
        setFullNameInput(data.full_name || '');
        setPhoneInput(data.phone_number || data.phone || '');
        setLoading(false);

        // Tự động đồng bộ ngược lại cho currentUser của toàn ứng dụng nếu có thông tin mới
        if (onUserUpdated && data) {
          onUserUpdated({
            ...currentUser,
            id: data.id,
            full_name: data.full_name,
            email: data.email,
            phone: data.phone_number || data.phone || undefined,
            phone_number: data.phone_number || data.phone || undefined,
            role: data.role,
            roles: data.roles,
            role_title: data.role_title,
            branch: data.branch || currentUser.branch,
            warehouse_name: data.warehouse_name,
            territory_name: data.territory_name,
            avatar_url: data.avatar_url,
          });
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Failed to load profile:', err);
        setErrorMsg(err.message || 'Không thể tải thông tin hồ sơ.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Lắng nghe sự kiện cập nhật vai trò từ Admin (Realtime / Broadcast / Cross-tab)
  useEffect(() => {
    let isMounted = true;
    const fetchLatestProfile = () => {
      getMyProfileApi(token)
        .then((data) => {
          if (!isMounted) return;
          setProfile(data);
          setFullNameInput(data.full_name || '');
          setPhoneInput(data.phone_number || data.phone || '');
          if (onUserUpdated && data) {
            onUserUpdated({
              ...currentUser,
              id: data.id,
              full_name: data.full_name,
              email: data.email,
              phone: data.phone_number || data.phone || undefined,
              phone_number: data.phone_number || data.phone || undefined,
              role: data.role,
              roles: data.roles,
              role_title: data.role_title,
              branch: data.branch || currentUser.branch,
              warehouse_name: data.warehouse_name,
              territory_name: data.territory_name,
              avatar_url: data.avatar_url,
            });
          }
        })
        .catch(() => {});
    };

    window.addEventListener('USER_ROLE_UPDATED', fetchLatestProfile);
    window.addEventListener('USER_ACCOUNTS_CHANGED', fetchLatestProfile);
    return () => {
      isMounted = false;
      window.removeEventListener('USER_ROLE_UPDATED', fetchLatestProfile);
      window.removeEventListener('USER_ACCOUNTS_CHANGED', fetchLatestProfile);
    };
  }, [token]);

  // Đồng bộ ngay khi props currentUser thay đổi vai trò
  useEffect(() => {
    if (currentUser) {
      setFullNameInput(currentUser.full_name || '');
      setPhoneInput(currentUser.phone || currentUser.phone_number || '');
    }
  }, [currentUser?.role, currentUser?.roles?.join(','), currentUser?.full_name]);

  // Kiểm tra tính hợp lệ của số điện thoại
  const validatePhone = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setPhoneError('Vui lòng nhập số điện thoại liên hệ.');
      return false;
    }
    if (!VIETNAM_PHONE_REGEX.test(trimmed)) {
      setPhoneError('Số điện thoại không đúng định dạng nhà mạng Việt Nam (yêu cầu 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09).');
      return false;
    }
    setPhoneError(null);
    return true;
  };

  // Kiểm tra họ tên
  const validateName = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setNameError('Họ và tên không được để trống.');
      return false;
    }
    setNameError(null);
    return true;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPhoneInput(val);
    if (phoneError) {
      validatePhone(val);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFullNameInput(val);
    if (nameError) {
      validateName(val);
    }
  };

  // Xử lý gửi cập nhật hồ sơ
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const isNameValid = validateName(fullNameInput);
    const isPhoneValid = validatePhone(phoneInput);

    if (!isNameValid || !isPhoneValid) {
      return;
    }

    setSaving(true);
    try {
      const updated = await updateMyProfileApi(token, {
        full_name: fullNameInput.trim(),
        phone_number: phoneInput.trim(),
      });

      setProfile(updated);
      setFullNameInput(updated.full_name);
      setPhoneInput(updated.phone_number || updated.phone || '');
      emitStatusToast({ message: 'Cập nhật hồ sơ thành công', title: 'Hồ sơ cá nhân' });

      // Cập nhật State người dùng ngay lập tức cho ứng dụng để Avatar/Header đổi tên
      if (onUserUpdated) {
        onUserUpdated({
          ...currentUser,
          id: updated.id,
          full_name: updated.full_name,
          phone: updated.phone_number || updated.phone || undefined,
          phone_number: updated.phone_number || updated.phone || undefined,
          email: updated.email,
          branch: updated.branch || currentUser.branch,
          warehouse_name: updated.warehouse_name,
          territory_name: updated.territory_name,
          avatar_url: updated.avatar_url ?? currentUser.avatar_url,
        });
      }

      // Tự động chuyển hướng về trang chủ làm việc
      onBackToHome();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi cập nhật hồ sơ cá nhân.');
    } finally {
      setSaving(false);
    }
  };

  // Nút Hủy: khôi phục về giá trị đã lưu
  const handleReset = () => {
    if (profile) {
      setFullNameInput(profile.full_name || '');
      setPhoneInput(profile.phone_number || profile.phone || '');
    } else {
      setFullNameInput(currentUser.full_name || '');
      setPhoneInput(currentUser.phone || currentUser.phone_number || '');
    }
    setNameError(null);
    setPhoneError(null);
    setErrorMsg(null);
    onBackToHome();
  };

  const primaryRole = profile?.role || currentUser.role;
  const isBranchAssigned = Boolean((profile?.branch || currentUser.branch) && (profile?.branch || currentUser.branch) !== 'Chưa phân công');
  const getRoleTitle = (r: string) => {
    if (r === 'customer') {
      return isBranchAssigned ? 'Đại lý' : 'Chưa phân quyền';
    }
    return ROLE_TITLE_MAP[r] || r;
  };
  const roleColor = primaryRole === 'customer' && !isBranchAssigned ? '#94a3b8' : (ROLE_COLOR_MAP[primaryRole] || '#64748b');
  const roleTitle = getRoleTitle(primaryRole);

  return (
    <main style={{ padding: '24px 32px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px',
          color: '#64748b',
          fontWeight: '500',
          marginBottom: '20px',
          padding: '2px 4px',
        }}
      >
        <button
          onClick={onBackToHome}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            color: '#2563eb',
            cursor: 'pointer',
            padding: '5px 14px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2563eb';
            e.currentTarget.style.background = '#eff6ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.background = '#ffffff';
          }}
        >
          <span>Trang chủ</span>
        </button>
        <span style={{ color: '#cbd5e1', fontSize: '14px' }}>/</span>
        <span style={{ color: '#0f172a', fontWeight: '600', fontSize: '13.5px' }}>Hồ sơ cá nhân</span>
      </nav>

      {/* Hero Banner Header */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '20px',
          padding: '28px',
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Avatar Box & Upload Trigger */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div
              onClick={() => {
                if (!uploadingAvatar) fileInputRef.current?.click();
              }}
              style={{
                width: '84px',
                height: '84px',
                borderRadius: '20px',
                background: (profile?.avatar_url || currentUser.avatar_url)
                  ? '#f1f5f9'
                  : `linear-gradient(135deg, ${roleColor} 0%, #4f46e5 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontSize: '32px',
                fontWeight: '800',
                boxShadow: `0 8px 20px ${roleColor}30`,
                flexShrink: 0,
                overflow: 'hidden',
                border: '3px solid #ffffff',
                position: 'relative',
                cursor: uploadingAvatar ? 'wait' : 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              }}
              title="Nhấn để đổi ảnh đại diện (JPG/PNG tối đa 2MB)"
            >
              {(profile?.avatar_url || currentUser.avatar_url) ? (
                <img
                  src={getAvatarUrl(profile?.avatar_url || currentUser.avatar_url)}
                  alt={fullNameInput || currentUser.full_name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <span>{(fullNameInput || currentUser.username).charAt(0).toUpperCase()}</span>
              )}

              {/* Loading spinner overlay */}
              {uploadingAvatar && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.7)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '600',
                    zIndex: 4,
                  }}
                >
                  <span style={{ fontSize: '18px' }}>⏳</span>
                </div>
              )}
            </div>

            {/* Nút camera nhỏ ở góc dưới avatar */}
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '28px',
                height: '28px',
                minWidth: '28px',
                minHeight: '28px',
                maxWidth: '28px',
                maxHeight: '28px',
                padding: 0,
                borderRadius: '50%',
                background: '#2563eb',
                border: '2px solid #ffffff',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                transition: 'background-color 0.15s ease',
                zIndex: 5,
              }}
              title="Tải lên ảnh đại diện mới"
              aria-label="Tải lên ảnh đại diện"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block', flexShrink: 0 }}
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>

            {/* Input file ẩn */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              style={{ display: 'none' }}
              onChange={handleAvatarFileSelect}
            />
          </div>

          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
              {fullNameInput || currentUser.full_name}
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onBackToHome}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            Quay lại
          </button>
        </div>
      </div>

      {/* Thông báo lỗi */}
      {errorMsg && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '14px 20px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Thông báo lỗi tải ảnh đại diện */}
      {avatarError && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '14px 20px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <span>⚠️ {avatarError}</span>
        </div>
      )}

      {/* Nội dung Form hồ sơ */}
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '24px',
            marginBottom: '24px',
          }}
        >
          {/* Card 1: Thông tin hệ thống (Chỉ xem - Disabled / Read-only) */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                Thông tin hệ thống
              </h3>
            </div>

            {/* Tên đăng nhập (Read-only) */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Tên đăng nhập
              </label>
              <input
                type="text"
                disabled
                value={currentUser.username}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  fontSize: '13.5px',
                  fontFamily: 'ui-monospace, monospace',
                  fontWeight: '600',
                  cursor: 'not-allowed',
                }}
              />
            </div>

            {/* Email (Read-only) */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Địa chỉ Email
              </label>
              <input
                type="text"
                disabled
                value={profile?.email || currentUser.email || (loading ? 'Đang tải...' : 'Chưa thiết lập')}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  fontSize: '13.5px',
                  cursor: 'not-allowed',
                }}
              />
            </div>

            {/* Vai trò trong hệ thống (Badge hiển thị) */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Vai trò phân quyền
              </label>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span
                  style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: `${roleColor}15`,
                    color: roleColor,
                    fontSize: '12.5px',
                    fontWeight: '700',
                    border: `1px solid ${roleColor}30`,
                  }}
                >
                  {roleTitle}
                </span>
              </div>
            </div>

            {/* Kho / Địa bàn phụ trách */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
                Kho / Khu vực phụ trách
              </label>
              <input
                type="text"
                disabled
                value={profile?.warehouse_name || profile?.territory_name || profile?.branch || currentUser.branch || 'Kho Tổng Hà Nội'}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#334155',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'not-allowed',
                }}
              />
            </div>

            <div
              style={{
                marginTop: 'auto',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '10px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#166534',
                lineHeight: '1.5',
              }}
            >
              Các thông tin phân quyền và chi nhánh làm việc do Quản trị viên quản lý. Vui lòng liên hệ Admin nếu cần điều chỉnh.
            </div>
          </div>

          {/* Card 2: Thông tin cá nhân có thể chỉnh sửa */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                Chỉnh sửa thông tin
              </h3>
            </div>

            {/* Họ và tên */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Họ và tên <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Nhập họ và tên đầy đủ..."
                value={fullNameInput}
                onChange={handleNameChange}
                onBlur={() => validateName(fullNameInput)}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${nameError ? '#ef4444' : '#cbd5e1'}`,
                  fontSize: '14px',
                  color: '#0f172a',
                  fontWeight: '500',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => {
                  if (!nameError) e.target.style.borderColor = '#2563eb';
                }}
                onBlurCapture={(e) => {
                  if (!nameError) e.target.style.borderColor = '#cbd5e1';
                }}
              />
              {nameError && (
                <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#dc2626', fontWeight: '500' }}>
                  {nameError}
                </p>
              )}
            </div>

            {/* Số điện thoại */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Số điện thoại liên lạc <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="Ví dụ: 0912345678, 0389123456..."
                value={phoneInput}
                onChange={handlePhoneChange}
                onBlur={() => validatePhone(phoneInput)}
                maxLength={11}
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${phoneError ? '#ef4444' : '#cbd5e1'}`,
                  fontSize: '14px',
                  color: '#0f172a',
                  fontWeight: '500',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => {
                  if (!phoneError) e.target.style.borderColor = '#2563eb';
                }}
                onBlurCapture={(e) => {
                  if (!phoneError) e.target.style.borderColor = '#cbd5e1';
                }}
              />
              {phoneError ? (
                <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#dc2626', fontWeight: '500' }}>
                  {phoneError}
                </p>
              ) : (
                <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#64748b' }}>
                  Yêu cầu 10 chữ số, đúng đầu số nhà mạng VN (03x, 05x, 07x, 08x, 09x).
                </p>
              )}
            </div>

            {/* Hộp bảo mật an toàn */}
            <div
              style={{
                marginTop: 'auto',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px',
                fontSize: '12.5px',
                color: '#475569',
              }}
            >
              Hệ thống đảm bảo bảo mật thông tin liên lạc cá nhân theo tiêu chuẩn kiểm toán hệ thống.
            </div>
          </div>
        </div>

        {/* Nút hành động Lưu & Hủy */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '16px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            style={{
              padding: '10px 22px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.backgroundColor = '#f1f5f9';
            }}
            onMouseLeave={(e) => {
              if (!saving) e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            Hủy
          </button>

          <button
            type="submit"
            disabled={saving || loading}
            style={{
              padding: '10px 26px',
              borderRadius: '10px',
              border: 'none',
              background: saving ? '#93c5fd' : '#2563eb',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: saving || loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (!saving && !loading) e.currentTarget.style.backgroundColor = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              if (!saving && !loading) e.currentTarget.style.backgroundColor = '#2563eb';
            }}
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>

      {/* Modal Cắt ảnh vuông tự chọn (Interactive Square Cropper) */}
      {cropModalOpen && rawImageSrc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onMouseMove={(e) => {
            if (!dragAction) return;
            const dx = e.clientX - dragInfoRef.current.startX;
            const dy = e.clientY - dragInfoRef.current.startY;
            const { initialBox } = dragInfoRef.current;
            const maxW = displayedImgSize.width;
            const maxH = displayedImgSize.height;

            if (dragAction === 'move') {
              const newX = Math.max(0, Math.min(maxW - initialBox.size, initialBox.x + dx));
              const newY = Math.max(0, Math.min(maxH - initialBox.size, initialBox.y + dy));
              setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
            } else if (dragAction === 'se') {
              // Kéo góc dưới phải để đổi kích thước vuông
              const delta = Math.max(dx, dy);
              const maxSize = Math.min(maxW - initialBox.x, maxH - initialBox.y);
              const newSize = Math.max(60, Math.min(maxSize, initialBox.size + delta));
              setCropBox((prev) => ({ ...prev, size: newSize }));
            } else if (dragAction === 'nw') {
              // Kéo góc trên trái
              const delta = Math.min(dx, dy);
              const proposedSize = initialBox.size - delta;
              const newSize = Math.max(60, Math.min(initialBox.x + initialBox.size, initialBox.y + initialBox.size, proposedSize));
              const newX = initialBox.x + (initialBox.size - newSize);
              const newY = initialBox.y + (initialBox.size - newSize);
              setCropBox({ x: newX, y: newY, size: newSize });
            }
          }}
          onMouseUp={() => setDragAction(null)}
          onMouseLeave={() => setDragAction(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Cắt ảnh vuông đại diện
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  Kéo khung vuông hoặc thanh kích thước để chọn vùng ảnh bạn muốn
                </p>
              </div>
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => {
                  setCropModalOpen(false);
                  setRawImageSrc(null);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '22px',
                  cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                  color: '#94a3b8',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>

            {/* Khung hiển thị ảnh và vùng chọn vuông */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#0f172a',
                borderRadius: '14px',
                padding: '12px',
                userSelect: 'none',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: `${displayedImgSize.width}px`,
                  height: `${displayedImgSize.height}px`,
                }}
              >
                {/* Ảnh nền */}
                <img
                  src={rawImageSrc}
                  alt="Ảnh gốc"
                  draggable={false}
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'block',
                    pointerEvents: 'none',
                    opacity: 0.5,
                  }}
                />

                {/* Khung cắt vuông sáng rõ */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${cropBox.x}px`,
                    top: `${cropBox.y}px`,
                    width: `${cropBox.size}px`,
                    height: `${cropBox.size}px`,
                    border: '2px solid #38bdf8',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)',
                    cursor: dragAction === 'move' ? 'grabbing' : 'grab',
                    overflow: 'hidden',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDragAction('move');
                    dragInfoRef.current = {
                      startX: e.clientX,
                      startY: e.clientY,
                      initialBox: { ...cropBox },
                    };
                  }}
                >
                  {/* Bản hiển thị 100% độ sáng bên trong khung vuông */}
                  <img
                    src={rawImageSrc}
                    alt="Vùng cắt"
                    draggable={false}
                    style={{
                      position: 'absolute',
                      left: `-${cropBox.x}px`,
                      top: `-${cropBox.y}px`,
                      width: `${displayedImgSize.width}px`,
                      height: `${displayedImgSize.height}px`,
                      display: 'block',
                      pointerEvents: 'none',
                      maxWidth: 'none',
                    }}
                  />

                  {/* Vòng tròn mờ mô phỏng hình đại diện khi hiển thị */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: '1px dashed rgba(255, 255, 255, 0.85)',
                      pointerEvents: 'none',
                      boxShadow: 'inset 0 0 10px rgba(0,0,0,0.2)',
                    }}
                  />

                  {/* Tay cầm co giãn góc dưới phải (SE corner) */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDragAction('se');
                      dragInfoRef.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        initialBox: { ...cropBox },
                      };
                    }}
                    style={{
                      position: 'absolute',
                      right: '-1px',
                      bottom: '-1px',
                      width: '18px',
                      height: '18px',
                      background: '#38bdf8',
                      border: '2px solid #ffffff',
                      borderRadius: '2px',
                      cursor: 'se-resize',
                      zIndex: 10,
                    }}
                    title="Kéo để thay đổi kích thước khung cắt"
                  />

                  {/* Tay cầm co giãn góc trên trái (NW corner) */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDragAction('nw');
                      dragInfoRef.current = {
                        startX: e.clientX,
                        startY: e.clientY,
                        initialBox: { ...cropBox },
                      };
                    }}
                    style={{
                      position: 'absolute',
                      left: '-1px',
                      top: '-1px',
                      width: '18px',
                      height: '18px',
                      background: '#38bdf8',
                      border: '2px solid #ffffff',
                      borderRadius: '2px',
                      cursor: 'nw-resize',
                      zIndex: 10,
                    }}
                    title="Kéo để thay đổi kích thước khung cắt"
                  />
                </div>
              </div>
            </div>

            {/* Điều khiển kích thước vùng vuông (Crop Size Slider) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: '600', color: '#334155' }}>
                <span>Kích thước vùng cắt</span>
                <span>{Math.round(cropBox.size)} px</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const newSize = Math.max(60, cropBox.size - 20);
                    setCropBox((prev) => ({
                      ...prev,
                      size: newSize,
                    }));
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#334155',
                  }}
                  title="Thu nhỏ vùng vuông"
                >
                  -
                </button>
                <input
                  type="range"
                  min="60"
                  max={Math.min(displayedImgSize.width, displayedImgSize.height)}
                  step="2"
                  value={cropBox.size}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const maxX = displayedImgSize.width - val;
                    const maxY = displayedImgSize.height - val;
                    setCropBox((prev) => ({
                      size: val,
                      x: Math.min(prev.x, maxX),
                      y: Math.min(prev.y, maxY),
                    }));
                  }}
                  style={{
                    flex: 1,
                    cursor: 'pointer',
                    accentColor: '#0284c7',
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const maxSize = Math.min(
                      displayedImgSize.width - cropBox.x,
                      displayedImgSize.height - cropBox.y,
                      Math.min(displayedImgSize.width, displayedImgSize.height)
                    );
                    const newSize = Math.min(maxSize, cropBox.size + 20);
                    setCropBox((prev) => ({
                      ...prev,
                      size: newSize,
                    }));
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '700',
                    color: '#334155',
                  }}
                  title="Phóng to vùng vuông"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const initialCropSize = Math.min(displayedImgSize.width, displayedImgSize.height) * 0.85;
                    setCropBox({
                      x: (displayedImgSize.width - initialCropSize) / 2,
                      y: (displayedImgSize.height - initialCropSize) / 2,
                      size: initialCropSize,
                    });
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#475569',
                    whiteSpace: 'nowrap',
                  }}
                  title="Căn giữa vùng vuông"
                >
                  Căn giữa
                </button>
              </div>
            </div>

            {/* Các nút hành động */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => {
                  setCropModalOpen(false);
                  setRawImageSrc(null);
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={handleConfirmCropAndUpload}
                style={{
                  padding: '9px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: uploadingAvatar ? '#93c5fd' : '#2563eb',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: uploadingAvatar ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                }}
              >
                {uploadingAvatar ? 'Đang cắt ảnh...' : 'Cắt ảnh & Áp dụng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
