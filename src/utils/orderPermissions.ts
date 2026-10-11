import { User } from '../services/api';

export type OrderPermissionTier = 'FULL_ACCESS' | 'READ_ONLY' | 'NO_ACCESS';

export const ORDER_ALLOWED_ROLES = ['admin', 'sales_manager', 'sales'];

/**
 * Kiểm tra người dùng có quyền xem/truy cập đơn hàng bán hay không.
 * Chỉ trả về true cho 3 vai trò: admin, sales_manager, sales.
 * Toàn bộ các vai trò còn lại (kho, warehouse_mgr, ketoan, muahang, ...) nhận false.
 */
export function canUserReadOrders(user?: User | null): boolean {
  if (!user) return false;

  const username = (user.username || '').toLowerCase();
  const rawRoles = (user.roles && user.roles.length > 0 ? user.roles : [user.role])
    .filter(Boolean)
    .map((r) => r.toLowerCase());

  return (
    ORDER_ALLOWED_ROLES.includes(user.role?.toLowerCase() || '') ||
    rawRoles.some((r) => ORDER_ALLOWED_ROLES.includes(r)) ||
    ORDER_ALLOWED_ROLES.includes(username)
  );
}

/**
 * Xác định nhóm phân quyền quản lý đơn hàng bán:
 * 1. Nhóm Toàn Quyền: admin, sales_manager, sales -> FULL_ACCESS
 * 2. Tất cả vai trò còn lại (kho, warehouse_mgr, ketoan, muahang) -> NO_ACCESS
 */
export function getOrderPermissionTier(user?: User | null): OrderPermissionTier {
  if (!user) return 'NO_ACCESS';

  if (canUserReadOrders(user)) {
    return 'FULL_ACCESS';
  }

  return 'NO_ACCESS';
}

/**
 * Trạng thái thứ tự vòng đời:
 * DRAFT (1) -> PENDING (2) -> CONFIRMED (3) -> PICKING (4) -> EXPORTED (5) -> DELIVERED (6) -> CLOSED (7)
 * Đơn đã xuất kho (status >= EXPORTED) thì KHÔNG được phép hủy (phải đi đường trả hàng).
 */
export function isOrderPastExported(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  const rankMap: Record<string, number> = {
    DRAFT: 1,
    PENDING: 2,
    PENDING_APPROVAL: 2,
    CONFIRMED: 3,
    APPROVED: 3,
    PICKING: 4,
    PREPARING: 4,
    PACKING: 4,
    EXPORTED: 5,
    SHIPPED: 5,
    DISPATCHED: 5,
    DELIVERED: 6,
    CLOSED: 7,
    COMPLETED: 7,
  };
  const rank = rankMap[s];
  return typeof rank === 'number' && rank >= 5;
}
