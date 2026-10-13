import React from 'react';
import { ProductItem } from '../services/api';
import { GoodsReceiptModal } from './GoodsReceiptModal';

export interface GoodsReceiptViewProps {
  token: string;
  products: ProductItem[];
  currentUserWarehouse?: string;
  initialTab?: 'form' | 'list';
  onBackToInventory: () => void;
  onSuccess?: () => void;
  onRequestAdjust?: (product: ProductItem | null, receiptCode: string) => void;
}

export const GoodsReceiptView: React.FC<GoodsReceiptViewProps> = ({
  token,
  products,
  currentUserWarehouse,
  initialTab = 'form',
  onBackToInventory,
  onSuccess,
  onRequestAdjust,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: '100%',
        gap: '12px',
      }}
    >
      {/* 1. Thanh Breadcrumb điều hướng quay lại Kho hàng */}
      <nav
        aria-label="Breadcrumb Nhập kho"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px',
          color: '#64748b',
          fontWeight: '500',
          padding: '2px 4px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBackToInventory}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            color: '#059669',
            cursor: 'pointer',
            padding: '5px 14px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#059669';
            e.currentTarget.style.background = '#ecfdf5';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.background = '#ffffff';
          }}
          title="Quay lại danh sách sản phẩm và tổng quan kho hàng"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Quản lý kho hàng</span>
        </button>

        <span style={{ color: '#cbd5e1', fontSize: '14px' }}>/</span>

        <span
          style={{
            color: '#0f172a',
            fontWeight: '700',
            fontSize: '13.5px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>Lập phiếu nhập kho từ Nhà cung cấp</span>
        </span>
      </nav>

      {/* 2. Nội dung Giao diện Phiếu Nhập Kho (Trang độc lập Full View) */}
      <div style={{ flex: 1, width: '100%' }}>
        <GoodsReceiptModal
          isOpen={true}
          isPage={true}
          token={token}
          products={products}
          currentUserWarehouse={currentUserWarehouse}
          initialTab={initialTab}
          onClose={onBackToInventory}
          onSuccess={() => {
            onSuccess?.();
          }}
          onRequestAdjust={onRequestAdjust}
        />
      </div>
    </div>
  );
};

export default GoodsReceiptView;
