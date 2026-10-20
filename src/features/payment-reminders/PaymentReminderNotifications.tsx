import { useEffect, useState } from 'react';
import {
  getPaymentRemindersApi,
  markPaymentReminderReadApi,
  type PaymentReminderNotification,
} from '../../services/paymentReminderApi';

interface PaymentReminderNotificationsProps {
  token: string;
  onOpenInvoice: (invoiceCode: string | null) => void;
}

export function PaymentReminderNotifications({
  token,
  onOpenInvoice,
}: PaymentReminderNotificationsProps) {
  const [items, setItems] = useState<PaymentReminderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const reminders = await getPaymentRemindersApi(token);
        if (!active) return;
        setItems(reminders.items);
        setUnreadCount(reminders.unread_count);
        setError(null);
      } catch (reason: unknown) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Không tải được thông báo.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void refresh();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    }, 60_000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [token]);

  const openInvoice = async (item: PaymentReminderNotification) => {
    if (!item.is_read) {
      try {
        await markPaymentReminderReadApi(token, item.id);
        setItems((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? { ...notification, is_read: true }
              : notification
          )
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (reason: unknown) {
        setError(reason instanceof Error ? reason.message : 'Không thể cập nhật thông báo.');
        return;
      }
    }
    setIsOpen(false);
    onOpenInvoice(item.invoice_code);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="payment-reminder-list"
        onClick={() => setIsOpen((open) => !open)}
        className="relative rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        Thông báo
        {unreadCount > 0 && (
          <span className="ml-2 rounded-full bg-emerald-700 px-1.5 py-0.5 text-xs font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <section
          id="payment-reminder-list"
          aria-label="Thông báo hạn thanh toán"
          className="table-hidden-scrollbar absolute right-0 z-50 mt-2 max-h-96 w-[min(90vw,24rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-slate-900 shadow-lg"
        >
          <h2 className="mb-2 text-base font-bold">Nhắc hạn thanh toán</h2>
          {error && (
            <p role="alert" className="mb-2 text-sm text-rose-800">
              {error}
            </p>
          )}
          {loading ? (
            <p className="py-4 text-sm text-slate-700">Đang tải thông báo...</p>
          ) : items.length === 0 ? (
            <p className="py-4 text-sm text-slate-700">Bạn chưa có thông báo nhắc hạn.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void openInvoice(item)}
                    className={`w-full rounded-md border px-2 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${
                      item.is_read
                        ? 'border-transparent text-slate-700 hover:bg-slate-50'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100'
                    }`}
                  >
                    <span className="block text-sm font-semibold">{item.title}</span>
                    <span className="mt-1 block text-sm">{item.body}</span>
                    <span className="mt-1 block text-xs text-slate-600">
                      {new Date(item.created_at).toLocaleString('vi-VN')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
