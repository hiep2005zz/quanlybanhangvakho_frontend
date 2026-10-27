import React from 'react';
import { useLocation } from '../hooks/useLocation';

export type TabType =
  | 'inventory'
  | 'cart'
  | 'warehouses'
  | 'stock-book'
  | 'inventory-turnover'
  | 'stock-audits'
  | 'stock-transfers'
  | 'warehouse-dispatch'
  | 'delivery-trips'
  | 'orders'
  | 'create-order'
  | 'users'
  | 'users-import'
  | 'categories'
  | 'audit-logs'
  | 'profile'
  | 'suppliers'
  | 'dealers'
  | 'dealer-profiles'
  | 'debt-ledger'
  | 'price-books'
  | 'delivery-points'
  | 'product-history'
  | 'discounts'
  | 'stock-thresholds'
  | 'low-stock-alerts'
  | 'goods-receipt'
  | 'add-product'
  | 'products-import'
  | 'stock-card'
  | 'agency-debts'
  | 'picking'
  | 'batches'
  | 'debt-aging'
  | 'sales-report'
  | 'sales-targets'
  | 'executive-dashboard'
  | 'delivery-tracking'
  | 'stock-adjustments'
  | 'payment-collections'
  | 'sales-invoices'
  | 'return-orders'
  | 'debt-payments'
  | 'debt-reconciliation'
  | 'debt-statement'
  | 'debt-adjustments'
  | 'receipt-vouchers';

export interface SidebarProps {
  activeTab?: TabType;
  onSelectTab: (tab: TabType) => void;
  isCustomer?: boolean;
  canManageProducts?: boolean;
  canCreateOrders?: boolean;
  canReadOrders?: boolean;
  canViewDealers?: boolean;
  canManageDealerProfiles?: boolean;
  canAccessDebtLedger?: boolean;
  canManageDeliveryPoints?: boolean;
  canManageSuppliers?: boolean;
  canAccessPriceBooks?: boolean;
  canManageCategories?: boolean;
  canViewProductHistory?: boolean;
  canAccessDiscounts?: boolean;
  canAccessStockAudit?: boolean;
  canAccessStockTransfer?: boolean;
  canAccessStockBook?: boolean;
  canAccessWarehouses?: boolean;
  canAccessDebtAging?: boolean;
  canAccessSalesReport?: boolean;
  canAccessSalesTargets?: boolean;
  canAccessExecutiveDashboard?: boolean;
  canWriteInventory?: boolean;
  canAccessDeliveryTracking?: boolean;
  isWarehouseOrAdmin?: boolean;
  isAdmin?: boolean;
  canAccessPaymentCollections?: boolean;
  canAccessSalesInvoices?: boolean;
  canAccessDebtPayments?: boolean;
  canAccessDebtReconciliation?: boolean;
  canAccessInventoryTurnover?: boolean;
  canAccessDebtStatement?: boolean;
  canAccessDebtAdjustments?: boolean;
  onLogout?: () => void;
  isLoggingOut?: boolean;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

interface MenuItemConfig {
  id?: string;
  tab: TabType;
  path: string;
  label: string;
  visible: boolean;
  badge?: string;
  icon: React.ReactNode;
}

interface MenuGroup {
  id: string;
  title: string;
  items: MenuItemConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCustomer = false,
  isMobileOpen = false,
  onCloseMobile,
  canManageProducts: _canManageProducts = true,
  canCreateOrders = false,
  canReadOrders = false,
  canViewDealers = false,
  canManageDealerProfiles = false,
  canAccessDebtLedger = false,
  canManageDeliveryPoints = false,
  canManageSuppliers = false,
  canAccessPriceBooks = false,
  canManageCategories = false,
  canViewProductHistory = false,
  canAccessDiscounts = false,
  canAccessStockAudit = false,
  canAccessStockTransfer = false,
  canAccessStockBook = true,
  canAccessWarehouses = false,
  canAccessDebtAging: _canAccessDebtAging = false,
  canAccessSalesReport = false,
  canAccessSalesTargets = false,
  canAccessExecutiveDashboard = false,
  canWriteInventory = false,
  canAccessDeliveryTracking = false,
  isWarehouseOrAdmin = false,
  isAdmin = false,
  canAccessPaymentCollections = false,
  canAccessSalesInvoices = true,
  canAccessDebtPayments = false,
  canAccessDebtReconciliation = false,
  canAccessInventoryTurnover = false,
  canAccessDebtStatement: _canAccessDebtStatement = false,
  canAccessDebtAdjustments = false,
  onLogout,
  isLoggingOut = false,
}) => {
  const location = useLocation();
  const currentPath = location.pathname.toLowerCase();

  // 1. DÀNH CHO KHÁCH HÀNG / ĐẠI LÝ (Customer portal - cấu trúc hiện đại)
  if (isCustomer) {
    const customerGroups: MenuGroup[] = [
      {
        id: 'group-customer-shopping',
        title: 'MUA HÀNG & ĐƠN HÀNG',
        items: [
          {
            id: 'btn-sidebar-products',
            tab: 'inventory',
            path: '/',
            label: 'Danh sách Sản phẩm',
            visible: true,
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
            ),
          },
          {
            id: 'btn-sidebar-orders',
            tab: 'orders',
            path: '/orders',
            label: 'Đơn hàng của tôi',
            visible: true,
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M8 8h8M8 12h8M8 16h4" />
              </svg>
            ),
          },
        ],
      },
      {
        id: 'group-customer-account',
        title: 'TÀI KHOẢN & CÔNG NỢ',
        items: [
          {
            id: 'btn-sidebar-dealers',
            tab: 'dealers',
            path: '/dealers',
            label: 'Danh bạ đại lý & Khách hàng',
            visible: true,
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            ),
          },
          {
            id: 'btn-sidebar-agency-debts',
            tab: 'agency-debts',
            path: '/agency-debts',
            label: 'Công nợ & Hóa đơn',
            visible: true,
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            ),
          },
          {
            id: 'btn-sidebar-debt-statement',
            tab: 'debt-statement',
            path: '/debt-statement',
            label: 'Sổ chi tiết công nợ',
            visible: true,
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            ),
          },
        ],
      },
    ];

    const filteredCustomerGroups = customerGroups
      .map((group) => {
        const visibleItems = group.items.filter(() => true);
        return { ...group, items: visibleItems };
      })
      .filter((group) => group.items.length > 0);

    const renderCustomerNav = (isMobile = false) => (
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {filteredCustomerGroups.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            Không tìm thấy chức năng phù hợp
          </div>
        ) : (
          filteredCustomerGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      type="button"
                      id={isMobile ? `mobile-${item.id}` : item.id}
                      onClick={() => {
                        onSelectTab(item.tab);
                        if (isMobile) onCloseMobile?.();
                      }}
                      style={{
                        backgroundImage: 'none',
                        boxShadow: 'none',
                        marginTop: 0,
                      }}
                      className={`group w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs transition-all text-left border-0 cursor-pointer ${isActive
                          ? 'bg-emerald-50 text-emerald-800 font-bold border-l-3 border-emerald-600 pl-[9px]'
                          : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                        }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`flex-shrink-0 transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-700'
                            }`}
                        >
                          {item.icon}
                        </span>
                        <span className="truncate leading-tight">{item.label}</span>
                      </div>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    );

    return (
      <>
        {/* Desktop Sidebar Customer */}
        <aside className="hidden md:flex md:w-64 bg-white border-r border-slate-200 flex-col h-full flex-shrink-0 select-none shadow-[1px_0_4px_rgba(0,0,0,0.02)]">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center bg-slate-50/70">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">CỔNG ĐẠI LÝ</span>
          </div>
          {renderCustomerNav(false)}
          {onLogout && (
            <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
              <button
                type="button"
                onClick={onLogout}
                disabled={isLoggingOut}
                style={{
                  backgroundImage: 'none',
                  boxShadow: 'none',
                  marginTop: 0,
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50 text-left bg-transparent border-0 cursor-pointer"
              >
                <span className="text-slate-400 hover:text-rose-600 transition-colors flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </span>
                <span className="truncate">{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
              </button>
            </div>
          )}
        </aside>

        {/* Mobile Customer Drawer */}
        {isMobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity" onClick={onCloseMobile} />
            <div className="relative w-72 max-w-[80vw] bg-white flex flex-col h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
              <div className="px-4 py-3 bg-emerald-700 text-white flex items-center justify-between">
                <span className="text-sm font-bold">Cổng Đại Lý</span>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/20 text-lg cursor-pointer border-0 bg-transparent"
                  title="Đóng menu"
                >
                  ✕
                </button>
              </div>
              {renderCustomerNav(true)}
              {onLogout && (
                <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onCloseMobile?.();
                      onLogout();
                    }}
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50 text-left bg-transparent border-0 cursor-pointer"
                  >
                    <span className="text-slate-400 hover:text-rose-600 transition-colors flex-shrink-0">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    </span>
                    <span className="truncate">{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  // 2. TỔ CHỨC CÁC PHÂN HỆ MENU THEO NHÓM NGHIỆP VỤ CHO TOÀN BỘ CÁC VAI TRÒ HỆ THỐNG
  const menuGroups: MenuGroup[] = [
    {
      id: 'group-overview',
      title: 'TỔNG QUAN & ĐIỀU HÀNH',
      items: [
        {
          id: 'btn-sidebar-executive-dashboard',
          tab: 'executive-dashboard',
          path: '/executive-dashboard',
          label: 'Tổng quan điều hành',
          visible: canAccessExecutiveDashboard,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" rx="1" />
              <rect x="14" y="3" width="7" height="5" rx="1" />
              <rect x="14" y="12" width="7" height="9" rx="1" />
              <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'group-inventory',
      title: 'KHO HÀNG & TỒN TRỮ',
      items: [
        {
          id: 'btn-sidebar-inventory',
          tab: 'inventory',
          path: '/',
          label: 'Quản lý kho hàng',
          visible: true,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-warehouses',
          tab: 'warehouses',
          path: '/warehouses',
          label: 'Danh sách kho & Vị trí',
          visible: canAccessWarehouses,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-stock-book',
          tab: 'stock-book',
          path: '/stock-book',
          label: 'Hàng tồn kho',
          visible: Boolean(canAccessStockBook),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="9" y1="7" x2="15" y2="7" />
              <line x1="9" y1="11" x2="15" y2="11" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-inventory-turnover',
          tab: 'inventory-turnover',
          path: '/inventory-turnover',
          label: 'Vòng quay & Tuổi tồn',
          visible: Boolean(canAccessInventoryTurnover),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              <path d="M12 7v5l3 3" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-batches',
          tab: 'batches',
          path: '/batches',
          label: 'Lô & Hạn sử dụng',
          visible: isWarehouseOrAdmin,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-stock-transfers',
          tab: 'stock-transfers',
          path: '/stock-transfers',
          label: 'Chuyển kho nội bộ',
          visible: canAccessStockTransfer,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-stock-audits',
          tab: 'stock-audits',
          path: '/stock-audits',
          label: 'Kiểm kê kho',
          visible: canAccessStockAudit,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="m9 14 2 2 4-4" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-product-history',
          tab: 'product-history',
          path: '/product-history',
          label: 'Lịch sử sản phẩm',
          visible: canViewProductHistory,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'group-orders',
      title: 'BÁN HÀNG & PHÂN PHỐI',
      items: [
        {
          id: 'btn-sidebar-create-order',
          tab: 'create-order',
          path: '/create-order',
          label: 'Tạo đơn hàng',
          visible: canCreateOrders,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-orders',
          tab: 'orders',
          path: '/orders',
          label: 'Quản lý đơn hàng',
          visible: canReadOrders,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M8 8h8M8 12h8M8 16h4" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-return-orders',
          tab: 'return-orders',
          path: '/return-orders',
          label: 'Trả hàng & Nhập lại kho',
          visible: !isCustomer && (canReadOrders || isWarehouseOrAdmin || canCreateOrders),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4" />
              <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-delivery-tracking',
          tab: 'delivery-tracking',
          path: '/delivery-tracking',
          label: 'Theo dõi giao hàng',
          visible: canAccessDeliveryTracking,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="1" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
              <line x1="9" y1="11" x2="12" y2="11" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-dealers',
          tab: 'dealers',
          path: '/dealers',
          label: 'Danh bạ đại lý & Khách',
          visible: canViewDealers,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-delivery-points',
          tab: 'delivery-points',
          path: '/delivery-points',
          label: 'Điểm giao hàng',
          visible: canManageDeliveryPoints,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-suppliers',
          tab: 'suppliers',
          path: '/suppliers',
          label: 'Nhà cung cấp',
          visible: canManageSuppliers,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" rx="1" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'group-finance',
      title: 'TÀI CHÍNH & CÔNG NỢ',
      items: [
        {
          id: 'btn-sidebar-dealer-profiles',
          tab: 'dealer-profiles',
          path: '/dealer-profiles',
          label: 'Hồ sơ & Hạn mức nợ',
          visible: canManageDealerProfiles,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-debt-ledger',
          tab: 'debt-ledger',
          path: '/debt-ledger',
          label: 'Sổ công nợ & Tuổi nợ',
          visible: Boolean(canAccessDebtLedger),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
              <path d="M8 7h6M8 11h6" />
            </svg>
          ),
        },

        {
          id: 'btn-sidebar-debt-adjustments',
          tab: 'debt-adjustments',
          path: '/debt-adjustments',
          label: 'Giảm trừ công nợ khi trả hàng',
          visible: Boolean(canAccessDebtAdjustments || isAdmin),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-debt-payments',
          tab: 'debt-payments',
          path: '/debt-payments',
          label: 'Thu tiền & Đối trừ nợ',
          visible: Boolean(canAccessDebtPayments),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
              <path d="M6 15h2M12 15h6" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-debt-reconciliation',
          tab: 'debt-reconciliation',
          path: '/debt-reconciliation',
          label: 'Đối chiếu công nợ',
          visible: Boolean(canAccessDebtReconciliation),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-payment-collections',
          tab: 'payment-collections',
          path: '/payment-collections',
          label: 'Thu tiền theo tuyến',
          visible: canAccessPaymentCollections,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
              <line x1="6" y1="15" x2="6.01" y2="15" />
              <line x1="10" y1="15" x2="14" y2="15" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-warehouse-dispatch',
          tab: 'warehouse-dispatch',
          path: '/warehouse/dispatch',
          label: 'Xuất kho & Giao thiếu',
          visible: !isCustomer && (canWriteInventory || isWarehouseOrAdmin || isAdmin),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 18H3c-.6 0-1-.4-1-1V7c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v11" />
              <path d="M14 9h4l4 4v4c0 .6-.4 1-1 1h-2" />
              <circle cx="7" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-delivery-trips',
          tab: 'delivery-trips',
          path: '/delivery-trips',
          label: 'Chuyến giao hàng',
          visible: !isCustomer && (canWriteInventory || isWarehouseOrAdmin || isAdmin),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-sales-invoices',
          tab: 'sales-invoices',
          path: '/sales-invoices',
          label: 'Xuất hóa đơn bán hàng',
          visible: !isCustomer && Boolean(canAccessSalesInvoices),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'group-pricing',
      title: 'CHÍNH SÁCH & BÁO CÁO',
      items: [
        {
          id: 'btn-sidebar-price-books',
          tab: 'price-books',
          path: '/price-books',
          label: 'Bảng giá bán hàng',
          visible: canAccessPriceBooks,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-discounts',
          tab: 'discounts',
          path: '/discounts',
          label: 'Chính sách chiết khấu',
          visible: canAccessDiscounts,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="5" x2="5" y2="19" />
              <circle cx="6.5" cy="6.5" r="2.5" />
              <circle cx="17.5" cy="17.5" r="2.5" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-categories',
          tab: 'categories',
          path: '/categories',
          label: 'Nhóm hàng & Doanh số',
          visible: canManageCategories,
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-sales-report',
          tab: 'sales-report',
          path: '/sales-report',
          label: 'Báo cáo doanh số đa chiều',
          visible: Boolean(canAccessSalesReport),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          ),
        },
        {
          id: 'btn-sidebar-sales-targets',
          tab: 'sales-targets',
          path: '/sales-targets',
          label: 'Chỉ tiêu doanh số (KPI)',
          visible: Boolean(canAccessSalesTargets),
          icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="6" />
              <circle cx="12" cy="12" r="2" />
            </svg>
          ),
        },
      ],
    },
  ];

  // Danh sách phẳng tất cả các mục có thể hiển thị
  const allVisibleItems = menuGroups.flatMap((g) => g.items.filter((i) => i.visible));

  // Kiểm tra trạng thái active của mục menu
  const checkIsItemActive = (item: MenuItemConfig) => {
    // Sổ chi tiết công nợ hoặc Phiếu thu tiền được mở từ Hồ sơ & Hạn mức nợ -> Giữ active cho Hồ sơ & Hạn mức nợ
    if (
      item.tab === 'dealer-profiles' &&
      (currentPath === '/debt-statement' ||
        activeTab === 'debt-statement' ||
        currentPath === '/receipt-vouchers' ||
        activeTab === 'receipt-vouchers')
    ) {
      return true;
    }

    const isPathMatched =
      item.path === '/'
        ? currentPath === '/' || currentPath === '' || currentPath === '/inventory' || currentPath === '/index.html'
        : currentPath === item.path.toLowerCase() || currentPath.startsWith(`${item.path.toLowerCase()}/`);

    const isAnyPathMatched = allVisibleItems.some((m) =>
      m.path === '/'
        ? currentPath === '/' || currentPath === '' || currentPath === '/inventory' || currentPath === '/index.html'
        : currentPath === m.path.toLowerCase() || currentPath.startsWith(`${m.path.toLowerCase()}/`)
    );

    return isAnyPathMatched
      ? isPathMatched
      : activeTab
        ? activeTab === item.tab
        : isPathMatched;
  };

  // Lọc các mục hiển thị trong menu
  const filteredGroups = menuGroups
    .map((group) => {
      const visibleItems = group.items.filter((item) => item.visible);
      return { ...group, items: visibleItems };
    })
    .filter((group) => group.items.length > 0);

  // Render nội dung danh sách menu
  const renderNavContent = (isMobile = false) => (
    <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
      {filteredGroups.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">
          Không tìm thấy chức năng phù hợp
        </div>
      ) : (
        filteredGroups.map((group) => (
          <div key={group.id} className="space-y-1">
            <div className="px-2.5 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = checkIsItemActive(item);
                return (
                  <button
                    key={item.tab}
                    type="button"
                    id={isMobile ? `mobile-${item.id}` : item.id}
                    onClick={() => {
                      onSelectTab(item.tab);
                      if (isMobile) onCloseMobile?.();
                    }}
                    style={{
                      backgroundImage: 'none',
                      boxShadow: 'none',
                      marginTop: 0,
                    }}
                    className={`group w-full flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-xs transition-all text-left border-0 cursor-pointer ${isActive
                        ? 'bg-emerald-50 text-emerald-800 font-bold border-l-3 border-emerald-600 pl-[9px]'
                        : 'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`flex-shrink-0 transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-slate-700'
                          }`}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate leading-tight">{item.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 flex-shrink-0"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 bg-white border-r border-slate-200 flex-col h-full flex-shrink-0 select-none shadow-[1px_0_4px_rgba(0,0,0,0.02)]">
        {/* Danh sách mục điều hướng Sidebar */}
        {renderNavContent(false)}

        {/* Footer Sidebar: Nút Đăng xuất */}
        {onLogout && (
          <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
            <button
              type="button"
              onClick={onLogout}
              disabled={isLoggingOut}
              style={{
                backgroundImage: 'none',
                boxShadow: 'none',
                marginTop: 0,
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50 text-left bg-transparent border-0 cursor-pointer"
            >
              <span className="text-slate-400 hover:text-rose-600 transition-colors flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              <span className="truncate">{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] bg-white flex flex-col h-full z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="px-4 py-3 bg-emerald-700 text-white flex items-center justify-between">
              <span className="text-sm font-bold">Hệ Thống Quản Lý</span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white hover:bg-white/20 text-lg cursor-pointer border-0 bg-transparent"
                title="Đóng menu"
              >
                ✕
              </button>
            </div>
            {renderNavContent(true)}
            {onLogout && (
              <div className="p-3 border-t border-slate-200 bg-white flex-shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile?.();
                    onLogout();
                  }}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50 text-left bg-transparent border-0 cursor-pointer"
                >
                  <span className="text-slate-400 hover:text-rose-600 transition-colors flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
                  <span className="truncate">{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
