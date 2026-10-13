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
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '12px 14px',
        marginTop: '14px',
        marginBottom: '14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          paddingBottom: '8px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
            Lịch sử phê duyệt & xử lý đơn hàng
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '500',
              color: '#0369a1',
              background: '#e0f2fe',
              padding: '1px 6px',
              borderRadius: '4px',
              border: '1px solid #bae6fd',
            }}
          >
            Bất biến (Chỉ đọc)
          </span>
        </div>
        <span style={{ fontSize: '11.5px', color: '#64748b' }}>
          {history.length} bản ghi ghi nhận
        </span>
      </div>

      {loading ? (
        <div style={{ padding: '12px', textAlign: 'center', fontSize: '12.5px', color: '#64748b' }}>
          Đang tải lịch sử phê duyệt...
        </div>
      ) : error ? (
        <div style={{ padding: '10px', fontSize: '12px', color: '#dc2626', background: '#fef2f2', borderRadius: '6px' }}>
          {error}
        </div>
      ) : history.length === 0 ? (
        <div style={{ padding: '12px', textAlign: 'center', fontSize: '12.5px', color: '#94a3b8' }}>
          Chưa có bản ghi phê duyệt nào cho đơn hàng này.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '6px 8px', fontWeight: '600', whiteSpace: 'nowrap' }}>Thời gian</th>
                <th style={{ padding: '6px 8px', fontWeight: '600', whiteSpace: 'nowrap' }}>Người thực hiện</th>
                <th style={{ padding: '6px 8px', fontWeight: '600', whiteSpace: 'nowrap' }}>Hành động</th>
                <th style={{ padding: '6px 8px', fontWeight: '600' }}>Ý kiến / Nội dung chỉ đạo</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item, idx) => {
                const badgeStyle = getActionBadgeStyle(item.action_type);
                const timeStr = item.created_at
                  ? new Date(item.created_at).toLocaleString('vi-VN')
                  : '—';

                return (
                  <tr
                    key={item.id || idx}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '7px 8px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {timeStr}
                    </td>
                    <td style={{ padding: '7px 8px', fontWeight: '600', color: '#1e293b', whiteSpace: 'nowrap' }}>
                      {item.user_name}
                    </td>
                    <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '1.5px 7px',
                          borderRadius: '999px',
                          fontSize: '11px',
                          fontWeight: '600',
                          ...badgeStyle,
                        }}
                      >
                        {item.action_label}
                      </span>
                    </td>
                    <td style={{ padding: '7px 8px', color: '#334155', lineHeight: '1.35', maxWidth: '300px' }}>
                      {item.reason ? (
                        <span>{item.reason}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
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
