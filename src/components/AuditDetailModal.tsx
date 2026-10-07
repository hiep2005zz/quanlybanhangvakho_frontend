import React, { useState } from 'react';
import { AuditLogItem, getAvatarUrl } from '../services/api';
import { formatLocalDateTime } from '../utils/dateUtils';
import { ModalPortal } from './ModalPortal';

interface AuditDetailModalProps {
  log: AuditLogItem | null;
  onClose: () => void;
}

// 1. Từ điển ánh xạ tên trường sang tiếng Việt thân thiện
export const FIELD_LABELS: Record<string, string> = {
  // Kho & Sản phẩm
  stock: 'Số lượng tồn kho',
  actual_stock: 'Số lượng thực tế',
  system_stock: 'Số lượng trên hệ thống',
  previous_stock: 'Tồn kho trước điều chỉnh',
  new_stock: 'Tồn kho sau điều chỉnh',
  adjustment: 'Mức chênh lệch tồn kho',
  sell_price: 'Giá bán niêm yết',
  cost_price: 'Giá vốn nhập kho',
  price: 'Đơn giá',
  product_id: 'Mã định danh sản phẩm',
  product_code: 'Mã sản phẩm',
  product_name: 'Tên sản phẩm',
  name: 'Tên đối tượng',
  code: 'Mã đối tượng',
  unit: 'Đơn vị tính',
  base_unit: 'Đơn vị tính cơ sở',
  unit_name: 'Đơn vị tính quy đổi',
  conversion_rate: 'Hệ số quy đổi',
  base_quantity: 'Số lượng theo đơn vị cơ sở',
  category: 'Danh mục sản phẩm',
  quantity: 'Số lượng',
  destination: 'Nơi nhận hàng',
  supplier: 'Nhà cung cấp',
  received: 'Số lượng nhập kho',
  issued: 'Số lượng xuất kho',

  // Công nợ & Đại lý / Khách hàng
  credit_limit: 'Hạn mức công nợ',
  dealer_id: 'Mã định danh đại lý',
  dealer_code: 'Mã đại lý',
  dealer_name: 'Tên đại lý',
  customer_id: 'Mã định danh khách hàng',
  customer_code: 'Mã khách hàng',
  customer_name: 'Tên khách hàng',
  balance: 'Số dư tài khoản',
  debt: 'Công nợ hiện tại',
  assigned_sale_id: 'Mã nhân viên phụ trách',
  assigned_sale_name: 'Nhân viên kinh doanh phụ trách',

  // Hóa đơn & Đơn hàng
  order_id: 'Mã định danh đơn hàng',
  order_code: 'Mã đơn hàng',
  invoice_id: 'Mã định danh hóa đơn',
  invoice_code: 'Mã hóa đơn',
  total_amount: 'Tổng tiền thanh toán',
  discount: 'Mức chiết khấu',
  amount: 'Số tiền',
  payment_method: 'Phương thức thanh toán',
  shipping_address: 'Địa chỉ giao hàng',
  items: 'Danh sách mặt hàng',

  // Người dùng & Phân quyền
  user_id: 'Mã người dùng',
  user_name: 'Tên người thực hiện',
  username: 'Tên tài khoản',
  full_name: 'Họ và tên',
  email: 'Địa chỉ Email',
  phone: 'Số điện thoại',
  address: 'Địa chỉ',
  role: 'Vai trò / Quyền hạn',
  roles: 'Danh sách quyền hạn',
  branch: 'Chi nhánh làm việc',
  status: 'Trạng thái',
  is_active: 'Trạng thái kích hoạt',
  lock_reason: 'Lý do khóa tài khoản',
  failed_attempts: 'Số lần đăng nhập sai',
  token_version: 'Phiên bản Token',

  // Nhập xuất Excel & Hàng loạt (Bulk Import)
  total_processed: 'Tổng số dòng xử lý',
  created_count: 'Số sản phẩm tạo mới',
  updated_count: 'Số sản phẩm cập nhật',
  failed_count: 'Số sản phẩm lỗi / thất bại',
  success_count: 'Số sản phẩm thành công',
  imported_count: 'Số sản phẩm đã nhập',
  valid_count: 'Số dòng hợp lệ',
  invalid_count: 'Số dòng không hợp lệ',
  bulk_items: 'Danh sách nhập hàng loạt',
  total_records: 'Tổng số bản ghi',
  skipped_count: 'Số dòng bỏ qua',

  // Thông tin chung
  note: 'Ghi chú',
  notes: 'Ghi chú',
  reason: 'Lý do điều chỉnh',
  description: 'Mô tả',
  type: 'Loại thao tác',
  created_at: 'Thời gian tạo',
  updated_at: 'Thời gian cập nhật',
  created_by: 'Người tạo',
  updated_by: 'Người cập nhật',
  ip_address: 'Địa chỉ IP',
};

// 2. Từ điển dịch giá trị (Value translations)
export const VALUE_TRANSLATIONS: Record<string, string> = {
  // Trạng thái đơn hàng / hóa đơn
  CANCELLED: 'Đã hủy',
  CANCELED: 'Đã hủy',
  PAID: 'Đã thanh toán',
  UNPAID: 'Chưa thanh toán',
  PENDING: 'Chờ xử lý',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn thành',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  DRAFT: 'Bản nháp',
  CONFIRMED: 'Đã xác nhận',
  SHIPPED: 'Đã giao hàng',
  DELIVERED: 'Đã nhận hàng',
  RETURNED: 'Đã hoàn trả',
  EDITED: 'Đã chỉnh sửa',

  // Trạng thái người dùng
  ACTIVE: 'Đang hoạt động',
  INACTIVE: 'Ngừng hoạt động',
  LOCKED: 'Đã bị khóa',
  UNLOCKED: 'Đang mở khóa',

  // Vai trò người dùng
  ADMIN: 'Quản trị viên (Admin)',
  SALES: 'Nhân viên kinh doanh',
  SALE: 'Nhân viên kinh doanh',
  WAREHOUSE: 'Thủ kho',
  MANAGER: 'Quản lý',
  USER: 'Người dùng',

  // Loại giao dịch kho
  ISSUE: 'Xuất kho',
  RECEIPT: 'Nhập kho',
  ADJUST: 'Điều chỉnh tồn kho',
  STOCK_COUNT: 'Kiểm kê kho',

  // Boolean dạng chuỗi
  TRUE: 'Có',
  FALSE: 'Không',
};

// 3. Từ điển nhãn hành động tiếng Việt
export const ACTION_LABELS: Record<string, string> = {
  INVENTORY_ADJUST: 'Điều chỉnh tồn kho',
  PRICE_CHANGE: 'Thay đổi giá',
  DEBT_LIMIT_CHANGE: 'Đổi hạn mức công nợ',
  INVOICE_CREATE: 'Tạo mới hóa đơn',
  INVOICE_EDIT: 'Sửa hóa đơn',
  INVOICE_CANCEL: 'Hủy hóa đơn',
  ORDER_CREATE: 'Tạo đơn hàng',
  ORDER_APPROVE: 'Duyệt đơn hàng',
  ORDER_REJECT: 'Từ chối đơn hàng',
  ORDER_EDIT: 'Sửa đơn hàng',
  ORDER_CANCEL: 'Hủy đơn hàng',
  ORDER_UPDATE: 'Cập nhật đơn hàng',
  STOCK_RECEIPT: 'Nhập kho',
  STOCK_ISSUE: 'Xuất kho',
  STOCK_COUNT: 'Kiểm kê kho',
  STOCK_ADJUST: 'Điều chỉnh kho',
  PRODUCT_CREATE: 'Thêm mới sản phẩm',
  PRODUCT_UPDATE: 'Cập nhật sản phẩm',
  PRODUCT_DELETE: 'Xóa sản phẩm',
  LOGIN: 'Đăng nhập hệ thống',
  LOGOUT: 'Đăng xuất',
  CREATE: 'Thêm mới',
  UPDATE: 'Cập nhật',
  DELETE: 'Xóa',
};

// 4. Từ điển loại đối tượng tiếng Việt
export const ENTITY_LABELS: Record<string, string> = {
  Inventory: 'Tồn kho',
  ProductPrice: 'Giá sản phẩm',
  PriceBook: 'Bảng giá sản phẩm',
  Product: 'Sản phẩm / Kho',
  CustomerDebt: 'Hạn mức công nợ',
  DealerDebtLimit: 'Hạn mức công nợ',
  Invoice: 'Hóa đơn',
  Order: 'Đơn hàng',
  Dealer: 'Đại lý / Khách hàng',
  Customer: 'Khách hàng',
  User: 'Tài khoản người dùng',
  UserAccount: 'Tài khoản người dùng',
  Account: 'Tài khoản',
  InventoryTransaction: 'Giao dịch kho',
};

export const getActionLabel = (actionType?: string): string => {
  if (!actionType) return '—';
  return ACTION_LABELS[actionType] || ACTION_LABELS[actionType.toUpperCase()] || actionType;
};

export const getEntityLabel = (entityType?: string): string => {
  if (!entityType) return 'Đối tượng';
  return (
    ENTITY_LABELS[entityType] ||
    ENTITY_LABELS[entityType.toLowerCase()] ||
    ENTITY_LABELS[entityType.toUpperCase()] ||
    entityType
  );
};

export const formatEntityIdDisplay = (entityId?: string): string => {
  if (!entityId) return '—';
  const match = entityId.match(/^BULK_(\d+)_ITEMS$/i);
  if (match) {
    return `Hàng loạt (${match[1]} mặt hàng)`;
  }
  return entityId;
};

export const getFieldLabel = (key: string): string => {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const lower = key.toLowerCase();
  if (FIELD_LABELS[lower]) return FIELD_LABELS[lower];

  if (lower.endsWith('_price') || lower.endsWith('price')) return `Giá (${key})`;
  if (lower.endsWith('_date') || lower.endsWith('_at')) return `Thời gian (${key})`;
  if (lower.endsWith('_id')) return `Mã định danh (${key})`;
  if (lower.endsWith('_name')) return `Tên (${key})`;
  if (lower.endsWith('_code')) return `Mã (${key})`;
  if (lower.endsWith('_status')) return `Trạng thái (${key})`;
  if (lower.endsWith('_amount')) return `Số tiền (${key})`;
  if (lower.endsWith('_limit')) return `Hạn mức (${key})`;
  if (lower.endsWith('_stock')) return `Tồn kho (${key})`;
  if (lower.endsWith('_count')) return `Số lượng (${key})`;

  return key;
};

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ log, onClose }) => {
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual');

  if (!log) return null;

  const parseJSON = (str?: string | null) => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  };

  const oldParsed = parseJSON(log.old_values);
  const newParsed = parseJSON(log.new_values);

  const formatFieldValue = (key: string, val: any): string => {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'boolean') {
      return val ? 'Có (Kích hoạt)' : 'Không (Vô hiệu)';
    }
    if (typeof val === 'number') {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('price') ||
        lowerKey.includes('limit') ||
        lowerKey.includes('amount') ||
        lowerKey.includes('cost') ||
        lowerKey.includes('debt') ||
        lowerKey.includes('balance')
      ) {
        return `${val.toLocaleString('vi-VN')} đ`;
      }
      return val.toLocaleString('vi-VN');
    }
    if (typeof val === 'string') {
      const upper = val.toUpperCase().trim();
      if (VALUE_TRANSLATIONS[upper]) {
        return VALUE_TRANSLATIONS[upper];
      }
      return val;
    }
    if (Array.isArray(val)) {
      return val.map((v) => formatFieldValue(key, v)).join(', ');
    }
    if (typeof val === 'object') {
      try {
        const entries = Object.entries(val).map(([k, v]) => `${getFieldLabel(k)}: ${formatFieldValue(k, v)}`);
        return entries.join('; ');
      } catch {
        return JSON.stringify(val);
      }
    }
    return String(val);
  };

  const formatRawVietnameseJSON = (obj: any): string => {
    if (!obj) return 'Không có dữ liệu';
    if (typeof obj !== 'object') return String(obj);

    const translateDeep = (item: any): any => {
      if (item === null || item === undefined) return item;
      if (Array.isArray(item)) return item.map(translateDeep);
      if (typeof item === 'object') {
        const res: Record<string, any> = {};
        for (const [k, v] of Object.entries(item)) {
          const viKey = getFieldLabel(k);
          res[viKey] = translateDeep(v);
        }
        return res;
      }
      if (typeof item === 'string') {
        const upper = item.toUpperCase().trim();
        if (VALUE_TRANSLATIONS[upper]) {
          return VALUE_TRANSLATIONS[upper];
        }
      }
      return item;
    };

    try {
      return JSON.stringify(translateDeep(obj), null, 2);
    } catch {
      return JSON.stringify(obj, null, 2);
    }
  };

  // Danh sách các trường metadata phụ không phải là thuộc tính đối tượng chính
  const METADATA_KEYS = new Set([
    'name',
    'product_name',
    'customer_name',
    'dealer_name',
    'adjustment',
    'reason',
    'note',
    'supplier',
    'destination',
    'received',
    'issued',
  ]);

  // Trích xuất danh sách các trường thực sự thay đổi giá trị giữa Trước và Sau
  const getFieldDiffList = () => {
    const keys = new Set<string>();
    if (oldParsed && typeof oldParsed === 'object') {
      Object.keys(oldParsed).forEach((k) => keys.add(k));
    }
    if (newParsed && typeof newParsed === 'object') {
      Object.keys(newParsed).forEach((k) => keys.add(k));
    }

    return Array.from(keys)
      .filter((key) => {
        // Loại bỏ các trường metadata phụ nếu chỉ xuất hiện ở một phía
        if (METADATA_KEYS.has(key)) {
          const inOld = oldParsed && typeof oldParsed === 'object' && key in oldParsed;
          const inNew = newParsed && typeof newParsed === 'object' && key in newParsed;
          if (!inOld || !inNew) return false;
        }

        const oldVal = oldParsed && typeof oldParsed === 'object' ? oldParsed[key] : undefined;
        const newVal = newParsed && typeof newParsed === 'object' ? newParsed[key] : undefined;

        // Chỉ hiển thị những trường có giá trị thực sự thay đổi
        return JSON.stringify(oldVal) !== JSON.stringify(newVal);
      })
      .map((key) => {
        const oldVal = oldParsed && typeof oldParsed === 'object' ? oldParsed[key] : undefined;
        const newVal = newParsed && typeof newParsed === 'object' ? newParsed[key] : undefined;

        // Tính chênh lệch nếu cả 2 là số (hoặc lấy từ metadata adjustment nếu oldVal không có)
        let deltaStr = '';
        if (typeof oldVal === 'number' && typeof newVal === 'number') {
          const delta = newVal - oldVal;
          const lower = key.toLowerCase();
          const isMoney =
            lower.includes('price') ||
            lower.includes('limit') ||
            lower.includes('amount') ||
            lower.includes('cost') ||
            lower.includes('debt');
          if (delta > 0) {
            deltaStr = `+${isMoney ? delta.toLocaleString('vi-VN') + ' đ' : delta.toLocaleString('vi-VN')}`;
          } else if (delta < 0) {
            deltaStr = `${isMoney ? delta.toLocaleString('vi-VN') + ' đ' : delta.toLocaleString('vi-VN')}`;
          }
        } else if (key === 'stock' && newParsed && typeof newParsed === 'object' && typeof newParsed.adjustment === 'number') {
          const adj = newParsed.adjustment;
          deltaStr = adj > 0 ? `+${adj.toLocaleString('vi-VN')}` : `${adj.toLocaleString('vi-VN')}`;
        }

        let displayOldVal = oldVal;

        // Nếu oldVal chưa có nhưng newVal có liên quan đến ĐVT quy đổi, hiển thị giá trị cơ sở ban đầu
        if (displayOldVal === undefined || displayOldVal === null) {
          if (key === 'unit_name') {
            displayOldVal = (oldParsed && oldParsed.base_unit) || (newParsed && newParsed.base_unit) || 'Đơn vị cơ sở';
          } else if (key === 'conversion_rate') {
            displayOldVal = 1;
          } else if (key === 'base_quantity') {
            displayOldVal = 0;
          }
        }

        return {
          key,
          label: getFieldLabel(key),
          oldVal: displayOldVal,
          newVal,
          isChanged: true,
          deltaStr,
        };
      });
  };

  const diffRows = getFieldDiffList();

  return (
    <ModalPortal>
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        animation: 'fadeInCard 0.2s ease',
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '740px',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}>
        {/* Tiêu đề modal */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                Chi tiết thay đổi #{log.id}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                Đối tượng: <strong style={{ color: '#0f172a' }}>{getEntityLabel(log.entity_type)} ({formatEntityIdDisplay(log.entity_id)})</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              lineHeight: 1,
            }}
            title="Đóng cửa sổ"
          >
            ✕
          </button>
        </div>

        {/* Nội dung thông tin chi tiết */}
        <div style={{ padding: '22px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Lưới thông tin tổng quan */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px 18px',
            fontSize: '13px',
          }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.04em' }}>
                Thời gian (Giờ Việt Nam)
              </span>
              <strong style={{ color: '#0f172a' }}>{formatLocalDateTime(log.created_at)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Người thực hiện
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: log.user_avatar ? '#f1f5f9' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '11px',
                  overflow: 'hidden',
                  border: '1px solid #cbd5e1',
                  flexShrink: 0,
                }}>
                  {log.user_avatar ? (
                    <img
                      src={getAvatarUrl(log.user_avatar)}
                      alt={log.user_name || 'U'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    (log.user_name || 'U').charAt(0).toUpperCase()
                  )}
                </div>
                <strong style={{ color: '#0f172a' }}>{log.user_name || 'Hệ thống'}</strong>
              </div>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.04em' }}>
                Hành động
              </span>
              <strong style={{ color: '#2563eb' }}>{getActionLabel(log.action_type)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.04em' }}>
                Địa chỉ IP
              </span>
              <strong style={{ color: '#475569', fontFamily: 'monospace' }}>{log.ip_address || '—'}</strong>
            </div>
          </div>

          {/* Hộp ghi chú / Lý do điều chỉnh */}
          {log.reason && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '16px' }}>📝</span>
              <div>
                <strong style={{ fontSize: '12px', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Lý do điều chỉnh:
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '13.5px', color: '#78350f', fontWeight: '500' }}>{log.reason}</p>
              </div>
            </div>
          )}

          {/* Thanh chuyển đổi chế độ xem */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
              Nội dung thay đổi
            </span>
            <div style={{
              display: 'inline-flex',
              padding: '2px',
              background: '#f1f5f9',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}>
              <button
                type="button"
                onClick={() => setViewMode('visual')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: viewMode === 'visual' ? '#ffffff' : 'transparent',
                  color: viewMode === 'visual' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'visual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Bảng so sánh
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  background: viewMode === 'raw' ? '#ffffff' : 'transparent',
                  color: viewMode === 'raw' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'raw' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                Dữ liệu gốc
              </button>
            </div>
          </div>

          {/* Chế độ 1: Bảng so sánh trực quan (Visual Key-Value Table) */}
          {viewMode === 'visual' ? (
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden',
              background: '#ffffff',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px', fontWeight: '600', width: '32%' }}>Thông tin thay đổi</th>
                    <th style={{ padding: '10px 14px', fontWeight: '600', width: '34%', color: '#b91c1c' }}>Trước khi sửa</th>
                    <th style={{ padding: '10px 14px', fontWeight: '600', width: '34%', color: '#15803d' }}>Sau khi sửa</th>
                  </tr>
                </thead>
                <tbody>
                  {diffRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                        Không có thông số thay đổi chi tiết.
                      </td>
                    </tr>
                  ) : (
                    diffRows.map((row, idx) => (
                      <tr
                        key={row.key}
                        style={{
                          background: row.isChanged ? (idx % 2 === 0 ? '#fefce8' : '#fffbeb') : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        {/* Cột Tên trường */}
                        <td style={{ padding: '11px 14px', fontWeight: '600', color: '#1e293b' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {row.isChanged && (
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#f59e0b',
                                display: 'inline-block',
                              }} />
                            )}
                            <span>{row.label}</span>
                          </div>
                        </td>

                        {/* Cột Trước khi sửa */}
                        <td style={{ padding: '11px 14px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{
                            background: row.isChanged ? '#fee2e2' : 'transparent',
                            color: row.isChanged ? '#991b1b' : '#334155',
                            padding: row.isChanged ? '2px 6px' : '0',
                            borderRadius: '4px',
                            fontWeight: row.isChanged ? '600' : 'normal',
                          }}>
                            {formatFieldValue(row.key, row.oldVal)}
                          </span>
                        </td>

                        {/* Cột Sau khi sửa */}
                        <td style={{ padding: '11px 14px', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              background: row.isChanged ? '#dcfce7' : 'transparent',
                              color: row.isChanged ? '#166534' : '#0f172a',
                              padding: row.isChanged ? '2px 6px' : '0',
                              borderRadius: '4px',
                              fontWeight: row.isChanged ? '700' : 'normal',
                            }}>
                              {formatFieldValue(row.key, row.newVal)}
                            </span>
                            {row.deltaStr && (
                              <span style={{
                                fontSize: '11.5px',
                                fontWeight: '700',
                                color: row.deltaStr.startsWith('+') ? '#15803d' : '#dc2626',
                                background: row.deltaStr.startsWith('+') ? '#dcfce7' : '#fee2e2',
                                padding: '1px 5px',
                                borderRadius: '4px',
                              }}>
                                ({row.deltaStr})
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Chế độ 2: Dữ liệu JSON gốc (Raw View) */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                borderRadius: '12px',
                padding: '12px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '8px',
                  color: '#dc2626',
                  fontWeight: '700',
                  fontSize: '12.5px',
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }} />
                  <span>Dữ liệu trước khi sửa</span>
                </div>
                <pre style={{
                  margin: 0,
                  padding: '10px',
                  background: '#ffffff',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  fontFamily: 'ui-monospace, monospace',
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}>
                  {formatRawVietnameseJSON(oldParsed)}
                </pre>
              </div>

              <div style={{
                background: '#f0fdf4',
                border: '1px solid #dcfce7',
                borderRadius: '12px',
                padding: '12px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '8px',
                  color: '#16a34a',
                  fontWeight: '700',
                  fontSize: '12.5px',
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a' }} />
                  <span>Dữ liệu sau khi sửa</span>
                </div>
                <pre style={{
                  margin: 0,
                  padding: '10px',
                  background: '#ffffff',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  fontFamily: 'ui-monospace, monospace',
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}>
                  {formatRawVietnameseJSON(newParsed)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Chân trang modal */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          background: '#f8fafc',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
