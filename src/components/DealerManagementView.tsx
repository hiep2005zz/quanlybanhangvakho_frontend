import { useState, useEffect } from 'react';
import { getClientSession, authenticatedFetch, API_BASE_URL } from '../services/api';
import { emitStatusToast } from './StatusToast';

export default function DealerManagementView() {
  const [dealers, setDealers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal State
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState<any | null>(null);
  const [lockReason, setLockReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDealers = async () => {
    try {
      setIsLoading(true);
      const session = getClientSession();
      if (!session.token) throw new Error('Chưa đăng nhập');
      
      const response = await authenticatedFetch(`${API_BASE_URL}/orders/dealers`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const res = await response.json();
      setDealers(res.dealers || []);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách đại lý');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDealers();
  }, []);

  const openLockModal = (dealer: any) => {
    setSelectedDealer(dealer);
    setLockReason('');
    setLockModalOpen(true);
  };

  const openUnlockModal = (dealer: any) => {
    setSelectedDealer(dealer);
    setUnlockModalOpen(true);
  };

  const handleLock = async () => {
    if (!lockReason.trim()) {
      emitStatusToast({ message: 'Vui lòng nhập lý do khóa', title: 'Lỗi khóa đại lý' });
      return;
    }
    try {
      setIsSubmitting(true);
      const session = getClientSession();
      const res = await authenticatedFetch(`${API_BASE_URL}/orders/dealers/${selectedDealer.id}/lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`
        },
        body: JSON.stringify({ lock_reason: lockReason.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Lỗi khi khóa đại lý');
      }
      emitStatusToast({ message: `Đã khóa giao dịch thành công cho đại lý "${selectedDealer.name}".`, title: 'Khóa đại lý thành công' });
      setLockModalOpen(false);
      setSelectedDealer(null);
      fetchDealers();
    } catch (err: any) {
      emitStatusToast({ message: err.message || 'Lỗi khi khóa đại lý', title: 'Lỗi thao tác' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlock = async () => {
    if (!selectedDealer) return;
    try {
      setIsSubmitting(true);
      const session = getClientSession();
      const res = await authenticatedFetch(`${API_BASE_URL}/orders/dealers/${selectedDealer.id}/unlock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Lỗi khi mở khóa');
      }
      emitStatusToast({ message: `Đã mở khóa giao dịch thành công cho đại lý "${selectedDealer.name}".`, title: 'Mở khóa đại lý thành công' });
      setUnlockModalOpen(false);
      setSelectedDealer(null);
      fetchDealers();
    } catch (err: any) {
      emitStatusToast({ message: err.message || 'Lỗi khi mở khóa', title: 'Lỗi thao tác' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>Quản Lý Đại Lý</h2>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748b' }}>Quản lý danh sách đại lý và kiểm soát trạng thái khóa/mở giao dịch bán hàng</p>
        </div>
        <button onClick={fetchDealers} style={{ padding: '8px 16px', background: '#3b82f6', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13.5px' }}>
          ↻ Tải lại
        </button>
      </div>

      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Đang tải danh sách đại lý...</div>
      ) : error ? (
        <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: '8px' }}>{error}</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#475569', fontSize: '13px' }}>Mã Đại Lý</th>
              <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#475569', fontSize: '13px' }}>Tên Đại Lý</th>
              <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#475569', fontSize: '13px' }}>Hạn Mức</th>
              <th style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#475569', fontSize: '13px' }}>Trạng Thái</th>
              <th style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontWeight: '700', color: '#475569', fontSize: '13px' }}>Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            {dealers.map(d => (
              <tr key={d.id}>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace', fontWeight: '700', color: '#3b82f6' }}>{d.code}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <strong style={{ color: '#0f172a', fontSize: '14px' }}>{d.name}</strong>
                  {d.address && <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>📍 {d.address}</div>}
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', fontWeight: '600', color: '#334155' }}>
                  {d.credit_limit ? `${d.credit_limit.toLocaleString('vi-VN')} đ` : 'Chưa có'}
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  {d.status === 'LOCKED' ? (
                    <div>
                      <span style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700' }}>BỊ KHÓA</span>
                      {d.lock_reason && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>Lý do: {d.lock_reason}</div>}
                    </div>
                  ) : (
                    <span style={{ color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: '700' }}>HOẠT ĐỘNG</span>
                  )}
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                  {d.status === 'LOCKED' ? (
                    <button onClick={() => openUnlockModal(d)} disabled={isSubmitting} style={{ padding: '6px 14px', background: '#10b981', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                      🔓 Mở khóa
                    </button>
                  ) : (
                    <button onClick={() => openLockModal(d)} disabled={isSubmitting} style={{ padding: '6px 14px', background: '#ef4444', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                      🔒 Khóa giao dịch
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {dealers.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Chưa có dữ liệu đại lý nào trong hệ thống</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {/* Modal Khóa Đại Lý */}
      {lockModalOpen && selectedDealer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '440px', maxWidth: '92vw', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#0f172a', fontSize: '18px' }}>Khóa Đại Lý: {selectedDealer.name}</h3>
            <p style={{ fontSize: '13.5px', color: '#dc2626', background: '#fef2f2', padding: '10px 12px', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '16px', lineHeight: '1.5' }}>
              ⚠️ Việc khóa đại lý sẽ dừng ngay lập tức khả năng tạo đơn hàng mới của đại lý này trên hệ thống.
            </p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: '#334155' }}>Lý do khóa <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea
                value={lockReason}
                onChange={e => setLockReason(e.target.value)}
                placeholder="Nhập lý do khóa giao dịch..."
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', minHeight: '80px', fontFamily: 'inherit', fontSize: '13.5px', outline: 'none' }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setLockModalOpen(false)} style={{ padding: '9px 18px', background: '#f1f5f9', color: '#475569', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13.5px' }}>Hủy</button>
              <button onClick={handleLock} disabled={isSubmitting || !lockReason.trim()} style={{ padding: '9px 18px', background: '#ef4444', color: '#fff', borderRadius: '8px', border: 'none', cursor: isSubmitting || !lockReason.trim() ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13.5px', opacity: isSubmitting || !lockReason.trim() ? 0.7 : 1 }}>
                {isSubmitting ? 'Đang khóa...' : 'Xác nhận khóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mở Khóa Đại Lý */}
      {unlockModalOpen && selectedDealer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', width: '440px', maxWidth: '92vw', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#0f172a', fontSize: '18px' }}>Mở Khóa Đại Lý: {selectedDealer.name}</h3>
            <p style={{ fontSize: '13.5px', color: '#16a34a', background: '#f0fdf4', padding: '10px 12px', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '20px', lineHeight: '1.5' }}>
              ℹ️ Đại lý sẽ được cho phép khôi phục giao dịch và tạo các đơn hàng mới bình thường.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setUnlockModalOpen(false)} style={{ padding: '9px 18px', background: '#f1f5f9', color: '#475569', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13.5px' }}>Hủy</button>
              <button onClick={handleUnlock} disabled={isSubmitting} style={{ padding: '9px 18px', background: '#10b981', color: '#fff', borderRadius: '8px', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '13.5px', opacity: isSubmitting ? 0.7 : 1 }}>
                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận mở khóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
