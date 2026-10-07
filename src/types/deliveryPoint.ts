export interface DeliveryPoint {
  id: number;
  dealer_id: number;
  label: string;
  address: string;
  receiver_name: string;
  receiver_phone: string;
  route_note: string | null;
  is_default: boolean;
  is_active: boolean;
}

export type DeliveryPointInput = Omit<DeliveryPoint, 'id' | 'dealer_id' | 'is_active'>;