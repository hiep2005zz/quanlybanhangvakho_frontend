// frontend/src/App.tsx
import { useState, useEffect, useCallback, FormEvent } from 'react';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './components/DashboardPage';
import { User, logoutApi, subscribeSessionExpired, getClientSession, saveClientSession, clearClientSession, AUTH_STORAGE, getMeApi } from './services/api';
import { sessionManager } from './services/sessionManager';
import { requestPasswordReset, resetPassword } from './services/auth';
import './app.css';

function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const initialResetToken = queryParams.get('token') ?? '';
  const isResetPath = window.location.pathname.includes('reset-password') || Boolean(initialResetToken);

  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset'>(
    isResetPath ? 'reset' : 'login'
  );
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

  // Đếm ngược 60 giây chống spam request
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const session = getClientSession();
    if (session.expiresAt && session.expiresAt < Date.now()) {
      clearClientSession();
      return null;
    }
    return session.user;
  });

  const [authToken, setAuthToken] = useState<string | null>(() => {
    const session = getClientSession();
    if (session.expiresAt && session.expiresAt < Date.now()) {
      return null;
    }
    return session.token;
  });

  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string | null>(() => {
    const stored = sessionStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE) || localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    if (stored) return stored;
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      return 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
    }
    return null;
  });

  // Tự động đồng bộ vai trò và thông tin mới nhất từ máy chủ khi load trang (F5)
  useEffect(() => {
    if (authToken) {
      getMeApi(authToken).then((freshUser) => {
        if (freshUser) {
          setCurrentUser(freshUser);
          sessionStorage.setItem(AUTH_STORAGE.USER, JSON.stringify(freshUser));
        }
      });
    }
  }, [authToken]);

  // Xử lý sự kiện hết hạn phiên
  const handleSessionExpired = useCallback((message: string) => {
    sessionManager.stop();
    clearClientSession();
    setCurrentUser(null);
    setAuthToken(null);
    setSessionExpiredMsg(message);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('expired', 'true');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSessionExpired(handleSessionExpired);
    return () => {
      unsubscribe();
    };
  }, [handleSessionExpired]);

  // Quản lý lifecycle của SessionManager
  useEffect(() => {
    if (authToken && currentUser) {
      sessionManager.start(authToken, currentUser.username);
      const unsubscribeRefresh = sessionManager.onTokenRefreshed((newToken) => {
        setAuthToken(newToken);
      });
      const unsubscribeProfile = sessionManager.onUserProfileUpdated((updatedUser) => {
        setCurrentUser(updatedUser);
      });
      return () => {
        unsubscribeRefresh();
        unsubscribeProfile();
        sessionManager.stop();
      };
    } else {
      sessionManager.stop();
    }
  }, [authToken, currentUser?.username]);

  // [CLEAN URL] Tự động làm sạch URL khi ở trạng thái Chưa đăng nhập (loại bỏ /users, ?tab=users)
  useEffect(() => {
    if (!currentUser || !authToken) {
      const pathname = window.location.pathname.toLowerCase();
      const search = window.location.search;
      const isReset = pathname.includes('reset-password') || new URLSearchParams(search).has('token');

      // Nếu không phải luồng đặt lại mật khẩu mà URL dính /users hoặc params thừa -> đưa về sạch '/'
      if (!isReset && (pathname === '/users' || pathname.startsWith('/users/') || pathname === '/admin' || (search && !new URLSearchParams(search).has('expired')))) {
        try {
          window.history.replaceState({}, '', '/');
        } catch {
          // ignore
        }
      }
    }
  }, [currentUser, authToken]);

  const handleLoginSuccess = (user: User, token: string) => {
    setSessionExpiredMsg(null);
    setCurrentUser(user);
    setAuthToken(token);
    sessionManager.start(token, user.username);
    // Nếu không phải admin thì làm sạch URL về trang chủ '/'
    const isUserAdmin = user.role === 'admin' || Boolean(user.roles && user.roles.includes('admin'));
    if (!isUserAdmin) {
      try {
        window.history.replaceState({}, '', '/');
      } catch {
        // ignore
      }
    }
  };

  const handleLogout = async () => {
    sessionManager.stop();
    if (authToken) {
      await logoutApi(authToken);
    }
    clearClientSession();
    setCurrentUser(null);
    setAuthToken(null);
    setSessionExpiredMsg(null);
    // Dọn sạch URL triệt để về trang gốc '/' khi đăng xuất
    try {
      window.history.replaceState({}, '', '/');
    } catch {
      // ignore
    }
  };

  // Xử lý yêu cầu gửi email đặt lại mật khẩu (chống spam với isSubmitting và countdown 60s)
  async function handleForgotRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || countdown > 0) return;

    setResetError('');
    setResetMessage('');
    setIsSubmitting(true);
    try {
      const response = await requestPasswordReset(forgotEmail);
      setResetMessage(response.message);
      setCountdown(60); // Bắt đầu đếm ngược 60 giây
    } catch (requestError) {
      let errorMessage = requestError instanceof Error ? requestError.message : 'Không thể gửi yêu cầu.';
      if (errorMessage === 'Failed to fetch') {
        errorMessage = 'Vui lòng xem lại thông tin tài khoản!';
      }
      setResetError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Xử lý xác nhận đổi mật khẩu qua token
  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setResetError('');
    setResetMessage('');

    if (resetNewPassword.length < 8) {
      setResetError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }

    if (resetConfirmPassword && resetNewPassword !== resetConfirmPassword) {
      setResetError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await resetPassword(resetToken, resetNewPassword);
      setResetMessage(response.message);
      setResetNewPassword('');
      setResetConfirmPassword('');
      // Sau 2.5s chuyển về màn hình đăng nhập
      setTimeout(() => {
        window.history.replaceState({}, '', window.location.pathname.replace(/\/reset-password.*/, '') || '/');
        setAuthView('login');
      }, 2500);
    } catch (resetErr) {
      setResetError(resetErr instanceof Error ? resetErr.message : 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleSwitchUser = (newUser: User, newToken: string) => {
    saveClientSession(newUser, newToken);
    setCurrentUser(newUser);
    setAuthToken(newToken);
    sessionManager.start(newToken);
  };

  // Nền sáng Clean Slate sang trọng
  const videoBackground = null;

  // Nếu đã đăng nhập thành công
  if (currentUser && authToken) {
    return (
      <>
        {videoBackground}
        <DashboardPage
          user={currentUser}
          token={authToken}
          onLogout={handleLogout}
          onSwitchUser={handleSwitchUser}
          onTokenUpdated={(newToken) => {
            setAuthToken(newToken);
            if (currentUser) {
              saveClientSession(currentUser, newToken);
              sessionManager.start(newToken, currentUser.username);
            }
          }}
        />
      </>
    );
  }

  // Màn hình Quên mật khẩu / Đặt lại mật khẩu
  // Màn hình Quên mật khẩu / Đặt lại mật khẩu
  if (authView === 'forgot' || authView === 'reset') {
    return (
      <>
        {videoBackground}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100vw', padding: '20px' }}>
          <div className="login-right-content" style={{ background: '#ffffff', padding: '40px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)', maxWidth: '460px', width: '100%' }}>
            <div className="login-header" style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h2>{authView === 'forgot' ? 'Lấy lại quyền truy cập' : 'Đặt lại mật khẩu mới'}</h2>
              <p>
                {authView === 'forgot'
                  ? 'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu có hiệu lực trong 30 phút.'
                  : 'Tạo mật khẩu mới cho tài khoản của bạn (tối thiểu 8 ký tự).'}
              </p>
            </div>

            {resetMessage && <div className="error-alert" style={{ background: '#dcfce7', borderColor: '#bbf7d0', color: '#15803d', marginBottom: '20px' }}>{resetMessage}</div>}
            {resetError && <div className="error-alert" style={{ marginBottom: '20px' }}>{resetError}</div>}

            {authView === 'forgot' ? (
              <form className="login-form" onSubmit={handleForgotRequest}>
                <div className="form-group">
                  <label htmlFor="email">Email tài khoản hoặc Tên đăng nhập</label>
                  <div className="input-container">
                    <input
                      id="email"
                      type="text"
                      value={forgotEmail}
                      onChange={(event) => setForgotEmail(event.target.value)}
                      placeholder="Nhập email hoặc tên đăng nhập"
                      autoComplete="username email"
                      required
                    />
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <button type="submit" className="submit-btn" disabled={isSubmitting || countdown > 0}>
                    {isSubmitting
                      ? 'Đang gửi...'
                      : countdown > 0
                      ? `Gửi lại sau (${countdown}s)`
                      : 'Gửi liên kết đặt lại'}
                  </button>
                  <button
                    type="button"
                    className="submit-btn"
                    style={{ background: '#f3f4f6', color: '#374151', boxShadow: 'none' }}
                    onClick={() => {
                      setResetMessage('');
                      setResetError('');
                      setAuthView('login');
                    }}
                  >
                    ← Quay lại Đăng nhập
                  </button>
                </div>
              </form>
            ) : (
              <form className="login-form" onSubmit={handleResetSubmit}>
                <div className="form-group">
                  <label htmlFor="new-password">Mật khẩu mới</label>
                  <div className="pwd-input-wrapper">
                    <input
                      id="new-password"
                      type={showResetNewPassword ? 'text' : 'password'}
                      value={resetNewPassword}
                      onChange={(event) => setResetNewPassword(event.target.value)}
                      minLength={8}
                      placeholder="Tối thiểu 8 ký tự"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="reset-toggle-pwd-btn"
                      onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                    >
                      {showResetNewPassword ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
                  <div className="pwd-input-wrapper">
                    <input
                      id="confirm-password"
                      type={showResetConfirmPassword ? 'text' : 'password'}
                      value={resetConfirmPassword}
                      onChange={(event) => setResetConfirmPassword(event.target.value)}
                      minLength={8}
                      placeholder="Nhập lại mật khẩu mới"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      className="reset-toggle-pwd-btn"
                      onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                    >
                      {showResetConfirmPassword ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <button type="submit" className="submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? 'Đang cập nhật...' : 'Xác nhận đặt lại mật khẩu'}
                  </button>
                  <button
                    type="button"
                    className="submit-btn"
                    style={{ background: '#f3f4f6', color: '#374151', boxShadow: 'none' }}
                    onClick={() => {
                      window.history.replaceState({}, '', window.location.pathname.replace(/\/reset-password.*/, '') || '/');
                      setResetToken('');
                      setResetMessage('');
                      setResetError('');
                      setAuthView('login');
                    }}
                  >
                    ← Quay lại Đăng nhập
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </>
    );
  }

  // Màn hình Đăng nhập chuẩn
  return (
    <>
      {videoBackground}
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        expiredMessage={sessionExpiredMsg}
        onClearExpiredMessage={() => setSessionExpiredMsg(null)}
        onForgotPassword={() => {
          setResetMessage('');
          setResetError('');
          setAuthView('forgot');
        }}
      />
    </>
  );
}

export default App;
