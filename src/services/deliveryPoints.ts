import type { DeliveryPoint, DeliveryPointInput } from '../types/deliveryPoint';
import { API_BASE_URL, AUTH_STORAGE } from './api';

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined'
    ? (sessionStorage.getItem(AUTH_STORAGE.TOKEN) || localStorage.getItem(AUTH_STORAGE.TOKEN))
    : null;
  const res = await fetch(`${API_BASE_URL}${url}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? 'Có lỗi xảy ra');
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const deliveryPointApi = {
  list: (dealerId: number) =>
    request<DeliveryPoint[]>(`/dealers/${dealerId}/delivery-points`),
  create: (dealerId: number, body: DeliveryPointInput) =>
    request<DeliveryPoint>(`/dealers/${dealerId}/delivery-points`, {
      method: 'POST', body: JSON.stringify(body),
    }),
  update: (dealerId: number, id: number, body: DeliveryPointInput) =>
    request<DeliveryPoint>(`/dealers/${dealerId}/delivery-points/${id}`, {
      method: 'PUT', body: JSON.stringify(body),
    }),
  setDefault: (dealerId: number, id: number) =>
    request<DeliveryPoint>(`/dealers/${dealerId}/delivery-points/${id}/set-default`, {
      method: 'POST',
    }),
  remove: (dealerId: number, id: number) =>
    request<void>(`/dealers/${dealerId}/delivery-points/${id}`, { method: 'DELETE' }),
};
