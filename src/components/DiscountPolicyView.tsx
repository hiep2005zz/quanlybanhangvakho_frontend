import React, { useState } from 'react';
import { User } from '../services/api';
import { emitStatusToast } from './StatusToast';

interface DiscountTier {
  id: string;
  min_quantity: number;
  max_quantity: number | null; // null = Không giới hạn (Từ X sản phẩm trở lên)
  discount_percent: number;
}

interface DiscountPolicy {
  id?: string;
  title: string;
  code: string;
  target_group: 'all' | 'agent_tier_1' | 'agent_tier_2';
  start_date: string;
  end_date: string;
  status: 'active' | 'draft' | 'expired';
  tiers: DiscountTier[];
  note?: string;
}

interface DiscountPolicyViewProps {
  token: string;
  user: User;
  onBackToHome?: () => void;
}

export default function DiscountPolicyView({ token, user, onBackToHome }: DiscountPolicyViewProps) {
  console.log(token, user);
  const [policies, setPolicies] = useState<DiscountPolicy[]>(() => {
    const saved = localStorage.getItem('discountPolicies');
    if (saved) {
      return JSON.parse(saved);
    }
    return [
      {
        id: '1',
        title: 'Chính sách chiết khấu - Đại lý Cấp 1',
        code: 'CK-CAP1',
        target_group: 'agent_tier_1',
        start_date: '2026-10-01',
        end_date: '2026-12-31',
        status: 'active',
        note: 'Áp dụng cho đơn hàng đạt mốc sản lượng',
        tiers: [
          { id: 't1', min_quantity: 100, max_quantity: 499, discount_percent: 5 },
          { id: 't2', min_quantity: 500, max_quantity: 999, discount_percent: 8 },
          { id: 't3', min_quantity: 1000, max_quantity: null, discount_percent: 12 },
        ],
      },
    ];
  });

  React.useEffect(() => {
    localStorage.setItem('discountPolicies', JSON.stringify(policies));
  }, [policies]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<DiscountPolicy>({
    title: '',
    code: '',
    target_group: 'all',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    status: 'active',
    note: '',
    tiers: [
      { id: Date.now().toString(), min_quantity: 50, max_quantity: 100, discount_percent: 3 },
    ],
  });

  // Xử lý thêm mốc sản lượng (Tier)
  const handleAddTier = () => {
    const lastTier = formData.tiers[formData.tiers.length - 1];
    const newMin = lastTier && lastTier.max_quantity ? lastTier.max_quantity + 1 : 100;
    
    setFormData({
      ...formData,
      tiers: [
        ...formData.tiers,
        { id: Date.now().toString(), min_quantity: newMin, max_quantity: null, discount_percent: 5 },
      ],
    });
  };

  // Xử lý xóa mốc sản lượng
  const handleRemoveTier = (id: string) => {
    if (formData.tiers.length === 1) {
      emitStatusToast({ title: 'Lỗi', message: 'Chính sách phải có ít nhất 1 mốc chiết khấu!' });
      return;
    }
    setFormData({
      ...formData,
      tiers: formData.tiers.filter((t) => t.id !== id),
    });
  };

  // Cập nhật giá trị mốc sản lượng
  const handleTierChange = (id: string, field: keyof DiscountTier, value: any) => {
    setFormData({
      ...formData,
      tiers: formData.tiers.map((t) => {
        if (t.id === id) {
          return { ...t, [field]: value === '' ? null : Number(value) };
        }
        return t;
      }),
    });
  };

  // Lưu chính sách chiết khấu mới
  const handleSavePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.code) {
      emitStatusToast({ title: 'Lỗi', message: 'Vui lòng nhập đầy đủ Tên chính sách và Mã áp dụng!' });
      return;
    }

    const newPolicy: DiscountPolicy = {
      ...formData,
      id: Date.now().toString(),
    };

    setPolicies([newPolicy, ...policies]);
    setIsModalOpen(false);
    emitStatusToast({ title: 'Thành công', message: 'Khai báo chính sách chiết khấu sản lượng thành công!' });
  };

  const handleDeletePolicy = (id: string | undefined) => {
    if (!id) return;
    setPolicies(policies.filter(p => p.id !== id));
    emitStatusToast({ title: 'Thành công', message: 'Xóa chính sách thành công!' });
  };

  // Quay lại trang chủ (Kho hàng) an toàn
  const handleGoHome = () => {
    if (onBackToHome) {
      onBackToHome();
    } else {
      try {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch {
        window.location.href = '/';
      }
    }
  };

  return (
    <div style={{ padding: '8px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Breadcrumb & Nút quay lại trang chủ */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px',
          color: '#64748b',
          fontWeight: '500',
          padding: '2px 4px',
          marginBottom: '18px',
        }}
      >
        <button
          onClick={handleGoHome}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            color: '#2563eb',
            cursor: 'pointer',
            padding: '6px 16px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2563eb';
            e.currentTarget.style.background = '#eff6ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.background = '#ffffff';
          }}
          title="Quay lại trang Kho hàng"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Quay lại trang chủ</span>
        </button>
        <span>/</span>
        <span style={{ color: '#0f172a', fontWeight: '600' }}>Chính sách chiết khấu sản lượng</span>
      </div>

      {/* Header View */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a', fontWeight: '700' }}>
            Quản Lý Chính Sách Chiết Khấu Sản Lượng
          </h2>
          <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Khai báo mốc sản lượng & tỷ lệ chiết khấu tự động dành cho đại lý
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({
              title: '',
              code: `CK-${Math.floor(1000 + Math.random() * 9000)}`,
              target_group: 'all',
              start_date: new Date().toISOString().split('T')[0],
              end_date: '',
              status: 'active',
              note: '',
              tiers: [
                { id: Date.now().toString(), min_quantity: 100, max_quantity: 499, discount_percent: 5 },
              ],
            });
            setIsModalOpen(true);
          }}
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            color: '#fff',
            border: 'none',
            padding: '10px 18px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
          }}
        >
          + Khai Báo Chính Sách Mới
        </button>
      </div>

      {/* Danh sách chính sách hiện tại */}
      <div style={{ display: 'grid', gap: '16px' }}>
        {policies.map((policy) => (
          <div
            key={policy.id}
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#1e293b' }}>
                    {policy.title}
                  </h3>
                  <span
                    style={{
                      background: '#eff6ff',
                      color: '#2563eb',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                      fontFamily: 'monospace',
                    }}
                  >
                    {policy.code}
                  </span>
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  Áp dụng: {policy.target_group === 'all' ? 'Tất cả đại lý' : policy.target_group === 'agent_tier_1' ? 'Đại lý Cấp 1' : 'Đại lý Cấp 2'} | Hiệu lực: {policy.start_date} đến {policy.end_date || 'Không thời hạn'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: policy.status === 'active' ? '#dcfce7' : '#f1f5f9',
                    color: policy.status === 'active' ? '#15803d' : '#64748b',
                  }}
                >
                  {policy.status === 'active' ? 'Đang áp dụng' : 'Dự thảo'}
                </span>
                <button
                  onClick={() => handleDeletePolicy(policy.id)}
                  style={{
                    background: 'none',
                    border: '1px solid #fee2e2',
                    borderRadius: '6px',
                    color: '#ef4444',
                    padding: '4px 8px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fef2f2';
                    e.currentTarget.style.borderColor = '#fca5a5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'none';
                    e.currentTarget.style.borderColor = '#fee2e2';
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>

            {/* Bảng bậc chiết khấu */}
            <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', marginTop: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                Bậc chiết khấu theo sản lượng:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                {policy.tiers.map((tier, idx) => (
                  <div
                    key={tier.id || idx}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      fontSize: '13px',
                    }}
                  >
                    <span style={{ color: '#64748b' }}>Từ </span>
                    <strong style={{ color: '#0f172a' }}>{tier.min_quantity}</strong>
                    <span style={{ color: '#64748b' }}> {tier.max_quantity ? `đến ${tier.max_quantity}` : '+'} sp: </span>
                    <strong style={{ color: '#16a34a', fontSize: '14px' }}>Giảm {tier.discount_percent}%</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Khai báo chính sách mới */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              width: '650px',
              maxWidth: '95vw',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Khai Báo Chính Sách Chiết Khấu</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePolicy}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                    Tên chính sách *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Chiết khấu sản lượng"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                    Mã chính sách *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                    Đối tượng áp dụng
                  </label>
                  <select
                    value={formData.target_group}
                    onChange={(e) => setFormData({ ...formData, target_group: e.target.value as any })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  >
                    <option value="all">Tất cả Đại lý</option>
                    <option value="agent_tier_1">Đại lý Cấp 1</option>
                    <option value="agent_tier_2">Đại lý Cấp 2</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                    Ngày bắt đầu
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                    Ngày kết thúc
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              {/* Bảng thiết lập Bậc Sản Lượng */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                    Cấu hình mốc sản lượng & Chiết khấu (%)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTier}
                    style={{
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    + Thêm mốc
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {formData.tiers.map((tier, index) => (
                    <div
                      key={tier.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: '#f8fafc',
                        padding: '10px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <span style={{ fontSize: '13px', color: '#64748b', minWidth: '50px' }}>Mốc {index + 1}:</span>
                      <input
                        type="number"
                        placeholder="Từ (SL)"
                        value={tier.min_quantity}
                        onChange={(e) => handleTierChange(tier.id, 'min_quantity', e.target.value)}
                        style={{ width: '100px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      <span style={{ fontSize: '13px', color: '#64748b' }}>đến</span>
                      <input
                        type="number"
                        placeholder="Không giới hạn"
                        value={tier.max_quantity ?? ''}
                        onChange={(e) => handleTierChange(tier.id, 'max_quantity', e.target.value)}
                        style={{ width: '110px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                      />
                      <span style={{ fontSize: '13px', color: '#64748b' }}>sp ➔ Giảm</span>
                      <input
                        type="number"
                        step="0.5"
                        placeholder="%"
                        value={tier.discount_percent}
                        onChange={(e) => handleTierChange(tier.id, 'discount_percent', e.target.value)}
                        style={{ width: '80px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: '700' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: '700' }}>%</span>

                      <button
                        type="button"
                        onClick={() => handleRemoveTier(tier.id)}
                        style={{
                          marginLeft: 'auto',
                          background: '#fef2f2',
                          color: '#ef4444',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                        }}
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>

                <button
                  type="submit"
                  style={{
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Lưu & Áp Dụng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
