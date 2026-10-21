import React, { useState, useEffect, useMemo } from 'react';
import {
  PriceBook,
  fetchPriceBooksApi,
  createPriceBookApi,
  updatePriceBookApi,
  clonePriceBookApi,
  PriceBookItem,
  getProductsApi,
  ProductItem,
  User
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';
import { Link } from '../hooks/useLocation';
import { ProductSelectDropdown } from './ProductSelectDropdown';

interface PriceBookManagementViewProps {
  token: string;
  currentUser?: User | null;
  products?: ProductItem[];
  onBackToHome?: () => void;
  onNavigateToOrders?: () => void;
  onRefreshProducts?: () => void;
}

export function PriceBookManagementView({
  token,
  currentUser,
  products: initialProducts,
  onBackToHome: _onBackToHome,
  onNavigateToOrders: _onNavigateToOrders,
  onRefreshProducts,
}: PriceBookManagementViewProps) {
  // Xác định vai trò người dùng (RBAC Matrix)
  const userRoles = useMemo(() => {
    if (currentUser?.roles && currentUser.roles.length > 0) {
      return currentUser.roles;
    }
    return [currentUser?.role || ''];
  }, [currentUser]);

  // Toàn quyền CRUD bảng giá: admin và sales_manager
  const canManagePriceBooks = userRoles.some(r => ['admin', 'sales_manager'].includes(r));
  // Kế toán: Chỉ xem (cấm Thêm/Sửa/Nhân bản)
  const isAccountant = userRoles.includes('accountant') && !canManagePriceBooks;

  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [products, setProducts] = useState<ProductItem[]>(initialProducts || []);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeDropdownId, setActiveDropdownId] = useState<number | null>(null);

  // Đóng dropdown khi bấm ra ngoài hoặc nhấn phím ESC
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('.price-book-action-menu')) {
        setActiveDropdownId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Đồng bộ products khi props initialProducts thay đổi
  useEffect(() => {
    if (initialProducts && initialProducts.length > 0) {
      setProducts(initialProducts);
    }
  }, [initialProducts]);

  // Bộ lọc tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'items'>('info');

  // Selected item
  const [selectedBook] = useState<PriceBook | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    customer_group: 'dai_ly_cap_1',
    valid_from: '',
    valid_to: '',
    status: 'ACTIVE',
    note: ''
  });

  // Items State (cho tạo/sửa)
  const [formItems, setFormItems] = useState<PriceBookItem[]>([]);
  const [newProductId, setNewProductId] = useState('');
  const [newSalePrice, setNewSalePrice] = useState('');
  const [newFloorPrice, setNewFloorPrice] = useState('');

  // Tự động tìm kiếm sau khi người dùng dừng gõ
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Tải danh mục sản phẩm
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProductsApi(token);
        setProducts(data.items || []);
      } catch (err) {
        console.error('Không thể tải danh sách sản phẩm', err);
      }
    };
    loadProducts();
  }, [token]);

  // Tải danh sách bảng giá
  const loadPriceBooks = async () => {
    setLoading(true);
    try {
      const data = await fetchPriceBooksApi(token, {
        customer_group: filterGroup || undefined,
        status_filter: filterStatus || undefined,
        search: debouncedSearch || undefined
      });
      setPriceBooks(data);
    } catch (err: any) {
      emitStatusToast({ message: err.message || 'Lỗi tải danh sách bảng giá', title: 'Lỗi' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPriceBooks();
  }, [filterGroup, filterStatus, debouncedSearch]);

  const filteredBooks = useMemo(() => {
    return priceBooks;
  }, [priceBooks]);

  // Phân trang danh sách bảng giá
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 6;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterGroup, filterStatus, debouncedSearch, filteredBooks.length]);

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedBooks = filteredBooks.slice((safePage - 1) * pageSize, safePage * pageSize);


  // Các hàm mở modal cũ - hiện tại đã chuyển sang điều hướng router (/price-books/:id)
  /*
  const handleOpenEdit = async (id: number) => {
    try {
      const detail = await fetchPriceBookDetailApi(token, id);
      if (detail.is_locked) {
        emitStatusToast({
          message: 'Bảng giá đã phát sinh đơn hàng, không được phép chỉnh sửa. Vui lòng tạo phiên bản mới.',
          title: 'Bảng giá đã bị khóa'
        });
        return;
      }
      setSelectedBook(detail);
      setFormData({
        code: detail.code,
        name: detail.name,
        customer_group: detail.customer_group,
        valid_from: detail.valid_from ? detail.valid_from.slice(0, 16) : '',
        valid_to: detail.valid_to ? detail.valid_to.slice(0, 16) : '',
        status: detail.status,
        note: detail.note || ''
      });
      setFormItems(detail.items || []);
      setNewProductId('');
      setNewSalePrice('');
      setNewFloorPrice('');
      setActiveTab('info');
      setIsFormModalOpen(true);
    } catch (err: any) {
      emitStatusToast({ message: err.message || 'Lỗi khi tải chi tiết bảng giá', title: 'Lỗi' });
    }
  };

  const handleOpenDetail = async (id: number) => {
    try {
      const detail = await fetchPriceBookDetailApi(token, id);
      setSelectedBook(detail);
      setIsDetailModalOpen(true);
    } catch (err: any) {
      emitStatusToast({ message: err.message || 'Lỗi tải chi tiết', title: 'Lỗi' });
    }
  };
  */

  const handleClonePriceBook = async (pb: PriceBook) => {
    if (cloningId) return;
    try {
      setCloningId(pb.id);
      const cloned = await clonePriceBookApi(token, pb.id);
      emitStatusToast({
        message: `Đã nhân bản thành công bảng giá "${cloned.name}" (Mã: ${cloned.code}, Phiên bản: Phiên bản ${cloned.version || 2})!`,
        title: 'Nhân bản thành công'
      });
      loadPriceBooks();
    } catch (err: any) {
      emitStatusToast({ message: err.message || 'Lỗi nhân bản bảng giá', title: 'Thất bại' });
    } finally {
      setCloningId(null);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      emitStatusToast({ message: 'Vui lòng nhập Tên Bảng Giá', title: 'Thông báo', type: 'warning' });
      setActiveTab('info');
      return;
    }

    if (new Date(formData.valid_to) < new Date(formData.valid_from)) {
      emitStatusToast({ message: 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu', title: 'Thông báo', type: 'warning' });
      setActiveTab('info');
      return;
    }

    if (formItems.length === 0) {
      emitStatusToast({ message: 'Vui lòng thêm ít nhất 1 sản phẩm vào bảng giá', title: 'Thông báo', type: 'warning' });
      setActiveTab('items');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedValidFrom = new Date(formData.valid_from).toISOString();
      const formattedValidTo = new Date(formData.valid_to).toISOString();

      const normalizedItems = formItems.map(item => ({
        product_id: Number(item.product_id),
        sale_price: Number(item.sale_price) || 0,
        floor_price: Number(item.floor_price) || 0,
        price: Number(item.sale_price) || 0,
        min_price: Number(item.floor_price) || 0
      }));

      if (selectedBook) {
        await updatePriceBookApi(token, selectedBook.id, {
          name: formData.name.trim(),
          customer_group: formData.customer_group,
          valid_from: formattedValidFrom,
          valid_to: formattedValidTo,
          status: formData.status,
          note: formData.note.trim() || undefined,
          items: normalizedItems
        });

        // (a) Đóng modal
        setIsFormModalOpen(false);
        // (b) Hiển thị thông báo Toast màu xanh ở góc dưới màn hình
        emitStatusToast({
          message: 'Cập nhật bảng giá thành công!',
          title: 'Thành công',
          type: 'success'
        });
      } else {
        await createPriceBookApi(token, {
          code: formData.code.trim(),
          name: formData.name.trim(),
          customer_group: formData.customer_group,
          valid_from: formattedValidFrom,
          valid_to: formattedValidTo,
          status: formData.status,
          note: formData.note.trim() || undefined,
          items: normalizedItems
        });

        // (a) Đóng Modal thoát ra danh sách Bảng giá
        setIsFormModalOpen(false);
        // (b) Hiển thị thông báo Toast màu xanh ở góc dưới màn hình
        emitStatusToast({
          message: 'Thêm mới Bảng giá thành công!',
          title: 'Thành công',
          type: 'success'
        });
      }

      // (c) Tự động tải lại danh sách bảng giá để thấy bản ghi vừa tạo
      await loadPriceBooks();

      // Đồng bộ refetch danh sách sản phẩm để cập nhật giá niêm yết/giá sàn mới nhất
      try {
        const prodData = await getProductsApi(token);
        setProducts(prodData.items || []);
      } catch (loadErr) {
        console.warn('Lỗi tải lại danh sách sản phẩm sau khi lưu bảng giá:', loadErr);
      }

      if (onRefreshProducts) {
        onRefreshProducts();
      }
    } catch (err: any) {
      emitStatusToast({
        message: err.message || 'Lỗi lưu bảng giá',
        title: 'Thất bại',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [selectedModalProduct, setSelectedModalProduct] = useState<ProductItem | null>(null);

  const handleProductSelect = (product: ProductItem | null) => {
    if (product) {
      setNewProductId(product.id.toString());
      setSelectedModalProduct(product);
      const currentSellPrice = product.sell_price != null ? product.sell_price : 0;
      setNewSalePrice(currentSellPrice > 0 ? currentSellPrice.toString() : '');
      const currentFloorPrice = product.floor_price != null && product.floor_price > 0
        ? product.floor_price
        : Math.round(currentSellPrice * 0.85);
      setNewFloorPrice(currentFloorPrice > 0 ? currentFloorPrice.toString() : '');
    } else {
      setNewProductId('');
      setSelectedModalProduct(null);
      setNewSalePrice('');
      setNewFloorPrice('');
    }
  };

  const addFormItem = () => {
    const pid = parseInt(newProductId);
    const sp = parseFloat(newSalePrice);
    const fp = parseFloat(newFloorPrice);

    if (!pid || isNaN(pid)) {
      emitStatusToast({ message: 'Vui lòng chọn sản phẩm' });
      return;
    }

    if (formItems.some(i => i.product_id === pid)) {
      emitStatusToast({ message: 'Sản phẩm này đã có trong danh sách bảng giá' });
      return;
    }

    if (isNaN(sp) || sp < 0) {
      emitStatusToast({ message: 'Giá niêm yết phải là số hợp lệ >= 0' });
      return;
    }

    if (isNaN(fp) || fp < 0) {
      emitStatusToast({ message: 'Giá sàn phải là số hợp lệ >= 0' });
      return;
    }

    const prod = selectedModalProduct || products.find(p => p.id === pid);

    setFormItems([{
      product_id: pid,
      product_code: prod?.code,
      product_name: prod?.name,
      price: sp,
      min_price: fp,
      sale_price: sp,
      floor_price: fp
    }, ...formItems]);

    setNewProductId('');
    setSelectedModalProduct(null);
    setNewSalePrice('');
    setNewFloorPrice('');
  };

  const removeFormItem = (pid: number) => {
    setFormItems(formItems.filter(i => i.product_id !== pid));
  };

  const handleInlineEdit = (pid: number, field: 'sale_price' | 'floor_price', val: string) => {
    if (val !== '' && isNaN(parseFloat(val))) return;
    setFormItems(formItems.map(item => {
      if (item.product_id === pid) {
        const num = val === '' ? ('' as any) : parseFloat(val);
        return {
          ...item,
          [field]: num,
          price: field === 'sale_price' ? (val === '' ? 0 : parseFloat(val)) : (item.sale_price || 0),
          min_price: field === 'floor_price' ? (val === '' ? 0 : parseFloat(val)) : (item.floor_price || 0)
        };
      }
      return item;
    }));
  };

  const formatGroupName = (grp: string) => {
    if (grp === 'CAP_1' || grp === 'Dai_ly_cap_1' || grp === 'Đại lý cấp 1' || grp === 'dai_ly_cap_1') return 'Đại lý cấp 1';
    if (grp === 'CAP_2' || grp === 'Dai_ly_cap_2' || grp === 'Đại lý cấp 2' || grp === 'dai_ly_cap_2') return 'Đại lý cấp 2';
    if (grp === 'khach_si' || grp === 'Khach_si' || grp === 'Khách sỉ') return 'Khách sỉ';
    if (grp === 'RETAIL' || grp === 'Khach_le' || grp === 'Khách lẻ' || grp === 'khach_le') return 'Khách lẻ';
    return grp;
  };

  const renderStatusBadge = (pb: PriceBook) => {
    const badgeStyle: React.CSSProperties = {
      padding: '4px 10px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '700',
      whiteSpace: 'nowrap',
      display: 'inline-block',
    };
    if (pb.status === 'INACTIVE') {
      return (
        <span style={{ ...badgeStyle, background: '#f1f5f9', color: '#64748b' }}>
          Ngừng hoạt động
        </span>
      );
    }
    const now = new Date();
    if (pb.status === 'EXPIRED' || new Date(pb.valid_to) < now) {
      return (
        <span style={{ ...badgeStyle, background: '#fef3c7', color: '#b45309' }}>
          Đã hết hạn
        </span>
      );
    }
    if (new Date(pb.valid_from) > now) {
      return (
        <span style={{ ...badgeStyle, background: '#e0f2fe', color: '#0369a1' }}>
          Chờ áp dụng
        </span>
      );
    }
    return (
      <span style={{ ...badgeStyle, background: '#dcfce7', color: '#15803d' }}>
        Đang áp dụng
      </span>
    );
  };

  const isAddingWarning = Boolean(
    newSalePrice && newFloorPrice && parseFloat(newSalePrice) < parseFloat(newFloorPrice)
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1680px',
        margin: '0 auto',
        padding: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >

      {/* Thanh công cụ và tiêu đề */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Quản lý Bảng giá
              </h1>
              {isAccountant && (
                <span style={{ padding: '3px 10px', borderRadius: '12px', background: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: '700', border: '1px solid #fde68a' }}>
                  Kế toán (Chỉ xem)
                </span>
              )}
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Thiết lập giá niêm yết và giá sàn theo nhóm khách hàng và thời hạn hiệu lực
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>

          {canManagePriceBooks && (
            <Link
              to="/price-lists/create"
              id="btn-add-price-book"
              style={{
                background: '#0fad89',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13.5px',
                boxShadow: '0 2px 4px rgba(15, 173, 137, 0.2)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              Thêm Bảng giá
            </Link>
          )}
        </div>
      </div>

      {/* Thanh tìm kiếm và bộ lọc */}
      <div style={{ background: '#fff', padding: '14px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: '260px' }}>
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên bảng giá..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', minWidth: '200px', background: '#fff', cursor: 'pointer' }}>
          <option value="">Tất cả nhóm khách hàng</option>
          <option value="dai_ly_cap_1">Đại lý cấp 1</option>
          <option value="dai_ly_cap_2">Đại lý cấp 2</option>
          <option value="khach_si">Khách sỉ</option>
          <option value="khach_le">Khách lẻ</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', minWidth: '180px', background: '#fff', cursor: 'pointer' }}>
          <option value="">Tất cả trạng thái</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="INACTIVE">Ngừng hoạt động</option>
          <option value="EXPIRED">Đã hết hạn</option>
        </select>
      </div>

      {/* Bảng danh sách bảng giá */}
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>Đang tải danh sách bảng giá...</div>
          </div>
        ) : (
          <>
            <div
              className="roles-grid-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <tr>
                    <th style={{ padding: '14px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f8fafc' }}>Mã Bảng Giá</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f8fafc' }}>Tên Bảng Giá</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', background: '#f8fafc' }}>Nhóm Khách Hàng</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f8fafc' }}>Thời Hạn</th>
                    {/* Cột Phiên bản: Chỉ hiển thị chữ thuần túy, không có icon (Yêu cầu đề bài) */}
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f8fafc' }}>Phiên bản</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', background: '#f8fafc' }}>Trạng thái</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', background: '#f8fafc', width: '90px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBooks.map((pb, idx) => {
                    const isLocked = Boolean(pb.is_locked);
                    return (
                      <tr key={pb.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                        <td style={{ padding: '14px 16px', color: '#0f172a', fontWeight: '700', fontSize: '13.5px' }}>
                          <Link
                            to={`/price-books/${pb.id}`}
                            style={{
                              fontFamily: 'monospace',
                              background: '#f1f5f9',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              color: '#0f766e',
                              textDecoration: 'none',
                              fontWeight: '700',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
                            title="Xem chi tiết bảng giá trên trang riêng"
                          >
                            {pb.code}
                          </Link>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#0f172a' }}>
                          <div style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>
                            {pb.name}
                          </div>
                          {pb.note && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{pb.note}</div>}
                        </td>
                        <td style={{ padding: '14px 16px', color: '#334155', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 10px',
                            background: pb.customer_group?.includes('cap_1') || pb.customer_group?.includes('CAP_1') ? '#e0e7ff' : pb.customer_group?.includes('cap_2') || pb.customer_group?.includes('CAP_2') ? '#f3e8ff' : '#fef3c7',
                            color: pb.customer_group?.includes('cap_1') || pb.customer_group?.includes('CAP_1') ? '#3730a3' : pb.customer_group?.includes('cap_2') || pb.customer_group?.includes('CAP_2') ? '#6b21a8' : '#92400e',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            display: 'inline-block',
                          }}>
                            {formatGroupName(pb.customer_group)}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', color: '#475569', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          <div>{new Date(pb.valid_from).toLocaleDateString('vi-VN')} → {new Date(pb.valid_to).toLocaleDateString('vi-VN')}</div>
                        </td>

                        {/* Cột Phiên bản: CHỈ chữ thuần túy, không có bất kỳ biểu tượng icon nào (Yêu cầu đề bài) */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: '8px',
                            background: isLocked ? '#fee2e2' : '#f1f5f9',
                            color: isLocked ? '#b91c1c' : '#334155',
                            fontWeight: '700',
                            fontSize: '12.5px',
                            display: 'inline-block',
                          }}>
                            Phiên bản {pb.version || 1}
                          </span>
                        </td>

                        <td style={{ padding: '14px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {renderStatusBadge(pb)}
                        </td>

                        <td style={{ padding: '10px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div className="price-book-action-menu" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(prev => prev === pb.id ? null : pb.id);
                              }}
                              title="Thao tác"
                              aria-label="Thao tác"
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                border: activeDropdownId === pb.id ? '1.5px solid #0fad89' : '1px solid #cbd5e1',
                                background: activeDropdownId === pb.id ? '#f0fdf4' : '#ffffff',
                                color: activeDropdownId === pb.id ? '#0fad89' : '#64748b',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                              }}
                              onMouseEnter={(e) => {
                                if (activeDropdownId !== pb.id) {
                                  e.currentTarget.style.background = '#f8fafc';
                                  e.currentTarget.style.color = '#0f172a';
                                  e.currentTarget.style.borderColor = '#94a3b8';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (activeDropdownId !== pb.id) {
                                  e.currentTarget.style.background = '#ffffff';
                                  e.currentTarget.style.color = '#64748b';
                                  e.currentTarget.style.borderColor = '#cbd5e1';
                                }
                              }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2.2" />
                                <circle cx="12" cy="12" r="2.2" />
                                <circle cx="12" cy="19" r="2.2" />
                              </svg>
                            </button>

                            {activeDropdownId === pb.id && (() => {
                              const openUpward = paginatedBooks.length > 2 && idx >= paginatedBooks.length - 2;
                              return (
                                <div
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    ...(openUpward
                                      ? { bottom: 'calc(100% + 6px)' }
                                      : { top: 'calc(100% + 6px)' }),
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '10px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
                                    minWidth: '165px',
                                    zIndex: 9999,
                                    padding: '6px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px',
                                    textAlign: 'left',
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {/* Xem chi tiết */}
                                  <Link
                                    to={`/price-books/${pb.id}`}
                                    onClick={() => setActiveDropdownId(null)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '9px',
                                      width: '100%',
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      color: '#334155',
                                      fontSize: '13px',
                                      fontWeight: '500',
                                      textDecoration: 'none',
                                      boxSizing: 'border-box',
                                      transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#f1f5f9';
                                      e.currentTarget.style.color = '#0f172a';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.color = '#334155';
                                    }}
                                  >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                      <circle cx="12" cy="12" r="3" />
                                    </svg>
                                    <span>Chi tiết</span>
                                  </Link>

                                  {/* Chỉnh sửa */}
                                  {canManagePriceBooks && (
                                    isLocked ? (
                                      <div
                                        title="Bảng giá đã phát sinh đơn hàng, không thể chỉnh sửa"
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '9px',
                                          width: '100%',
                                          padding: '8px 12px',
                                          borderRadius: '6px',
                                          color: '#94a3b8',
                                          fontSize: '13px',
                                          fontWeight: '500',
                                          cursor: 'not-allowed',
                                          boxSizing: 'border-box',
                                          background: '#f8fafc',
                                        }}
                                      >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                        <span>Sửa (Đã khóa)</span>
                                      </div>
                                    ) : (
                                      <Link
                                        to={`/price-books/${pb.id}/edit`}
                                        onClick={() => setActiveDropdownId(null)}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '9px',
                                          width: '100%',
                                          padding: '8px 12px',
                                          borderRadius: '6px',
                                          color: '#2563eb',
                                          fontSize: '13px',
                                          fontWeight: '500',
                                          textDecoration: 'none',
                                          boxSizing: 'border-box',
                                          transition: 'all 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = '#eff6ff';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = 'transparent';
                                        }}
                                      >
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                        <span>Chỉnh sửa</span>
                                      </Link>
                                    )
                                  )}

                                  {/* Nhân bản */}
                                  {canManagePriceBooks && (
                                    <button
                                      type="button"
                                      disabled={cloningId === pb.id}
                                      onClick={() => {
                                        setActiveDropdownId(null);
                                        handleClonePriceBook(pb);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '9px',
                                        width: '100%',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: 'transparent',
                                        color: cloningId === pb.id ? '#94a3b8' : '#16a34a',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        cursor: cloningId === pb.id ? 'wait' : 'pointer',
                                        textAlign: 'left',
                                        boxSizing: 'border-box',
                                        transition: 'all 0.15s ease',
                                      }}
                                      onMouseEnter={(e) => {
                                        if (cloningId !== pb.id) {
                                          e.currentTarget.style.background = '#f0fdf4';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (cloningId !== pb.id) {
                                          e.currentTarget.style.background = 'transparent';
                                        }
                                      }}
                                    >
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                      </svg>
                                      <span>{cloningId === pb.id ? 'Đang tạo...' : 'Nhân bản'}</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredBooks.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: '#64748b' }}>Không tìm thấy bảng giá nào phù hợp</div>
                        <div style={{ fontSize: '13px', marginTop: '4px' }}>Nhấn nút "Thêm Bảng giá" để tạo bảng giá mới</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* FOOTER PHÂN TRANG */}
            {!loading && filteredBooks.length > 0 && (
              <div
                style={{
                  padding: '8px 18px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '12px',
                  color: '#64748b',
                  flexShrink: 0,
                }}
              >
                {/* Khối phân trang liền thanh chuẩn theo thiết kế */}
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
                  {safePage > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx, arr) => {
                      const hasNext = safePage < totalPages;
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

                      const isActive = p === safePage;
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
                            background: isActive ? '#2ba1f4' : '#ffffff',
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
                  {safePage < totalPages && (
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
          </>
        )}
      </div>

      {/* Modal Chỉnh sửa Bảng Giá */}
      {isFormModalOpen && selectedBook && (
        <ModalPortal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, padding: '16px', boxSizing: 'border-box' }}>
            <div style={{ background: '#fff', borderRadius: '16px', width: '860px', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>

              <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                    {selectedBook ? `Cập nhật Bảng Giá: ${selectedBook.code}` : 'Thêm mới Bảng Giá'}
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                    {selectedBook ? 'Điều chỉnh thông tin và danh sách sản phẩm bảng giá' : 'Khai báo bảng giá theo nhóm khách hàng và thời gian hiệu lực'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '20px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    lineHeight: 1,
                    borderRadius: '6px'
                  }}
                  title="Đóng"
                >
                  ✕
                </button>
              </div>

              {/* Tab điều hướng */}
              <div style={{ padding: '0 24px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', gap: '28px' }}>
                  <div
                    onClick={() => setActiveTab('info')}
                    style={{
                      padding: '14px 4px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '14px',
                      color: activeTab === 'info' ? '#2563eb' : '#64748b',
                      borderBottom: activeTab === 'info' ? '2.5px solid #2563eb' : '2.5px solid transparent'
                    }}
                  >
                    Thông tin chung
                  </div>
                  <div
                    onClick={() => setActiveTab('items')}
                    style={{
                      padding: '14px 4px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '14px',
                      color: activeTab === 'items' ? '#2563eb' : '#64748b',
                      borderBottom: activeTab === 'items' ? '2.5px solid #2563eb' : '2.5px solid transparent'
                    }}
                  >
                    Danh sách sản phẩm ({formItems.length})
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>

                  {activeTab === 'info' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Mã Bảng Giá <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                          required
                          disabled={!!selectedBook}
                          value={formData.code}
                          onChange={e => setFormData({ ...formData, code: e.target.value })}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: selectedBook ? '#f1f5f9' : '#fff', boxSizing: 'border-box', fontSize: '14px' }}
                          placeholder="Ví dụ: BG-DL1-2026"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Tên Bảng Giá <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                          required
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', fontSize: '14px' }}
                          placeholder="Ví dụ: Bảng giá Đại lý cấp 1 - Quý 4"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Nhóm Khách Hàng <span style={{ color: '#ef4444' }}>*</span></label>
                        <select
                          value={formData.customer_group}
                          onChange={e => setFormData({ ...formData, customer_group: e.target.value })}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', boxSizing: 'border-box', fontSize: '14px' }}
                        >
                          <option value="dai_ly_cap_1">Đại lý cấp 1</option>
                          <option value="dai_ly_cap_2">Đại lý cấp 2</option>
                          <option value="khach_si">Khách sỉ</option>
                          <option value="khach_le">Khách lẻ</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Trạng thái</label>
                        <select
                          value={formData.status}
                          onChange={e => setFormData({ ...formData, status: e.target.value })}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', boxSizing: 'border-box', fontSize: '14px' }}
                        >
                          <option value="ACTIVE">Đang hoạt động</option>
                          <option value="INACTIVE">Ngừng hoạt động</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Ngày bắt đầu <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                          type="datetime-local"
                          required
                          value={formData.valid_from}
                          onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', fontSize: '14px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Ngày kết thúc <span style={{ color: '#ef4444' }}>*</span></label>
                        <input
                          type="datetime-local"
                          required
                          min={formData.valid_from}
                          value={formData.valid_to}
                          onChange={e => setFormData({ ...formData, valid_to: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: formData.valid_to && formData.valid_from && new Date(formData.valid_to) < new Date(formData.valid_from) ? '1px solid #ef4444' : '1px solid #cbd5e1',
                            outline: 'none',
                            boxSizing: 'border-box',
                            fontSize: '14px'
                          }}
                        />
                        {formData.valid_to && formData.valid_from && new Date(formData.valid_to) < new Date(formData.valid_from) && (
                          <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>Ngày kết thúc không được nhỏ hơn ngày bắt đầu</div>
                        )}
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Ghi chú</label>
                        <textarea
                          value={formData.note}
                          onChange={e => setFormData({ ...formData, note: e.target.value })}
                          placeholder="Nhập ghi chú hoặc điều kiện áp dụng nếu có..."
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '80px', boxSizing: 'border-box', fontSize: '14px' }}
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'items' && (
                    <div>
                      {/* Phần thêm sản phẩm */}
                      <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '10px' }}>THÊM SẢN PHẨM VÀO BẢNG GIÁ</div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                          <div style={{ flex: 2, minWidth: '240px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                              Sản phẩm
                            </label>
                            <ProductSelectDropdown
                              token={token}
                              selectedProductId={newProductId ? parseInt(newProductId, 10) : 0}
                              onSelectProduct={(p) => handleProductSelect(p)}
                              placeholder="-- Chọn Sản phẩm --"
                              autoSelectFirst={false}
                              fallbackProduct={selectedModalProduct ? {
                                id: selectedModalProduct.id,
                                code: selectedModalProduct.code,
                                name: selectedModalProduct.name,
                                is_batch_managed: selectedModalProduct.is_batch_managed,
                              } : null}
                            />
                          </div>

                          <div style={{ flex: 1, minWidth: '140px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                              Giá niêm yết (đồng)
                            </label>
                            <input
                              type="number"
                              placeholder="Giá niêm yết (đồng)..."
                              value={newSalePrice}
                              onChange={e => setNewSalePrice(e.target.value)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: isAddingWarning ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                width: '100%',
                                outline: 'none',
                                boxSizing: 'border-box',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: isAddingWarning ? '#ef4444' : '#0f172a'
                              }}
                              title="Chỉnh sửa Giá niêm yết"
                            />
                          </div>

                          <div style={{ flex: 1, minWidth: '140px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                              Giá sàn (đồng)
                            </label>
                            <input
                              type="number"
                              placeholder="Giá sàn (đồng)..."
                              value={newFloorPrice}
                              onChange={e => setNewFloorPrice(e.target.value)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                width: '100%',
                                outline: 'none',
                                boxSizing: 'border-box',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#475569'
                              }}
                              title="Chỉnh sửa Giá sàn"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={addFormItem}
                            style={{
                              background: '#0fad89',
                              color: '#fff',
                              border: 'none',
                              padding: '10px 24px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontWeight: '700',
                              fontSize: '14px',
                              height: '42px'
                            }}
                          >
                            Thêm sản phẩm
                          </button>
                        </div>

                        {/* Cảnh báo chữ màu đỏ nếu Giá niêm yết < Giá sàn */}
                        {isAddingWarning && (
                          <div style={{ marginTop: '8px', color: '#dc2626', fontSize: '12.5px', fontWeight: '600' }}>
                            Cảnh báo: Đơn giá niêm yết nhỏ hơn giá sàn quy định! Đơn hàng sẽ phải chuyển sang Quản lý phê duyệt.
                          </div>
                        )}
                      </div>

                      {/* Bảng danh sách sản phẩm trong bảng giá */}
                      <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead style={{ background: '#f1f5f9' }}>
                            <tr>
                              <th style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '13px' }}>Mã Sản Phẩm</th>
                              <th style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '13px' }}>Tên Sản Phẩm</th>
                              <th style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '13px' }}>Giá Niêm Yết (đồng)</th>
                              <th style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '13px' }}>Giá Sàn (đồng)</th>
                              <th style={{ padding: '12px 14px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '13px', width: '70px' }}>Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formItems.map(item => {
                              const isBelowFloor = (item.sale_price || 0) < (item.floor_price || 0);
                              return (
                                <tr key={item.product_id} style={{ background: isBelowFloor ? '#fef2f2' : 'transparent', borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '10px 14px', fontWeight: '600', color: '#0f172a', fontSize: '13.5px' }}>
                                    <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                      {item.product_code || `#${item.product_id}`}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', fontWeight: '500', color: '#334155', fontSize: '13.5px' }}>
                                    {item.product_name || '-'}
                                  </td>
                                  <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                    <input
                                      type="number"
                                      placeholder="Giá niêm yết..."
                                      title="Chỉnh sửa giá niêm yết"
                                      value={item.sale_price != null ? item.sale_price : ''}
                                      onChange={(e) => handleInlineEdit(item.product_id, 'sale_price', e.target.value)}
                                      style={{
                                        textAlign: 'right',
                                        width: '130px',
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: isBelowFloor ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                        outline: 'none',
                                        background: '#fff',
                                        fontWeight: '600',
                                        color: isBelowFloor ? '#ef4444' : '#0f172a',
                                        fontSize: '13.5px'
                                      }}
                                    />
                                  </td>
                                  <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                    <input
                                      type="number"
                                      placeholder="Giá sàn..."
                                      title="Chỉnh sửa giá sàn"
                                      value={item.floor_price != null ? item.floor_price : ''}
                                      onChange={(e) => handleInlineEdit(item.product_id, 'floor_price', e.target.value)}
                                      style={{
                                        textAlign: 'right',
                                        width: '120px',
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        outline: 'none',
                                        background: '#fff',
                                        fontWeight: '600',
                                        color: '#475569',
                                        fontSize: '13.5px'
                                      }}
                                    />
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => removeFormItem(item.product_id)}
                                      style={{ color: '#ef4444', border: '1px solid #fca5a5', background: '#fef2f2', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}
                                      title="Xóa khỏi bảng giá"
                                    >
                                      Xóa
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            {formItems.length === 0 && (
                              <tr>
                                <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                                  Chưa có sản phẩm nào trong bảng giá. Hãy chọn sản phẩm ở ô trên và nhấn "Thêm sản phẩm".
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>

                {/* Modal footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '14px' }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isSubmitting ? '#94a3b8' : '#0fad89',
                      color: 'white',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      fontWeight: '700',
                      fontSize: '14px',
                      boxShadow: '0 2px 4px rgba(15, 173, 137, 0.2)'
                    }}
                  >
                    {isSubmitting ? 'Đang lưu...' : (selectedBook ? 'Lưu cập nhật' : 'Lưu Bảng Giá')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Chi Tiết Bảng Giá */}
      {isDetailModalOpen && selectedBook && (
        <ModalPortal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 99999, padding: '16px', boxSizing: 'border-box' }}>
            <div style={{ background: '#fff', borderRadius: '16px', width: '800px', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>

              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{selectedBook.name}</h2>
                  <div style={{ color: '#64748b', fontSize: '13px' }}>
                    Mã bảng giá: <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{selectedBook.code}</strong> • Phiên bản: <strong style={{ color: '#2563eb' }}>Phiên bản {selectedBook.version || 1}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '20px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    lineHeight: 1,
                    borderRadius: '6px'
                  }}
                  title="Đóng"
                >
                  ✕
                </button>
              </div>

              <div style={{ padding: '24px', overflowY: 'auto' }}>
                <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
                  <div><span style={{ color: '#64748b' }}>Nhóm khách hàng:</span> <strong>{formatGroupName(selectedBook.customer_group)}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Trạng thái:</span> {renderStatusBadge(selectedBook)}</div>
                  <div><span style={{ color: '#64748b' }}>Ngày bắt đầu:</span> <strong>{new Date(selectedBook.valid_from).toLocaleString('vi-VN')}</strong></div>
                  <div><span style={{ color: '#64748b' }}>Ngày kết thúc:</span> <strong>{new Date(selectedBook.valid_to).toLocaleString('vi-VN')}</strong></div>
                  <div>
                    <span style={{ color: '#64748b' }}>Tình trạng chỉnh sửa:</span>{' '}
                    {selectedBook.is_locked ? (
                      <span style={{ color: '#b91c1c', fontWeight: '700' }}>Đã khóa (Đã phát sinh đơn hàng)</span>
                    ) : (
                      <span style={{ color: '#15803d', fontWeight: '600' }}>Cho phép chỉnh sửa</span>
                    )}
                  </div>
                  <div><span style={{ color: '#64748b' }}>Người tạo:</span> <strong>{selectedBook.created_by || 'admin'}</strong></div>
                  {selectedBook.note && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#64748b' }}>Ghi chú:</span> {selectedBook.note}</div>}
                </div>

                <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                  Danh sách sản phẩm áp dụng ({selectedBook.items?.length || 0})
                </h3>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f1f5f9' }}>
                      <tr>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '13px' }}>Mã Sản Phẩm</th>
                        <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '13px' }}>Tên Sản Phẩm</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '13px' }}>Giá Niêm Yết (đồng)</th>
                        <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '13px' }}>Giá Sàn (đồng)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBook.items?.map((item: PriceBookItem) => {
                        const salePrice = item.sale_price !== undefined && item.sale_price !== null ? item.sale_price : item.price;
                        const floorPrice = item.floor_price !== undefined && item.floor_price !== null ? item.floor_price : item.min_price;
                        return (
                          <tr key={item.id || item.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '12px', fontWeight: '600', fontFamily: 'monospace', color: '#0f172a' }}>{item.product_code || `#${item.product_id}`}</td>
                            <td style={{ padding: '12px', color: '#334155' }}>{item.product_name || '-'}</td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#15803d', fontWeight: '700' }}>
                              {salePrice ? Number(salePrice).toLocaleString('vi-VN') : '0'} đồng
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>
                              {floorPrice ? Number(floorPrice).toLocaleString('vi-VN') : '0'} đồng
                            </td>
                          </tr>
                        );
                      })}
                      {!selectedBook.items?.length && (
                        <tr><td colSpan={4} style={{ padding: '28px', textAlign: 'center', color: '#94a3b8' }}>Chưa có sản phẩm nào trong bảng giá này.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  {canManagePriceBooks && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleClonePriceBook(selectedBook);
                      }}
                      style={{
                        padding: '9px 18px',
                        borderRadius: '8px',
                        border: '1px solid #86efac',
                        background: '#f0fdf4',
                        color: '#16a34a',
                        cursor: 'pointer',
                        fontWeight: '700',
                        fontSize: '13px'
                      }}
                    >
                      Tạo phiên bản mới
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  style={{ padding: '9px 22px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13px' }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
export default PriceBookManagementView;
