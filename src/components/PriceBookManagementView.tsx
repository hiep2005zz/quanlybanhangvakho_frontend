import React, { useState, useEffect, useMemo } from 'react';
import { 
  PriceBook, 
  fetchPriceBooksApi, 
  createPriceBookApi,
  updatePriceBookApi,
  fetchPriceBookDetailApi,
  PriceBookItem,
  getProductsApi,
  ProductItem
} from '../services/api';
import { emitStatusToast } from './StatusToast';


interface PriceBookManagementViewProps {
  token: string;
}

export function PriceBookManagementView({ token }: PriceBookManagementViewProps) {
  const [priceBooks, setPriceBooks] = useState<PriceBook[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  
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
    customer_group: 'CAP_1',
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
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  const loadPriceBooks = async () => {
    setLoading(true);
    try {
      const data = await fetchPriceBooksApi(token, {
        customer_group: filterGroup || undefined,
        status_filter: filterStatus || undefined
      });
      setPriceBooks(data);
    } catch (err: any) {
      emitStatusToast({ message: err.message, title: 'Lỗi tải danh sách' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPriceBooks();
  }, [filterGroup, filterStatus]);

  const filteredBooks = useMemo(() => {
    let result = priceBooks;
    if (debouncedSearch) {
      const lowerQ = debouncedSearch.toLowerCase();
      result = result.filter(pb => pb.code.toLowerCase().includes(lowerQ) || pb.name.toLowerCase().includes(lowerQ));
    }
    return result;
  }, [priceBooks, debouncedSearch]);

  const handleOpenCreate = () => {
    setSelectedBook(null);
    setFormData({
      code: '', name: '', customer_group: 'CAP_1', 
      valid_from: new Date().toISOString().slice(0, 16), 
      valid_to: new Date(Date.now() + 30*24*60*60*1000).toISOString().slice(0, 16),
      status: 'ACTIVE', note: ''
    });
    setFormItems([]);
    setActiveTab('info');
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = async (id: number) => {
    try {
      const detail = await fetchPriceBookDetailApi(token, id);
      setSelectedBook(detail);
      setFormData({
        code: detail.code,
        name: detail.name,
        customer_group: detail.customer_group,
        valid_from: detail.valid_from.slice(0, 16),
        valid_to: detail.valid_to.slice(0, 16),
        status: detail.status,
        note: detail.note || ''
      });
      setFormItems(detail.items || []);
      setActiveTab('info');
      setIsFormModalOpen(true);
    } catch (err: any) {
      emitStatusToast({ message: err.message, title: 'Lỗi' });
    }
  };

  const handleOpenDetail = async (id: number) => {
    try {
      const detail = await fetchPriceBookDetailApi(token, id);
      setSelectedBook(detail);
      setIsDetailModalOpen(true);
    } catch (err: any) {
      emitStatusToast({ message: err.message, title: 'Lỗi' });
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formItems.length === 0) {
      emitStatusToast({ message: 'Vui lòng thêm ít nhất 1 sản phẩm vào bảng giá' });
      setActiveTab('items');
      return;
    }

    // Validation
    if (new Date(formData.valid_to) < new Date(formData.valid_from)) {
      emitStatusToast({ message: 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu' });
      setActiveTab('info');
      return;
    }

    try {
      const formattedValidFrom = new Date(formData.valid_from).toISOString();
      const formattedValidTo = new Date(formData.valid_to).toISOString();

      if (selectedBook) {
        await updatePriceBookApi(token, selectedBook.id, {
          name: formData.name,
          valid_from: formattedValidFrom,
          valid_to: formattedValidTo,
          status: formData.status,
          note: formData.note,
          items: formItems.map(item => ({
            product_id: item.product_id,
            price: item.price,
            min_price: item.min_price,
            sale_price: item.sale_price,
            floor_price: item.floor_price
          }))
        });
        emitStatusToast({ message: 'Cập nhật thành công' });
      } else {
        await createPriceBookApi(token, {
          ...formData,
          valid_from: formattedValidFrom,
          valid_to: formattedValidTo,
          items: formItems.map(item => ({
            product_id: item.product_id,
            price: item.price,
            min_price: item.min_price,
            sale_price: item.sale_price,
            floor_price: item.floor_price
          }))
        });
        emitStatusToast({ message: 'Tạo bảng giá thành công' });
      }
      setIsFormModalOpen(false);
      loadPriceBooks();
    } catch (err: any) {
      emitStatusToast({ message: err.message, title: 'Thất bại' });
    }
  };

  const addFormItem = () => {
    const pid = parseInt(newProductId);
    const sp = parseFloat(newSalePrice);
    const fp = parseFloat(newFloorPrice);
    if (!pid) {
      emitStatusToast({ message: 'Vui lòng chọn sản phẩm' });
      return;
    }
    
    if (formItems.some(i => i.product_id === pid)) {
      emitStatusToast({ message: 'Sản phẩm này đã có trong danh sách' });
      return;
    }
    
    const prod = products.find(p => p.id === pid);
    
    setFormItems([{ 
      product_id: pid, 
      product_code: prod?.code,
      product_name: prod?.name,
      price: 0, 
      min_price: 0, 
      sale_price: isNaN(sp) ? 0 : sp, 
      floor_price: isNaN(fp) ? 0 : fp 
    }, ...formItems]);
    setNewProductId('');
    setNewSalePrice('');
    setNewFloorPrice('');
  };

  const removeFormItem = (pid: number) => {
    setFormItems(formItems.filter(i => i.product_id !== pid));
  };

  const handleInlineEdit = (pid: number, field: 'price' | 'min_price' | 'sale_price' | 'floor_price', val: string) => {
    const num = val === '' ? 0 : parseFloat(val);
    if (val !== '' && isNaN(num)) return;
    setFormItems(formItems.map(item => item.product_id === pid ? { ...item, [field]: num } : item));
  };

  const renderStatusBadge = (pb: PriceBook) => {
    if (pb.status === 'INACTIVE') {
      return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', background: '#f1f5f9', color: '#64748b' }}>Ngừng HĐ</span>;
    }
    const now = new Date();
    if (new Date(pb.valid_to) < now) {
      return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', background: '#f1f5f9', color: '#64748b' }}>Hết hạn</span>;
    }
    if (new Date(pb.valid_from) > now) {
      return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', background: '#e0f2fe', color: '#0369a1' }}>Chờ áp dụng</span>;
    }
    return <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600', background: '#dcfce3', color: '#166534' }}>Đang áp dụng</span>;
  };

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => window.location.href = '/'}
            style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}
            title="Quay lại trang chủ"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Trang chủ
          </button>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Quản lý Bảng giá</h1>
        </div>
        <button 
          onClick={handleOpenCreate}
          style={{ background: '#2563eb', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Thêm Bảng giá
        </button>
      </div>

      <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            placeholder="Tìm theo Mã hoặc Tên Bảng Giá..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minWidth: '200px' }}>
          <option value="">-- Tất cả nhóm khách hàng --</option>
          <option value="CAP_1">Đại lý cấp 1</option>
          <option value="CAP_2">Đại lý cấp 2</option>
          <option value="RETAIL">Khách lẻ</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minWidth: '180px' }}>
          <option value="">-- Tất cả trạng thái --</option>
          <option value="ACTIVE">Đang hoạt động</option>
          <option value="INACTIVE">Ngừng hoạt động</option>
        </select>
      </div>

      <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Đang tải...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Mã BG</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Tên Bảng Giá</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Nhóm KH</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Thời hạn</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '600', color: '#475569' }}>Trạng thái</th>
                <th style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '600', color: '#475569' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredBooks.map(pb => (
                <tr key={pb.id} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s' }} className="hover:bg-slate-50">
                  <td style={{ padding: '14px 16px', color: '#0f172a', fontWeight: '600' }}>{pb.code}</td>
                  <td style={{ padding: '14px 16px', color: '#334155' }}>
                    <div onClick={() => handleOpenDetail(pb.id)} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: '500' }} title="Xem chi tiết">
                      {pb.name}
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#334155' }}>
                    <span style={{ padding: '2px 8px', background: '#e0e7ff', color: '#3730a3', borderRadius: '12px', fontSize: '12px', fontWeight: '500' }}>
                      {pb.customer_group === 'CAP_1' ? 'Đại lý cấp 1' : pb.customer_group === 'CAP_2' ? 'Đại lý cấp 2' : 'Khách lẻ'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#475569', fontSize: '14px' }}>
                    {new Date(pb.valid_from).toLocaleDateString('vi-VN')} - {new Date(pb.valid_to).toLocaleDateString('vi-VN')}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    {renderStatusBadge(pb)}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right', display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button onClick={() => handleOpenDetail(pb.id)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }} title="Xem chi tiết">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button onClick={() => handleOpenEdit(pb.id)} style={{ border: 'none', background: 'none', color: '#2563eb', cursor: 'pointer' }} title="Sửa Bảng giá">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredBooks.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
                    <svg style={{ margin: '0 auto 12px', color: '#cbd5e1' }} xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <div>Chưa có dữ liệu bảng giá</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Form Modal (Tạo / Sửa) */}
      {isFormModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '850px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>{selectedBook ? 'Cập nhật Bảng Giá' : 'Thêm mới Bảng Giá'}</h2>
              <button onClick={() => setIsFormModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div onClick={() => setActiveTab('info')} style={{ paddingBottom: '12px', cursor: 'pointer', fontWeight: '600', color: activeTab === 'info' ? '#2563eb' : '#64748b', borderBottom: activeTab === 'info' ? '2px solid #2563eb' : '2px solid transparent' }}>
                  1. Thông tin chung
                </div>
                <div onClick={() => setActiveTab('items')} style={{ paddingBottom: '12px', cursor: 'pointer', fontWeight: '600', color: activeTab === 'items' ? '#2563eb' : '#64748b', borderBottom: activeTab === 'items' ? '2px solid #2563eb' : '2px solid transparent' }}>
                  2. Danh sách sản phẩm áp dụng
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                
                {activeTab === 'info' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Mã Bảng Giá <span style={{color: '#ef4444'}}>*</span></label>
                      <input required disabled={!!selectedBook} value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: selectedBook ? '#f8fafc' : '#fff', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Tên Bảng Giá <span style={{color: '#ef4444'}}>*</span></label>
                      <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Nhóm Khách Hàng <span style={{color: '#ef4444'}}>*</span></label>
                      <select disabled={!!selectedBook} value={formData.customer_group} onChange={e => setFormData({...formData, customer_group: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: selectedBook ? '#f8fafc' : '#fff', boxSizing: 'border-box' }}>
                        <option value="CAP_1">Đại lý cấp 1</option>
                        <option value="CAP_2">Đại lý cấp 2</option>
                        <option value="RETAIL">Khách lẻ</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Trạng thái</label>
                      <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}>
                        <option value="ACTIVE">Hoạt động</option>
                        <option value="INACTIVE">Ngừng hoạt động</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Ngày bắt đầu <span style={{color: '#ef4444'}}>*</span></label>
                      <input type="datetime-local" required value={formData.valid_from} onChange={e => setFormData({...formData, valid_from: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Ngày kết thúc <span style={{color: '#ef4444'}}>*</span></label>
                      <input type="datetime-local" required min={formData.valid_from} value={formData.valid_to} onChange={e => setFormData({...formData, valid_to: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#475569', fontSize: '14px' }}>Ghi chú</label>
                      <textarea value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minHeight: '80px', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                )}

                {activeTab === 'items' && (
                  <div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <select value={newProductId} onChange={e => setNewProductId(e.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '250px', outline: 'none' }}>
                        <option value="">-- Chọn Sản phẩm --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                        ))}
                      </select>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input type="number" placeholder="Giá bán..." value={newSalePrice} onChange={e => setNewSalePrice(e.target.value)} style={{ padding: '10px 12px 10px 30px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
                        <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>₫</span>
                      </div>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input type="number" placeholder="Giá sàn..." value={newFloorPrice} onChange={e => setNewFloorPrice(e.target.value)} style={{ padding: '10px 12px 10px 30px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', outline: 'none', boxSizing: 'border-box' }} />
                        <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}>₫</span>
                      </div>
                      <button type="button" onClick={addFormItem} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Thêm</button>
                    </div>

                    <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f1f5f9' }}>
                          <tr>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>Mã SP</th>
                            <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>Tên SP</th>
                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>Giá Bán (₫)</th>
                            <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>Giá Sàn (₫)</th>
                            <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>Xóa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formItems.map(item => {
                            const isWarning = (item.sale_price || 0) < (item.floor_price || 0);
                            return (
                              <tr key={item.product_id} style={{ background: isWarning ? '#fef2f2' : 'transparent' }}>
                                <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', fontWeight: '500' }}>{item.product_code || `#${item.product_id}`}</td>
                                <td style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', fontWeight: '500' }}>{item.product_name || '-'}</td>
                                <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0' }}>
                                  <input 
                                    type="number" 
                                    value={item.sale_price || ''}
                                    onChange={(e) => handleInlineEdit(item.product_id, 'sale_price', e.target.value)}
                                    style={{ textAlign: 'right', width: '120px', padding: '6px 8px', borderRadius: '4px', border: isWarning ? '1px solid #ef4444' : '1px solid transparent', outline: 'none', background: 'transparent', fontWeight: '500', color: isWarning ? '#ef4444' : '#0f172a' }}
                                  />
                                </td>
                                <td style={{ padding: '8px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', position: 'relative' }}>
                                  <input 
                                    type="number" 
                                    value={item.floor_price || ''}
                                    onChange={(e) => handleInlineEdit(item.product_id, 'floor_price', e.target.value)}
                                    style={{ textAlign: 'right', width: '100px', padding: '6px 8px', borderRadius: '4px', border: '1px solid transparent', outline: 'none', background: 'transparent', fontWeight: '500', color: '#475569' }}
                                  />
                                  {isWarning && (
                                    <span title="Giá bán nhỏ hơn giá sàn" style={{ position: 'absolute', right: '4px', top: '14px', color: '#ef4444' }}>
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                    </span>
                                  )}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0' }}>
                                  <button type="button" onClick={() => removeFormItem(item.product_id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {formItems.length === 0 && <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>Chưa có sản phẩm nào. Vui lòng thêm sản phẩm ở trên.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={() => setIsFormModalOpen(false)} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: '600', color: '#475569' }}>Hủy</button>
                <button type="submit" style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: '600' }}>Lưu Bảng Giá</button>
              </div>
            </form>
          </div>
        </div>
      )}



      {/* Detail Modal */}
      {isDetailModalOpen && selectedBook && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '750px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>{selectedBook.name}</h2>
                <div style={{ color: '#64748b', fontSize: '14px' }}>Mã: <strong style={{color: '#0f172a'}}>{selectedBook.code}</strong></div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div><span style={{color: '#64748b'}}>Nhóm KH:</span> <strong style={{color: '#0f172a'}}>{selectedBook.customer_group === 'CAP_1' ? 'Đại lý cấp 1' : selectedBook.customer_group === 'CAP_2' ? 'Đại lý cấp 2' : 'Khách lẻ'}</strong></div>
                <div><span style={{color: '#64748b'}}>Trạng thái:</span> {renderStatusBadge(selectedBook)}</div>
                <div><span style={{color: '#64748b'}}>Từ ngày:</span> <strong style={{color: '#0f172a'}}>{new Date(selectedBook.valid_from).toLocaleString('vi-VN')}</strong></div>
                <div><span style={{color: '#64748b'}}>Đến ngày:</span> <strong style={{color: '#0f172a'}}>{new Date(selectedBook.valid_to).toLocaleString('vi-VN')}</strong></div>
                {selectedBook.note && <div style={{ gridColumn: '1 / -1' }}><span style={{color: '#64748b'}}>Ghi chú:</span> {selectedBook.note}</div>}
              </div>
              
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>Sản phẩm áp dụng ({selectedBook.items?.length || 0})</h3>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ background: '#f1f5f9' }}>
                    <tr>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '14px' }}>Mã SP</th>
                      <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '14px' }}>Tên Sản phẩm</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '14px' }}>Giá Bán</th>
                      <th style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', fontSize: '14px' }}>Giá Sàn</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedBook.items?.map((item: PriceBookItem) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px', fontWeight: '500' }}>{item.product_code || `#${item.product_id}`}</td>
                        <td style={{ padding: '12px' }}>{item.product_name || '-'}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#166534', fontWeight: '600' }}>{item.sale_price ? item.sale_price.toLocaleString() : '-'} ₫</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#475569', fontWeight: '600' }}>{item.floor_price ? item.floor_price.toLocaleString() : '-'} ₫</td>
                      </tr>
                    ))}
                    {!selectedBook.items?.length && (
                      <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Chưa có sản phẩm.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setIsDetailModalOpen(false)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: '600', color: '#475569' }}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
