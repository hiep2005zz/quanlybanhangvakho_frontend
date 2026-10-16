import { API_BASE_URL } from './api';
import type {
  InTransitSummaryResponse,
  DeliveryTripResponse,
  DeliveryStopResponse,
  DeliveryTripCreate,
  DeliveryStopStatusUpdate,
  DeliveryTripStatusUpdate,
  ReadyOrderForDelivery,
  DeliveryStopConfirmRequest,
  DeliveryStopFailureRequest,
  PodUploadResponse,
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
    failure_reason: isFailed ? failed_reason_or_note : undefined,
    note: !isFailed ? failed_reason_or_note : undefined,
  });
}

/**
 * SCRUM-85: Tải lên hình ảnh biên bản giao nhận có chữ ký (POD - Proof of Delivery)
 */
export async function uploadPodImage(token: string, file: File): Promise<PodUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/deliveries/upload-pod`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tải lên ảnh chứng từ giao hàng (POD)');
  }
  return res.json();
}

/**
 * SCRUM-85: Xác nhận giao hàng thành công kèm ảnh POD, người nhận, thời gian thực tế
 * Tự động chuyển trạng thái đơn hàng sang DELIVERED để kích hoạt phát hành hóa đơn ở Sprint 7
 */
export async function confirmDeliveryStop(
  token: string,
  stopId: number,
  data: DeliveryStopConfirmRequest
): Promise<DeliveryStopResponse> {
  const res = await fetch(`${API_BASE_URL}/deliveries/stops/${stopId}/confirm-delivery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể xác nhận giao hàng thành công');
  }
  return res.json();
}

/**
 * SCRUM-85: Ghi nhận giao hàng không thành công kèm lý do chi tiết
 * Chuyển hàng sang trạng thái Chờ hoàn kho (Sprint 8), không làm âm tồn kho
 */
export async function recordDeliveryStopFailure(
  token: string,
  stopId: number,
  data: DeliveryStopFailureRequest
): Promise<DeliveryStopResponse> {
  const res = await fetch(`${API_BASE_URL}/deliveries/stops/${stopId}/record-failure`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể ghi nhận giao hàng thất bại');
  }
  return res.json();
}
