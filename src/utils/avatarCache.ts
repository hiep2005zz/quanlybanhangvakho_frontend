// frontend/src/utils/avatarCache.ts
/**
 * Global In-Memory Image Preload & Cache Manager
 * Triệt tiêu hoàn toàn hiện tượng chập chờn (flickering), tải chậm hoặc mất hình ảnh Avatar.
 */

// Bộ nhớ đệm lưu trạng thái nạp của các URL ảnh trong phiên làm việc
const PRELOADED_URLS = new Set<string>();
const FAILED_URLS = new Set<string>();
const IN_FLIGHT_PROMISES = new Map<string, Promise<boolean>>();

/**
 * Preload ảnh vào bộ nhớ đệm trình duyệt ngay lập tức.
 * Trả về Promise<boolean>: true nếu ảnh load thành công, false nếu 404/lỗi.
 */
export function preloadAvatarImage(url: string | null | undefined): Promise<boolean> {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return Promise.resolve(false);
  }

  const cleanUrl = url.trim();

  // Đã từng load thành công trước đó
  if (PRELOADED_URLS.has(cleanUrl)) {
    return Promise.resolve(true);
  }

  // Đã từng xác nhận lỗi 404/lỗi mạng trước đó
  if (FAILED_URLS.has(cleanUrl)) {
    return Promise.resolve(false);
  }

  // Đang trong quá trình nạp
  if (IN_FLIGHT_PROMISES.has(cleanUrl)) {
    return IN_FLIGHT_PROMISES.get(cleanUrl)!;
  }

  const promise = new Promise<boolean>((resolve) => {
    const img = new Image();
    img.src = cleanUrl;
    img.onload = () => {
      PRELOADED_URLS.add(cleanUrl);
      IN_FLIGHT_PROMISES.delete(cleanUrl);
      resolve(true);
    };
    img.onerror = () => {
      FAILED_URLS.add(cleanUrl);
      IN_FLIGHT_PROMISES.delete(cleanUrl);
      resolve(false);
    };
  });

  IN_FLIGHT_PROMISES.set(cleanUrl, promise);
  return promise;
}

/**
 * Kiểm tra xem URL ảnh này đã được preload thành công chưa (Sync check)
 */
export function isAvatarPreloaded(url: string | null | undefined): boolean {
  if (!url) return false;
  return PRELOADED_URLS.has(url.trim());
}

/**
 * Kiểm tra xem URL ảnh này có bị hỏng/404 không
 */
export function isAvatarFailed(url: string | null | undefined): boolean {
  if (!url) return false;
  return FAILED_URLS.has(url.trim());
}

/**
 * Đăng ký và phát sự kiện đồng bộ avatar real-time không cần F5
 */
export const AVATAR_UPDATED_EVENT = 'AVATAR_REALTIME_UPDATED';

export interface AvatarUpdateEventDetail {
  avatar_url?: string | null;
  avatar_thumbnail_url?: string | null;
  username?: string;
}

export function broadcastAvatarUpdate(detail: AvatarUpdateEventDetail) {
  // Preload ngay URL mới
  if (detail.avatar_url) preloadAvatarImage(detail.avatar_url);
  if (detail.avatar_thumbnail_url) preloadAvatarImage(detail.avatar_thumbnail_url);

  // Gửi sự kiện trên tab hiện tại
  window.dispatchEvent(new CustomEvent(AVATAR_UPDATED_EVENT, { detail }));
}
