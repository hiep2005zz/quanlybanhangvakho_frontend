import React, { useState, useEffect } from 'react';
import { CategoryTreeResponse, getCategoryTreeApi, moveProductCategoryApi } from '../services/api';
import { emitStatusToast } from './StatusToast';

interface MoveCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  productId: number;
  productName: string;
  currentCategoryId?: number | null;
  onSuccess: () => void;
}

export default function MoveCategoryModal({ isOpen, onClose, token, productId, productName, currentCategoryId, onSuccess }: MoveCategoryModalProps) {
  const [categories, setCategories] = useState<CategoryTreeResponse[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>(currentCategoryId || '');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedCategoryId(currentCategoryId || '');
      getCategoryTreeApi(token).then(setCategories).catch(() => {
        emitStatusToast({ message: 'Không thể tải danh sách danh mục', title: 'Lỗi' });
      });
    }
  }, [isOpen, token, currentCategoryId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategoryId === '') return;
    
    setIsLoading(true);
    try {
      await moveProductCategoryApi(token, productId, Number(selectedCategoryId));
      emitStatusToast({ message: 'Đã chuyển danh mục thành công', title: 'Thành công' });
      onSuccess();
      onClose();
    } catch (err: any) {
      emitStatusToast({ message: err.message || 'Lỗi khi chuyển danh mục', title: 'Lỗi' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderOptions = (nodes: CategoryTreeResponse[], level = 0): React.ReactNode[] => {
    let res: React.ReactNode[] = [];
    nodes.forEach(n => {
      res.push(<option key={n.id} value={n.id}>{'-'.repeat(level * 2)} {n.name}</option>);
      if (n.sub_categories) res = res.concat(renderOptions(n.sub_categories, level + 1));
    });
    return res;
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    }}>
      <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', color: '#0f172a' }}>Chuyển Nhóm Hàng</h3>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
          Sản phẩm: <strong>{productName}</strong>
        </p>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', fontSize: '13px', color: '#334155' }}>Chọn danh mục mới</label>
            <select
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value === '' ? '' : Number(e.target.value))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
              required
            >
              <option value="" disabled>-- Chọn danh mục --</option>
              {renderOptions(categories)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={isLoading} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Hủy</button>
            <button type="submit" disabled={isLoading || selectedCategoryId === '' || selectedCategoryId === currentCategoryId} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', cursor: isLoading ? 'not-allowed' : 'pointer' }}>
              {isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
