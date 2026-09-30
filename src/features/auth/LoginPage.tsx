import { useState, useEffect } from 'react';
import './login.css';
import { loginApi, User, AUTH_STORAGE } from '../../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  expiredMessage?: string | null;
  onClearExpiredMessage?: () => void;
  onForgotPassword?: () => void;
}

export default function LoginPage({ onLoginSuccess, expiredMessage, onClearExpiredMessage, onForgotPassword }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const formatNotice = (msg: string) => msg.startsWith('⚠️') ? msg : `⚠️ ${msg}`;

  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(() => {
    const stored = sessionStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE) || localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    if (stored) return formatNotice(stored);
    if (expiredMessage) return formatNotice(expiredMessage);
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      return '⚠️ Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
    }
    return null;
  });

  const [lockRemaining, setLockRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE) || localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    if (stored) {
      setSessionExpiredNotice(formatNotice(stored));
    } else if (expiredMessage) {
      setSessionExpiredNotice(formatNotice(expiredMessage));
    } else {
      const params = new URLSearchParams(window.location.search);
      if (params.get('expired') === 'true') {
        setSessionExpiredNotice('⚠️ Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
      }
    }
  }, [expiredMessage]);

  useEffect(() => {
    if (sessionExpiredNotice) {
      sessionStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
      localStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
      onClearExpiredMessage?.();
      if (typeof window !== 'undefined' && window.location.search.includes('expired')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('expired');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    }
  }, [sessionExpiredNotice, onClearExpiredMessage]);

  useEffect(() => {
    const lockUntilStr = localStorage.getItem('lockout_until');
    if (lockUntilStr) {
      const lockUntil = parseInt(lockUntilStr, 10);
      const now = Date.now();
      if (lockUntil > now) {
        setLockRemaining(Math.ceil((lockUntil - now) / 1000));
      } else {
        localStorage.removeItem('lockout_until');
        localStorage.removeItem('login_failed_count');
      }
    }
  }, []);

  useEffect(() => {
    if (lockRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockRemaining((prev) => {
        if (prev <= 1) {
          localStorage.removeItem('lockout_until');
          localStorage.removeItem('login_failed_count');
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockRemaining > 0 || isLoading) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const cleanUsername = username.trim();
      const cleanPassword = password.trim();
      const data = await loginApi(cleanUsername, cleanPassword);

      localStorage.removeItem('login_failed_count');
      localStorage.removeItem('lockout_until');
      sessionStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
      localStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
      setSessionExpiredNotice(null);
      onClearExpiredMessage?.();
      setErrorMessage('');
      onLoginSuccess(data.user, data.access_token);
    } catch (err: any) {
      if (err.lock_remaining_seconds) {
        const lockUntil = Date.now() + err.lock_remaining_seconds * 1000;
        localStorage.setItem('lockout_until', lockUntil.toString());
        setLockRemaining(err.lock_remaining_seconds);
        setErrorMessage('');
      } else {
        const remainInfo = err.remaining_attempts !== undefined ? ` (Bạn còn ${err.remaining_attempts} lần thử)` : '';
        setErrorMessage((err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.') + remainInfo);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-left-content">
          <div className="saas-badge">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
            ENTERPRISE WMS & COMMERCE
          </div>
          <h1>Hệ Thống Quản Lý Kho<br /><span className="highlight-text">& Bán Hàng Thông Minh</span></h1>
          <p className="left-desc">
            Tối ưu hóa quy trình vận hành kho bãi, kiểm soát tồn kho thời gian thực và quản trị doanh số bán hàng đa kênh chính xác, chuẩn mực.
          </p>
          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-icon-box">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="feature-text">
                <span className="feature-title">Báo cáo Lãi/Lỗ Tức thì</span>
                <span className="feature-subtitle">Kiểm soát giá vốn chuẩn xác</span>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon-box">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <div className="feature-text">
                <span className="feature-title">Điều chuyển Kho & Tồn kho</span>
                <span className="feature-subtitle">Cảnh báo hết hàng tự động</span>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon-box">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              </div>
              <div className="feature-text">
                <span className="feature-title">Phân quyền 7 Cấp độ</span>
                <span className="feature-subtitle">Bảo mật dữ liệu tối đa</span>
              </div>
            </div>
          </div>
        </div>
        <div className="login-footer">
          © 2026 Enterprise Warehouse & Sales Management. All rights reserved.
        </div>
      </div>

      <div className="login-right">
        <div className="login-right-content">
          <div className="login-badge">CỔNG TRUY CẬP HỆ THỐNG</div>
          <div className="login-header">
            <h2>Đăng nhập tài khoản</h2>
            <p>Chào mừng bạn quay trở lại. Vui lòng nhập thông tin để tiếp tục.</p>
          </div>

          {sessionExpiredNotice && (
            <div className="session-expired-alert" role="alert">
              <span>{sessionExpiredNotice}</span>
            </div>
          )}

          {lockRemaining > 0 ? (
            <div className="lock-alert">
              <p>Tài khoản đã bị tạm khóa do nhập sai quá 5 lần liên tiếp. Vui lòng thử lại sau:</p>
              <div className="lock-timer">{formatTime(lockRemaining)}</div>
            </div>
          ) : (
            <form className="login-form" onSubmit={handleSubmit}>
              {errorMessage && (
                <div className="error-alert">
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="username">Tên đăng nhập</label>
                </div>
                <div className="input-container">
                  <svg xmlns="http://www.w3.org/2000/svg" className="input-icon" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                  <input
                    id="username"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={lockRemaining > 0 || isLoading}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="password">Mật khẩu</label>
                  <button
                    type="button"
                    className="forgot-password"
                    onClick={onForgotPassword}
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="input-container">
                  <svg xmlns="http://www.w3.org/2000/svg" className="input-icon" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={lockRemaining > 0 || isLoading}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-pwd-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '18px', height: '18px'}}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '18px', height: '18px'}}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={lockRemaining > 0 || isLoading}>
                {isLoading ? 'Đang xác thực...' : 'Đăng nhập hệ thống \u2192'}
              </button>
            </form>
          )}

          <div className="demo-roles">
            <div className="demo-roles-header">
              <span className="title">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width: '16px', height: '16px'}}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                7 Vai Trò Nghiệp Vụ (Click để chọn nhanh)
              </span>
              <span className="demo-roles-hint">Mật khẩu chung: <strong style={{fontWeight: 800}}>123</strong></span>
            </div>
            <div className="roles-grid">
              {[
                { u: 'admin', label: 'Quản trị hệ thống', desc: 'Toàn quyền + Giá vốn + Kho', color: '#ef4444' },
                { u: 'sales_manager', label: 'Quản lý kinh doanh', desc: 'Xem giá vốn & lãi', color: '#a855f7' },
                { u: 'sales', label: 'Nhân viên kinh doanh', desc: 'Chặn giá vốn & kho', color: '#3b82f6' },
                { u: 'kho', label: 'Thủ kho', desc: 'Thao tác kho, ẩn giá vốn', color: '#10b981' },
                { u: 'warehouse_mgr', label: 'Quản lý kho', desc: 'Quản lý kho & mua hàng', color: '#10b981' },
                { u: 'ketoan', label: 'Kế toán công nợ', desc: 'Sổ sách & đối trừ nợ', color: '#f59e0b' },
                { u: 'customer', label: 'Đại lý', desc: 'Tự đặt hàng & xem nợ', color: '#3b82f6' },
              ].map((role) => (
                <button
                  key={role.u}
                  type="button"
                  className="role-card"
                  onClick={() => {
                    setUsername(role.u);
                    setPassword('123');
                  }}
                >
                  <div className="role-title">
                    <span className="role-dot" style={{ background: role.color }}></span>
                    <span style={{ color: role.color }}>{role.label}</span>
                  </div>
                  <div className="role-desc">
                    {role.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
