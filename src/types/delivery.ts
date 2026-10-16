// frontend/src/types/delivery.ts

export type DeliveryTripStatus = 'IN_TRANSIT' | 'DELIVERING' | 'COMPLETED' | 'CANCELLED';
export type DeliveryStopStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED';

export interface InTransitSummaryResponse {
  total_in_transit_value: number;
  active_trips_count: number;
  remaining_stops_count: number;
  overdue_trips_count: number;
}

export interface DeliveryStopResponse {
  id: number;
  trip_id: number;
  stop_order: number;
  order_id?: number | null;
  order_code: string;
  dealer_id?: number | null;
  dealer_name: string;
  delivery_point: string;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  amount: number;
  status: DeliveryStopStatus | string;
  estimated_arrival?: string | null;
  delivered_at?: string | null;
  failed_reason?: string | null;
  note?: string | null;
}

export interface DeliveryTripResponse {
  id: number;
  trip_code: string;
  driver_name: string;
  driver_phone?: string | null;
  vehicle_plate: string;
  route_name?: string | null;
  warehouse_id?: string | null;
  warehouse_name?: string | null;
  status: DeliveryTripStatus | string;
  dispatched_at: string;
  estimated_delivery_time: string;
  completed_at?: string | null;
  note?: string | null;
  is_overdue: boolean;
  overdue_minutes: number;
  total_stops: number;
  delivered_stops: number;
  remaining_stops: number;
  total_trip_value: number;
  remaining_value: number;
  stops: DeliveryStopResponse[];
}

export type DeliveryTripDetail = DeliveryTripResponse;
export type DeliveryStopDetail = DeliveryStopResponse;

export interface DeliveryStopStatusUpdate {
  status: DeliveryStopStatus | string;
  failed_reason?: string | null;
  note?: string | null;
}

export interface DeliveryTripStatusUpdate {
  status: DeliveryTripStatus | string;
  note?: string | null;
}

export interface DeliveryStopCreate {
  order_id?: number | null;
  order_code: string;
  dealer_id?: number | null;
  dealer_name: string;
  delivery_point: string;
  receiver_name?: string | null;
  receiver_phone?: string | null;
  amount: number;
  estimated_arrival?: string | null;
  note?: string | null;
}

export interface DeliveryTripCreate {
  trip_code?: string | null;
  driver_name: string;
  driver_phone?: string | null;
  vehicle_plate: string;
  route_name?: string | null;
  warehouse_id?: string | null;
  warehouse_name?: string | null;
  estimated_delivery_time: string;
  note?: string | null;
  stops: DeliveryStopCreate[];
}

export interface ReadyOrderForDelivery {
  id: number;
  order_code: string;
  dealer_id: number;
  dealer_name: string;
  delivery_point: string;
  amount: number;
  status: string;
  created_at?: string | null;
}
