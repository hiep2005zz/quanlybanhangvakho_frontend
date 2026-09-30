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

  const handleCloseExpiredNotice = () => {
    setSessionExpiredNotice(null);
    sessionStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    localStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    onClearExpiredMessage?.();
  };

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
          <div className="saas-badge">✨ Nền tảng SaaS v2.0</div>
          <h1>HỆ THỐNG QUẢN LÝ<br />BÁN HÀNG & KHO</h1>
          <p className="left-desc">
            Giải pháp toàn diện giúp doanh nghiệp tối ưu hóa quy trình bán hàng, kiểm soát tồn kho chặt chẽ và theo dõi doanh thu theo thời gian thực.
          </p>
          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">📦</span> Quản lý kho vận hành thông minh
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span> Báo cáo doanh thu thời gian thực
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔒</span> Phân quyền bảo mật đa lớp
            </div>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="login-right-content">
          <div className="login-header">
            <h2>Chào mừng trở lại!</h2>
            <p>Vui lòng đăng nhập tài khoản của bạn để tiếp tục truy cập vào hệ thống.</p>
          </div>

          {sessionExpiredNotice && (
            <div className="session-expired-alert" role="alert">
              <div className="session-expired-content">
                <span>{sessionExpiredNotice}</span>
              </div>
              <button
                type="button"
                className="session-expired-close-btn"
                onClick={handleCloseExpiredNotice}
              >
                &times;
              </button>
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
                <label htmlFor="username">Tên đăng nhập</label>
                <div className="input-container">
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
                <label htmlFor="password">Mật khẩu</label>
                <div className="input-container">
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
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="forgot-password"
                  onClick={onForgotPassword}
                >
                  Quên mật khẩu?
                </button>
              </div>

              <button type="submit" className="submit-btn" disabled={lockRemaining > 0 || isLoading}>
                {isLoading ? 'Đang xác thực...' : 'Đăng nhập'}
              </button>
            </form>
          )}

          <div className="demo-roles">
            <div className="demo-roles-header">
              <span>Trải nghiệm nhanh các vai trò:</span>
              <span className="demo-roles-hint">(Mật khẩu chung: <strong>123</strong>)</span>
            </div>
            <div className="roles-grid">
              {[
                { u: 'admin', label: 'Quản trị hệ thống', desc: 'Toàn quyền + Giá vốn + Kho' },
                { u: 'sales_manager', label: 'Quản lý kinh doanh', desc: 'Xem giá vốn & lãi' },
                { u: 'sales', label: 'Nhân viên kinh doanh', desc: 'Chặn giá vốn & kho' },
                { u: 'kho', label: 'Thủ kho', desc: 'Thao tác kho, ẩn giá vốn' },
                { u: 'warehouse_mgr', label: 'Quản lý kho', desc: 'Quản lý kho & mua hàng' },
                { u: 'ketoan', label: 'Kế toán công nợ', desc: 'Sổ sách & đối trừ nợ' },
                { u: 'customer', label: 'Đại lý', desc: 'Tự đặt hàng & xem nợ' },
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
                    <strong>{role.label}</strong>
                  </div>
                  <div className="role-desc">
                    <code>{role.u}</code> • {role.desc}
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
