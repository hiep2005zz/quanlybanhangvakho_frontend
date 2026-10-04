import React, { useEffect, useState } from 'react';
import {
  getOrdersApi,
  approveOrderApi,
  OrderResponseData,
  User,
  ProductItem,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { OrderCreateModal } from './OrderCreateModal';

interface OrderManagementViewProps {
  currentUser: User;
  token: string;
  products: ProductItem[];
  onBackToHome?: () => void;
  onRefreshProducts?: () => void;
}

export const OrderManagementView: React.FC<OrderManagementViewProps> = ({
  currentUser,
  token,
  products,
  onBackToHome,
  onRefreshProducts,
}) => {
  const [orders, setOrders] = useState<OrderResponseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'CONFIRMED'>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [approvingOrderId, setApprovingOrderId] = useState<number | string | null>(null);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<OrderResponseData | null>(null);

  const rawRoles = currentUser.roles && currentUser.roles.length > 0 ? currentUser.roles : [currentUser.role];
  const isAdmin = currentUser.role === 'admin' || rawRoles.includes('admin');
  const isSalesManager = currentUser.role === 'sales_manager' || rawRoles.includes('sales_manager');
  const canApprove = isAdmin || isSalesManager;

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrdersApi(token);
      setOrders(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách đơn hàng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const handleApprove = async (order: OrderResponseData) => {
    if (!window.confirm(`Xác nhận duyệt đơn hàng ${order.order_code} (Bán dưới giá sàn)?`)) {
      return;
    }

    setApprovingOrderId(order.order_code);
    try {
      const updated = await approveOrderApi(token, order.order_code);
      emitStatusToast({
        title: 'Duyệt đơn thành công',
        message: `Đơn hàng ${updated.order_code} đã được duyệt và chuyển sang trạng thái ĐÃ XÁC NHẬN để xuất kho.`,
      });
      await fetchOrders();
      if (onRefreshProducts) onRefreshProducts();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi duyệt đơn hàng');
    } finally {
      setApprovingOrderId(null);
    }
  };

  // KPI calculations
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING_APPROVAL').length;
  const confirmedOrdersCount = orders.filter((o) => o.status === 'CONFIRMED').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    const q = searchTerm.trim().toLowerCase();
    const matchSearch =
      !q ||
      o.order_code.toLowerCase().includes(q) ||
      o.dealer_name.toLowerCase().includes(q) ||
      o.created_by.toLowerCase().includes(q);

    const matchStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PENDING_APPROVAL' && o.status === 'PENDING_APPROVAL') ||
      (statusFilter === 'CONFIRMED' && o.status === 'CONFIRMED');

    return matchSearch && matchStatus;
  });

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                ← Quay lại Kho
              </button>
            )}
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Quản Lý Đơn Hàng & Bán Hàng
            </h2>
          </div>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '6px', margin: 0 }}>
            Kết nối trực tiếp Bảng giá theo nhóm khách hàng · Tự động kiểm soát giá sàn & quy trình duyệt ngoại lệ
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={fetchOrders}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '9px 14px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
            }}
            title="Tải lại danh sách"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            id="btn-create-order-view"
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '700',
              color: '#ffffff',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>+ Tạo Đơn Hàng Mới</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Tổng số đơn hàng</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>{totalOrdersCount} đơn</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Toàn bộ đơn hàng trong hệ thống</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #fed7aa', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#d97706', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚠️ Đơn chờ quản lý duyệt</span>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#b45309', marginTop: '6px' }}>{pendingOrdersCount} đơn</div>
          <div style={{ fontSize: '12px', color: '#d97706', marginTop: '4px' }}>Bán dưới giá sàn cần phê duyệt</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#16a34a', fontWeight: '600' }}>✓ Đơn đã xác nhận</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#15803d', marginTop: '6px' }}>{confirmedOrdersCount} đơn</div>
          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>Đủ điều kiện xuất kho bán hàng</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Tổng doanh thu bán hàng</div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#2563eb', marginTop: '6px' }}>{totalRevenue.toLocaleString('vi-VN')} đ</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>Giá trị lũy kế các đơn hàng</div>
        </div>
      </div>

      {/* Main Table Card */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {/* Filters */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <span style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }}>🔍</span>
              <input
                type="text"
                placeholder="Tìm mã đơn, tên đại lý, người tạo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  background: '#ffffff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'inline-flex', background: '#e2e8f0', padding: '2px', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: statusFilter === 'ALL' ? '#ffffff' : 'transparent',
                  color: statusFilter === 'ALL' ? '#0f172a' : '#64748b',
                  fontWeight: statusFilter === 'ALL' ? '700' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: statusFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Tất cả ({totalOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING_APPROVAL')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: statusFilter === 'PENDING_APPROVAL' ? '#ffffff' : 'transparent',
                  color: statusFilter === 'PENDING_APPROVAL' ? '#d97706' : '#64748b',
                  fontWeight: statusFilter === 'PENDING_APPROVAL' ? '700' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: statusFilter === 'PENDING_APPROVAL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Chờ duyệt ({pendingOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CONFIRMED')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: statusFilter === 'CONFIRMED' ? '#ffffff' : 'transparent',
                  color: statusFilter === 'CONFIRMED' ? '#16a34a' : '#64748b',
                  fontWeight: statusFilter === 'CONFIRMED' ? '700' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: statusFilter === 'CONFIRMED' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Đã duyệt ({confirmedOrdersCount})
              </button>
            </div>
          </div>

          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Hiển thị <strong>{filteredOrders.length}</strong> / {totalOrdersCount} đơn hàng
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '30px', marginBottom: '12px' }}>⏳</div>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>Đang tải danh sách đơn hàng...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#dc2626' }}>
            ⚠️ {error}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#334155' }}>Không có đơn hàng nào phù hợp</div>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', marginTop: '4px' }}>
              Hãy nhấn nút "+ Tạo Đơn Hàng Mới" để lên đơn bán hàng cho khách hàng.
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '12px 18px', fontWeight: '700' }}>Mã Đơn</th>
                <th style={{ padding: '12px 18px', fontWeight: '700' }}>Khách Hàng / Đại Lý</th>
                <th style={{ padding: '12px 18px', fontWeight: '700' }}>Người Lên Đơn</th>
                <th style={{ padding: '12px 18px', fontWeight: '700', textAlign: 'right' }}>Tổng Giá Trị</th>
                <th style={{ padding: '12px 18px', fontWeight: '700', textAlign: 'center' }}>Trạng Thái Duyệt</th>
                <th style={{ padding: '12px 18px', fontWeight: '700' }}>Lý Do Cảnh Báo</th>
                <th style={{ padding: '12px 18px', fontWeight: '700', textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, idx) => {
                const isPending = order.status === 'PENDING_APPROVAL';
                return (
                  <tr
                    key={order.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isPending ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '14px 18px', fontFamily: 'monospace', fontWeight: '700', color: '#1e293b' }}>
                      {order.order_code}
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{order.dealer_name}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                        Mã đại lý: #{order.dealer_id}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: '500', color: '#334155' }}>
                        {order.assigned_sale_name || order.created_by}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                        User: @{order.created_by}
                      </div>
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                      {order.total_amount.toLocaleString('vi-VN')} đ
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      {isPending ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            borderRadius: '999px',
                            padding: '3px 10px',
                            fontSize: '12px',
                            fontWeight: '700',
                          }}
                        >
                          ⏳ Chờ duyệt (Dưới sàn)
                        </span>
                      ) : order.status === 'CONFIRMED' ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#dcfce7',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            borderRadius: '999px',
                            padding: '3px 10px',
                            fontSize: '12px',
                            fontWeight: '700',
                          }}
                        >
                          ✓ Đã xác nhận
                        </span>
                      ) : (
                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#64748b',
                            borderRadius: '999px',
                            padding: '3px 10px',
                            fontSize: '12px',
                            fontWeight: '600',
                          }}
                        >
                          {order.status}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', maxWidth: '280px' }}>
                      {order.approval_reason ? (
                        <div style={{ fontSize: '12px', color: '#b45309', fontWeight: '500', lineHeight: '1.4' }}>
                          ⚠️ {order.approval_reason}
                        </div>
                      ) : order.approved_by ? (
                        <div style={{ fontSize: '11.5px', color: '#16a34a' }}>
                          ✓ Duyệt bởi @{order.approved_by}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Giá chuẩn bảng giá</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        {/* Nút Duyệt cho sales_manager và admin khi đơn PENDING_APPROVAL */}
                        {isPending && canApprove && (
                          <button
                            type="button"
                            onClick={() => handleApprove(order)}
                            disabled={approvingOrderId === order.order_code}
                            style={{
                              padding: '5px 12px',
                              background: '#16a34a',
                              border: 'none',
                              borderRadius: '6px',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: approvingOrderId === order.order_code ? 'not-allowed' : 'pointer',
                              boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                            }}
                            title="Phê duyệt đơn hàng bán dưới giá sàn"
                          >
                            {approvingOrderId === order.order_code ? 'Đang duyệt...' : '✓ Duyệt đơn'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedOrderDetail(order)}
                          style={{
                            padding: '5px 10px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#334155',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                          title="Xem chi tiết các mặt hàng"
                        >
                          Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Xem Chi Tiết Đơn Hàng */}
      {selectedOrderDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Chi Tiết Đơn Hàng #{selectedOrderDetail.order_code}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Khách hàng: <strong>{selectedOrderDetail.dealer_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '20px', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {selectedOrderDetail.approval_reason && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#b45309' }}>
                ⚠️ <strong>Lý do yêu cầu duyệt:</strong> {selectedOrderDetail.approval_reason}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left' }}>Sản phẩm</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center' }}>ĐVT</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Số lượng</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Đơn giá</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrderDetail.items || []).map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: '500' }}>{item.product_name || `SP #${item.product_id}`}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>{item.unit_name || 'Cái'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>{item.quantity}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>{(item.price || 0).toLocaleString('vi-VN')} đ</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>
                        {((item.quantity || 1) * (item.price || 0)).toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Trạng thái: <strong style={{ color: selectedOrderDetail.status === 'CONFIRMED' ? '#16a34a' : '#d97706' }}>{selectedOrderDetail.status}</strong>
              </div>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                Tổng cộng: {selectedOrderDetail.total_amount.toLocaleString('vi-VN')} đ
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {selectedOrderDetail.status === 'PENDING_APPROVAL' && canApprove && (
                <button
                  type="button"
                  onClick={async () => {
                    await handleApprove(selectedOrderDetail);
                    setSelectedOrderDetail(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#16a34a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  ✓ Duyệt đơn hàng này
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                style={{
                  padding: '8px 16px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tạo Đơn Hàng */}
      {isCreateModalOpen && (
        <OrderCreateModal
          isOpen={isCreateModalOpen}
          token={token}
          currentUser={currentUser}
          products={products}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchOrders();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      )}
    </div>
  );
};
export default OrderManagementView;
