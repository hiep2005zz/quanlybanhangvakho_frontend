import React, { useState, useEffect } from 'react';
import {
  User,
  DealerCreditInfo,
  getDealerCreditInfoApi,
  getOrderDealersApi,
  getOrdersApi,
  OrderResponseData,
} from '../services/api';

interface CustomerDebtViewProps {
  currentUser: User;
  token: string;
  onBackToPortal?: () => void;
  onNavigateToOrders?: () => void;
}

export const CustomerDebtView: React.FC<CustomerDebtViewProps> = ({
  currentUser,
  token,
  onBackToPortal,
  onNavigateToOrders,
}) => {
  const [customerDealer, setCustomerDealer] = useState<any | null>(null);
  const [creditInfo, setCreditInfo] = useState<DealerCreditInfo | null>(null);
  const [orders, setOrders] = useState<OrderResponseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchDebtData = async () => {
      setLoading(true);
      setError(null);
      try {
        const dealers = await getOrderDealersApi(token);
        if (!dealers || dealers.length === 0) {
          throw new Error('Không tìm thấy thông tin đại lý cho tài khoản này.');
        }
        const dealer = dealers[0];
        if (!isMounted) return;
        setCustomerDealer(dealer);

        const [credit, orderList] = await Promise.all([
          getDealerCreditInfoApi(token, dealer.id),
          getOrdersApi(token),
        ]);

        if (!isMounted) return;
        setCreditInfo(credit);
        setOrders(orderList || []);
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Lỗi khi tải dữ liệu công nợ.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDebtData();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Tính tổng giá trị các đơn hàng
  const totalOrdersAmount = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return (
    <div className="w-full min-h-full bg-slate-50 flex flex-col p-4 md:p-8">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                {customerDealer?.customer_group || 'Đại lý'}
              </span>
              <span className="text-xs text-gray-500">
                Mã: {customerDealer?.dealer_code || currentUser.username}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Hồ Sơ Công Nợ & Lịch Sử Hóa Đơn
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Đại lý: <strong className="text-gray-800">{customerDealer?.dealer_name || currentUser.full_name}</strong>
              {customerDealer?.phone ? ` | ĐT: ${customerDealer.phone}` : ''}
              {customerDealer?.address ? ` | ĐC: ${customerDealer.address}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {onBackToPortal && (
              <button
                type="button"
                id="btn-back-to-products"
                onClick={onBackToPortal}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                Đặt hàng sản phẩm
              </button>
            )}
            {onNavigateToOrders && (
              <button
                type="button"
                id="btn-goto-orders"
                onClick={onNavigateToOrders}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors shadow-xs"
              >
                Đơn hàng của tôi
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
            <div className="animate-spin text-2xl mb-2">⏳</div>
            <div className="text-sm font-semibold">Đang tải dữ liệu hạn mức và công nợ...</div>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-sm font-semibold">
            ⚠️ {error}
          </div>
        ) : (
          <>
            {/* THẺ TỔNG HỢP TÍN DỤNG & CÔNG NỢ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                <div className="text-sm font-medium text-gray-500">
                  Hạn mức tín dụng được cấp
                </div>
                <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                  {creditInfo?.credit_limit.toLocaleString('vi-VN')} đ
                </div>
                <div className="text-xs text-gray-500 mt-1.5">
                  Áp dụng theo hạn mức thỏa thuận hợp đồng
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                <div className="text-sm font-medium text-gray-500">
                  Dư nợ hiện tại
                </div>
                <div className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">
                  {creditInfo?.current_debt.toLocaleString('vi-VN')} đ
                </div>
                <div className="text-xs text-gray-500 mt-1.5">
                  Tổng các đơn hàng đang ghi nhận nợ
                </div>
              </div>

              <div className={`rounded-xl p-4 shadow-xs border ${
                (creditInfo?.remaining_credit || 0) > 0
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="text-sm font-medium text-emerald-800">
                  Hạn mức công nợ còn lại
                </div>
                <div className="text-xl sm:text-2xl font-bold mt-1 text-emerald-700">
                  {creditInfo?.remaining_credit.toLocaleString('vi-VN')} đ
                </div>
                <div className="text-xs text-emerald-800 mt-1.5">
                  Số dư sẵn sàng để tiếp tục đặt hàng
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                <div className="text-sm font-medium text-gray-500">
                  Quy định thời hạn nợ
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">
                  {creditInfo?.overdue_days_allowed || 30} <span className="text-sm font-normal text-gray-500">ngày</span>
                </div>
                <div className="text-xs mt-1.5">
                  {creditInfo?.is_overdue ? (
                    <span className="text-rose-600 font-semibold">Đang có nợ quá hạn</span>
                  ) : (
                    <span className="text-emerald-600 font-semibold">Tình trạng nợ chuẩn hạn</span>
                  )}
                </div>
              </div>
            </div>

            {/* CẢNH BÁO CÔNG NỢ TỰ ĐỘNG (S7-04) */}
            {(creditInfo?.credit_warning_flag || creditInfo?.is_over_credit_limit || creditInfo?.is_overdue) && (
              <div className="bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 p-4 rounded-xl shadow-xs">
                <div className="flex items-start gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-rose-800">
                      Cảnh báo rủi ro tín dụng & công nợ tự động
                    </h3>
                    <p className="text-xs text-rose-700 mt-1 leading-relaxed">
                      {creditInfo.credit_flag_reason || 'Đại lý đang vượt hạn mức tín dụng hoặc có khoản nợ quá số ngày cho phép.'}
                      {' '}Đơn đặt hàng mới có thể bị hệ thống chặn hoặc chuyển sang trạng thái Cần duyệt theo chính sách kiểm soát rủi ro.
                    </p>
                    {creditInfo.last_credit_evaluated_at && (
                      <div className="text-[11px] text-rose-500 mt-1.5">
                        Thời điểm đánh giá gần nhất: {new Date(creditInfo.last_credit_evaluated_at).toLocaleString('vi-VN')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* DANH SÁCH ĐƠN HÀNG & HÓA ĐƠN ĐÃ ĐẶT */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
                <div>
                  <h2 className="text-base font-bold text-gray-900">
                    Lịch Sử Đơn Hàng & Hóa Đơn Của Đại Lý ({orders.length})
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Tất cả đơn hàng phát sinh từ Cổng đặt hàng của đại lý
                  </p>
                </div>
                <div className="text-sm font-medium text-gray-700">
                  Tổng doanh số: <strong className="text-emerald-700">{totalOrdersAmount.toLocaleString('vi-VN')} đ</strong>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="text-2xl mb-1">📦</div>
                  <p className="text-sm font-medium">Chưa có đơn hàng hoặc hóa đơn nào được tạo</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-gray-600 text-xs uppercase font-semibold border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3">Mã Đơn Hàng</th>
                        <th className="px-6 py-3">Ngày Đặt</th>
                        <th className="px-6 py-3 text-right">Tổng Tiền</th>
                        <th className="px-6 py-3 text-center">Trạng Thái</th>
                        <th className="px-6 py-3">Điểm Nhận Hàng</th>
                        <th className="px-6 py-3">Ghi Chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {orders.map((ord) => {
                        const isPending = ord.status === 'PENDING_APPROVAL';
                        const isConfirmed = ord.status === 'CONFIRMED';
                        const isCancelled = ord.status === 'CANCELLED';

                        return (
                          <tr key={ord.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-6 py-3.5 font-bold text-slate-800 text-xs">
                              {ord.order_code}
                            </td>
                            <td className="px-6 py-3.5 text-xs text-gray-600">
                              {ord.created_at ? new Date(ord.created_at).toLocaleString('vi-VN') : '—'}
                            </td>
                            <td className="px-6 py-3.5 text-right font-bold text-emerald-700 text-xs">
                              {ord.total_amount?.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="px-6 py-3.5 text-center">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  isPending
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : isConfirmed
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : isCancelled
                                    ? 'bg-gray-100 text-gray-600 border border-gray-200'
                                    : 'bg-blue-100 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {isPending ? 'Chờ duyệt' : isConfirmed ? 'Đã xác nhận' : isCancelled ? 'Đã hủy' : ord.status}
                              </span>
                            </td>
                            <td className="px-6 py-3.5 text-xs text-gray-600 max-w-xs truncate">
                              {ord.delivery_point || 'Địa chỉ đại lý'}
                            </td>
                            <td className="px-6 py-3.5 text-xs text-gray-500 italic max-w-xs truncate">
                              {ord.note || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
export default CustomerDebtView;
