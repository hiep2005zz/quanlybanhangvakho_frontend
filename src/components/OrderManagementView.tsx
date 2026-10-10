// frontend/src/components/OrderManagementView.tsx
import React from 'react';
import { User, ProductItem } from '../services/api';
import { OrderListView } from '../features/sales/OrderListView';

export interface OrderManagementViewProps {
  currentUser: User;
  token: string;
  products: ProductItem[];
  onBackToHome?: () => void;
  onRefreshProducts?: () => void;
  onNavigateToPriceBooks?: () => void;
  onCloneOrder?: (data: any) => void;
}

export const OrderManagementView: React.FC<OrderManagementViewProps> = (props) => {
  return <OrderListView {...props} />;
};

export default OrderManagementView;
