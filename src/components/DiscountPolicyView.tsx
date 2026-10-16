import React, { useState } from 'react';
import {
  User,
  getProductsApi,
  ProductItem,
  getDiscountPoliciesApi,
  createDiscountPolicyApi,
  updateDiscountPolicyApi,
  toggleDiscountPolicyStatusApi,
  deleteDiscountPolicyApi,
  getCategoryTreeApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';

interface DiscountTier {
  id: string;
  min_quantity: number | string;
  max_quantity: number | string | null; // null = Không giới hạn (Từ X sản phẩm trở lên)
  discount_percent: number | string;
  discount_amount?: number | string;
  discount_type?: 'percent' | 'amount';
}

interface DiscountPolicy {
  id?: string;
  title: string;
  code: string;
  category?: string;
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

export default function DiscountPolicyView({ token, user, onBackToHome: _onBackToHome }: DiscountPolicyViewProps) {
  const canManageDiscounts = Boolean(
    user?.role === 'admin' ||
    user?.role === 'sales_manager' ||
    user?.roles?.includes('admin') ||
    user?.roles?.includes('sales_manager')
  );
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<string[]>([
    'Thời trang',
    'Giày dép',
    'Phụ kiện',
    'Áo Nam',
    'Quần Nam',
    'Đồ uống',
    'Đồ điện tử',
  ]);
  const [applyScope, setApplyScope] = useState<'all' | 'category' | 'product'>('all');

  React.useEffect(() => {
    let active = true;
    getProductsApi(token).then(res => {
      if (active && res.items) {
        setProducts(res.items);
        const catsFromProd = res.items.map((p: any) => p.category).filter(Boolean);
        setCategories(prev => Array.from(new Set([...prev, ...catsFromProd])));
      }
    }).catch(() => {});

    getCategoryTreeApi(token).then(tree => {
      if (active && Array.isArray(tree)) {
        const flatten = (nodes: any[]): string[] => {
          let list: string[] = [];
          for (const n of nodes) {
            if (n.name) list.push(n.name);
            if (n.sub_categories) list = list.concat(flatten(n.sub_categories));
          }
          return list;
        };
        const catsFromTree = flatten(tree);
        setCategories(prev => Array.from(new Set([...prev, ...catsFromTree])));
      }
    }).catch(() => {});

    return () => { active = false; };
  }, [token]);

  const [policies, setPolicies] = useState<DiscountPolicy[]>(() => {
    const saved = localStorage.getItem('discountPolicies');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((p: any) => ({
            ...p,
            category: p.category ? String(p.category).replace(/Qu\?n/g, 'Quần') : p.category,
          }));
        }
      } catch {}
    }
    return [];
  });

  const fetchPolicies = React.useCallback(async () => {
    try {
      const res = await getDiscountPoliciesApi(token);
      if (res && Array.isArray(res.items)) {
        const mapped: DiscountPolicy[] = res.items.map((bePolicy: any) => ({
          id: String(bePolicy.id),
          title: bePolicy.name || bePolicy.title || bePolicy.code,
          code: bePolicy.code,
          category: bePolicy.category ? String(bePolicy.category).replace(/Qu\?n/g, 'Quần') : 'ALL',
          target_group: (bePolicy.target_dealer_type === 'agent_tier_1' || bePolicy.target_group === 'agent_tier_1')
            ? 'agent_tier_1'
            : (bePolicy.target_dealer_type === 'agent_tier_2' || bePolicy.target_group === 'agent_tier_2')
            ? 'agent_tier_2'
            : 'all',
          start_date: bePolicy.start_date || '2026-01-01',
          end_date: bePolicy.end_date || '',
          status: bePolicy.is_active ? 'active' : 'expired',
          note: bePolicy.description || '',
          tiers: (bePolicy.tiers || []).map((t: any) => ({
            id: String(t.id || Math.random()),
            min_quantity: t.min_quantity,
            max_quantity: t.max_quantity ?? null,
            discount_percent: t.discount_percent || 0,
            discount_amount: t.discount_amount || 0,
            discount_type: t.discount_type || (t.discount_amount && t.discount_amount > 0 && !t.discount_percent ? 'amount' : 'percent'),
          })),
        }));
        setPolicies(mapped);
        localStorage.setItem('discountPolicies', JSON.stringify(mapped));
      }
    } catch (err) {
      console.error('Error fetching discount policies from backend:', err);
    }
  }, [token]);

  React.useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);  React.useEffect(() => {
    localStorage.setItem('discountPolicies', JSON.stringify(policies));
  }, [policies]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [formData, setFormData] = useState<DiscountPolicy>({
    title: 'Tất cả sản phẩm',
    code: '',
    category: 'ALL',
    target_group: 'all',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    status: 'active',
    note: '',
    tiers: [
      { id: Date.now().toString(), min_quantity: 50, max_quantity: 100, discount_percent: 3, discount_amount: 0, discount_type: 'percent' },
    ],
  });

  // Kiểm tra chính sách có bị chồng chéo số lượng không
  const hasOverlappingTiers = (tiers?: DiscountTier[]) => {
    if (!tiers || tiers.length < 2) return false;
    const sorted = [...tiers].sort((a, b) => Number(a.min_quantity) - Number(b.min_quantity));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      if (prev.max_quantity === null || prev.max_quantity === undefined || prev.max_quantity === '' || Number(curr.min_quantity) <= Number(prev.max_quantity)) {
        return true;
      }
    }
    return false;
  };

  // Mở modal chỉnh sửa chính sách
  const handleEditPolicy = (policy: DiscountPolicy) => {
    setEditingPolicyId(policy.id || null);
    let scope: 'all' | 'category' | 'product' = 'all';
    if (policy.category && policy.category !== 'ALL' && policy.category !== 'PRODUCT') {
      scope = 'category';
    } else if (policy.title && policy.title !== 'Tất cả sản phẩm') {
      scope = 'product';
    }
    setApplyScope(scope);
    setFormData({
      id: policy.id,
      title: policy.title,
      code: policy.code,
      category: policy.category || 'ALL',
      target_group: policy.target_group,
      start_date: policy.start_date || new Date().toISOString().split('T')[0],
      end_date: policy.end_date || '',
      status: policy.status,
      note: policy.note || '',
      tiers: policy.tiers && policy.tiers.length > 0
        ? policy.tiers.map(t => ({ ...t }))
        : [{ id: Date.now().toString(), min_quantity: 100, max_quantity: 499, discount_percent: 5 }],
    });
    setIsModalOpen(true);
  };

  // Xử lý thêm mốc sản lượng (Tier) tự động tính toán không để chồng chéo
  const handleAddTier = () => {
    const lastTier = formData.tiers[formData.tiers.length - 1];
    let newMin: number | string = 100;
    let nextTiers = [...formData.tiers];
    if (lastTier) {
      if (lastTier.max_quantity !== null && lastTier.max_quantity !== undefined && lastTier.max_quantity !== '') {
        newMin = Number(lastTier.max_quantity) + 1;
      } else {
        const autoMax = Number(lastTier.min_quantity || 0) + 49;
        nextTiers = nextTiers.map((t, idx) =>
          idx === nextTiers.length - 1 ? { ...t, max_quantity: autoMax } : t
        );
        newMin = autoMax + 1;
      }
    }

    setFormData({
      ...formData,
      tiers: [
        ...nextTiers,
        { id: Date.now().toString(), min_quantity: newMin, max_quantity: null, discount_percent: 5, discount_amount: 0, discount_type: 'percent' },
      ],
    });
  };

  // Xử lý xóa mốc sản lượng
  const handleRemoveTier = (id: string) => {
    if (formData.tiers.length === 1) {
      emitStatusToast({ title: 'Lỗi', message: 'Chính sách phải có ít nhất 1 mốc chiết khấu!', type: 'error' });
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
          if (field === 'discount_type') {
            return { ...t, discount_type: value as 'percent' | 'amount' };
          }
          if (field === 'max_quantity') {
            return { ...t, max_quantity: value === '' ? null : value };
          }
          return { ...t, [field]: value === '' ? '' : value };
        }
        return t;
      }),
    });
  };

  // Lưu chính sách chiết khấu (Tạo mới hoặc Cập nhật) vào Database
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageDiscounts) {
      emitStatusToast({ title: 'Từ chối', message: 'Chỉ Quản trị viên và Quản lý kinh doanh mới có quyền thiết lập chính sách chiết khấu!', type: 'error' });
      return;
    }
    if (!formData.title || !formData.code) {
      emitStatusToast({ title: 'Lỗi nhập liệu', message: 'Vui lòng nhập đầy đủ Tên chính sách và Mã áp dụng!', type: 'error' });
      return;
    }

    if (applyScope === 'category' && (!formData.category || formData.category === 'ALL')) {
      emitStatusToast({ title: 'Lỗi nhập liệu', message: 'Vui lòng chọn 1 nhóm hàng áp dụng cụ thể!', type: 'error' });
      return;
    }

    // Chuyển đổi và chuẩn hóa các mốc chiết khấu
    const parsedTiers = formData.tiers.map((t) => ({
      ...t,
      min_quantity: t.min_quantity === '' ? 0 : Number(t.min_quantity),
      max_quantity: t.max_quantity === '' || t.max_quantity === null || t.max_quantity === undefined ? null : Number(t.max_quantity),
      discount_percent: t.discount_percent === '' ? 0 : Number(t.discount_percent),
      discount_amount: t.discount_amount === '' ? 0 : Number(t.discount_amount || 0),
    }));

    // Kiểm tra từng mốc chiết khấu và chống chồng chéo số lượng (overlapping)
    const sortedTiers = [...parsedTiers].sort((a, b) => a.min_quantity - b.min_quantity);
    for (let i = 0; i < sortedTiers.length; i++) {
      const t = sortedTiers[i];
      if (t.min_quantity < 0 || isNaN(t.min_quantity)) {
        emitStatusToast({ title: 'Lỗi nhập liệu', message: `Mốc ${i + 1}: Số lượng tối thiểu phải lớn hơn hoặc bằng 0!`, type: 'error' });
        return;
      }
      if (t.max_quantity !== null && t.max_quantity !== undefined && t.max_quantity < t.min_quantity) {
        emitStatusToast({ title: 'Lỗi nhập liệu', message: `Mốc ${i + 1}: Số lượng tối đa (${t.max_quantity}) phải lớn hơn hoặc bằng số lượng tối thiểu (${t.min_quantity})!`, type: 'error' });
        return;
      }
      const tType = t.discount_type || (t.discount_amount && t.discount_amount > 0 ? 'amount' : 'percent');
      if (tType === 'percent') {
        if (isNaN(t.discount_percent) || t.discount_percent < 0 || t.discount_percent > 100) {
          emitStatusToast({ title: 'Lỗi nhập liệu', message: `Mốc ${i + 1}: Tỷ lệ chiết khấu phải từ 0% đến 100%!`, type: 'error' });
          return;
        }
      } else {
        const amt = Number(t.discount_amount) || 0;
        if (isNaN(amt) || amt < 0) {
          emitStatusToast({ title: 'Lỗi nhập liệu', message: `Mốc ${i + 1}: Số tiền chiết khấu trên đơn vị phải lớn hơn hoặc bằng 0 đ!`, type: 'error' });
          return;
        }
      }
      if (i > 0) {
        const prev = sortedTiers[i - 1];
        if (prev.max_quantity === null || prev.max_quantity === undefined) {
          emitStatusToast({
            title: 'Lỗi cấu hình mốc sản lượng',
            message: `Mốc ${i} (từ ${prev.min_quantity}+) không có giới hạn tối đa, không thể tạo thêm Mốc ${i + 1}!`,
            type: 'error',
          });
          return;
        }
        if (t.min_quantity <= prev.max_quantity) {
          emitStatusToast({
            title: 'Bị chồng số lượng sản phẩm',
            message: `Mốc ${i + 1} (từ ${t.min_quantity} sp) bị trùng với Mốc ${i} (đến ${prev.max_quantity} sp)! Mốc ${i + 1} phải bắt đầu từ ${prev.max_quantity + 1} sp trở lên.`,
            type: 'error',
          });
          return;
        }
      }
    }

    const finalCategory = applyScope === 'category'
      ? (formData.category || 'ALL')
      : (applyScope === 'all' ? 'ALL' : (formData.category || 'ALL'));

    const payload = {
      name: formData.title,
      title: formData.title,
      code: formData.code,
      category: finalCategory,
      target_dealer_type: formData.target_group,
      target_group: formData.target_group,
      description: formData.note,
      start_date: formData.start_date,
      end_date: formData.end_date || undefined,
      is_active: formData.status === 'active',
      status: formData.status,
      tiers: sortedTiers.map((t) => ({
        min_quantity: t.min_quantity,
        max_quantity: t.max_quantity,
        discount_percent: t.discount_type === 'amount' ? 0 : (t.discount_percent || 0),
        discount_amount: t.discount_type === 'amount' ? (t.discount_amount || 0) : 0,
        discount_type: t.discount_type || 'percent',
      })),
    };

    try {
      if (editingPolicyId) {
        const numId = Number(editingPolicyId);
        if (!isNaN(numId) && numId > 0) {
          await updateDiscountPolicyApi(numId, payload, token);
        } else {
          const beList = await getDiscountPoliciesApi(token);
          const match = beList.items.find((item: any) => item.code === formData.code);
          if (match?.id) {
            await updateDiscountPolicyApi(Number(match.id), payload, token);
          }
        }
        const updatedPolicies: DiscountPolicy[] = policies.map(p =>
          (p.id === editingPolicyId || p.code === formData.code)
            ? {
                ...p,
                title: formData.title,
                code: formData.code,
                category: finalCategory,
                target_group: formData.target_group,
                start_date: formData.start_date,
                end_date: formData.end_date || '',
                status: formData.status,
                note: formData.note,
                tiers: sortedTiers,
              }
            : p
        );
        setPolicies(updatedPolicies);
        localStorage.setItem('discountPolicies', JSON.stringify(updatedPolicies));
        emitStatusToast({ title: 'Thành công', message: 'Cập nhật chính sách chiết khấu thành công!', type: 'success' });
      } else {
        await createDiscountPolicyApi(payload, token);
        emitStatusToast({ title: 'Thành công', message: 'Khai báo chính sách chiết khấu sản lượng thành công!', type: 'success' });
      }

      await fetchPolicies();
      setIsModalOpen(false);
      setEditingPolicyId(null);
    } catch (err: any) {
      emitStatusToast({ title: 'Lỗi', message: err?.message || 'Không thể lưu chính sách chiết khấu.', type: 'error' });
    }
  };

  // Xóa vĩnh viễn chính sách khỏi Database
  const handleDeletePolicy = async (id: string | undefined) => {
    if (!id) return;
    if (!canManageDiscounts) {
      emitStatusToast({ title: 'Từ chối', message: 'Chỉ Quản trị viên và Quản lý kinh doanh mới có quyền xóa chính sách chiết khấu!', type: 'error' });
      return;
    }
    const targetPolicy = policies.find(p => p.id === id);
    try {
      const numId = Number(id);
      if (!isNaN(numId) && numId > 0) {
        await deleteDiscountPolicyApi(numId, token);
      } else if (targetPolicy?.code) {
        const beList = await getDiscountPoliciesApi(token);
        const match = beList.items.find((item: any) => item.code === targetPolicy.code);
        if (match?.id) {
          await deleteDiscountPolicyApi(Number(match.id), token);
        }
      }
    } catch (err: any) {
      console.warn('Delete policy API note:', err);
    }
    const nextPolicies = policies.filter(p => p.id !== id);
    setPolicies(nextPolicies);
    localStorage.setItem('discountPolicies', JSON.stringify(nextPolicies));
    emitStatusToast({ title: 'Thành công', message: 'Xóa chính sách thành công!', type: 'success' });
  };

  // Ngừng áp dụng chính sách (cập nhật DB)
  const handleStopPolicy = async (id: string | undefined) => {
    if (!id) return;
    if (!canManageDiscounts) {
      emitStatusToast({ title: 'Từ chối', message: 'Chỉ Quản trị viên và Quản lý kinh doanh mới có quyền ngừng áp dụng chính sách chiết khấu!', type: 'error' });
      return;
    }
    const targetPolicy = policies.find(p => p.id === id);
    try {
      const numId = Number(id);
      if (!isNaN(numId) && numId > 0) {
        await toggleDiscountPolicyStatusApi(numId, token);
      } else if (targetPolicy?.code) {
        const beList = await getDiscountPoliciesApi(token);
        const match = beList.items.find((item: any) => item.code === targetPolicy.code);
        if (match?.id) {
          await toggleDiscountPolicyStatusApi(Number(match.id), token);
        }
      }
    } catch (err: any) {
      console.warn('Stop policy API note:', err);
    }
    const nextPolicies = policies.map(p => p.id === id ? { ...p, status: 'expired' as const } : p);
    setPolicies(nextPolicies);
    localStorage.setItem('discountPolicies', JSON.stringify(nextPolicies));
    emitStatusToast({ title: 'Thành công', message: 'Đã ngừng áp dụng chính sách!', type: 'success' });
  };

  return (
    <div style={{ padding: '0', width: '100%', boxSizing: 'border-box' }}>
      {isModalOpen ? (
        /* TRANG RIÊNG: KHAI BÁO / CHỈNH SỬA CHÍNH SÁCH (TỐI ƯU TOÀN DIỆN CHO CẢ DESKTOP & ĐIỆN THOẠI) */
        <div style={{ width: '100%' }}>
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              overflow: 'hidden',
            }}
          >
            <form onSubmit={handleSavePolicy} style={{ margin: 0 }}>
              {/* Header thanh công cụ trên cùng: Nút quay lại + Tiêu đề + Nút Lưu */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingPolicyId(null);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#1e293b',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.borderColor = '#94a3b8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                  >
                    <span style={{ fontSize: '16px', lineHeight: 1 }}>←</span> Quay lại danh sách
                  </button>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a', lineHeight: 1.2 }}>
                      {editingPolicyId ? 'Chỉnh Sửa Chính Sách Chiết Khấu' : 'Khai Báo Chính Sách Chiết Khấu Mới'}
                    </h2>
                    <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                      Cấu hình phạm vi áp dụng, đối tượng khách hàng và các mốc sản lượng chiết khấu (%)
                    </p>
                  </div>
                </div>

              </div>

              {/* Thân form: Liền 1 khung thống nhất, cân đối 100%, không bị lệch, tối ưu desktop & mobile */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* PHẦN 1: THÔNG TIN CHUNG CHÍNH SÁCH */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Tiêu đề mục 1 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '14px', fontWeight: '750' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', fontSize: '12px', fontWeight: '800' }}>1</span>
                    <span>Thông tin chính sách & Phạm vi áp dụng</span>
                  </div>

                  {/* 1. Phạm vi áp dụng: 3 nút chọn phạm vi */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '6px', color: '#1e293b' }}>
                      Phạm vi áp dụng chính sách <b style={{ color: '#dc2626' }}>*</b>
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px', maxWidth: '480px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setApplyScope('all');
                          setFormData({
                            ...formData,
                            category: 'ALL',
                            title: 'Tất cả sản phẩm',
                          });
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: applyScope === 'all' ? '2px solid #0fba90' : '1px solid #cbd5e1',
                          background: applyScope === 'all' ? '#ecfdf5' : '#ffffff',
                          color: applyScope === 'all' ? '#065f46' : '#475569',
                          fontWeight: applyScope === 'all' ? '700' : '500',
                          cursor: 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        ✓ Tất cả SP
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setApplyScope('category');
                          const firstCat = categories[0] || 'Thời trang';
                          setFormData({
                            ...formData,
                            category: firstCat,
                            title: `Nhóm hàng: ${firstCat}`,
                          });
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: applyScope === 'category' ? '2px solid #0fba90' : '1px solid #cbd5e1',
                          background: applyScope === 'category' ? '#ecfdf5' : '#ffffff',
                          color: applyScope === 'category' ? '#065f46' : '#475569',
                          fontWeight: applyScope === 'category' ? '700' : '500',
                          cursor: 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        📦 1 Nhóm hàng
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setApplyScope('product');
                          const firstProd = products[0];
                          setFormData({
                            ...formData,
                            category: firstProd?.category || 'ALL',
                            title: firstProd ? `${firstProd.code} - ${firstProd.name}` : '',
                          });
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: applyScope === 'product' ? '2px solid #0fba90' : '1px solid #cbd5e1',
                          background: applyScope === 'product' ? '#ecfdf5' : '#ffffff',
                          color: applyScope === 'product' ? '#065f46' : '#475569',
                          fontWeight: applyScope === 'product' ? '700' : '500',
                          cursor: 'pointer',
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        🏷️ 1 SP lẻ
                      </button>
                    </div>
                  </div>

                  {/* 2. Hàng 3 cột cân đối: [Phạm vi chi tiết] | [Mã chính sách] | [Tên chính sách] */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '14px' }}>
                    <div>
                      {applyScope === 'category' ? (
                        <>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#1e293b' }}>
                            Chọn nhóm hàng <b style={{ color: '#dc2626' }}>*</b>
                          </label>
                          <select
                            required
                            value={formData.category}
                            onChange={(e) => {
                              const cat = e.target.value;
                              setFormData({
                                ...formData,
                                category: cat,
                                title: `Nhóm hàng: ${cat}`,
                              });
                            }}
                            style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', boxSizing: 'border-box' }}
                          >
                            <option value="">-- Chọn nhóm hàng --</option>
                            {categories.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </>
                      ) : applyScope === 'product' ? (
                        <>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#1e293b' }}>
                            Chọn sản phẩm <b style={{ color: '#dc2626' }}>*</b>
                          </label>
                          <select
                            required
                            value={formData.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              const selectedProd = products.find(p => `${p.code} - ${p.name}` === val);
                              setFormData({
                                ...formData,
                                title: val,
                                category: selectedProd?.category || 'ALL',
                              });
                            }}
                            style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', fontSize: '13px', boxSizing: 'border-box' }}
                          >
                            <option value="">-- Chọn sản phẩm --</option>
                            {products.map(p => (
                              <option key={p.id} value={`${p.code} - ${p.name}`}>{p.code} - {p.name}</option>
                            ))}
                          </select>
                        </>
                      ) : (
                        <>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#1e293b' }}>
                            Phạm vi áp dụng
                          </label>
                          <input
                            type="text"
                            disabled
                            value="Toàn bộ sản phẩm trong hệ thống"
                            style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '13px', boxSizing: 'border-box' }}
                          />
                        </>
                      )}
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#1e293b' }}>
                        Mã chính sách <b style={{ color: '#dc2626' }}>*</b>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="VD: CK-2026..."
                        style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#1e293b' }}>
                        Tên chính sách chiết khấu <b style={{ color: '#dc2626' }}>*</b>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ví dụ: Chiết khấu nhóm Thời trang, Chiết khấu Đại lý Cấp 1..."
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* 3. Hàng 3 cột cân đối: [Đối tượng] | [Từ ngày] | [Đến ngày] */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '14px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#1e293b' }}>
                        Đối tượng áp dụng
                      </label>
                      <select
                        value={formData.target_group}
                        onChange={(e) => setFormData({ ...formData, target_group: e.target.value as any })}
                        style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      >
                        <option value="all">Tất cả Đại lý</option>
                        <option value="agent_tier_1">Đại lý Cấp 1</option>
                        <option value="agent_tier_2">Đại lý Cấp 2</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#1e293b' }}>
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#1e293b' }}>
                        Đến ngày
                      </label>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  {/* 4. Ghi chú / Diễn giải */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '5px', color: '#1e293b' }}>
                      Ghi chú / Diễn giải
                    </label>
                    <input
                      type="text"
                      value={formData.note || ''}
                      placeholder="Ghi chú điều kiện áp dụng nếu có..."
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* ĐƯỜNG PHÂN CÁCH MẢNH GIỮA 2 PHẦN */}
                <div style={{ borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

                {/* PHẦN 2: CẤU HÌNH MỐC SẢN LƯỢNG & CHIẾT KHẤU (%) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Header phần 2 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontSize: '14px', fontWeight: '750' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#ecfdf5', color: '#059669', fontSize: '12px', fontWeight: '800' }}>2</span>
                        <span>Cấu hình mốc sản lượng & Chiết khấu (%) <b style={{ color: '#dc2626' }}>*</b></span>
                      </div>
                      <p style={{ margin: '3px 0 0 30px', fontSize: '12px', color: '#64748b' }}>
                        Hệ thống tự động áp dụng % chiết khấu tương ứng khi đơn hàng đạt ngưỡng sản lượng
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddTier}
                      style={{
                        background: '#ffffff',
                        border: '1.5px solid #0fba90',
                        color: '#065f46',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#ecfdf5';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#ffffff';
                      }}
                    >
                      <span style={{ fontSize: '15px', fontWeight: '800' }}>+</span> Thêm mốc sản lượng
                    </button>
                  </div>

                  {/* Danh sách các mốc sản lượng: hiển thị dạng card mốc rõ ràng, thẳng hàng tuyệt đối */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {formData.tiers.map((tier, index) => {
                      const prevTier = index > 0 ? formData.tiers[index - 1] : null;
                      const isOverlapping = prevTier !== null && (
                        prevTier.max_quantity === null || prevTier.max_quantity === undefined || prevTier.max_quantity === ''
                          ? true
                          : (tier.min_quantity !== '' && Number(tier.min_quantity) <= Number(prevTier.max_quantity))
                      );
                      const isInvalidMax = tier.max_quantity !== null && tier.max_quantity !== undefined && tier.max_quantity !== '' && tier.min_quantity !== '' && Number(tier.max_quantity) < Number(tier.min_quantity);

                      return (
                        <div
                          key={tier.id}
                          style={{
                            background: isOverlapping || isInvalidMax ? '#fef2f2' : '#f8fafc',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: isOverlapping || isInvalidMax ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', minWidth: '60px' }}>
                              Mốc {index + 1}:
                            </span>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: '600' }}>Từ</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="Từ"
                                value={tier.min_quantity ?? ''}
                                onChange={(e) => handleTierChange(tier.id, 'min_quantity', e.target.value)}
                                style={{
                                  width: '80px',
                                  height: '34px',
                                  padding: '0 8px',
                                  borderRadius: '6px',
                                  border: isOverlapping ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  boxSizing: 'border-box',
                                }}
                              />
                              <span style={{ fontSize: '12.5px', color: '#64748b' }}>sản phẩm</span>
                            </div>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12.5px', color: '#475569', fontWeight: '600' }}>đến</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="Vô hạn"
                                value={tier.max_quantity ?? ''}
                                onChange={(e) => handleTierChange(tier.id, 'max_quantity', e.target.value)}
                                style={{
                                  width: '90px',
                                  height: '34px',
                                  padding: '0 8px',
                                  borderRadius: '6px',
                                  border: isInvalidMax ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                  backgroundColor: '#ffffff',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  boxSizing: 'border-box',
                                }}
                              />
                              <span style={{ fontSize: '12.5px', color: '#64748b' }}>sản phẩm</span>
                            </div>

                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '12.5px', color: '#047857', fontWeight: '700' }}>➔ Giảm</span>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.5"
                                placeholder="%"
                                value={tier.discount_percent ?? ''}
                                onChange={(e) => handleTierChange(tier.id, 'discount_percent', e.target.value)}
                                style={{
                                  width: '75px',
                                  height: '34px',
                                  padding: '0 8px',
                                  borderRadius: '6px',
                                  border: '1.5px solid #10b981',
                                  fontWeight: '800',
                                  fontSize: '14px',
                                  color: '#065f46',
                                  backgroundColor: '#ffffff',
                                  boxSizing: 'border-box',
                                }}
                              />
                              <span style={{ fontSize: '14px', fontWeight: '800', color: '#047857' }}>%</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveTier(tier.id)}
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: '1px solid #fca5a5',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '700',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fecaca';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#fee2e2';
                            }}
                          >
                            ✕ Xóa mốc
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tip hướng dẫn cơ chế bậc thang */}
                  <div
                    style={{
                      padding: '12px 14px',
                      background: '#f0fdf4',
                      borderRadius: '8px',
                      border: '1px solid #bbf7d0',
                      fontSize: '12.5px',
                      color: '#166534',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      lineHeight: '1.55',
                    }}
                  >
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>💡</span>
                    <div>
                      <strong style={{ color: '#14532d' }}>Cơ chế chiết khấu bậc thang:</strong> Khi khách hàng đặt số lượng sản phẩm đạt mốc sản lượng nào, hệ thống sẽ tự động chiết khấu theo tỷ lệ % ưu đãi của mốc đó. Bạn có thể bấm <strong>+ Thêm mốc sản lượng</strong> để thiết lập các mức sản lượng ưu đãi lũy tiến (VD: 100 - 499 sp: giảm 5%, 500 - 999 sp: giảm 8%, từ 1000 sp trở lên: giảm 10%).
                    </div>
                  </div>
                </div>
              </div>

              {/* Thanh thao tác dưới cùng: Tối ưu responsive cả trên Mobile */}
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}
              >
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  * Vui lòng kiểm tra kỹ tỷ lệ chiết khấu trước khi lưu áp dụng
                </span>
                <div style={{ display: 'flex', gap: '10px', width: 'auto', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingPolicyId(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '7px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    ← Quay lại danh sách
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 22px',
                      borderRadius: '7px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(15, 186, 144, 0.35)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Lưu & Áp Dụng Chính Sách
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* TRANG DANH SÁCH CHÍNH SÁCH */
        <>
          {/* Header View */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '22px', color: '#0f172a', fontWeight: '700' }}>
                Quản Lý Chính Sách Chiết Khấu Sản Lượng
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>
                Khai báo mốc sản lượng & tỷ lệ chiết khấu tự động dành cho đại lý
              </p>
            </div>
            {canManageDiscounts ? (
              <button
                onClick={() => {
                  setEditingPolicyId(null);
                  setApplyScope('all');
                  setFormData({
                    title: 'Tất cả sản phẩm',
                    code: `CK-${Math.floor(1000 + Math.random() * 9000)}`,
                    category: 'ALL',
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
                  background: 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(15, 186, 144, 0.35)',
                }}
              >
                + Khai Báo Chính Sách Mới
              </button>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  background: '#f8fafc',
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                }}
                title="Chỉ Admin và Quản lý kinh doanh mới có quyền thiết lập chính sách chiết khấu"
              >
                <span>Chỉ xem</span>
              </div>
            )}
          </div>

          {/* Danh sách chính sách hiện tại (Khối liền nhau) */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              overflow: 'hidden',
            }}
          >
            {policies.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
                Chưa có chính sách chiết khấu nào được khai báo.
              </div>
            ) : (
              policies.map((policy, index) => (
                <div
                  key={policy.id}
                  style={{
                    padding: '20px',
                    borderBottom: index < policies.length - 1 ? '1px solid #e2e8f0' : 'none',
                  }}
                >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                      {policy.category && policy.category !== 'ALL' && policy.category !== 'PRODUCT' ? (
                        <span
                          style={{
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                          }}
                        >
                          Nhóm: {policy.category ? String(policy.category).replace(/Qu\?n/g, 'Quần') : ''}
                        </span>
                      ) : (!policy.category || policy.category === 'ALL') && policy.title === 'Tất cả sản phẩm' ? (
                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                          }}
                        >
                          Toàn bộ sản phẩm
                        </span>
                      ) : (
                        <span
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                          }}
                        >
                          Sản phẩm
                        </span>
                      )}
                      {hasOverlappingTiers(policy.tiers) && (
                        <span
                          style={{
                            background: '#fef2f2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                          }}
                          title="Chính sách này có các mốc sản lượng bị chồng chéo nhau!"
                        >
                          Bị chồng số lượng sản phẩm
                        </span>
                      )}
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
                      {policy.status === 'active' ? 'Đang áp dụng' : policy.status === 'expired' ? 'Đã ngừng' : 'Dự thảo'}
                    </span>
                    {canManageDiscounts && (
                      <>
                        <button
                          onClick={() => handleEditPolicy(policy)}
                          style={{
                            background: 'none',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            color: '#2563eb',
                            padding: '4px 8px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#eff6ff';
                            e.currentTarget.style.borderColor = '#93c5fd';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'none';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                          }}
                          title="Chỉnh sửa chính sách"
                        >
                          Sửa
                        </button>
                        {policy.status === 'active' ? (
                          <button
                            onClick={() => handleStopPolicy(policy.id)}
                            style={{
                              background: 'none',
                              border: '1px solid #fef08a',
                              borderRadius: '6px',
                              color: '#ca8a04',
                              padding: '4px 8px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '600',
                              transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fefce8';
                              e.currentTarget.style.borderColor = '#fde047';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'none';
                              e.currentTarget.style.borderColor = '#fef08a';
                            }}
                          >
                            Ngừng áp dụng
                          </button>
                        ) : (
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
                        )}
                      </>
                    )}
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
                        <strong style={{ color: '#16a34a', fontSize: '14px' }}>
                          Giảm {tier.discount_type === 'amount' || (tier.discount_amount && Number(tier.discount_amount) > 0 && !tier.discount_percent)
                            ? `${Number(tier.discount_amount).toLocaleString('vi-VN')} đ/sp`
                            : `${tier.discount_percent}%`}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )))}
          </div>
        </>
      )}
    </div>
  );
}
