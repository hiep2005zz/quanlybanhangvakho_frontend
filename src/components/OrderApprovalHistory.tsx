import React, { useEffect, useState } from 'react';
import { ApprovalHistoryItem, getOrderApprovalHistoryApi } from '../services/api';

interface OrderApprovalHistoryProps {
  orderCode: string;
  token: string;
}

export const OrderApprovalHistory: React.FC<OrderApprovalHistoryProps> = ({ orderCode, token }) => {
  const [history, setHistory] = useState<ApprovalHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getOrderApprovalHistoryApi(token, orderCode);
        if (isMounted) {
          setHistory(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Không thể tải lịch sử phê duyệt.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (orderCode && token) {
      fetchHistory();
    }
    return () => {
      isMounted = false;
    };
  }, [orderCode, token]);

  const getActionBadgeStyle = (actionType: string) => {
    switch (actionType) {
      case 'ORDER_APPROVE':
        return {
          background: '#dcfce7',
          color: '#15803d',
          border: '1px solid #bbf7d0',
        };
      case 'ORDER_RETURN_FOR_EDIT':
        return {
          background: '#ffedd5',
          color: '#c2410c',
          border: '1px solid #fed7aa',
        };
      case 'ORDER_REJECT':
        return {
          background: '#fee2e2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
        };
      case 'ORDER_CANCEL':
        return {
          background: '#f1f5f9',
          color: '#475569',
          border: '1px solid #cbd5e1',
        };
      case 'ORDER_CREATE':
        return {
          background: '#e0f2fe',
          color: '#0369a1',
          border: '1px solid #bae6fd',
        };
      default:
        return {
          background: '#f1f5f9',
          color: '#334155',
          border: '1px solid #e2e8f0',
        };
    }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden my-4">
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">
            Lịch sử phê duyệt & xử lý đơn hàng
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          {history.length} bản ghi ghi nhận
        </span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-500">
          Đang tải lịch sử phê duyệt...
        </div>
      ) : error ? (
        <div className="p-4 m-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
          {error}
        </div>
      ) : history.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          Chưa có bản ghi phê duyệt nào cho đơn hàng này.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold">
                <th className="py-3 px-4 whitespace-nowrap">Thời gian</th>
                <th className="py-3 px-4 whitespace-nowrap">Người thực hiện</th>
                <th className="py-3 px-4 whitespace-nowrap">Hành động</th>
                <th className="py-3 px-4">Ý kiến / Nội dung chỉ đạo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((item, idx) => {
                const badgeStyle = getActionBadgeStyle(item.action_type);
                const timeStr = item.created_at
                  ? new Date(item.created_at).toLocaleString('vi-VN')
                  : '—';

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {timeStr}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {item.user_name}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: '600',
                          ...badgeStyle,
                        }}
                      >
                        {item.action_label}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 max-w-xs break-words">
                      {item.reason || <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OrderApprovalHistory;
