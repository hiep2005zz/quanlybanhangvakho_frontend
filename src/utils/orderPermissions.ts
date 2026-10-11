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

  const isCustomerRole = user.role?.toLowerCase() === 'customer' || rawRoles.includes('customer');

  // Nhóm Không Liên Quan (No Access): purchasing (chỉ chặn nếu không phải là Customer)
  if (
    !isCustomerRole &&
    (username === 'muahang' ||
     rawRoles.includes('purchasing') ||
     user.role?.toLowerCase() === 'purchasing')
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
 * Danh sách các trạng thái KHẢ DỤNG ĐỂ HỦY ĐƠN:
 * Nháp -> Chờ duyệt -> Đã duyệt -> Đang soạn hàng
 */
export const CANCELABLE_STATUSES = [
  'DRAFT',
  'PENDING',
  'PENDING_APPROVAL',
  'CONFIRMED',
  'APPROVED',
  'PICKING',
  'PREPARING',
  'PACKING',
  'NHÁP',
  'CHỜ DUYỆT',
  'ĐÃ DUYỆT',
  'ĐANG SOẠN HÀNG',
];

/**
 * Danh sách các trạng thái KHÔNG ĐƯỢC PHÉP HỦY:
 * Bằng hoặc vượt qua mốc "Đã xuất", "Đã giao", "Đóng"
 */
export const UN_CANCELABLE_STATUSES = [
  'EXPORTED',
  'SHIPPED',
  'DISPATCHED',
  'DELIVERED',
  'CLOSED',
  'COMPLETED',
  'ĐÃ XUẤT',
  'ĐÃ GIAO',
  'ĐÓNG',
  'HOÀN THÀNH',
];

/**
 * Trạng thái thứ tự vòng đời:
 * DRAFT (1) -> PENDING (2) -> CONFIRMED (3) -> PICKING (4) -> EXPORTED (5) -> DELIVERED (6) -> CLOSED (7)
 * Đơn đã xuất kho (status >= EXPORTED / "Đã xuất") thì KHÔNG được phép hủy (phải đi đường trả hàng).
 */
export function isOrderPastExported(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  const rankMap: Record<string, number> = {
    // Tiếng Anh
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
    // Tiếng Việt theo vòng đời
    'NHÁP': 1,
    'CHỜ DUYỆT': 2,
    'ĐÃ DUYỆT': 3,
    'ĐANG SOẠN HÀNG': 4,
    'ĐÃ XUẤT': 5,
    'ĐÃ GIAO': 6,
    'ĐÓNG': 7,
    'HOÀN THÀNH': 7,
  };
  const rank = rankMap[s];
  if (typeof rank === 'number') {
    return rank >= 5;
  }
  return UN_CANCELABLE_STATUSES.includes(s);
}

/**
 * Kiểm tra xem đơn hàng có thỏa mãn điều kiện để hủy hay không:
 * Chỉ khả dụng khi thuộc nhóm ["Nháp", "Chờ duyệt", "Đã duyệt", "Đang soạn hàng"].
 * Nếu bằng hoặc vượt qua mốc "Đã xuất", khóa nút hủy.
 */
export function isOrderCancelable(status?: string | null): boolean {
  if (!status) return false;
  const s = status.toUpperCase().trim();
  if (isOrderPastExported(status)) return false;
  return CANCELABLE_STATUSES.includes(s);
}

/**
 * Chuyển đổi mã trạng thái đơn hàng (tiếng Anh) sang tiếng Việt chuẩn và thân thiện với người dùng.
 * Đảm bảo không hiển thị mã thô như EXPORTED, PENDING_APPROVAL, PICKING trên giao diện.
 */
export function getOrderStatusLabel(status?: string | null): string {
  if (!status) return '—';
  const s = status.toUpperCase().trim();
  switch (s) {
    case 'DRAFT':
    case 'NHÁP':
      return 'Nháp';
    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'CHỜ DUYỆT':
      return 'Chờ duyệt';
    case 'CONFIRMED':
    case 'APPROVED':
    case 'ĐÃ DUYỆT':
      return 'Đã xác nhận';
    case 'PICKING':
    case 'PREPARING':
    case 'PACKING':
    case 'ĐANG SOẠN HÀNG':
      return 'Đang soạn hàng';
    case 'EXPORTED':
    case 'SHIPPED':
    case 'DISPATCHED':
    case 'ĐÃ XUẤT':
      return 'Đã xuất kho';
    case 'DELIVERED':
    case 'ĐÃ GIAO':
      return 'Đã giao hàng';
    case 'CLOSED':
    case 'COMPLETED':
    case 'ĐÓNG':
    case 'HOÀN THÀNH':
      return 'Đóng đơn';
    case 'CANCELLED':
    case 'ĐÃ HỦY':
      return 'Đã hủy';
    case 'REJECTED':
    case 'BỊ TỪ CHỐI':
      return 'Bị từ chối';
    default:
      return status;
  }
}

