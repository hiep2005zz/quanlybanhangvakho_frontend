import React, { useState, useEffect, useMemo } from 'react';
import { 
  PriceBook, 
  fetchPriceBooksApi, 
  createPriceBookApi,
  updatePriceBookApi,
  clonePriceBookApi,
  fetchPriceBookDetailApi,
  PriceBookItem,
  getProductsApi,
  ProductItem,
  User
} from '../services/api';
import { emitStatusToast } from './StatusToast';

interface PriceBookManagementViewProps {
  token: string;
  currentUser?: User | null;
  onBackToHome?: () => void;
}

export function PriceBookManagementView({ token, currentUser, onBackToHome }: PriceBookManagementViewProps) {
  // Xác định vai trò người dùng (RBAC Matrix)
  const userRoles = useMemo(() => {
    if (currentUser?.roles && currentUser.roles.length > 0) {
      return currentUser.roles;
    }
    return [currentUser?.role || ''];
  }, [currentUser]);

  // Toàn quyền CRUD bảng giá: admin và sales_manager
  const canManagePriceBooks = userRoles.some(r => ['admin', 'sales_manager'].includes(r));
  // Kế toán: Read-only (chỉ xem, cấm Thêm/Sửa/Clone)
  const isAccountant = userRoles.includes('accountant') && !canManagePriceBooks;

  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<number | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'items'>('info');

  // Selected item
  const [selectedBook, setSelectedBook] = useState<PriceBook | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    customer_group: 'Dai_ly_cap_1',
    valid_from: '',
    valid_to: '',
    status: 'ACTIVE',
    note: ''
  });
  
  // Items State (for creating/updating)
  const [formItems, setFormItems] = useState<PriceBookItem[]>([]);
  const [newProductId, setNewProductId] = useState('');
  const [newSalePrice, setNewSalePrice] = useState('');
  const [newFloorPrice, setNewFloorPrice] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load products for dropdown
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const data = await getProductsApi(token);
        setProducts(data.items || []);
      } catch (err) {
        console.error('Failed to fetch products', err);
      }
    };
    loadProducts();
  }, [token]);

  // Load price books
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

  const handleOpenCreate = () => {
    setSelectedBook(null);
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    // Format to YYYY-MM-DDTHH:mm for datetime-local
    const formatDT = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setFormData({
      code: `BG-${Date.now().toString().slice(-6)}`,
      name: '',
      customer_group: 'Dai_ly_cap_1',
      valid_from: formatDT(now),
      valid_to: formatDT(thirtyDaysLater),
      status: 'ACTIVE',
      note: ''
    });
    setFormItems([]);
    setNewProductId('');
    setNewSalePrice('');
    setNewFloorPrice('');
    setActiveTab('info');
    setIsFormModalOpen(true);
  };

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

  const handleClonePriceBook = async (pb: PriceBook) => {
    if (cloningId) return;
    try {
      setCloningId(pb.id);
      const cloned = await clonePriceBookApi(token, pb.id);
      emitStatusToast({ 
        message: `Đã nhân bản thành công bảng giá "${cloned.name}" (Mã: ${cloned.code}, Phiên bản: v${cloned.version || 2})!`,
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
      emitStatusToast({ message: 'Vui lòng nhập Tên Bảng Giá' });
      setActiveTab('info');
      return;
    }

    // Validate dates
    if (new Date(formData.valid_to) < new Date(formData.valid_from)) {
      emitStatusToast({ message: 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu' });
      setActiveTab('info');
      return;
    }

    if (formItems.length === 0) {
      emitStatusToast({ message: 'Vui lòng thêm ít nhất 1 sản phẩm vào bảng giá' });
      setActiveTab('items');
      return;
    }

    try {
      const formattedValidFrom = new Date(formData.valid_from).toISOString();
      const formattedValidTo = new Date(formData.valid_to).toISOString();

      // Chuẩn hóa đúng danh sách sản phẩm gửi xuống backend
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
        emitStatusToast({ message: 'Cập nhật bảng giá thành công' });
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
        emitStatusToast({ message: 'Tạo bảng giá mới thành công' });
      }

      setIsFormModalOpen(false);
      loadPriceBooks();
    } catch (err: any) {
      emitStatusToast({ message: err.message || 'Lỗi lưu bảng giá', title: 'Thất bại' });
    }
  };

  const handleProductSelect = (productIdStr: string) => {
    setNewProductId(productIdStr);
    const pid = parseInt(productIdStr);
    const prod = products.find(p => p.id === pid);
    if (prod && prod.sell_price) {
      setNewSalePrice(prod.sell_price.toString());
      setNewFloorPrice(Math.round(prod.sell_price * 0.85).toString());
    } else {
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
      emitStatusToast({ message: 'Giá bán phải là số hợp lệ >= 0' });
      return;
    }

    if (isNaN(fp) || fp < 0) {
      emitStatusToast({ message: 'Giá sàn phải là số hợp lệ >= 0' });
      return;
    }
    
    const prod = products.find(p => p.id === pid);
    
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
    setNewSalePrice('');
    setNewFloorPrice('');
  };

  const removeFormItem = (pid: number) => {
    setFormItems(formItems.filter(i => i.product_id !== pid));
  };

  const handleInlineEdit = (pid: number, field: 'sale_price' | 'floor_price', val: string) => {
    const num = val === '' ? 0 : parseFloat(val);
    if (val !== '' && isNaN(num)) return;
    setFormItems(formItems.map(item => {
      if (item.product_id === pid) {
        return {
          ...item,
          [field]: num,
          price: field === 'sale_price' ? num : (item.sale_price || 0),
          min_price: field === 'floor_price' ? num : (item.floor_price || 0)
        };
      }
      return item;
    }));
  };

  const formatGroupName = (grp: string) => {
    if (grp === 'CAP_1' || grp === 'Dai_ly_cap_1' || grp === 'Đại lý cấp 1') return 'Đại lý cấp 1';
    if (grp === 'CAP_2' || grp === 'Dai_ly_cap_2' || grp === 'Đại lý cấp 2') return 'Đại lý cấp 2';
    if (grp === 'RETAIL' || grp === 'Khach_le' || grp === 'Khách lẻ') return 'Khách lẻ';
    return grp;
  };

  const renderStatusBadge = (pb: PriceBook) => {
    if (pb.status === 'INACTIVE') {
      return (
        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: '#f1f5f9', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
          Ngừng HĐ
        </span>
      );
    }
    const now = new Date();
    if (pb.status === 'EXPIRED' || new Date(pb.valid_to) < now) {
      return (
        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: '#fef3c7', color: '#b45309', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
          Hết hạn
        </span>
      );
    }
    if (new Date(pb.valid_from) > now) {
      return (
        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: '#e0f2fe', color: '#0369a1', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0284c7' }} />
          Chờ áp dụng
        </span>
      );
    }
    return (
      <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: '#dcfce7', color: '#15803d', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
        Đang áp dụng
      </span>
    );
  };

  const handleBackHome = () => {
    if (onBackToHome) {
      onBackToHome();
    } else {
      window.location.href = '/';
    }
  };

  const isAddingWarning = Boolean(
    newSalePrice && newFloorPrice && parseFloat(newSalePrice) < parseFloat(newFloorPrice)
  );

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button 
            onClick={handleBackHome}
            style={{ 
              background: '#ffffff', 
              color: '#334155', 
              border: '1px solid #cbd5e1', 
              padding: '9px 16px', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: '600', 
              fontSize: '14px',
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            title="Quay lại trang chủ"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Quay lại trang chủ
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>Quản lý Bảng giá</h1>
              {isAccountant && (
                <span style={{ padding: '3px 10px', borderRadius: '12px', background: '#fef3c7', color: '#92400e', fontSize: '12px', fontWeight: '700', border: '1px solid #fde68a' }}>
                  Kế toán (Read-only)
                </span>
              )}
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>Thiết lập đơn giá bán và giá sàn theo nhóm khách hàng & thời hạn hiệu lực</p>
          </div>
        </div>

        {canManagePriceBooks && (
          <button 
            onClick={handleOpenCreate}
            id="btn-add-price-book"
            style={{ 
              background: '#2563eb', 
              color: 'white', 
              border: 'none', 
              padding: '10px 20px', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: '600', 
              fontSize: '14px',
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            + Thêm Bảng giá
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Tìm theo Mã hoặc Tên Bảng Giá (Debounce)..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', minWidth: '200px', background: '#fff', cursor: 'pointer' }}>
          <option value="">-- Tất cả nhóm khách hàng --</option>
          <option value="Dai_ly_cap_1">Đại lý cấp 1</option>
          <option value="Dai_ly_cap_2">Đại lý cấp 2</option>
          <option value="Khach_le">Khách lẻ</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '14px', minWidth: '180px', background: '#fff', cursor: 'pointer' }}>
          <option value="">-- Tất cả trạng thái --</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="INACTIVE">Ngừng hoạt động</option>
          <option value="EXPIRED">Đã hết hạn</option>
        </select>
      </div>

      {/* Main Table View */}
      <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ display: 'inline-block', width: '28px', height: '28px', border: '3px solid #cbd5e1', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ marginTop: '12px', fontWeight: '500' }}>Đang tải danh sách bảng giá...</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Mã BG</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tên Bảng Giá</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nhóm KH</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Thời hạn</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Version</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trạng thái</th>
                <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600', color: '#475569', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredBooks.map(pb => {
                const isLocked = Boolean(pb.is_locked);
                return (
                  <tr key={pb.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s' }}>
                    <td style={{ padding: '14px 16px', color: '#0f172a', fontWeight: '600', fontSize: '14px' }}>
                      <span style={{ fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{pb.code}</span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#334155' }}>
                      <div 
                        onClick={() => handleOpenDetail(pb.id)} 
                        style={{ color: '#2563eb', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }} 
                        title="Xem chi tiết bảng giá"
                      >
                        {pb.name}
                      </div>
                      {pb.note && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{pb.note}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', color: '#334155' }}>
                      <span style={{ 
                        padding: '3px 10px', 
                        background: pb.customer_group?.includes('cap_1') || pb.customer_group?.includes('CAP_1') ? '#e0e7ff' : pb.customer_group?.includes('cap_2') || pb.customer_group?.includes('CAP_2') ? '#f3e8ff' : '#fef3c7', 
                        color: pb.customer_group?.includes('cap_1') || pb.customer_group?.includes('CAP_1') ? '#3730a3' : pb.customer_group?.includes('cap_2') || pb.customer_group?.includes('CAP_2') ? '#6b21a8' : '#92400e', 
                        borderRadius: '12px', 
                        fontSize: '12px', 
                        fontWeight: '600' 
                      }}>
                        {formatGroupName(pb.customer_group)}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#475569', fontSize: '13px' }}>
                      <div>{new Date(pb.valid_from).toLocaleDateString('vi-VN')} → {new Date(pb.valid_to).toLocaleDateString('vi-VN')}</div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ 
                        padding: '2px 8px', 
                        borderRadius: '8px', 
                        background: isLocked ? '#fee2e2' : '#f1f5f9', 
                        color: isLocked ? '#b91c1c' : '#475569', 
                        fontWeight: '700', 
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        v{pb.version || 1}
                        {isLocked && (
                          <span title="Đã phát sinh giao dịch, bảng giá bị khóa chỉnh sửa">🔒</span>
                        )}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      {renderStatusBadge(pb)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                        
                        {/* Nút Xem Chi Tiết - Luôn khả dụng cho admin, sales_manager, accountant */}
                        <button 
                          onClick={() => handleOpenDetail(pb.id)} 
                          style={{ border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
                          title="Xem chi tiết bảng giá"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>

                        {/* Nút Sửa và Clone: CHỈ dành cho admin và sales_manager. Với accountant BỊ ẨN */}
                        {canManagePriceBooks && (
                          <>
                            {/* Nút Sửa (Edit): Bị disabled kèm Tooltip nếu is_locked == true */}
                            <button 
                              onClick={() => !isLocked && handleOpenEdit(pb.id)} 
                              disabled={isLocked}
                              style={{ 
                                border: '1px solid #cbd5e1', 
                                background: isLocked ? '#f1f5f9' : '#eff6ff', 
                                color: isLocked ? '#94a3b8' : '#2563eb', 
                                padding: '6px', 
                                borderRadius: '6px', 
                                cursor: isLocked ? 'not-allowed' : 'pointer', 
                                opacity: isLocked ? 0.45 : 1,
                                display: 'flex', 
                                alignItems: 'center' 
                              }} 
                              title={isLocked ? "Đã phát sinh giao dịch, không thể chỉnh sửa. Vui lòng nhân bản để tạo phiên bản mới." : "Chỉnh sửa bảng giá"}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>

                            {/* Nút Clone (Nhân bản): Luôn khả dụng cho sales_manager và admin */}
                            <button 
                              onClick={() => handleClonePriceBook(pb)} 
                              disabled={cloningId === pb.id}
                              style={{ 
                                border: '1px solid #86efac', 
                                background: '#f0fdf4', 
                                color: '#16a34a', 
                                padding: '6px', 
                                borderRadius: '6px', 
                                cursor: cloningId === pb.id ? 'wait' : 'pointer', 
                                display: 'flex', 
                                alignItems: 'center',
                                opacity: cloningId === pb.id ? 0.5 : 1
                              }} 
                              title="Tạo phiên bản mới (Clone)"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            </button>
                          </>
                        )}

                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredBooks.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                    <svg style={{ margin: '0 auto 12px', color: '#cbd5e1' }} xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <div style={{ fontSize: '15px', fontWeight: '500', color: '#64748b' }}>Không tìm thấy bảng giá nào phù hợp</div>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>Nhấn nút "Thêm Bảng giá" để tạo bảng giá mới</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Thêm mới / Chỉnh sửa */}
      {isFormModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '860px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  {selectedBook ? `Cập nhật Bảng Giá: ${selectedBook.code}` : 'Thêm mới Bảng Giá'}
                </h2>
                <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>
                  {selectedBook ? 'Điều chỉnh thông tin và danh sách sản phẩm bảng giá' : 'Khai báo bảng giá theo nhóm khách hàng và thời gian hiệu lực'}
                </p>
              </div>
              <button onClick={() => setIsFormModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Tab navigation */}
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
                  Tab 1: Thông tin chung
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
                  Tab 2: Danh sách sản phẩm ({formItems.length})
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                
                {activeTab === 'info' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Mã Bảng Giá <span style={{color: '#ef4444'}}>*</span></label>
                      <input 
                        required 
                        disabled={!!selectedBook} 
                        value={formData.code} 
                        onChange={e => setFormData({...formData, code: e.target.value})} 
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: selectedBook ? '#f1f5f9' : '#fff', boxSizing: 'border-box', fontSize: '14px' }} 
                        placeholder="VD: BG-DL1-2026"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Tên Bảng Giá <span style={{color: '#ef4444'}}>*</span></label>
                      <input 
                        required 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})} 
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', fontSize: '14px' }} 
                        placeholder="VD: Bảng giá Đại lý cấp 1 - Quý 4"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Nhóm Khách Hàng <span style={{color: '#ef4444'}}>*</span></label>
                      <select 
                        value={formData.customer_group} 
                        onChange={e => setFormData({...formData, customer_group: e.target.value})} 
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', boxSizing: 'border-box', fontSize: '14px' }}
                      >
                        <option value="Dai_ly_cap_1">Đại lý cấp 1</option>
                        <option value="Dai_ly_cap_2">Đại lý cấp 2</option>
                        <option value="Khach_le">Khách lẻ</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Trạng thái</label>
                      <select 
                        value={formData.status} 
                        onChange={e => setFormData({...formData, status: e.target.value})} 
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', boxSizing: 'border-box', fontSize: '14px' }}
                      >
                        <option value="ACTIVE">Hoạt động (Active)</option>
                        <option value="INACTIVE">Ngừng hoạt động (Inactive)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Ngày bắt đầu <span style={{color: '#ef4444'}}>*</span></label>
                      <input 
                        type="datetime-local" 
                        required 
                        value={formData.valid_from} 
                        onChange={e => setFormData({...formData, valid_from: e.target.value})} 
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box', fontSize: '14px' }} 
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#334155', fontSize: '13px' }}>Ngày kết thúc <span style={{color: '#ef4444'}}>*</span></label>
                      <input 
                        type="datetime-local" 
                        required 
                        min={formData.valid_from} 
                        value={formData.valid_to} 
                        onChange={e => setFormData({...formData, valid_to: e.target.value})} 
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
                        onChange={e => setFormData({...formData, note: e.target.value})} 
                        placeholder="Nhập ghi chú hoặc điều kiện áp dụng nếu có..."
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '80px', boxSizing: 'border-box', fontSize: '14px' }} 
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'items' && (
                  <div>
                    {/* Add product section */}
                    <div style={{ marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#475569', marginBottom: '10px' }}>THÊM SẢN PHẨM VÀO BẢNG GIÁ</div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select 
                          value={newProductId} 
                          onChange={e => handleProductSelect(e.target.value)} 
                          style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', minWidth: '260px', flex: 2, outline: 'none', fontSize: '14px', background: '#fff' }}
                        >
                          <option value="">-- Chọn Sản phẩm --</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.code} - {p.name} (Niêm yết: {(p.sell_price || 0).toLocaleString()} ₫)</option>
                          ))}
                        </select>
                        
                        <div style={{ position: 'relative', flex: 1, minWidth: '140px' }}>
                          <input 
                            type="number" 
                            placeholder="Giá bán..." 
                            value={newSalePrice} 
                            onChange={e => setNewSalePrice(e.target.value)} 
                            style={{ 
                              padding: '10px 12px 10px 30px', 
                              borderRadius: '8px', 
                              border: isAddingWarning ? '1.5px solid #ef4444' : '1px solid #cbd5e1', 
                              width: '100%', 
                              outline: 'none', 
                              boxSizing: 'border-box',
                              fontSize: '14px',
                              fontWeight: '600',
                              color: isAddingWarning ? '#ef4444' : '#0f172a'
                            }} 
                          />
                          <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8', fontSize: '13px' }}>₫</span>
                        </div>

                        <div style={{ position: 'relative', flex: 1, minWidth: '140px' }}>
                          <input 
                            type="number" 
                            placeholder="Giá sàn..." 
                            value={newFloorPrice} 
                            onChange={e => setNewFloorPrice(e.target.value)} 
                            style={{ 
                              padding: '10px 12px 10px 30px', 
                              borderRadius: '8px', 
                              border: '1px solid #cbd5e1', 
                              width: '100%', 
                              outline: 'none', 
                              boxSizing: 'border-box',
                              fontSize: '14px',
                              fontWeight: '600',
                              color: '#475569'
                            }} 
                          />
                          <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8', fontSize: '13px' }}>₫</span>
                        </div>

                        {/* Nút Thêm đồng bộ màu Xanh Primary #2563eb */}
                        <button 
                          type="button" 
                          onClick={addFormItem} 
                          style={{ 
                            background: '#2563eb', 
                            color: '#fff', 
                            border: 'none', 
                            padding: '10px 24px', 
                            borderRadius: '8px', 
                            cursor: 'pointer', 
                            fontWeight: '700',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          Thêm
                        </button>
                      </div>

                      {/* Cảnh báo nếu Giá bán < Giá sàn */}
                      {isAddingWarning && (
                        <div style={{ marginTop: '8px', color: '#ef4444', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                          Cảnh báo: Giá bán nhỏ hơn giá sàn! Đơn hàng phát sinh giá này sẽ phải qua Quản lý kinh doanh duyệt.
                        </div>
                      )}
                    </div>

                    {/* Products list table */}
                    <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f1f5f9' }}>
                          <tr>
                            <th style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '13px' }}>Mã SP</th>
                            <th style={{ padding: '12px 14px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '13px' }}>Tên Sản phẩm</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '13px' }}>Giá Bán (₫)</th>
                            <th style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '13px' }}>Giá Sàn (₫)</th>
                            <th style={{ padding: '12px 14px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '13px', width: '60px' }}>Xóa</th>
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
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <input 
                                      type="number" 
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
                                    {isBelowFloor && (
                                      <span title="Giá bán nhỏ hơn giá sàn quy định" style={{ color: '#ef4444' }}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                  <input 
                                    type="number" 
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
                                    style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                                    title="Xóa khỏi bảng giá"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {formItems.length === 0 && (
                            <tr>
                              <td colSpan={5} style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                                Chưa có sản phẩm nào trong bảng giá. Hãy chọn sản phẩm ở ô trên và nhấn "Thêm".
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
                  Hủy
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '14px', boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)' }}
                >
                  {selectedBook ? 'Lưu cập nhật' : 'Lưu Bảng Giá'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailModalOpen && selectedBook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{selectedBook.name}</h2>
                <div style={{ color: '#64748b', fontSize: '13px' }}>
                  Mã BG: <strong style={{color: '#0f172a', fontFamily: 'monospace'}}>{selectedBook.code}</strong> • Phiên bản: <strong style={{color: '#2563eb'}}>v{selectedBook.version || 1}</strong>
                </div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              {/* Information card */}
              <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '14px' }}>
                <div><span style={{color: '#64748b'}}>Nhóm khách hàng:</span> <strong>{formatGroupName(selectedBook.customer_group)}</strong></div>
                <div><span style={{color: '#64748b'}}>Trạng thái:</span> {renderStatusBadge(selectedBook)}</div>
                <div><span style={{color: '#64748b'}}>Ngày bắt đầu:</span> <strong>{new Date(selectedBook.valid_from).toLocaleString('vi-VN')}</strong></div>
                <div><span style={{color: '#64748b'}}>Ngày kết thúc:</span> <strong>{new Date(selectedBook.valid_to).toLocaleString('vi-VN')}</strong></div>
                <div>
                  <span style={{color: '#64748b'}}>Tình trạng chỉnh sửa:</span>{' '}
                  {selectedBook.is_locked ? (
                    <span style={{ color: '#b91c1c', fontWeight: '700' }}>🔒 Đã khóa (Đã phát sinh đơn hàng)</span>
                  ) : (
                    <span style={{ color: '#15803d', fontWeight: '600' }}>🔓 Cho phép chỉnh sửa</span>
                  )}
                </div>
                <div><span style={{color: '#64748b'}}>Người tạo:</span> <strong>{selectedBook.created_by || 'admin'}</strong></div>
                {selectedBook.note && <div style={{ gridColumn: '1 / -1' }}><span style={{color: '#64748b'}}>Ghi chú:</span> {selectedBook.note}</div>}
              </div>
              
              <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                Danh sách sản phẩm áp dụng ({selectedBook.items?.length || 0})
              </h3>
              
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f1f5f9' }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '13px' }}>Mã SP</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '13px' }}>Tên Sản phẩm</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '13px' }}>Giá Bán (₫)</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '13px' }}>Giá Sàn (₫)</th>
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
                            {salePrice ? Number(salePrice).toLocaleString() : '0'} ₫
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>
                            {floorPrice ? Number(floorPrice).toLocaleString() : '0'} ₫
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
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    Tạo phiên bản mới (Clone)
                  </button>
                )}
              </div>
              <button 
                onClick={() => setIsDetailModalOpen(false)} 
                style={{ padding: '9px 22px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: '600', color: '#475569', fontSize: '13px' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
