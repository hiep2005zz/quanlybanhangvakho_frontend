import React, { useState, useEffect, useRef } from 'react';
import { User, UserProfile, getMyProfileApi, updateMyProfileApi, uploadAvatarApi } from '../services/api';
import { emitStatusToast } from './StatusToast';
import { AvatarCropModal } from './AvatarCropModal';

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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Avatar states
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [selectedImageSrc, setSelectedImageSrc] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isLightBoxOpen, setIsLightBoxOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [fullNameInput, setFullNameInput] = useState(currentUser.full_name || '');
  const [phoneInput, setPhoneInput] = useState(currentUser.phone || currentUser.phone_number || '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  // Xử lý chọn file ảnh từ máy (AC-01 & AC-02)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAvatarError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // 1. Kiểm tra định dạng đuôi tệp và mime type (JPG, PNG)
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const fileName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => fileName.endsWith(ext));
    const validMimes = ['image/jpeg', 'image/png', 'image/pjpeg'];
    const hasValidMime = validMimes.includes(file.type.toLowerCase());

    if (!hasValidExt || (!hasValidMime && file.type)) {
      setAvatarError('Định dạng tệp không hợp lệ. Chỉ chấp nhận ảnh JPG/PNG.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Kiểm tra dung lượng (<= 2MB = 2,097,152 bytes)
    const MAX_SIZE_BYTES = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE_BYTES) {
      setAvatarError('Dung lượng ảnh vượt quá 2MB. Vui lòng chọn ảnh nhỏ hơn.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);

    // Mở khung cắt ảnh 1:1
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setSelectedImageSrc(reader.result as string);
        setIsCropModalOpen(true);
        setIsLightBoxOpen(false);
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Xác nhận cắt ảnh và upload lên Server
  const handleConfirmCrop = async (cropData: {
    crop_x: number;
    crop_y: number;
    crop_width: number;
    crop_height: number;
  }) => {
    if (!selectedFile) return;

    setIsUploadingAvatar(true);
    setAvatarError(null);

    try {
      const coords = {
        x: cropData.crop_x,
        y: cropData.crop_y,
        width: cropData.crop_width,
        height: cropData.crop_height,
      };

      const res = await uploadAvatarApi(token, selectedFile, coords);

      // Cập nhật profile state
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              avatar_url: res.avatar_url,
              avatar_thumbnail_url: res.avatar_thumbnail_url,
            }
          : null
      );

      // Đồng bộ currentUser cho toàn ứng dụng
      if (onUserUpdated) {
        onUserUpdated({
          ...currentUser,
          avatar_url: res.avatar_url,
          avatar_thumbnail_url: res.avatar_thumbnail_url,
        });
      }

      emitStatusToast({
        title: 'Thành công',
        message: 'Cập nhật ảnh đại diện thành công.',
      });

      setIsCropModalOpen(false);
      setSelectedFile(null);
      setSelectedImageSrc('');
    } catch (err: any) {
      setAvatarError(err.message || 'Lỗi khi tải lên ảnh đại diện.');
    } finally {
      setIsUploadingAvatar(false);
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
    setSuccessMsg(null);

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
      setSuccessMsg('Cập nhật hồ sơ thành công');
      emitStatusToast({ message: 'Cập nhật hồ sơ thành công', title: 'Hồ sơ cá nhân' });

      // Tự động ẩn thông báo sau 4 giây
      setTimeout(() => {
        setSuccessMsg(null);
      }, 4000);

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
        });
      }
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
  const displayRoles = profile?.roles && profile.roles.length > 0 ? profile.roles : currentUser.roles || [primaryRole];

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

      {/* Banner thông báo lỗi nếu có khi tải ảnh */}
      {avatarError && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{avatarError}</span>
          <button
            type="button"
            onClick={() => setAvatarError(null)}
            style={{
              background: 'none',
              border: 'none',
              color: '#b91c1c',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>
      )}

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
          {/* Input file ẩn */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Avatar Preview Area: Khung tròn/vuông hiển thị ảnh hiện tại hoặc Placeholder icon + chữ cái đầu */}
          <div
            onClick={() => {
              const currentImg = profile?.avatar_url || currentUser.avatar_url;
              if (currentImg) {
                setIsLightBoxOpen(true);
              } else {
                fileInputRef.current?.click();
              }
            }}
            title={profile?.avatar_url || currentUser.avatar_url ? 'Xem ảnh lớn hoặc thay đổi ảnh đại diện' : 'Click để chọn ảnh đại diện'}
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '20px',
              background: (profile?.avatar_url || currentUser.avatar_url)
                ? '#f8fafc'
                : `linear-gradient(135deg, ${roleColor} 0%, #4f46e5 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '28px',
              fontWeight: '800',
              boxShadow: `0 8px 20px ${roleColor}35`,
              flexShrink: 0,
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
              border: (profile?.avatar_url || currentUser.avatar_url) ? '2px solid #e2e8f0' : 'none',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.04)';
              const overlay = e.currentTarget.querySelector('.avatar-hover-overlay') as HTMLElement;
              if (overlay) overlay.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              const overlay = e.currentTarget.querySelector('.avatar-hover-overlay') as HTMLElement;
              if (overlay) overlay.style.opacity = '0';
            }}
          >
            {(profile?.avatar_url || currentUser.avatar_url) ? (
              <img
                src={profile?.avatar_url || currentUser.avatar_url || ''}
                alt={fullNameInput || currentUser.username}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : (
              (fullNameInput || currentUser.username).charAt(0).toUpperCase()
            )}

            {/* Upload Button: Icon Máy ảnh đè lên vùng Preview khi hover */}
            <div
              className="avatar-hover-overlay"
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s ease',
                color: '#ffffff',
              }}
            >
              {(profile?.avatar_url || currentUser.avatar_url) ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              )}
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
                {fullNameInput || currentUser.full_name}
              </h1>
              <span
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  background: '#f1f5f9',
                  color: '#475569',
                  fontSize: '12px',
                  fontWeight: '600',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                }}
              >
                @{currentUser.username}
              </span>
              {(profile?.email || currentUser.email) && (
                <span
                  style={{
                    color: '#475569',
                    fontSize: '12.5px',
                    fontWeight: '500',
                    background: '#f8fafc',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {profile?.email || currentUser.email}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
              {displayRoles.map((rCode) => {
                const c = rCode === 'customer' && !isBranchAssigned ? '#94a3b8' : (ROLE_COLOR_MAP[rCode] || '#64748b');
                const label = getRoleTitle(rCode);
                return (
                  <span
                    key={rCode}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: `${c}15`,
                      color: c,
                      fontSize: '12px',
                      fontWeight: '700',
                      border: `1px solid ${c}30`,
                    }}
                  >
                    {label}
                  </span>
                );
              })}

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: '#dcfce7',
                  color: '#15803d',
                  fontSize: '12px',
                  fontWeight: '700',
                  border: '1px solid #86efac',
                }}
              >
                Đang hoạt động
              </span>
            </div>
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

      {/* Thông báo thành công */}
      {successMsg && (
        <div
          style={{
            background: '#dcfce7',
            border: '1px solid #86efac',
            color: '#15803d',
            padding: '14px 20px',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            animation: 'fadeInCard 0.25s ease',
          }}
        >
          <span>{successMsg}</span>
        </div>
      )}

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
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Các trường do Quản trị viên phân quyền (Chỉ đọc)
              </span>
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
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Cập nhật họ tên và số điện thoại liên lạc của bạn
              </span>
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

      {/* LightBox Modal xem ảnh đại diện kích thước lớn */}
      {isLightBoxOpen && (
        <div
          onClick={() => setIsLightBoxOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              overflow: 'hidden',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
            }}
          >
            {/* Header Modal */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                Ảnh đại diện
              </h3>
              <button
                type="button"
                onClick={() => setIsLightBoxOpen(false)}
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
                  cursor: 'pointer',
                  fontSize: '16px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Vùng hiển thị ảnh phóng to */}
            <div
              style={{
                padding: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#090d16',
              }}
            >
              <img
                src={profile?.avatar_url || currentUser.avatar_url || ''}
                alt="Avatar phóng to"
                style={{
                  width: '280px',
                  height: '280px',
                  objectFit: 'cover',
                  borderRadius: '16px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)',
                }}
              />
            </div>

            {/* Footer hành động: Nút Thay đổi ảnh và Đóng */}
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
                gap: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Đổi ảnh mới
              </button>

              <button
                type="button"
                onClick={() => setIsLightBoxOpen(false)}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cắt ảnh 1:1 chuẩn AC-03 */}
      <AvatarCropModal
        isOpen={isCropModalOpen}
        imageSrc={selectedImageSrc}
        onClose={() => {
          setIsCropModalOpen(false);
          setSelectedFile(null);
          setSelectedImageSrc('');
        }}
        onConfirmCrop={handleConfirmCrop}
        isUploading={isUploadingAvatar}
      />
    </main>
  );
};
