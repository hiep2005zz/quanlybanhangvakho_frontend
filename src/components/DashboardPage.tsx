import { useState, useEffect, useMemo, useRef } from 'react';
import { getProductsApi, ProductItem, User } from '../services/api';
import { sessionManager, SessionState } from '../services/sessionManager';
import SecurityModal from './SecurityModal';
import { UserManagementView } from './UserManagementView';
import { CategoryManagementView } from './CategoryManagementView';
import CreateCustomerModal from './CreateCustomerModal';
import MoveCategoryModal from './MoveCategoryModal';
import { StatusToastHost, emitStatusToast } from './StatusToast';
import { AccessDeniedView } from './AccessDeniedView';
import SupplierManagementView from './SupplierManagementView';
import { PriceBookManagementView } from './PriceBookManagementView';
import { AuditLogView } from './AuditLogView';
import { ProductAuditDrawer } from './ProductAuditDrawer';
import { PriceUpdateModal } from './PriceUpdateModal';
import { ProfileView } from './ProfileView';
import DiscountPolicyView from './DiscountPolicyView';
import { ProductBulkImportModal } from './ProductBulkImportModal';
import DealerSearchView from './DealerSearchView';
import DealerProfileManagementView from './DealerProfileManagementView';
import DeliveryPointsView from './DeliveryPointsView';
import { ProductUnitModal } from './ProductUnitModal';
import { StockActionModal } from './StockActionModal';
import { GoodsReceiptModal } from './GoodsReceiptModal';
import { OrderManagementView } from './OrderManagementView';
import SalesOrderEntry from './SalesOrderEntry';
import { ProductHistoryView } from './ProductHistoryView';
import { ProductFormView } from './ProductFormView';
import { ModalPortal } from './ModalPortal';

import './dashboard.css';
import { Sidebar, type TabType } from './Sidebar';
import { DashboardHeader } from './DashboardHeader';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { getOrderPermissionTier } from '../utils/orderPermissions';

interface DashboardProps {
  user: User;
  token: string;
  onLogout: () => void | Promise<void>;
  onTokenUpdated?: (newToken: string) => void;
  onSwitchUser?: (newUser: User, newToken: string) => void;
  onUserUpdated?: (updatedUser: User) => void;
}

export default function DashboardPage({
  user,
  token,
  onLogout,
  onTokenUpdated,
  onUserUpdated,
}: DashboardProps) {
  // 1. Xác định vai trò & Kiểm tra quyền Admin tối cao
  const rawRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
  const officialRoles: string[] = rawRoles.filter(Boolean) as string[];
  const isCustomer = user.role === 'customer' || Boolean(user.roles && user.roles.includes('customer'));

  // Tài khoản bị khóa màn hình chờ chỉ khi chưa được phân công kho/địa bàn VÀ chưa có vai trò hợp lệ (không áp dụng cho tài khoản đại lý)
  const isPendingCustomer =
    !isCustomer &&
    officialRoles.length === 0 &&
    (!user.branch || user.branch === 'Chưa phân công');
  const isAdmin = user.role === 'admin' || Boolean(user.roles && user.roles.includes('admin'));
  const isAccountant = user.role === 'accountant' || Boolean(user.roles && user.roles.includes('accountant'));
  const orderPermTier = getOrderPermissionTier(user);
  const canReadOrders = orderPermTier !== 'NO_ACCESS';
  const canCreateOrders = (orderPermTier === 'FULL_ACCESS' || isCustomer || user.role === 'agent' || Boolean(user.roles && user.roles.includes('agent'))) && !isAccountant;
  const isSalesManager = user.role === 'sales_manager' || Boolean(user.roles && user.roles.includes('sales_manager'));
  const canAccessDiscounts =
    isAdmin ||
    isSalesManager ||
    officialRoles.includes('sales') ||
    user.role === 'sales' ||
    officialRoles.includes('accountant') ||
    user.role === 'accountant' ||
    Boolean(user.permissions && (user.permissions.includes('discount:read') || user.permissions.includes('discount:manage')));

  // Quyền quản lý nhà cung cấp
  const SUPPLIER_ROLES = ['admin', 'warehouse', 'warehouse_manager'];
  const canManageSuppliers = officialRoles.some((r) => SUPPLIER_ROLES.includes(r));

  // Quyền quản lý ngành hàng & sản phẩm
  const canManageCategories = isAdmin || isSalesManager;
  const canManageProducts = isAdmin || isSalesManager;
  const canAccessPriceBooks = isAdmin || isSalesManager || isAccountant;
  // Quyền tra cứu đại lý: Nhân viên kinh doanh (sales), Quản lý kinh doanh (sales_manager), Quản trị viên (admin), Kế toán (accountant), Đại lý (customer)
  const DEALER_ROLES = ['admin', 'sales_manager', 'sales', 'accountant'];
  const canViewDealers = isCustomer || officialRoles.some((r) => DEALER_ROLES.includes(r));
  // Quyền quản lý hồ sơ đại lý: Kế toán công nợ (accountant), Quản lý kinh doanh (sales_manager), Quản trị viên (admin), Nhân viên kinh doanh (sales)
  const canManageDealerProfiles = Boolean(
    isAdmin ||
    isSalesManager ||
    isAccountant ||
    user.role === 'sales' ||
    officialRoles.some((r) => DEALER_ROLES.includes(r))
  );

  // Quyền quản lý điểm giao hàng: Chỉ hiển thị với 3 vai trò admin, sales, sales_manager
  const DELIVERY_ROLES = ['admin', 'sales_manager', 'sales'];
  const canManageDeliveryPoints = Boolean(
    isAdmin ||
    isSalesManager ||
    user.role === 'sales' ||
    officialRoles.some((r) => DELIVERY_ROLES.includes(r))
  );

  // Quyền thao tác kho (Nhập/xuất/sửa kho: Admin, Quản lý kho, Thủ kho)
  const canWriteInventory = user.can_write_inventory ?? (isAdmin || officialRoles.some((r) => ['admin', 'warehouse', 'warehouse_manager'].includes(r)));

  // Quyền Cấu hình ĐVT quy đổi (Chỉ Quản trị hệ thống và Quản lý kho)
  const canConfigUnit = isAdmin || officialRoles.some((r) => ['admin', 'warehouse_manager'].includes(r));

  // Quyền thao tác các nút trên dòng sản phẩm (Cấu hình ĐVT, Nhập/Xuất kho, Lịch sử)
  const canPerformProductAction = Boolean(canConfigUnit || canWriteInventory || isAdmin || isSalesManager);

  // 2. Khởi tạo State với Clean URL
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const pathname = window.location.pathname.toLowerCase();
    const isCreateOrderPath = pathname === '/create-order' || pathname.startsWith('/create-order/');
    const isPriceBooksPath = pathname === '/price-books';
    const isUsersPath = pathname === '/users' || pathname.startsWith('/users/') || pathname === '/admin' || pathname.startsWith('/admin/');
    const isCategoriesPath = pathname === '/categories';
    const isAuditPath = pathname === '/audit-logs' || pathname.startsWith('/audit-logs/');
    const isOrdersPath = pathname === '/orders' || pathname.startsWith('/orders/');
    const isProfilePath = pathname === '/profile' || pathname.startsWith('/profile/');
    const isDiscountsPath = pathname === '/discounts' || pathname.startsWith('/discounts/');
    const isDealerProfilesPath = pathname === '/dealer-profiles' || pathname.startsWith('/dealer-profiles/');
    const isDealersPath = pathname === '/dealers' || pathname.startsWith('/dealers/');
    const isDeliveryPointsPath = pathname === '/delivery-points' || pathname.startsWith('/delivery-points/');
    const isProductHistoryPath = pathname === '/product-history' || pathname.startsWith('/product-history/');

    const params = new URLSearchParams(window.location.search);
    const hasOldTabParam = params.has('tab') || params.has('view');
    const oldTabVal = (params.get('tab') || params.get('view') || '').toLowerCase();

    if (isDiscountsPath || oldTabVal === 'discounts' || oldTabVal === 'discount') {
      if (canAccessDiscounts) {
        if (pathname !== '/discounts' || hasOldTabParam) {
          try { window.history.replaceState({}, '', '/discounts'); } catch {}
        }
        return 'discounts';
      }
      try { window.history.replaceState({}, '', '/'); } catch {}
      return 'inventory';
    }

    if (isProductHistoryPath || oldTabVal === 'product-history') {
      return 'product-history';
    }

    if (isCreateOrderPath || oldTabVal === 'create-order') {
      if (canCreateOrders) return 'create-order';
      if (canReadOrders) {
        try { window.history.replaceState({}, '', '/orders'); } catch {}
        return 'orders';
      }
      try { window.history.replaceState({}, '', '/'); } catch {}
      return 'inventory';
    }
    if (isPriceBooksPath) {
      return 'price-books';
    }
    if (pathname === '/suppliers' || pathname.startsWith('/suppliers/')) {
      return 'suppliers';
    }
    if (isOrdersPath || oldTabVal === 'orders') {
      if (canReadOrders) return 'orders';
      window.history.replaceState({}, '', '/');
      return 'inventory';
    }
    if (isDeliveryPointsPath || oldTabVal === 'delivery-points') {
      if (hasOldTabParam || pathname !== '/delivery-points') {
        try {
          window.history.replaceState({}, '', '/delivery-points');
        } catch {
          // ignore
        }
      }
      return 'delivery-points';
    }
    if (isDealerProfilesPath || oldTabVal === 'dealer-profiles') {
      if (hasOldTabParam || pathname !== '/dealer-profiles') {
        try { window.history.replaceState({}, '', '/dealer-profiles'); } catch {}
      }
      return 'dealer-profiles';
    }
    if (isDealersPath || oldTabVal === 'dealers') {
      if (hasOldTabParam || pathname !== '/dealers') {
        try {
          window.history.replaceState({}, '', '/dealers');
        } catch {
          // ignore
        }
      }
      return 'dealers';
    }
    if (isProfilePath || oldTabVal === 'profile') {
      if (hasOldTabParam || pathname !== '/profile') {
        try {
          window.history.replaceState({}, '', '/profile');
        } catch {
          // ignore
        }
      }
      return 'profile';
    } else if (isAuditPath || oldTabVal === 'audit-logs' || oldTabVal === 'audit') {
      if (hasOldTabParam || pathname !== '/audit-logs') {
        try {
          window.history.replaceState({}, '', '/audit-logs');
        } catch {
          // ignore
        }
      }
      return 'audit-logs';
    } else if (isUsersPath || hasOldTabParam) {
      if (hasOldTabParam || pathname !== '/users') {
        try {
          window.history.replaceState({}, '', '/users');
        } catch {
          // ignore
        }
      }
      return 'users';
    }
    if (isCategoriesPath) {
      return 'categories';
    }
    return 'inventory';
  });
  // 3. Chuyển đổi Route Clean URL
  const setActiveTab = (tab: TabType) => {
    // Luôn đóng màn hình Thêm/Sửa sản phẩm khi chuyển sang bất kỳ tab/nhánh nào
    if (tab !== 'add-product') {
      setProductDrawerState({ isOpen: false, product: null });
    }

    if (tab === 'product-history') {
      setActiveTabState('product-history');
      try {
        const url = new URL(window.location.href);
        url.pathname = '/product-history';
        if (historyProductTarget?.code) {
          url.searchParams.set('code', historyProductTarget.code);
        }
        window.history.pushState({}, '', url.toString());
      } catch {
        // ignore
      }
      return;
    }
    if (tab === 'add-product') {
      setActiveTabState('inventory');
      setProductDrawerState({ isOpen: true, product: null });
      try {
        window.history.pushState({}, '', '/');
      } catch {
        // ignore
      }
      return;
    }

    if (tab === 'create-order') {
      if (!canCreateOrders) {
        setActiveTabState('orders');
        try {
          window.history.replaceState({}, '', '/orders');
        } catch {
          // ignore
        }
        return;
      }
      setActiveTabState('create-order');
      try {
        window.history.pushState({}, '', '/create-order');
      } catch {
        // ignore
      }
      return;
    }

    if (tab === 'orders' && !canReadOrders) {
      setActiveTabState('inventory');
      window.history.replaceState({}, '', '/');
      return;
    }

    if (tab === 'orders') {
      setActiveTabState('orders');
      try {
        window.history.pushState({}, '', '/orders');
      } catch {
        // ignore
      }
    } else if (tab === 'profile') {
      setActiveTabState('profile');
      try {
        window.history.pushState({}, '', '/profile');
      } catch {
        // ignore
      }
    } else if (tab === 'delivery-points') {
      setActiveTabState('delivery-points');
      try {
        window.history.pushState({}, '', '/delivery-points');
      } catch {
        // ignore
      }
    } else if (tab === 'dealer-profiles') {
      if (!canManageDealerProfiles) {
        setActiveTabState('inventory');
        try {
          window.history.replaceState({}, '', '/');
        } catch {
          // ignore
        }
        return;
      }
      setActiveTabState('dealer-profiles');
      try {
        window.history.pushState({}, '', '/dealer-profiles');
      } catch {
        // ignore
      }
    } else if (tab === 'dealers') {
      setActiveTabState('dealers');
      try {
        window.history.pushState({}, '', '/dealers');
      } catch {
        // ignore
      }
    } else if (tab === 'users') {
      setActiveTabState('users');
      try {
        window.history.pushState({}, '', '/users');
      } catch {
        // ignore
      }
    } else if (tab === 'categories') {
      setActiveTabState('categories');
      try {
        window.history.pushState({}, '', '/categories');
      } catch {
        // ignore
      }
    } else if (tab === 'audit-logs') {
      setActiveTabState('audit-logs');
      try {
        window.history.pushState({}, '', '/audit-logs');
      } catch {
        // ignore
      }
    } else if (tab === 'price-books') {
      setActiveTabState('price-books');
      try {
        window.history.pushState({}, '', '/price-books');
      } catch {}
    } else if (tab === 'suppliers') {
      setActiveTabState('suppliers');
      try {
        window.history.pushState({}, '', '/suppliers');
      } catch {
        // ignore
      }
    } else if (tab === 'discounts') {
      if (!canAccessDiscounts) {
        setActiveTabState('inventory');
        try {
          window.history.replaceState({}, '', '/');
        } catch {
          // ignore
        }
        return;
      }
      setActiveTabState('discounts');
      try {
        window.history.pushState({}, '', '/discounts');
      } catch {
        // ignore
      }
    } else {
      setActiveTabState('inventory');
      window.history.replaceState({}, '', '/');
      return;
    }
  };

  useEffect(() => {
    const tabRequiresAdmin = activeTab === 'users' || activeTab === 'audit-logs';
    const isAllowed =
      tabRequiresAdmin ? isAdmin
        : activeTab === 'categories' ? canManageCategories
          : activeTab === 'orders' ? canReadOrders
            : activeTab === 'create-order' ? canCreateOrders
              : activeTab === 'suppliers' ? canManageSuppliers
                : activeTab === 'discounts' ? canAccessDiscounts
                : activeTab === 'product-history' ? (isAdmin || isSalesManager || canWriteInventory)
                  : true;
    if (!isAllowed) {
      setActiveTabState('inventory');
      window.history.replaceState({}, '', '/');
    }
    if (activeTab === 'dealer-profiles' && !canManageDealerProfiles) {
      setActiveTabState('inventory');
      try {
        window.history.replaceState({}, '', '/');
      } catch {}
    }
    if (activeTab === 'dealers' && !canViewDealers) {
      setActiveTabState('inventory');
      try {
        window.history.replaceState({}, '', '/');
      } catch {
        // ignore
      }
    }
    if (activeTab === 'delivery-points' && !canManageDeliveryPoints) {
      setActiveTabState('inventory');
      try {
        window.history.replaceState({}, '', '/');
      } catch {
        // ignore
      }
    }
  }, [activeTab, canManageCategories, canViewDealers, canManageDealerProfiles, canManageDeliveryPoints, canAccessDiscounts, user.username]);

  useEffect(() => {
    const syncFromUrl = () => {
      const pathname = window.location.pathname.toLowerCase();
      const isPriceBooksPath = pathname === '/price-books';
      const params = new URLSearchParams(window.location.search);
      const tabParam = (params.get('tab') || params.get('view') || '').toLowerCase();

      const isAddProduct = pathname === '/add-product' || pathname.startsWith('/add-product/') || tabParam === 'add-product';
      if (!isAddProduct) {
        setProductDrawerState({ isOpen: false, product: null });
      }

      const isUsersPath = pathname === '/users' || pathname.startsWith('/users/') || pathname === '/admin' || pathname.startsWith('/admin/');
      const isAuditPath = pathname === '/audit-logs' || pathname.startsWith('/audit-logs/');
      const isOrdersPath = pathname === '/orders' || pathname.startsWith('/orders/');
      const isProfilePath = pathname === '/profile' || pathname.startsWith('/profile/');
      const isProductHistoryPath = pathname === '/product-history' || pathname.startsWith('/product-history/');

      if (isProductHistoryPath || tabParam === 'product-history') {
        const code = params.get('code') || params.get('productCode');
        if (code) {
          setHistoryProductTarget((prev) => ({ code, name: prev?.code === code ? prev.name : '' }));
        }
        if (pathname !== '/product-history' || tabParam) {
          try {
            window.history.replaceState({}, '', '/product-history');
          } catch {
            // ignore
          }
        }
        setActiveTabState('product-history');
        return;
      }

      if (pathname === '/suppliers' || pathname.startsWith('/suppliers/')) {
        setActiveTabState('suppliers');
        return;
      }
      if (isPriceBooksPath) { setActiveTabState('price-books'); return; }

      if (isOrdersPath || tabParam === 'orders') {
        if (canReadOrders) {
          if (pathname !== '/orders' || tabParam) window.history.replaceState({}, '', '/orders');
          setActiveTabState('orders');
        } else {
          setActiveTabState('inventory');
          window.history.replaceState({}, '', '/');
        }
        return;
      }

      const isDiscountsPath = pathname === '/discounts' || pathname.startsWith('/discounts/');
      if (isDiscountsPath || tabParam === 'discounts' || tabParam === 'discount') {
        if (canAccessDiscounts) {
          if (pathname !== '/discounts' || tabParam) {
            try { window.history.replaceState({}, '', '/discounts'); } catch {}
          }
          setActiveTabState('discounts');
        } else {
          setActiveTabState('inventory');
          try { window.history.replaceState({}, '', '/'); } catch {}
        }
        return;
      }

      const isDeliveryPointsPath = pathname === '/delivery-points' || pathname.startsWith('/delivery-points/');
      if (isDeliveryPointsPath || tabParam === 'delivery-points') {
        if (pathname !== '/delivery-points' || tabParam) {
          try {
            window.history.replaceState({}, '', '/delivery-points');
          } catch {
            // ignore
          }
        }
        setActiveTabState('delivery-points');
        return;
      }

      const isDealerProfilesPath = pathname === '/dealer-profiles' || pathname.startsWith('/dealer-profiles/');
      if (isDealerProfilesPath || tabParam === 'dealer-profiles') {
        if (pathname !== '/dealer-profiles' || tabParam) {
          try {
            window.history.replaceState({}, '', '/dealer-profiles');
          } catch {}
        }
        setActiveTabState('dealer-profiles');
        return;
      }
      const isDealersPath = pathname === '/dealers' || pathname.startsWith('/dealers/');
      if (isDealersPath || tabParam === 'dealers') {
        if (pathname !== '/dealers' || tabParam) {
          try {
            window.history.replaceState({}, '', '/dealers');
          } catch {
            // ignore
          }
        }
        setActiveTabState('dealers');
        return;
      }

      if (isProfilePath || tabParam === 'profile') {
        if (pathname !== '/profile' || tabParam) {
          try {
            window.history.replaceState({}, '', '/profile');
          } catch {
            // ignore
          }
        }
        setActiveTabState('profile');
      } else if (isAuditPath || tabParam === 'audit-logs' || tabParam === 'audit') {
        if (pathname !== '/audit-logs' || tabParam) {
          try {
            window.history.replaceState({}, '', '/audit-logs');
          } catch {
            // ignore
          }
        }
        setActiveTabState('audit-logs');
      } else if (isUsersPath || tabParam === 'users') {
        if (pathname !== '/users' || tabParam) {
          try {
            window.history.replaceState({}, '', '/users');
          } catch {
            // ignore
          }
        }
        setActiveTabState('users');
      } else if (pathname === '/categories') {
        setActiveTabState('categories');
      } else {
        setActiveTabState('inventory');
        if (pathname !== '/' || params.size) window.history.replaceState({}, '', '/');
      }
    };

    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [canManageCategories, canManageSuppliers, canReadOrders, isAdmin, canAccessDiscounts]);
    const [products, setProducts] = useState<ProductItem[]>([]);
  const [productSearchInput, setProductSearchInput] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Debounce tìm kiếm sản phẩm: Chỉ lọc khi người dùng ngừng nhập 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setProductSearchTerm(productSearchInput);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [productSearchInput]);

  // Phân trang danh sách sản phẩm (mặc định 20 cái/trang)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [isCostVisible, setIsCostVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionState>(() => sessionManager.getSessionState());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);
  const [productAuditDrawerState, setProductAuditDrawerState] = useState<{
    isOpen: boolean;
    productCode: string;
    productName: string;
    initialFilter?: 'ALL' | 'PRICE_CHANGE' | 'INVENTORY_ADJUST';
  }>({ isOpen: false, productCode: '', productName: '', initialFilter: 'ALL' });

  // Price Update Modal State
  const [priceUpdateModalProduct, setPriceUpdateModalProduct] = useState<ProductItem | null>(null);

  // Move Category Modal State
  const [movingProduct, setMovingProduct] = useState<{ id: number; name: string; category_id?: number | null } | null>(null);

  // Bulk Import Product Modal State
  const [isProductBulkImportOpen, setIsProductBulkImportOpen] = useState(false);
  const [productDrawerState, setProductDrawerState] = useState<{ isOpen: boolean; product: ProductItem | null }>(() => {
    const pathname = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const oldTabVal = (params.get('tab') || params.get('view') || '').toLowerCase();
    const isAddProduct = pathname === '/add-product' || pathname.startsWith('/add-product/') || oldTabVal === 'add-product';
    return { isOpen: isAddProduct, product: null };
  });

  // Quản lý sản phẩm được chọn để xem lịch sử (/product-history)
  const [historyProductTarget, setHistoryProductTarget] = useState<{ code: string; name: string } | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const c = params.get('code') || params.get('productCode') || '';
    const n = params.get('name') || params.get('productName') || '';
    return c ? { code: c, name: n } : null;
  });

  // Unit Conversion Modals State
  const [unitConfigProduct, setUnitConfigProduct] = useState<ProductItem | null>(null);
  const [stockActionState, setStockActionState] = useState<{
    isOpen: boolean;
    actionType: 'receipt' | 'issue' | 'adjust';
    product: ProductItem | null;
    initialReason?: string;
  }>({ isOpen: false, actionType: 'receipt', product: null });
  const [isGoodsReceiptModalOpen, setIsGoodsReceiptModalOpen] = useState(false);
  const [goodsReceiptInitialTab, setGoodsReceiptInitialTab] = useState<'form' | 'list'>('form');
  const [isSalesOrderEntryOpen, setIsSalesOrderEntryOpen] = useState(false);
  const [isDiscountExpanded, setIsDiscountExpanded] = useState(false);
  const availableCategories = useMemo(
    () => Array.from(new Set(['Thời trang', 'Giày dép', 'Phụ kiện', ...products.map((p) => p.category).filter(Boolean)])),
    [products]
  );

  // Dropdown menu 3 chấm trên dòng sản phẩm, menu Excel & menu Thêm mới
  const [openProductMenuId, setOpenProductMenuId] = useState<number | null>(null);
  const [isExcelMenuOpen, setIsExcelMenuOpen] = useState(false);
  const excelMenuRef = useRef<HTMLDivElement>(null);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      setOpenProductMenuId(null);
      if (excelMenuRef.current && !excelMenuRef.current.contains(e.target as Node)) {
        setIsExcelMenuOpen(false);
      }
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Tự động đóng popover user / Excel / Thêm mới khi bấm phím Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsUserMenuOpen(false);
        setIsExcelMenuOpen(false);
        setIsCreateMenuOpen(false);
      }
    };
    if (isUserMenuOpen || isExcelMenuOpen || isCreateMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen, isExcelMenuOpen, isCreateMenuOpen]);

  // Lắng nghe cập nhật trạng thái phiên
  useEffect(() => {
    const unsubscribe = sessionManager.onStatusChange((state) => {
      setSessionInfo(state);
    });
    return () => unsubscribe();
  }, []);

  const remainingSeconds = sessionInfo.remainingSeconds;
  const isWarningZone = remainingSeconds > 0 && remainingSeconds <= 120;

  const fetchProducts = () => {
    if (isPendingCustomer) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    getProductsApi(token)
      .then((data) => {
        setProducts(data.items);
        setIsCostVisible(data.is_cost_price_visible);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Lỗi khi tải dữ liệu sản phẩm từ Backend.');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchProducts();
  }, [token, isPendingCustomer, activeTab]);

  // Tính toán số liệu thống kê
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const totalSellValue = products.reduce((acc, p) => acc + p.sell_price * p.stock, 0);

  // Tính giá vốn và lợi nhuận
  const isCostAvailable = isCostVisible && products.length > 0 && products.every((p) => p.cost_price !== null && p.cost_price !== undefined);
  const totalCostValue = isCostAvailable ? products.reduce((acc, p) => acc + (p.cost_price || 0) * p.stock, 0) : 0;
  const totalProfit = totalSellValue - totalCostValue;

  // Lọc sản phẩm
  const filteredProducts = products.filter((p) => {
    const q = productSearchTerm.trim().toLowerCase();
    const matchQuery = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchQuery && matchCat;
  });

  // Phân trang sản phẩm (mặc định 20 cái)
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + pageSize);

  // Xuất file Excel danh mục hàng hóa
  const handleExportExcel = () => {
    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Danh Sách Hàng Hóa</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; font-family: Calibri, sans-serif; }
          th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          td { border: 1px solid #e2e8f0; padding: 8px 10px; color: #334155; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th style="width: 100px;">Mã SP</th>
              <th style="width: 250px;">Tên sản phẩm</th>
              <th style="width: 140px;" class="text-center">Ngành hàng</th>
              <th style="width: 110px;" class="text-right">Số lượng tồn</th>
              <th style="width: 150px;" class="text-right">Giá niêm yết (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredProducts.map((p) => `
              <tr>
                <td style="mso-number-format:'\\@'; font-weight: 600;">${p.code}</td>
                <td>${p.name}</td>
                <td class="text-center">${p.category}</td>
                <td class="text-right">${p.stock}</td>
                <td class="text-right">${p.sell_price.toLocaleString('vi-VN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob(['\uFEFF' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `danh_sach_hang_hoa_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const roleLabelMap: Record<string, string> = {
    admin: 'Quản Trị Hệ Thống',
    sales_manager: 'Quản Lý Kinh Doanh',
    sales: 'Nhân Viên Kinh Doanh',
    warehouse: 'Thủ Kho',
    warehouse_manager: 'Quản Lý Kho',
    accountant: 'Kế Toán',
    purchasing: 'Nhân Viên Mua Hàng',
    customer: (!user.branch || user.branch === 'Chưa phân công') ? 'Chưa Phân Quyền' : 'Đại Lý',
  };

  const roleBadgeColorMap: Record<string, string> = {
    admin: '#ef4444',
    sales_manager: '#8b5cf6',
    sales: '#3b82f6',
    warehouse: '#10b981',
    warehouse_manager: '#059669',
    accountant: '#f59e0b',
    purchasing: '#06b6d4',
    customer: (!user.branch || user.branch === 'Chưa phân công') ? '#94a3b8' : '#0284c7',
  };

  const primaryRole = officialRoles[0] || user.role;
  const currentBadgeColor = roleBadgeColorMap[primaryRole] || '#64748b';

  const isProductFormOpen = productDrawerState.isOpen && activeTab === 'inventory';
  const isSalesOrderOpen = activeTab === 'create-order' || isSalesOrderEntryOpen;
  const isLockedScrollTab = !isProductFormOpen && !isSalesOrderOpen && (activeTab === 'inventory' || activeTab === 'dealers' || activeTab === 'delivery-points' || activeTab === 'suppliers' || activeTab === 'price-books' || activeTab === 'categories' || activeTab === 'orders' || activeTab === 'product-history') && !isPendingCustomer;

  return (
    <DashboardLayout
      header={
        <DashboardHeader
          user={user}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdmin={isAdmin}
          canViewDealers={canViewDealers}
          isUserMenuOpen={isUserMenuOpen}
          setIsUserMenuOpen={setIsUserMenuOpen}
          onOpenSecurityModal={() => setIsSecurityModalOpen(true)}
          onLogout={() => {
            if (isLoggingOut) return;
            setShowLogoutConfirm(true);
          }}
          isLoggingOut={isLoggingOut}
          officialRoles={officialRoles}
          roleLabelMap={roleLabelMap}
          roleBadgeColorMap={roleBadgeColorMap}
          primaryRole={primaryRole}
          currentBadgeColor={currentBadgeColor}
        />
      }
      noScroll={isLockedScrollTab}
      sidebar={
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          canManageProducts={canManageProducts}
          canCreateOrders={canCreateOrders}
          canReadOrders={canReadOrders}
          canViewDealers={canViewDealers}
          canManageDealerProfiles={canManageDealerProfiles}
          canManageDeliveryPoints={canManageDeliveryPoints}
          canManageSuppliers={canManageSuppliers}
          canAccessPriceBooks={canAccessPriceBooks}
          canManageCategories={canManageCategories}
          canViewProductHistory={isAdmin || isSalesManager || canWriteInventory}
          canAccessDiscounts={canAccessDiscounts}
          isAdmin={isAdmin}
          onLogout={() => {
            if (isLoggingOut) return;
            setShowLogoutConfirm(true);
          }}
          isLoggingOut={isLoggingOut}
        />
      }
    >
      <div
        className="dashboard-main-container"
        style={isLockedScrollTab ? {
          height: '100%',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          width: '100%',
        } : undefined}
      >
      {/* Main Content: Switch between Product Form, Create Order, Order Management, User Management, Audit Logs, Inventory and Pending Authorization */}
      {productDrawerState.isOpen && activeTab === 'inventory' ? (
        canManageProducts ? (
          <ProductFormView
            product={productDrawerState.product}
            token={token}
            isCostVisible={isCostVisible}
            categories={availableCategories}
            onBack={() => {
              setProductDrawerState({ isOpen: false, product: null });
              try {
                window.history.pushState({}, '', '/');
              } catch {
                // ignore
              }
            }}
            onSuccess={(updatedProduct, isDeleted) => {
              if (isDeleted) {
                setProducts((prev) => prev.filter((p) => p.id !== productDrawerState.product?.id));
              } else if (updatedProduct) {
                setProducts((prev) => {
                  const idx = prev.findIndex((p) => p.id === updatedProduct.id);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy[idx] = updatedProduct;
                    return copy;
                  }
                  return [updatedProduct, ...prev];
                });
              }
              setProductDrawerState({ isOpen: false, product: null });
              try {
                window.history.pushState({}, '', '/');
              } catch {
                // ignore
              }
              fetchProducts();
            }}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quyền quản lý sản phẩm (Thủ kho / Quản lý kho / Quản lý kinh doanh / Quản trị viên)"
            onBackToWorkflow={() => setProductDrawerState({ isOpen: false, product: null })}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'create-order' || (isSalesOrderEntryOpen && canCreateOrders) ? (
        canCreateOrders ? (
          <SalesOrderEntry
            token={token}
            username={user.username}
            user={user}
            products={products}
            onClose={() => {
              setIsSalesOrderEntryOpen(false);
              setActiveTab('orders');
            }}
            onCreated={() => {
              setIsSalesOrderEntryOpen(false);
              setActiveTab('orders');
              fetchProducts();
            }}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quyền tạo đơn hàng (order:write)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'orders' ? (
        canReadOrders ? (
          <OrderManagementView
            currentUser={user}
            token={token}
            products={products}
            onBackToHome={() => setActiveTab('inventory')}
            onRefreshProducts={fetchProducts}
            onNavigateToPriceBooks={canAccessPriceBooks ? () => setActiveTab('price-books') : undefined}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quyền xem đơn hàng (order:read)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'users' ? (
        isAdmin ? (
          <UserManagementView
            currentUser={user}
            token={token}
            onBackToHome={() => setActiveTab('inventory')}
            onCreateAccount={() => setIsCreateAccountModalOpen(true)}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quản trị hệ thống (Admin)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'categories' ? (
        canManageCategories ? (
          <CategoryManagementView
            token={token}
            onBackToHome={() => setActiveTab('inventory')}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quản lý ngành hàng (Quản lý kinh doanh / Quản trị viên)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'discounts' ? (
        canAccessDiscounts ? (
          <DiscountPolicyView
            token={token}
            user={user}
            onBackToHome={() => setActiveTab('inventory')}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Chính sách chiết khấu (Quản lý kinh doanh / Quản trị viên)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'audit-logs' ? (
        isAdmin ? (
          <AuditLogView
            currentUser={user}
            token={token}
            onBackToHome={() => setActiveTab('inventory')}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quản trị hệ thống (Admin)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'profile' ? (
        <ProfileView
          currentUser={user}
          token={token}
          onBackToHome={() => setActiveTab('inventory')}
          onUserUpdated={onUserUpdated}
        />
      ) : activeTab === 'product-history' ? (
        (isAdmin || isSalesManager || canWriteInventory) ? (
          <ProductHistoryView
            currentUser={user}
            token={token}
            products={products}
            initialProductCode={historyProductTarget?.code}
            initialProductName={historyProductTarget?.name}
            isCostVisible={isCostVisible}
            onBackToInventory={() => setActiveTab('inventory')}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Xem lịch sử thay đổi sản phẩm (Thủ kho / Quản lý kho / Quản lý kinh doanh / Quản trị viên)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'suppliers' ? (
        canManageSuppliers ? (
          <SupplierManagementView
            token={token}
            onBackToHome={() => setActiveTab('inventory')}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quản lý nhà cung cấp (Thủ kho / Quản lý kho / Quản trị)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'dealer-profiles' ? (
        canManageDealerProfiles ? (
          <DealerProfileManagementView
            currentUser={user}
            token={token}
            onBackToHome={() => setActiveTab('inventory')}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quản lý hồ sơ đại lý (Kế toán công nợ / Quản lý kinh doanh / Quản trị viên)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'dealers' ? (
        canViewDealers ? (
          <DealerSearchView
            currentUser={user}
            token={token}
            onBackToHome={() => setActiveTab('inventory')}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Tra cứu đại lý & khách hàng (Nhân viên kinh doanh / Quản lý kinh doanh / Quản trị viên)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'price-books' ? (
        canAccessPriceBooks ? (
          <PriceBookManagementView
            token={token}
            currentUser={user}
            products={products}
            onBackToHome={() => setActiveTab('inventory')}
            onNavigateToOrders={() => setActiveTab('orders')}
            onRefreshProducts={fetchProducts}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quản lý Bảng giá theo nhóm khách hàng (Quản trị hệ thống / Quản lý kinh doanh / Kế toán)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'delivery-points' ? (
        canManageDeliveryPoints ? (
          <DeliveryPointsView
            currentUser={user}
            token={token}
            onBackToHome={() => setActiveTab('inventory')}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quản lý điểm giao hàng"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )

      ) : isPendingCustomer ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px 20px',
          minHeight: '60vh',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '40px 32px',
            maxWidth: '560px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(16px)',
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.35))',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              margin: '0 auto 20px auto',
              boxShadow: '0 10px 25px rgba(245, 158, 11, 0.25)',
            }}>
              ⏳
            </div>

            <h2 style={{
              fontSize: '22px',
              fontWeight: '800',
              color: '#ffffff',
              marginBottom: '12px',
              letterSpacing: '-0.01em',
            }}>
              Tài Khoản Đang Chờ Quản Trị Viên Cấp Quyền
            </h2>

            <p style={{
              fontSize: '14.5px',
              color: '#94a3b8',
              lineHeight: '1.6',
              marginBottom: '24px',
            }}>
              Xin chào <strong style={{ color: '#f8fafc' }}>{user.full_name || user.username}</strong>! Tài khoản của bạn đã được khởi tạo thành công trên hệ thống.
              Hiện tại tài khoản chưa được Quản trị viên phân bổ vai trò nghiệp vụ (Bán hàng, Kho, Mua hàng...) và phân công chi nhánh.
            </p>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '26px',
              textAlign: 'left',
              fontSize: '13.5px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ color: '#64748b' }}>Tên đăng nhập:</span>
                <span style={{ color: '#38bdf8', fontWeight: '600' }}>@{user.username}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ color: '#64748b' }}>Trạng thái tài khoản:</span>
                <span style={{
                  color: '#fbbf24',
                  background: 'rgba(245, 158, 11, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  Chờ Quản trị viên phê duyệt
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: '#64748b' }}>Chi nhánh / Kho:</span>
                <span style={{ color: '#94a3b8' }}>{user.branch || 'Chưa phân công'}</span>
              </div>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <button
                onClick={async () => {
                  try {
                    await sessionManager.syncCurrentProfile();
                    window.location.reload();
                  } catch {
                    window.location.reload();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #0fba90, #0fad89)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(15, 173, 137, 0.35)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                🔄 Kiểm tra lại trạng thái quyền hạn
              </button>

              <button
                onClick={() => {
                  if (isLoggingOut) return;
                  setShowLogoutConfirm(true);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#cbd5e1',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#cbd5e1')}
              >
                {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất tài khoản'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '20px'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* 4 Thẻ KPI Dashboard (Thu gọn bé gọn) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '10px',
            marginBottom: '10px',
            flexShrink: 0,
          }}>
            <div className="kpi-stat-card" style={{ padding: '10px 14px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Mặt hàng trong kho</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Tổng tồn: <strong style={{ color: '#0f172a' }}>{totalStock.toLocaleString()}</strong>
                </span>
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: '700',
                letterSpacing: '-0.02em',
                color: '#0f172a',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
              }}>
                {isLoading ? '...' : `${products.length} mã SP`}
              </div>
            </div>

            <div className="kpi-stat-card" style={{ padding: '10px 14px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Tổng giá trị bán niêm yết</span>
                <span style={{ fontSize: '10.5px', color: '#64748b' }}>Đã gồm VAT</span>
              </div>
              <div style={{
                fontSize: '18px',
                fontWeight: '700',
                letterSpacing: '-0.02em',
                color: '#0f172a',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
              }}>
                {isLoading ? '...' : `${totalSellValue.toLocaleString('vi-VN')} đ`}
              </div>
            </div>

            {isCostVisible && isCostAvailable && (
              <div className="kpi-stat-card" style={{ padding: '10px 14px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Tổng giá vốn tồn kho</span>
                  <span style={{ fontSize: '10.5px', color: '#0284c7' }}>Admin / QL</span>
                </div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  letterSpacing: '-0.02em',
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                }}>
                  {isLoading ? '...' : `${totalCostValue.toLocaleString('vi-VN')} đ`}
                </div>
              </div>
            )}

            {isCostVisible && isCostAvailable && (
              <div className="kpi-stat-card" style={{ padding: '10px 14px', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Lợi nhuận gộp dự kiến</span>
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '600' }}>
                    +{totalSellValue && totalCostValue ? Math.round(((totalSellValue - totalCostValue) / totalSellValue) * 100) : 0}%
                  </span>
                </div>
                <div style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  letterSpacing: '-0.02em',
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                }}>
                  {isLoading ? '...' : `+${totalProfit.toLocaleString('vi-VN')} đ`}
                </div>
              </div>
            )}
          </div>

          {/* CHÍNH SÁCH CHIẾT KHẤU - 1 Ô GỌN GÀNG */}
          {(() => {
            try {
              const savedPolicies = localStorage.getItem('discountPolicies');
              if (savedPolicies) {
                const policies = JSON.parse(savedPolicies);
                const activePolicies = policies.filter((p: any) => p.status === 'active');
                if (activePolicies.length > 0) {
                  return (
                    <div style={{
                      marginBottom: '10px',
                      background: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      padding: '7px 12px',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        flexWrap: 'wrap',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>
                            Chính sách chiết khấu:
                          </span>
                          {activePolicies.map((p: any) => (
                            <div
                              key={p.id}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '5px',
                                padding: '2px 8px',
                                fontSize: '11.5px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                              }}
                            >
                              <strong style={{ color: '#2563eb' }}>{p.code}</strong>
                              <span style={{ color: '#475569' }}>
                                {p.target_group === 'all' ? 'Tất cả đại lý' : p.target_group === 'agent_tier_1' ? 'Đại lý Cấp 1' : 'Đại lý Cấp 2'}:
                              </span>
                              <span style={{ color: '#059669', fontWeight: '600' }}>
                                {p.tiers?.map((t: any) => `≥${t.min_quantity}sp (-${t.discount_percent}%)`).join(', ')}
                              </span>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsDiscountExpanded(!isDiscountExpanded)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #cbd5e1',
                            borderRadius: '5px',
                            padding: '2px 8px',
                            fontSize: '11px',
                            color: '#475569',
                            cursor: 'pointer',
                            fontWeight: '500',
                          }}
                        >
                          {isDiscountExpanded ? 'Thu gọn ▲' : 'Bảng chi tiết ▼'}
                        </button>
                      </div>

                      {isDiscountExpanded && (
                        <div style={{ overflowX: 'auto', marginTop: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                <th style={{ padding: '6px 10px', fontWeight: '600', color: '#475569' }}>Mã CS</th>
                                <th style={{ padding: '6px 10px', fontWeight: '600', color: '#475569' }}>Sản phẩm áp dụng</th>
                                <th style={{ padding: '6px 10px', fontWeight: '600', color: '#475569' }}>Đối tượng</th>
                                <th style={{ padding: '6px 10px', fontWeight: '600', color: '#475569' }}>Thời hạn</th>
                                <th style={{ padding: '6px 10px', fontWeight: '600', color: '#475569' }}>Bậc chiết khấu</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activePolicies.map((p: any) => (
                                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '6px 10px', fontWeight: '600', color: '#2563eb' }}>{p.code}</td>
                                  <td style={{ padding: '6px 10px', color: '#334155' }}>{p.title === 'Tất cả sản phẩm' ? <span style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '10px', fontSize: '11px' }}>Tất cả SP</span> : p.title}</td>
                                  <td style={{ padding: '6px 10px', color: '#475569' }}>{p.target_group === 'all' ? 'Tất cả đại lý' : p.target_group === 'agent_tier_1' ? 'Đại lý Cấp 1' : 'Đại lý Cấp 2'}</td>
                                  <td style={{ padding: '6px 10px', color: '#64748b' }}>{p.start_date} - {p.end_date || 'Vô thời hạn'}</td>
                                  <td style={{ padding: '6px 10px' }}>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                      {p.tiers && p.tiers.map((t: any, idx: number) => (
                                        <span key={idx} style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5', padding: '1px 5px', borderRadius: '4px', fontSize: '10.5px', fontWeight: '500' }}>
                                          Từ {t.min_quantity}sp: -{t.discount_percent}%
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                }
              }
            } catch (e) {}
            return null;
          })()}

          {/* Clean Enterprise Data Table Container */}
          <div
            className="premium-table-card"
            style={{
              padding: '0',
              borderRadius: '12px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Thanh công cụ tìm kiếm và tác vụ (Cố định ở trên) */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 20px',
              borderBottom: '1px solid #e2e8f0',
              gap: '12px',
              background: '#ffffff',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
                <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm theo mã hoặc tên sản phẩm..."
                    value={productSearchInput}
                    onChange={(e) => setProductSearchInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#334155',
                    background: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">Tất cả ngành hàng</option>
                  {Array.from(new Set(products.map((p) => p.category).filter(Boolean))).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b', marginRight: '4px' }}>
                  Hiển thị <strong style={{ color: '#0f172a' }}>{filteredProducts.length}</strong> / {products.length} SP
                </span>


                {/* Dropdown Excel ▾ */}
                <div ref={excelMenuRef} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    id="btn-excel-menu"
                    onClick={() => setIsExcelMenuOpen(!isExcelMenuOpen)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      color: '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = '#94a3b8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    title="Tùy chọn nhập / xuất file Excel"
                  >
                    Excel ▾
                  </button>

                  {isExcelMenuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: 0,
                        minWidth: '150px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                        zIndex: 50,
                        padding: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                      }}
                    >
                      {(isAdmin || isSalesManager) && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsExcelMenuOpen(false);
                            setIsProductBulkImportOpen(true);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            background: 'transparent',
                            border: 'none',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            fontSize: '12.5px',
                            fontWeight: '500',
                            color: '#0f172a',
                            cursor: 'pointer',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          Nhập file Excel
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsExcelMenuOpen(false);
                          handleExportExcel();
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          background: 'transparent',
                          border: 'none',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: '500',
                          color: '#0f172a',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        Xuất file Excel
                      </button>
                    </div>
                  )}
                </div>

                {/* Dropdown Thêm mới ▾ (Gộp Thêm sản phẩm và Nhập kho) */}
                {(canManageProducts || canWriteInventory) && (
                  (canManageProducts && canWriteInventory) ? (
                    <div ref={createMenuRef} style={{ position: 'relative' }}>
                      <button
                        type="button"
                        id="btn-create-menu"
                        onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          background: 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                          border: 'none',
                          padding: '7px 16px',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: '600',
                          color: '#ffffff',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(15, 186, 144, 0.35)',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #0fad89 0%, #0a8f70 100%)';
                          e.currentTarget.style.boxShadow = '0 4px 14px rgba(15, 186, 144, 0.45)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)';
                          e.currentTarget.style.boxShadow = '0 2px 8px rgba(15, 186, 144, 0.35)';
                        }}
                        title="Thêm mới sản phẩm hoặc lập phiếu nhập kho"
                      >
                        Thêm mới ▾
                      </button>

                      {isCreateMenuOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: 0,
                            minWidth: '150px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                            zIndex: 50,
                            padding: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setIsCreateMenuOpen(false);
                              setProductDrawerState({ isOpen: true, product: null });
                              try {
                                window.history.pushState({}, '', '/add-product');
                              } catch {}
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              background: 'transparent',
                              border: 'none',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              fontSize: '12.5px',
                              fontWeight: '500',
                              color: '#0f172a',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            Thêm sản phẩm
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setIsCreateMenuOpen(false);
                              setGoodsReceiptInitialTab('form');
                              setIsGoodsReceiptModalOpen(true);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              background: 'transparent',
                              border: 'none',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              fontSize: '12.5px',
                              fontWeight: '500',
                              color: '#0f172a',
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            Nhập kho
                          </button>
                        </div>
                      )}
                    </div>
                  ) : canManageProducts ? (
                    <button
                      type="button"
                      id="btn-add-product"
                      onClick={() => {
                        setProductDrawerState({ isOpen: true, product: null });
                        try {
                          window.history.pushState({}, '', '/add-product');
                        } catch {}
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                        border: 'none',
                        padding: '7px 16px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        color: '#ffffff',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(15, 186, 144, 0.35)',
                        transition: 'all 0.15s ease',
                      }}
                      title="Thêm mới sản phẩm vào hệ thống kho"
                    >
                      Thêm sản phẩm
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        id="btn-goods-receipt-modal"
                        onClick={() => {
                          setGoodsReceiptInitialTab('form');
                          setIsGoodsReceiptModalOpen(true);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                          border: 'none',
                          padding: '7px 16px',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: '600',
                          color: '#ffffff',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)',
                          transition: 'all 0.15s ease',
                        }}
                        title="Lập phiếu nhập kho từ nhà cung cấp"
                      >
                        Nhập kho
                      </button>
                      <button
                        type="button"
                        id="btn-stock-adjust-modal"
                        onClick={() => {
                          setStockActionState({
                            isOpen: true,
                            actionType: 'adjust',
                            product: null,
                            initialReason: 'Kiểm kê / Điều chỉnh tồn kho',
                          });
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          fontSize: '12.5px',
                          fontWeight: '600',
                          color: '#1e293b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        title="Lập phiếu điều chỉnh / kiểm kê kho hàng"
                      >
                        <span>⚖️</span>
                        <span>Điều chỉnh kho</span>
                      </button>
                    </>
                  )
                )}
              </div>
            </div>

            {/* Vùng cuộn riêng cho bảng hàng hóa (cố định thead) */}
            <div
              className="roles-grid-scroll"
              style={{
                overflowX: 'auto',
                overflowY: 'auto',
                flex: 1,
                minHeight: 0,
                scrollBehavior: 'smooth'
              }}
            >
              {isLoading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                  <div style={{ fontSize: '14px', fontWeight: '500' }}>Đang tải dữ liệu từ máy chủ Backend...</div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                  Không tìm thấy sản phẩm nào phù hợp với điều kiện tìm kiếm.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 0 #e2e8f0' }}>
                    <tr style={{
                      color: '#64748b',
                      background: '#f8fafc',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid #e2e8f0',
                    }}>
                      <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'left', background: '#f8fafc' }}>Mã SP</th>
                      <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'left', background: '#f8fafc' }}>Tên Sản Phẩm</th>
                      <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'left', background: '#f8fafc' }}>Ngành Hàng</th>
                      <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'left', background: '#f8fafc' }}>Đơn Vị Tính</th>
                      <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'right', background: '#f8fafc' }}>Số Lượng Tồn</th>
                      <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'right', background: '#f8fafc' }}>Giá Niêm Yết (Bán)</th>
                      <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'right', background: '#f8fafc' }}>Giá Sàn (Tối thiểu)</th>
                      {isCostVisible && (
                        <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'right', background: '#f8fafc' }}>Giá Vốn Nhập Kho</th>
                      )}
                      {canPerformProductAction && (
                        <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'center', width: '80px', background: '#f8fafc' }}>Thao Tác</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((item, idx) => (
                      <tr
                        key={item.id}
                        className="inventory-row"
                        style={{
                          background: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
                        <td style={{
                          padding: '13px 18px',
                          textAlign: 'left',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: '#334155',
                        }}>
                          {item.code}
                        </td>

                        <td style={{ padding: '13px 18px', fontWeight: '500', color: '#0f172a', fontSize: '13.5px', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {item.images && item.images.length > 0 ? (
                              <img src={item.images[0]} alt="" style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #cbd5e1' }} />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', border: '1px solid #e2e8f0' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                              </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{item.name}</span>
                              {item.status === 'inactive' && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    background: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fecaca',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    width: 'fit-content',
                                    marginTop: '3px',
                                  }}
                                >
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                                  Ngừng giao dịch
                                </span>
                              )}
                              {item.status === 'active' && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    border: '1px solid #bbf7d0',
                                    padding: '2px 8px',
                                    borderRadius: '999px',
                                    width: 'fit-content',
                                    marginTop: '3px',
                                  }}
                                >
                                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                                  Đang giao dịch
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td style={{ padding: '13px 18px', textAlign: 'left', color: '#64748b', fontSize: '12.5px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{item.category}</span>
                            {canManageCategories && (
                              <button
                                onClick={() => setMovingProduct({ id: item.id, name: item.name, category_id: item.category_id })}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  color: '#94a3b8',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Chuyển ngành hàng"
                                onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Cột Đơn vị tính cơ sở & quy đổi */}
                        <td style={{ padding: '13px 18px', textAlign: 'left', fontSize: '12.5px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontWeight: '600', color: '#0f172a' }}>
                              {item.base_unit || 'Cái'} <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '400' }}>(cơ sở)</span>
                            </span>
                            {item.units && item.units.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {item.units.map((u, uIdx) => (
                                  <span
                                    key={uIdx}
                                    style={{
                                      fontSize: '11px',
                                      background: '#ecfdf5',
                                      color: '#065f46',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      border: '1px solid #a7f3d0',
                                    }}
                                    title={`1 ${u.unit_name} = ${u.conversion_rate} ${item.base_unit || 'Cái'}`}
                                  >
                                    {u.unit_name} (×{u.conversion_rate})
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Chưa có ĐVT quy đổi</span>
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '13px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          <span style={{
                            fontWeight: '600',
                            color: '#0f172a',
                          }}>
                            {item.stock.toLocaleString()} {item.base_unit || 'cái'}
                          </span>
                        </td>

                        <td style={{ padding: '13px 18px', color: '#0f172a', fontWeight: '600', fontSize: '13.5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {item.sell_price > 0 ? (
                            `${item.sell_price.toLocaleString('vi-VN')} đ`
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', fontWeight: '400' }}>Chưa thiết lập</span>
                          )}
                        </td>

                        <td style={{ padding: '13px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {item.floor_price && item.floor_price > 0 ? (
                            <span style={{ color: '#0284c7', fontWeight: '600', fontSize: '13.5px' }}>
                              {item.floor_price.toLocaleString('vi-VN')} đ
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', fontWeight: '400' }}>Chưa thiết lập</span>
                          )}
                        </td>

                        {isCostVisible && (
                          <td style={{ padding: '13px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <span style={{ color: '#0f172a', fontWeight: '600', fontSize: '13.5px' }}>
                              {item.cost_price ? `${item.cost_price.toLocaleString('vi-VN')} đ` : '—'}
                            </span>
                          </td>
                        )}
                        {canPerformProductAction && (
                          <td style={{ padding: '10px 18px', textAlign: 'center' }}>
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenProductMenuId(openProductMenuId === item.id ? null : item.id);
                                }}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  padding: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: openProductMenuId === item.id ? '#e2e8f0' : '#ffffff',
                                  color: openProductMenuId === item.id ? '#0f172a' : '#64748b',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  boxShadow: 'none',
                                  margin: 0,
                                }}
                                onMouseEnter={(e) => {
                                  if (openProductMenuId !== item.id) {
                                    e.currentTarget.style.background = '#f8fafc';
                                    e.currentTarget.style.color = '#0f172a';
                                    e.currentTarget.style.borderColor = '#94a3b8';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (openProductMenuId !== item.id) {
                                    e.currentTarget.style.background = '#ffffff';
                                    e.currentTarget.style.color = '#64748b';
                                    e.currentTarget.style.borderColor = '#cbd5e1';
                                  }
                                }}
                                title="Thao tác sản phẩm"
                                aria-label="Thao tác sản phẩm"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="1.5" />
                                  <circle cx="12" cy="5" r="1.5" />
                                  <circle cx="12" cy="19" r="1.5" />
                                </svg>
                              </button>

                              {openProductMenuId === item.id && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    ...(idx >= paginatedProducts.length - 2 && paginatedProducts.length > 2
                                      ? { bottom: 'calc(100% + 4px)' }
                                      : { top: 'calc(100% + 4px)' }),
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
                                    padding: '5px',
                                    minWidth: '150px',
                                    zIndex: 50,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    textAlign: 'left',
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {(isAdmin || isSalesManager) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProductDrawerState({ isOpen: true, product: item });
                                        setOpenProductMenuId(null);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: '#0f172a',
                                        cursor: 'pointer',
                                        boxShadow: 'none',
                                        margin: 0,
                                        transition: 'background 0.15s ease',
                                        textAlign: 'left',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                      </svg>
                                      <span>Chỉnh sửa sản phẩm</span>
                                    </button>
                                  )}

                                  {canConfigUnit && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setUnitConfigProduct(item);
                                        setOpenProductMenuId(null);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: '#334155',
                                        cursor: 'pointer',
                                        boxShadow: 'none',
                                        margin: 0,
                                        transition: 'background 0.15s ease',
                                        textAlign: 'left',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                      title="Cấu hình ĐVT cơ sở & danh sách ĐVT quy đổi (Lốc, Thùng...)"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="3" />
                                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                      </svg>
                                      <span>Cấu hình ĐVT</span>
                                    </button>
                                  )}

                                  {canWriteInventory && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStockActionState({ isOpen: true, actionType: 'issue', product: item });
                                        setOpenProductMenuId(null);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: '#9a3412',
                                        cursor: 'pointer',
                                        boxShadow: 'none',
                                        margin: 0,
                                        transition: 'background 0.15s ease',
                                        textAlign: 'left',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = '#fff7ed')}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                      title="Tạo phiếu xuất kho (cho phép chọn ĐVT quy đổi)"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12" />
                                      </svg>
                                      <span>Xuất kho</span>
                                    </button>
                                  )}

                                  {canWriteInventory && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setStockActionState({
                                          isOpen: true,
                                          actionType: 'adjust',
                                          product: item,
                                          initialReason: `Kiểm kê / Điều chỉnh tồn cho mặt hàng [${item.code}] ${item.name}`,
                                        });
                                        setOpenProductMenuId(null);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        color: '#0f766e',
                                        cursor: 'pointer',
                                        boxShadow: 'none',
                                        margin: 0,
                                        transition: 'background 0.15s ease',
                                        textAlign: 'left',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdfa')}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                      title="Lập phiếu điều chỉnh / kiểm kê tồn kho cho mặt hàng này"
                                    >
                                      <span style={{ fontSize: '14px' }}>⚖️</span>
                                      <span>Điều chỉnh kho</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Thanh điều khiển Phân Trang Cố Định Ở Đáy Bảng */}
            {filteredProducts.length > 0 && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                alignItems: 'center',
                padding: '8px 18px',
                borderTop: '1px solid #e2e8f0',
                background: '#ffffff',
                gap: '12px',
                fontSize: '12px',
                color: '#64748b',
                flexShrink: 0
              }}>
                {/* Khối phân trang liền thanh chuẩn theo thiết kế thu nhỏ */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'stretch',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    background: '#ffffff',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    height: '24px',
                  }}
                >
                  {/* Nút trang trước (<) - hiển thị khi trang > 1 */}
                  {safeCurrentPage > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      style={{
                        minWidth: '24px',
                        height: '100%',
                        padding: '0 6px',
                        border: 'none',
                        borderRight: '1px solid #e5e7eb',
                        background: '#ffffff',
                        color: '#4b5563',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      title="Trang trước"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                  )}

                  {/* Danh sách các số trang */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx, arr) => {
                      const hasNext = safeCurrentPage < totalPages;
                      const isLastItem = idx === arr.length - 1 && !hasNext;
                      if (typeof p === 'string') {
                        return (
                          <span
                            key={`ellipsis-${idx}`}
                            style={{
                              minWidth: '22px',
                              height: '100%',
                              padding: '0 4px',
                              borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                              background: '#ffffff',
                              color: '#6b7280',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              userSelect: 'none',
                            }}
                          >
                            ...
                          </span>
                        );
                      }

                      const isActive = p === safeCurrentPage;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          style={{
                            minWidth: '24px',
                            height: '100%',
                            padding: '0 7px',
                            border: 'none',
                            borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                            background: isActive ? '#0fad89' : '#ffffff',
                            color: isActive ? '#ffffff' : '#374151',
                            cursor: isActive ? 'default' : 'pointer',
                            fontSize: '11.5px',
                            fontWeight: isActive ? '700' : '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.backgroundColor = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.backgroundColor = '#ffffff';
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}

                  {/* Nút trang sau (>) - hiển thị khi chưa tới trang cuối */}
                  {safeCurrentPage < totalPages && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      style={{
                        minWidth: '24px',
                        height: '100%',
                        padding: '0 6px',
                        border: 'none',
                        background: '#ffffff',
                        color: '#4b5563',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      title="Trang sau"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Cảnh báo phiên sắp hết hạn */}
      {isWarningZone && (
        <ModalPortal>
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '440px',
              background: '#1e293b',
              border: '1px solid rgba(245, 158, 11, 0.5)',
              borderRadius: '18px',
              padding: '28px 24px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(245, 158, 11, 0.2)',
              textAlign: 'center',
              color: '#f8fafc'
            }}>
              <h3 style={{ fontSize: '19px', fontWeight: '700', margin: '0 0 10px', color: '#fde68a' }}>
                Phiên Làm Việc Sắp Hết Hạn
              </h3>
              <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 14px' }}>
                Hệ thống phát hiện bạn không thao tác trong một khoảng thời gian.
              </p>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modals */}
      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        token={token}
        username={user.username}
        onTokenUpdated={onTokenUpdated}
      />

      <CreateCustomerModal
        isOpen={isCreateAccountModalOpen}
        onClose={() => setIsCreateAccountModalOpen(false)}
        token={token}
        onSuccess={(msg) => {
          window.dispatchEvent(new CustomEvent('USER_ACCOUNTS_CHANGED', { detail: { message: msg } }));
          emitStatusToast({ message: msg.replace(/^✅\s*/, ''), title: 'Tạo tài khoản thành công' });
        }}
      />

      <MoveCategoryModal
        isOpen={movingProduct !== null}
        onClose={() => setMovingProduct(null)}
        token={token}
        productId={movingProduct?.id || 0}
        productName={movingProduct?.name || ''}
        currentCategoryId={movingProduct?.category_id}
        onSuccess={() => {
          getProductsApi(token).then(data => {
            setProducts(data.items);
          }).catch(console.error);
        }}
      />

      {/* Xác nhận đăng xuất */}
      {showLogoutConfirm && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '16px',
              animation: 'fadeInCard 0.15s ease-out'
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: '24px',
                maxWidth: '380px',
                width: '100%',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                textAlign: 'center',
                border: '1px solid #e2e8f0'
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px auto',
                  border: '1px solid #fee2e2'
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
                Xác nhận đăng xuất
              </h3>
              <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5', margin: '0 0 24px 0' }}>
                Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{
                    flex: 1,
                    padding: '9px 16px',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                >
                  Hủy bỏ
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setShowLogoutConfirm(false);
                    setIsLoggingOut(true);
                    try {
                      await onLogout();
                    } finally {
                      setIsLoggingOut(false);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '9px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                    transition: 'background 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      <ProductAuditDrawer
        isOpen={productAuditDrawerState.isOpen}
        onClose={() => setProductAuditDrawerState((prev) => ({ ...prev, isOpen: false }))}
        productCode={productAuditDrawerState.productCode}
        productName={productAuditDrawerState.productName}
        token={token}
        initialFilter={productAuditDrawerState.initialFilter || 'ALL'}
        isCostVisible={isCostVisible}
      />

      <PriceUpdateModal
        isOpen={Boolean(priceUpdateModalProduct)}
        product={priceUpdateModalProduct}
        onClose={() => setPriceUpdateModalProduct(null)}
        token={token}
        isCostVisible={isCostVisible}
        onSuccess={() => {
          emitStatusToast({
            title: 'Cập nhật giá thành công',
            message: 'Đã lưu giá mới thành công.',
          });
          fetchProducts();
        }}
      />

      {isProductBulkImportOpen && (
        <ProductBulkImportModal
          token={token}
          onClose={() => setIsProductBulkImportOpen(false)}
          onSuccess={() => {
            setIsProductBulkImportOpen(false);
            fetchProducts();
          }}
        />
      )}

      {/* Unit Conversion Modals */}
      {unitConfigProduct && (
        <ProductUnitModal
          isOpen={Boolean(unitConfigProduct)}
          token={token}
          product={unitConfigProduct}
          onClose={() => setUnitConfigProduct(null)}
          onSuccess={() => {
            setUnitConfigProduct(null);
            fetchProducts();
          }}
        />
      )}

      {stockActionState.isOpen && (
        <StockActionModal
          isOpen={stockActionState.isOpen}
          token={token}
          actionType={stockActionState.actionType}
          product={stockActionState.product}
          products={products}
          initialReason={stockActionState.initialReason}
          onClose={() => setStockActionState({ isOpen: false, actionType: 'receipt', product: null })}
          onSuccess={() => {
            setStockActionState({ isOpen: false, actionType: 'receipt', product: null });
            fetchProducts();
          }}
        />
      )}

      {canWriteInventory && isGoodsReceiptModalOpen && (
        <GoodsReceiptModal
          isOpen={isGoodsReceiptModalOpen}
          initialTab={goodsReceiptInitialTab}
          onClose={() => setIsGoodsReceiptModalOpen(false)}
          token={token}
          products={products}
          currentUserWarehouse={user.branch || user.warehouse_name || undefined}
          onRequestAdjust={(targetProduct, receiptCode) => {
            setIsGoodsReceiptModalOpen(false);
            setStockActionState({
              isOpen: true,
              actionType: 'adjust',
              product: targetProduct,
              initialReason: `Điều chỉnh số lượng theo phiếu nhập kho ${receiptCode}`,
            });
          }}
          onSuccess={() => {
            fetchProducts();
          }}
        />
      )}



      {movingProduct && (
        <MoveCategoryModal
          isOpen={Boolean(movingProduct)}
          token={token}
          productId={movingProduct.id}
          productName={movingProduct.name}
          currentCategoryId={movingProduct.category_id}
          onClose={() => setMovingProduct(null)}
          onSuccess={() => {
            setMovingProduct(null);
            fetchProducts();
          }}
        />
      )}
      <StatusToastHost />
    </div>
    </DashboardLayout>
  );
}
