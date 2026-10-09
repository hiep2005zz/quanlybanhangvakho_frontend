import { User } from '../services/api';

export type OrderPermissionTier = 'FULL_ACCESS' | 'READ_ONLY' | 'NO_ACCESS';

/**
 * Xác định nhóm phân quyền quản lý đơn hàng bán theo 3 cấp độ bắt buộc:
 * 1. Nhóm Toàn Quyền (View & Action): admin, sales_manager, sales
 *    - Xem UI Timeline vòng đời đơn hàng
 *    - Hiển thị nút "Hủy đơn" và thực hiện thao tác gọi API hủy
 * 2. Nhóm Chỉ Xem (Read-Only): kho, warehouse_mgr, ketoan
 *    - Xem UI Timeline vòng đời đơn hàng
 *    - ẨN HOÀN TOÀN nút "Hủy đơn"
 * 3. Nhóm Không Liên Quan (No Access): muahang
 *    - Chặn và ẩn hoàn toàn toàn bộ UI liên quan đến Đơn hàng bán & vòng đời đơn hàng
 */
export function getOrderPermissionTier(user?: User | null): OrderPermissionTier {
  if (!user) return 'NO_ACCESS';

  const username = (user.username || '').toLowerCase();
  const rawRoles = (user.roles && user.roles.length > 0 ? user.roles : [user.role])
    .filter(Boolean)
    .map((r) => r.toLowerCase());

  // Nhóm Không Liên Quan (No Access): muahang
  if (
    username === 'muahang' ||
    rawRoles.includes('purchasing') ||
    user.role?.toLowerCase() === 'purchasing'
  ) {
    return 'NO_ACCESS';
  }

  // Nhóm Toàn Quyền (View & Action): admin, sales_manager, sales
  const fullAccessRoles = ['admin', 'sales_manager', 'sales'];
  const isFullAccess =
    fullAccessRoles.includes(user.role?.toLowerCase()) ||
    rawRoles.some((r) => fullAccessRoles.includes(r)) ||
    fullAccessRoles.includes(username);

  if (isFullAccess) {
    return 'FULL_ACCESS';
  }

  // Nhóm Chỉ Xem (Read-Only): kho, warehouse_mgr, ketoan
  const readOnlyRoles = [
    'warehouse',
    'warehouse_manager',
    'accountant',
    'kho',
    'warehouse_mgr',
    'ketoan',
  ];
  const isReadOnly =
    readOnlyRoles.includes(user.role?.toLowerCase()) ||
    rawRoles.some((r) => readOnlyRoles.includes(r)) ||
    ['kho', 'warehouse_mgr', 'ketoan'].includes(username) ||
    user.role?.toLowerCase() === 'customer' ||
    rawRoles.includes('customer');

  if (isReadOnly) {
    return 'READ_ONLY';
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
