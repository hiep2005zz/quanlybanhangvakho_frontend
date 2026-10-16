// frontend/src/services/deliveryService.ts
import { API_BASE_URL } from './api';
import type {
  InTransitSummaryResponse,
  DeliveryTripResponse,
  DeliveryStopResponse,
  DeliveryTripCreate,
  DeliveryStopStatusUpdate,
  DeliveryTripStatusUpdate,
  ReadyOrderForDelivery,
} from '../types/delivery';

export async function getInTransitSummary(token: string): Promise<InTransitSummaryResponse> {
  const res = await fetch(`${API_BASE_URL}/deliveries/in-transit-summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tải chỉ số hàng đang giao');
  }
  return res.json();
}

export async function getInTransitTrips(
  token: string,
  params?: { status?: string; search?: string; is_overdue?: boolean }
): Promise<DeliveryTripResponse[]> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.search) query.append('search', params.search);
  if (params?.is_overdue !== undefined) query.append('is_overdue', String(params.is_overdue));

  const qs = query.toString();
  const url = `${API_BASE_URL}/deliveries/in-transit${qs ? `?${qs}` : ''}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tải danh sách chuyến giao hàng');
  }
  return res.json();
}

export async function getTripDetail(token: string, tripId: number | string): Promise<DeliveryTripResponse> {
  const res = await fetch(`${API_BASE_URL}/deliveries/trips/${tripId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tải chi tiết chuyến giao hàng');
  }
  return res.json();
}

export async function createDeliveryTrip(token: string, data: DeliveryTripCreate): Promise<DeliveryTripResponse> {
  const res = await fetch(`${API_BASE_URL}/deliveries/trips`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tạo chuyến giao hàng');
  }
  return res.json();
}

export async function updateTripStatus(
  token: string,
  tripId: number,
  status: string,
  note?: string
): Promise<DeliveryTripResponse> {
  const payload: DeliveryTripStatusUpdate = { status, note };
  const res = await fetch(`${API_BASE_URL}/deliveries/trips/${tripId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể cập nhật trạng thái chuyến');
  }
  return res.json();
}

export async function updateStopStatus(
  token: string,
  stopId: number,
  data: DeliveryStopStatusUpdate
): Promise<DeliveryStopResponse> {
  const res = await fetch(`${API_BASE_URL}/deliveries/stops/${stopId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể cập nhật trạng thái điểm giao');
  }
  return res.json();
}

export async function getOrdersReadyForDelivery(token: string): Promise<ReadyOrderForDelivery[]> {
  const res = await fetch(`${API_BASE_URL}/deliveries/orders-ready`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tải danh sách đơn hàng sẵn sàng giao');
  }
  return res.json();
}

export const getDeliveryTripDetail = getTripDetail;

export async function updateDeliveryStopStatus(
  token: string,
  stopId: number,
  status: string,
  failed_reason_or_note?: string
): Promise<DeliveryStopResponse> {
  const isFailed = status === 'FAILED';
  return updateStopStatus(token, stopId, {
    status,
    failed_reason: isFailed ? failed_reason_or_note : undefined,
    note: !isFailed ? failed_reason_or_note : undefined,
  });
}
