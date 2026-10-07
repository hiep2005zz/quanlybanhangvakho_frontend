import React, { useState, useEffect } from 'react';
import { CategoryTreeResponse, getCategoryTreeApi, moveProductCategoryApi } from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

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
    <ModalPortal>
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15, 23, 42, 0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
        padding: '16px', boxSizing: 'border-box'
      }}>
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '420px', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
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
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                margin: 0,
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: 'none',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isLoading || selectedCategoryId === '' || selectedCategoryId === currentCategoryId}
              style={{
                margin: 0,
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: (isLoading || selectedCategoryId === '' || selectedCategoryId === currentCategoryId) ? '#94a3b8' : '#0fad89',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: (isLoading || selectedCategoryId === '' || selectedCategoryId === currentCategoryId) ? 'not-allowed' : 'pointer',
                boxShadow: (isLoading || selectedCategoryId === '' || selectedCategoryId === currentCategoryId) ? 'none' : '0 2px 8px rgba(15, 173, 137, 0.3)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                if (!(isLoading || selectedCategoryId === '' || selectedCategoryId === currentCategoryId)) {
                  e.currentTarget.style.backgroundColor = '#0a8f70';
                }
              }}
              onMouseLeave={(e) => {
                if (!(isLoading || selectedCategoryId === '' || selectedCategoryId === currentCategoryId)) {
                  e.currentTarget.style.backgroundColor = '#0fad89';
                }
              }}
            >
              {isLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
}
