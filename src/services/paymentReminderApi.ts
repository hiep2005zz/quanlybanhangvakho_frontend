import { API_BASE_URL, authenticatedFetch } from './api';

export interface PaymentReminderNotification {
  id: number;
  invoice_id: number;
  invoice_code: string | null;
  reminder_type: 'DUE_SOON_3D' | 'OVERDUE';
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface PaymentReminderListResponse {
  items: PaymentReminderNotification[];
  unread_count: number;
}

export interface PaymentReminderSchedule {
  enabled: boolean;
  running: boolean;
  run_time: string;
  timezone: string;
  next_run_at: string;
  last_run_at: string | null;
  last_run_summary: {
    candidates: number;
    sent: number;
    failed: number;
    skipped: number;
    dry_run: boolean;
    disabled: boolean;
  } | null;
  last_run_failed: boolean;
}

export async function getPaymentReminderScheduleApi(
  token: string
): Promise<PaymentReminderSchedule> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/payment-reminders/schedule`,
    { method: 'GET' },
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi kiểm tra lịch nhắc hạn (HTTP ${response.status})`);
  }
  return data as PaymentReminderSchedule;
}

export async function getPaymentRemindersApi(
  token: string
): Promise<PaymentReminderListResponse> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/payment-reminders`,
    { method: 'GET' },
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Tính năng nhắc hạn thanh toán hiện chưa được bật trên máy chủ.');
    }
    throw new Error(data.detail || `Lỗi tải thông báo (HTTP ${response.status})`);
  }
  return data as PaymentReminderListResponse;
}

export async function markPaymentReminderReadApi(
  token: string,
  notificationId: number
): Promise<void> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/payment-reminders/${notificationId}/read`,
    { method: 'PATCH' },
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Tính năng nhắc hạn thanh toán hiện chưa được bật trên máy chủ.');
    }
    throw new Error(data.detail || `Lỗi cập nhật thông báo (HTTP ${response.status})`);
  }
}
