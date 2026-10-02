// frontend/src/services/sessionManager.ts
import { refreshTokenApi, notifySessionExpired, AUTH_STORAGE, getMeApi, User } from './api';

// Định danh duy nhất cho từng Tab/Cửa sổ để phân biệt tab thao tác với các tab khác
export const CURRENT_TAB_ID = 'tab_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

// Cấu hình thời gian
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 phút không tương tác -> hết hạn phiên
const WARNING_THRESHOLD_SECONDS = 120; // 2 phút (Vùng cảnh báo)
const CHECK_INTERVAL_MS = 1000; // Chạy setInterval mỗi 1000ms (1s)

export interface SessionState {
  isActive: boolean;
  remainingSeconds: number;
  expiresAt: number;
  isWarning: boolean; // remainingSeconds <= 120s
  lastActivity: number;
  lastRefreshed: number;
  isRefreshing: boolean;
}

type TokenRefreshListener = (newToken: string) => void;
type StatusListener = (state: SessionState) => void;
type UserProfileListener = (user: User) => void;

class SessionManager {
  private lastActivityTime: number = Date.now();
  private lastRefreshedTime: number = Date.now();
  private checkTimer: number | null = null;
  private currentToken: string | null = null;
  private currentUsername: string | null = null;
  private isRefreshing: boolean = false;
  private lastSilentRefreshTrigger: number = 0;
  private tokenRefreshListeners: Set<TokenRefreshListener> = new Set();
  private statusListeners: Set<StatusListener> = new Set();
  private userProfileListeners: Set<UserProfileListener> = new Set();
  private isInitialized: boolean = false;
  private authChannel: BroadcastChannel | null = null;

  constructor() {
    this.handleMouseMove = this.throttle(this.handleMouseMove.bind(this), 2000);
    this.handleUserInteraction = this.throttle(this.handleUserInteraction.bind(this), 1000);
    this.handleOnline = this.handleOnline.bind(this);
    // Throttle 60s để tránh gọi liên tục /auth/me và validate mỗi khi tab được focus hoặc click ra vào
    this.handleWindowFocus = this.throttle(this.handleWindowFocus.bind(this), 60000);
    this.handleVisibilityChange = this.throttle(this.handleVisibilityChange.bind(this), 60000);
  }

  private throttle(fn: () => void, wait: number) {
    let lastTime = 0;
    return () => {
      const now = Date.now();
      if (now - lastTime >= wait) {
        lastTime = now;
        fn();
      }
    };
  }

  // Cập nhật hoạt động thụ động (di chuột)
  private handleMouseMove() {
    this.lastActivityTime = Date.now();
  }

  // Cập nhật thao tác chủ động (gõ phím, click chuột, gửi form)
  public handleUserInteraction() {
    this.lastActivityTime = Date.now();

    // Nếu người dùng chủ động thao tác khi thời gian còn dưới 2 phút (<= 120s):
    // Tự động kích hoạt Silent Refresh ngầm để bảo toàn phiên và dữ liệu
    const state = this.getSessionState();
    if (state.remainingSeconds > 0 && state.remainingSeconds <= WARNING_THRESHOLD_SECONDS) {
      const now = Date.now();
      if (now - this.lastSilentRefreshTrigger > 3000 && !this.isRefreshing) {
        this.lastSilentRefreshTrigger = now;
        this.performSilentRefresh();
      }
    }
  }

  public recordActivity() {
    this.handleUserInteraction();
  }

  private handleOnline() {
    // Khi mạng có lại, lập tức thử làm mới phiên nếu token sắp hết hạn
    if (this.currentToken && !this.isRefreshing) {
      this.checkAndRefreshSession(true);
      this.syncCurrentProfile();
    }
  }

  // Lắng nghe sự kiện chuyển tab / focus lại cửa sổ (đã được throttle 60s)
  private handleWindowFocus() {
    if (this.currentToken && !this.isRefreshing) {
      this.syncCurrentProfile();
    }
  }

  private handleVisibilityChange() {
    if (document.visibilityState === 'visible' && this.currentToken && !this.isRefreshing) {
      this.syncCurrentProfile();
    }
  }

  public async syncCurrentProfile(): Promise<User | null> {
    if (!this.currentToken) return null;
    try {
      const updatedUser = await getMeApi(this.currentToken);
      if (updatedUser) {
        // So sánh với user hiện tại trong sessionStorage trước khi notify để tránh re-render lặp vô hạn
        const currentUserStr = sessionStorage.getItem(AUTH_STORAGE.USER);
        const newUserStr = JSON.stringify(updatedUser);
        if (currentUserStr !== newUserStr) {
          sessionStorage.setItem(AUTH_STORAGE.USER, newUserStr);
          this.notifyUserProfile(updatedUser);
          window.dispatchEvent(new CustomEvent('USER_ROLE_UPDATED', { detail: updatedUser }));
          window.dispatchEvent(new CustomEvent('USER_ACCOUNTS_CHANGED', { detail: updatedUser }));
        }
        return updatedUser;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public broadcastUserUpdate(username: string) {
    const uname = (username || '').toLowerCase();
    if (this.authChannel) {
      try {
        this.authChannel.postMessage({
          type: 'USER_ROLE_UPDATED',
          username: uname,
          tabId: CURRENT_TAB_ID,
          timestamp: Date.now(),
        });
      } catch {
        // ignore
      }
    }

    try {
      localStorage.setItem('auth_role_updated', JSON.stringify({
        username: uname,
        timestamp: Date.now(),
      }));
    } catch {
      // ignore
    }

    window.dispatchEvent(new CustomEvent('USER_ROLE_UPDATED', { detail: { username: uname } }));
    window.dispatchEvent(new CustomEvent('USER_ACCOUNTS_CHANGED', { detail: { username: uname } }));
  }

  public start(token: string, username?: string) {
    this.currentToken = token;
    if (username) {
      this.currentUsername = username;
    }
    this.lastActivityTime = Date.now();
    this.lastRefreshedTime = Date.now();

    // Thiết lập BroadcastChannel để đồng bộ thu hồi tức thì giữa các tab CÙNG TÀI KHOẢN
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        if (this.authChannel) {
          this.authChannel.close();
        }
        this.authChannel = new BroadcastChannel('auth_channel');
        this.authChannel.onmessage = (event) => {
          // Bỏ qua tin nhắn do chính tab này gửi để không tự đá văng chính mình
          if (event.data?.tabId === CURRENT_TAB_ID) {
            return;
          }

          if (event.data?.type === 'PASSWORD_CHANGED') {
            // Kiểm tra đúng tài khoản đang đăng nhập
            const eventUser = (event.data?.username || '').toLowerCase().trim();
            const thisUser = (this.currentUsername || '').toLowerCase().trim();
            if (thisUser && eventUser && eventUser !== thisUser) {
              return;
            }

            // Vì các tab này cùng trên một máy tính / cùng một trình duyệt:
            // Cập nhật ngay Token mới vào sessionStorage & localStorage và thông báo cho App cập nhật
            // Nhờ đó các tab trên máy này KHÔNG BỊ OUT, còn máy khác (thiết bị khác) cầm token cũ sẽ bị Backend đá văng 401 ngay lập tức.
            if (event.data?.newToken) {
              this.currentToken = event.data.newToken;
              sessionStorage.setItem(AUTH_STORAGE.TOKEN, event.data.newToken);
              localStorage.setItem(AUTH_STORAGE.TOKEN, event.data.newToken);
              this.tokenRefreshListeners.forEach((listener) => listener(event.data.newToken));
            }
          }

          if (event.data?.type === 'USER_ROLE_UPDATED') {
            // Nếu tài khoản được cập nhật vai trò trùng với tài khoản tab này -> Lập tức đồng bộ lại profile
            const eventUser = (event.data?.username || '').toLowerCase().trim();
            const thisUser = (this.currentUsername || '').toLowerCase().trim();
            if (!eventUser || !thisUser || eventUser === thisUser || eventUser === 'all') {
              this.syncCurrentProfile();
            }
          }
        };
      } catch {
        // ignore
      }
    }

    if (!this.isInitialized) {
      window.addEventListener('mousemove', this.handleUserInteraction);
      window.addEventListener('mousedown', this.handleUserInteraction);
      window.addEventListener('keydown', this.handleUserInteraction);
      window.addEventListener('click', this.handleUserInteraction);
      window.addEventListener('touchstart', this.handleUserInteraction);
      window.addEventListener('scroll', this.handleUserInteraction);
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('focus', this.handleWindowFocus);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      
      // Lắng nghe sự kiện storage từ các tab khác
      window.addEventListener('storage', (e) => {
        if (e.key === 'auth_role_updated' && e.newValue) {
          try {
            const data = JSON.parse(e.newValue);
            const target = (data?.username || '').toLowerCase().trim();
            const current = (this.currentUsername || '').toLowerCase().trim();
            if (!target || !current || target === current || target === 'all') {
              this.syncCurrentProfile();
            }
          } catch {
            // ignore
          }
        }
      });

      this.isInitialized = true;
    }

    if (this.checkTimer) {
      window.clearInterval(this.checkTimer);
    }

    // Interval chạy mỗi 1000ms tính thời gian còn lại của phiên làm việc
    this.checkTimer = window.setInterval(() => {
      this.checkAndRefreshSession(false);
      this.notifyStatus();
<<<<<<< HEAD
=======

      // Heartbeat mỗi 3 giây: Tự động kiểm tra và đồng bộ vai trò mới nhất nếu Admin vừa phân quyền
      this.heartbeatCounter++;
      if (this.heartbeatCounter >= 3) {
        this.heartbeatCounter = 0;
        if (this.currentToken && !this.isRefreshing) {
          this.syncCurrentProfile();
        }
      }
>>>>>>> 1541664110b191ca523e1eb06946cae39be4f8b7
    }, CHECK_INTERVAL_MS);

    this.notifyStatus();
  }

  public stop() {
    if (this.checkTimer) {
      window.clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    this.currentToken = null;

    if (this.authChannel) {
      try {
        this.authChannel.close();
      } catch {
        // ignore
      }
      this.authChannel = null;
    }

    if (this.isInitialized) {
      window.removeEventListener('mousemove', this.handleUserInteraction);
      window.removeEventListener('mousedown', this.handleUserInteraction);
      window.removeEventListener('keydown', this.handleUserInteraction);
      window.removeEventListener('click', this.handleUserInteraction);
      window.removeEventListener('touchstart', this.handleUserInteraction);
      window.removeEventListener('scroll', this.handleUserInteraction);
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('focus', this.handleWindowFocus);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.isInitialized = false;
    }
  }

  public onTokenRefreshed(listener: TokenRefreshListener): () => void {
    this.tokenRefreshListeners.add(listener);
    return () => {
      this.tokenRefreshListeners.delete(listener);
    };
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  public onUserProfileUpdated(listener: UserProfileListener): () => void {
    this.userProfileListeners.add(listener);
    return () => {
      this.userProfileListeners.delete(listener);
    };
  }

  private notifyUserProfile(user: User) {
    this.userProfileListeners.forEach((listener) => listener(user));
  }

  public getSessionState(): SessionState {
    const expiresAtStr = sessionStorage.getItem(AUTH_STORAGE.EXPIRES_AT) || localStorage.getItem(AUTH_STORAGE.EXPIRES_AT);
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
    const now = Date.now();
    // Logic tính toán: const remainingSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
    const idleMs = now - this.lastActivityTime;
    const isActive = idleMs < INACTIVITY_TIMEOUT_MS;
    const isWarning = remainingSeconds > 0 && remainingSeconds <= WARNING_THRESHOLD_SECONDS;

    return {
      isActive,
      remainingSeconds,
      expiresAt,
      isWarning,
      lastActivity: this.lastActivityTime,
      lastRefreshed: this.lastRefreshedTime,
      isRefreshing: this.isRefreshing,
    };
  }

  private notifyStatus() {
    const state = this.getSessionState();
    this.statusListeners.forEach((listener) => listener(state));
  }

  public async forceRefresh(): Promise<boolean> {
    if (this.currentToken) {
      return await this.performSilentRefresh();
    }
    return false;
  }

  public forceExpire(message: string = 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.') {
    this.stop();
    notifySessionExpired(message);
  }

  private async checkAndRefreshSession(forceCheck: boolean = false) {
    if (!this.currentToken || this.isRefreshing) return;

    const expiresAtStr = sessionStorage.getItem(AUTH_STORAGE.EXPIRES_AT) || localStorage.getItem(AUTH_STORAGE.EXPIRES_AT);
    const expiresAt = expiresAtStr ? parseInt(expiresAtStr, 10) : 0;
    const now = Date.now();
    const remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));
    const idleMs = now - this.lastActivityTime;

    // 1. Kiểm tra hết hạn do không tương tác (Idle Timeout)
    if (idleMs >= INACTIVITY_TIMEOUT_MS) {
      this.forceExpire();
      return;
    }

    // 2. Khi remainingSeconds = 0: Xóa sạch token, đưa về trang /login kèm thông báo
    if (remainingSeconds <= 0) {
      this.forceExpire();
      return;
    }

    // 3. Nếu forceCheck (ví dụ: mạng vừa online trở lại) và token sắp hết hạn
    if (forceCheck && remainingSeconds <= WARNING_THRESHOLD_SECONDS) {
      await this.performSilentRefresh();
    }
  }

  private async performSilentRefresh(): Promise<boolean> {
    if (!this.currentToken || this.isRefreshing) return false;

    this.isRefreshing = true;
    this.notifyStatus();

    try {
      const data = await refreshTokenApi(this.currentToken);
      this.currentToken = data.access_token;
      this.lastRefreshedTime = Date.now();
      this.lastActivityTime = Date.now();

      // Thông báo cho App và các component cập nhật token mới
      this.tokenRefreshListeners.forEach((listener) => listener(data.access_token));
      return true;
    } catch (err: any) {
      console.warn('Silent refresh không thành công:', err);
      return false;
    } finally {
      this.isRefreshing = false;
      this.notifyStatus();
    }
  }
}

export const sessionManager = new SessionManager();
