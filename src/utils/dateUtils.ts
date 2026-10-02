// frontend/src/utils/dateUtils.ts
/**
 * Chuyển đổi chuỗi thời gian từ máy chủ (UTC) sang giờ địa phương Việt Nam (GMT+7)
 * Định dạng hiển thị: DD/MM/YYYY HH:mm:ss
 */
export function formatLocalDateTime(utcStr?: string | null): string {
  if (!utcStr) return '—';

  try {
    let raw = utcStr.trim();
    // Nếu chuỗi có dạng 'YYYY-MM-DD HH:mm:ss' không có múi giờ, thêm 'Z' để Date parser hiểu là UTC
    if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(raw)) {
      raw = raw.replace(' ', 'T') + 'Z';
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) {
      raw = raw + 'Z';
    }

    const d = new Date(raw);
    if (isNaN(d.getTime())) {
      return utcStr;
    }

    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return utcStr;
  }
}
