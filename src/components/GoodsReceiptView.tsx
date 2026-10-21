import React from 'react';
import { ProductItem } from '../services/api';
import { GoodsReceiptModal } from './GoodsReceiptModal';

export interface GoodsReceiptViewProps {
  token: string;
  products: ProductItem[];
  currentUserWarehouse?: string;
  initialTab?: 'form' | 'list';
  initialSearchCode?: string;
  onBackToInventory: () => void;
  onSuccess?: () => void;
  onRequestAdjust?: (product: ProductItem | null, receiptCode: string) => void;
}

export const GoodsReceiptView: React.FC<GoodsReceiptViewProps> = ({
  token,
  products,
  currentUserWarehouse,
  initialTab = 'form',
  initialSearchCode,
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
      }}
    >
      <GoodsReceiptModal
        isOpen={true}
        isPage={true}
        token={token}
        products={products}
        currentUserWarehouse={currentUserWarehouse}
        initialTab={initialTab}
        initialSearchCode={initialSearchCode}
        onClose={onBackToInventory}
        onSuccess={() => {
          onSuccess?.();
        }}
        onRequestAdjust={onRequestAdjust}
      />
    </div>
  );
};

export default GoodsReceiptView;
