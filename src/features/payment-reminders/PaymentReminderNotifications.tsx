import { useEffect, useState } from 'react';
import {
  getPaymentRemindersApi,
  markPaymentReminderReadApi,
  type PaymentReminderNotification,
} from '../../services/paymentReminderApi';

interface PaymentReminderNotificationsProps {
  token: string;
  onOpenInvoice: (invoiceCode: string | null) => void;
  buttonClassName?: string;
  useBellIcon?: boolean;
}

export function PaymentReminderNotifications({
  token,
  onOpenInvoice,
  buttonClassName,
  useBellIcon = true,
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
        className={
          buttonClassName ||
          "relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-600 active:scale-95 shadow-sm hover:shadow-md transition-all cursor-pointer select-none"
        }
        title="Thông báo nhắc nợ"
      >
        {useBellIcon ? (
          <div className="relative flex items-center justify-center">
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-4.5 h-4.5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        ) : (
          <>
            Thông báo
            {unreadCount > 0 && (
              <span className="ml-2 rounded-full bg-emerald-700 px-1.5 py-0.5 text-xs font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </>
        )}
      </button>
      {isOpen && (
        <section
          id="payment-reminder-list"
          aria-label="Thông báo hạn thanh toán"
          className="table-hidden-scrollbar absolute right-0 z-50 mt-2.5 max-h-[26rem] w-[min(90vw,22rem)] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-4 text-slate-900 shadow-xl"
          style={{
            boxShadow: '0 12px 32px -4px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.06)',
          }}
        >
          {/* Header popup cân đối với icon và badge */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </span>
              <h2 className="text-sm font-bold text-slate-800 tracking-tight">Nhắc hạn thanh toán</h2>
            </div>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                {unreadCount} mới
              </span>
            )}
          </div>

          {error && (
            <p role="alert" className="mb-2.5 p-2 rounded-lg bg-rose-50 text-xs font-medium text-rose-700 border border-rose-200">
              {error}
            </p>
          )}

          {loading ? (
            <div className="py-8 text-center">
              <div className="inline-block w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-xs text-slate-500 font-medium">Đang tải thông báo...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-6 px-4 text-center flex flex-col items-center justify-center">
              <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <p className="text-xs font-semibold text-slate-700">Chưa có thông báo nào</p>
              <p className="text-[11.5px] text-slate-400 mt-0.5">Các hóa đơn sắp đến hạn hoặc quá hạn sẽ hiển thị tại đây.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 space-y-1">
              {items.map((item) => (
                <li key={item.id} className="pt-1">
                  <button
                    type="button"
                    onClick={() => void openInvoice(item)}
                    className={`w-full rounded-xl border p-2.5 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700 ${
                      item.is_read
                        ? 'border-transparent text-slate-700 hover:bg-slate-50'
                        : 'border-emerald-200 bg-emerald-50/70 text-emerald-950 hover:bg-emerald-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-slate-800 line-clamp-1">{item.title}</span>
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                      )}
                    </div>
                    <span className="block text-xs text-slate-600 leading-relaxed">{item.body}</span>
                    <span className="mt-1.5 block text-[10.5px] font-medium text-slate-400">
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
