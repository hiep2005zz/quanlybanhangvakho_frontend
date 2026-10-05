import React, { useState, useEffect, useMemo } from 'react';
import {
  CategoryTreeResponse,
  CategorySalesReport,
  ProductItem,
  getCategoryTreeApi,
  createCategoryApi,
  updateCategoryApi,
  deleteCategoryApi,
  getCategorySalesReportApi,
  getProductsApi,
  moveProductCategoryApi
} from '../services/api';
import { emitStatusToast } from './StatusToast';

interface CategoryManagementViewProps {
  token: string;
  onBackToHome: () => void;
}

// Icons
const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);
const ChevronDown = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);
const FolderIcon = ({ open, color }: { open: boolean, color: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={open ? `${color}33` : "none"} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
  </svg>
);
const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>
);
const DragIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="5" r="1"></circle>
    <circle cx="9" cy="12" r="1"></circle>
    <circle cx="9" cy="19" r="1"></circle>
    <circle cx="15" cy="5" r="1"></circle>
    <circle cx="15" cy="12" r="1"></circle>
    <circle cx="15" cy="19" r="1"></circle>
  </svg>
);

export function CategoryManagementView({ token, onBackToHome }: CategoryManagementViewProps) {
  const [treeData, setTreeData] = useState<CategoryTreeResponse[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [salesReport, setSalesReport] = useState<CategorySalesReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMoving, setIsMoving] = useState(false);
  const [activeTab, setActiveTab] = useState<'manage' | 'report'>('manage');
  
  // Search & Selection State
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [productFilter, setProductFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [productSearch, setProductSearch] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', parent_id: '' });
  
  // Report Filter State
  const [reportPeriod, setReportPeriod] = useState<'today' | 'month' | 'quarter' | 'all'>('month');

  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      if (activeTab === 'manage') {
        const [catData, prodData] = await Promise.all([
          getCategoryTreeApi(token),
          getProductsApi(token)
        ]);
        setTreeData(catData);
        setProducts(prodData.items);
        
        // Only expand root nodes if not already expanded
        setExpandedNodes(prev => {
          if (prev.size === 0) {
            return new Set(catData.map(d => d.id));
          }
          return prev;
        });
      } else {
        const report = await getCategorySalesReportApi(token, reportPeriod);
        setSalesReport(report);
      }
    } catch (err: any) {
      emitStatusToast({ message: err.message || 'Lỗi tải dữ liệu', title: 'Lỗi' });
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, token, reportPeriod]);

  const toggleExpand = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteCategoryApi(token, deleteConfirmId);
      emitStatusToast({ message: 'Xóa nhóm hàng thành công', title: 'Thành công' });
      loadData(false);
      if (selectedCategoryId === deleteConfirmId) setSelectedCategoryId(null);
    } catch (err: any) {
      emitStatusToast({ message: err.message, title: 'Lỗi xóa' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        parent_id: formData.parent_id ? parseInt(formData.parent_id) : null
      };

      if (editingId) {
        await updateCategoryApi(token, editingId, payload);
        emitStatusToast({ message: 'Cập nhật nhóm hàng thành công', title: 'Thành công' });
      } else {
        await createCategoryApi(token, payload);
        emitStatusToast({ message: 'Tạo nhóm hàng thành công', title: 'Thành công' });
      }
      setIsModalOpen(false);
      loadData(false);
    } catch (err: any) {
      emitStatusToast({ message: err.message, title: 'Lỗi lưu' });
    }
  };

  // --- Drag & Drop Handlers ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, productId: number) => {
    e.dataTransfer.setData('productId', String(productId));
    e.dataTransfer.effectAllowed = 'move';
    
    // Create drag image effect
    const el = e.currentTarget;
    el.style.opacity = '0.5';
    setTimeout(() => { el.style.opacity = '1'; }, 0);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, color: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.style.backgroundColor = `${color}11`;
    e.currentTarget.style.transform = 'scale(1.01)';
    e.currentTarget.style.borderColor = color;
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, isSelected: boolean, baseBorderColor: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.backgroundColor = '#ffffff';
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.borderColor = isSelected ? baseBorderColor : '#f1f5f9';
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetCategoryId: number, categoryName: string, isSelected: boolean, baseBorderColor: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.style.backgroundColor = '#ffffff';
    e.currentTarget.style.transform = 'scale(1)';
    e.currentTarget.style.borderColor = isSelected ? baseBorderColor : '#f1f5f9';
    
    const productId = Number(e.dataTransfer.getData('productId'));
    if (!productId) return;
    
    const product = products.find(p => p.id === productId);
    if (!product || product.category_id === targetCategoryId) return;

    setIsMoving(true);
    try {
      await moveProductCategoryApi(token, productId, targetCategoryId);
      emitStatusToast({ message: `Đã đưa sản phẩm "${product.name}" vào nhóm "${categoryName}" thành công!`, title: 'Thành công' });
      // Cập nhật ngay lập tức category_id của sản phẩm đó trong state frontend (Optimistic Update)
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, category_id: targetCategoryId, category: categoryName } : p));
      
      // Không ép đổi setSelectedCategoryId(targetCategoryId) để giữ nguyên danh sách các sản phẩm còn lại cho người dùng xem và kéo tiếp
    } catch (err: any) {
      emitStatusToast({ message: err.message || 'Lỗi', title: 'Lỗi' });
    } finally {
      setIsMoving(false);
    }
  };

  // --- Filter tree data based on search term ---
  const filteredTreeData = useMemo(() => {
    if (!searchTerm.trim()) return treeData;
    const term = searchTerm.toLowerCase();

    const filterNodes = (nodes: CategoryTreeResponse[]): CategoryTreeResponse[] => {
      return nodes.map(node => {
        const subFiltered = node.sub_categories ? filterNodes(node.sub_categories) : [];
        const isMatch = node.name.toLowerCase().includes(term);
        
        if (isMatch || subFiltered.length > 0) {
          return { ...node, sub_categories: subFiltered };
        }
        return null;
      }).filter(Boolean) as CategoryTreeResponse[];
    };
    return filterNodes(treeData);
  }, [treeData, searchTerm]);

  // Tree View Renderer
  const renderTree = (nodes: CategoryTreeResponse[], level = 0) => {
    const levelColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
    const color = levelColors[Math.min(level, levelColors.length - 1)];

    return nodes.map(node => {
      const hasChildren = node.sub_categories && node.sub_categories.length > 0;
      const isExpanded = searchTerm.trim() ? true : expandedNodes.has(node.id);
      const isSelected = selectedCategoryId === node.id;
      
      return (
        <React.Fragment key={node.id}>
          <div 
            onClick={() => setSelectedCategoryId(prev => prev === node.id ? null : node.id)}
            onDragOver={(e) => handleDragOver(e, color)}
            onDragLeave={(e) => handleDragLeave(e, isSelected, color)}
            onDrop={(e) => handleDrop(e, node.id, node.name, isSelected, color)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '12px 16px',
              marginLeft: `${level * 28}px`,
              background: '#ffffff',
              borderRadius: '12px',
              border: `1px solid ${isSelected ? color : '#f1f5f9'}`,
              borderLeft: `5px solid ${color}`,
              boxShadow: isSelected ? `0 4px 12px ${color}22` : '0 1px 3px rgba(0,0,0,0.05)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '10px',
              position: 'relative',
              overflow: 'hidden'
            }}
            className="category-tree-card"
          >
            {isSelected && (
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '4px', background: color }}></div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Expand Toggle */}
              {hasChildren ? (
                <button 
                  onClick={(e) => toggleExpand(node.id, e)}
                  style={{ 
                    background: isExpanded ? `${color}11` : '#f1f5f9', 
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', 
                    color: color, padding: '6px', borderRadius: '8px', transition: 'all 0.2s'
                  }}
                >
                  {isExpanded ? <ChevronDown /> : <ChevronRight />}
                </button>
              ) : (
                <span style={{ width: '30px', display: 'inline-block' }}></span>
              )}
              
              {/* Icon & Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', fontWeight: isSelected ? '700' : '600' }}>
                <FolderIcon open={isExpanded} color={color} />
                <span style={{ fontSize: '15px' }}>{node.name}</span>
                <span style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '2px 8px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  ID: {node.id}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '8px' }} className="category-actions" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => {
                  setEditingId(null);
                  setFormData({ name: '', parent_id: String(node.id) });
                  setIsModalOpen(true);
                }}
                title="Thêm nhóm con"
                className="action-btn-add"
              >
                <PlusIcon /> Thêm Con
              </button>
              <button
                onClick={() => {
                  setEditingId(node.id);
                  setFormData({ name: node.name, parent_id: node.parent_id ? String(node.parent_id) : '' });
                  setIsModalOpen(true);
                }}
                title="Sửa nhóm"
                className="action-btn-edit"
              >
                <EditIcon /> Sửa
              </button>
              <button
                onClick={(e) => handleDelete(node.id, e)}
                title="Xóa nhóm"
                className="action-btn-del"
              >
                <TrashIcon /> Xóa
              </button>
            </div>
          </div>
          
          {/* Render Children if expanded */}
          {hasChildren && isExpanded && (
            <div style={{ animation: 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
              {renderTree(node.sub_categories, level + 1)}
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  // Kiểm tra sản phẩm đã được phân nhóm vào cây chưa
  const isProductUnassigned = (p: ProductItem) => {
    if (!p.category_id) return true;
    if (!p.category || p.category.trim() === '' || p.category === 'Chưa phân loại') return true;
    return false;
  };

  const unassignedCount = useMemo(() => {
    return products.filter(isProductUnassigned).length;
  }, [products]);

  const assignedCount = products.length - unassignedCount;

  const selectedCategoryName = useMemo(() => {
    if (!selectedCategoryId) return null;
    const findCatName = (nodes: CategoryTreeResponse[], id: number): string | null => {
      for (const n of nodes) {
        if (n.id === id) return n.name;
        if (n.sub_categories) {
          const found = findCatName(n.sub_categories, id);
          if (found) return found;
        }
      }
      return null;
    };
    return findCatName(treeData, selectedCategoryId);
  }, [selectedCategoryId, treeData]);

  // -- Render Right Panel (Products) --
  const displayedProducts = useMemo(() => {
    let list = products;

    if (selectedCategoryId) {
      list = list.filter(p => {
        if (p.category_id) return p.category_id === selectedCategoryId;
        if (selectedCategoryName && p.category === selectedCategoryName) return true;
        return false;
      });
    } else {
      if (productFilter === 'unassigned') {
        list = list.filter(isProductUnassigned);
      } else if (productFilter === 'assigned') {
        list = list.filter(p => !isProductUnassigned(p));
      }
    }

    if (productSearch.trim()) {
      const q = productSearch.toLowerCase().trim();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
      );
    }

    return list;
  }, [products, selectedCategoryId, selectedCategoryName, productFilter, productSearch]);

  const renderProductsList = () => {
    return (
      <div style={{ flex: '1', minWidth: '400px', maxWidth: '520px', background: '#ffffff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              Danh Sách Sản Phẩm
            </h3>
            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '700', background: '#e2e8f0', padding: '3px 10px', borderRadius: '12px' }}>
              {displayedProducts.length} / {products.length} SP
            </span>
          </div>
          <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#64748b' }}>
            <strong style={{ color: '#2563eb' }}>Kéo thả thẻ sản phẩm</strong> vào các nhánh ngành hàng bên trái để phân nhóm.
          </p>

          {/* Quick Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', background: '#e2e8f0', padding: '4px', borderRadius: '12px' }}>
            <button
              onClick={() => { setProductFilter('all'); setSelectedCategoryId(null); }}
              style={{
                flex: 1, padding: '7px 8px', borderRadius: '8px', border: 'none',
                background: (!selectedCategoryId && productFilter === 'all') ? '#ffffff' : 'transparent',
                color: (!selectedCategoryId && productFilter === 'all') ? '#0f172a' : '#64748b',
                fontWeight: (!selectedCategoryId && productFilter === 'all') ? '700' : '600',
                fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: (!selectedCategoryId && productFilter === 'all') ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Tất cả ({products.length})
            </button>
            <button
              onClick={() => { setProductFilter('unassigned'); setSelectedCategoryId(null); }}
              style={{
                flex: 1, padding: '7px 8px', borderRadius: '8px', border: 'none',
                background: (!selectedCategoryId && productFilter === 'unassigned') ? '#fef3c7' : 'transparent',
                color: (!selectedCategoryId && productFilter === 'unassigned') ? '#b45309' : (unassignedCount > 0 ? '#b45309' : '#64748b'),
                fontWeight: (!selectedCategoryId && productFilter === 'unassigned') ? '700' : '600',
                fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: (!selectedCategoryId && productFilter === 'unassigned') ? '0 1px 3px rgba(180,83,9,0.2)' : 'none'
              }}
            >
              Chưa gán ({unassignedCount})
            </button>
            <button
              onClick={() => { setProductFilter('assigned'); setSelectedCategoryId(null); }}
              style={{
                flex: 1, padding: '7px 8px', borderRadius: '8px', border: 'none',
                background: (!selectedCategoryId && productFilter === 'assigned') ? '#ffffff' : 'transparent',
                color: (!selectedCategoryId && productFilter === 'assigned') ? '#0f172a' : '#64748b',
                fontWeight: (!selectedCategoryId && productFilter === 'assigned') ? '700' : '600',
                fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.15s',
                boxShadow: (!selectedCategoryId && productFilter === 'assigned') ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Đã gán ({assignedCount})
            </button>
          </div>

          {/* Active Tree Category Filter Alert */}
          {selectedCategoryId && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: '#eff6ff', borderRadius: '10px',
              border: '1px solid #bfdbfe', marginBottom: '12px', fontSize: '13px', color: '#1e40af'
            }}>
              <div>
                Đang xem nhóm: <strong>{selectedCategoryName || `ID ${selectedCategoryId}`}</strong>
              </div>
              <button
                onClick={() => setSelectedCategoryId(null)}
                style={{
                  background: '#ffffff', border: '1px solid #93c5fd', borderRadius: '6px',
                  padding: '3px 8px', fontSize: '12px', color: '#1d4ed8', fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                ✕ Xem tất cả
              </button>
            </div>
          )}

          {/* Product Search Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Tìm theo tên hoặc mã SP..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 12px',
                borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px',
                outline: 'none', background: '#ffffff', color: '#0f172a'
              }}
            />
            {productSearch && (
              <button
                onClick={() => setProductSearch('')}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '14px'
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
        
        {/* Products List Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, maxHeight: 'calc(100vh - 350px)' }}>
          {displayedProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>
                {productFilter === 'unassigned' ? '🎉' : '📦'}
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#475569' }}>
                {productFilter === 'unassigned' 
                  ? 'Tuyệt vời! Tất cả sản phẩm đã được phân nhóm.' 
                  : 'Không có sản phẩm nào phù hợp'}
              </div>
              {selectedCategoryId && (
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  style={{
                    marginTop: '12px', padding: '6px 14px', borderRadius: '8px',
                    border: '1px solid #cbd5e1', background: '#ffffff', color: '#2563eb',
                    fontWeight: '600', fontSize: '13px', cursor: 'pointer'
                  }}
                >
                  Bỏ chọn nhóm để xem tất cả
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {displayedProducts.map(product => {
                const unassigned = isProductUnassigned(product);
                return (
                  <div
                    key={product.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, product.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 14px',
                      background: unassigned ? '#fffdf5' : '#ffffff',
                      border: `1px solid ${unassigned ? '#fde68a' : '#e2e8f0'}`,
                      borderRadius: '12px',
                      cursor: 'grab',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      opacity: isMoving ? 0.6 : 1
                    }}
                    className="product-drag-card"
                    title={`Kéo thả sản phẩm này vào ngành hàng bên trái (ID: ${product.id})`}
                  >
                    <div style={{ cursor: 'grab', color: unassigned ? '#d97706' : '#94a3b8', padding: '2px' }}>
                      <DragIcon />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginBottom: '4px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {product.name}
                        </div>
                        {unassigned ? (
                          <span style={{
                            fontSize: '11px', fontWeight: '700', color: '#b45309',
                            background: '#fef3c7', border: '1px solid #fde68a',
                            padding: '2px 6px', borderRadius: '6px', whiteSpace: 'nowrap'
                          }}>
                            Chưa gán
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px', fontWeight: '600', color: '#0369a1',
                            background: '#e0f2fe', border: '1px solid #bae6fd',
                            padding: '2px 6px', borderRadius: '6px', whiteSpace: 'nowrap',
                            maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            📁 {product.category || 'Đã phân nhóm'}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                        <span>
                          <span style={{ color: '#94a3b8' }}>Mã:</span> <strong style={{ color: '#334155' }}>{product.code}</strong>
                        </span>
                        <span>
                          <span style={{ color: '#94a3b8' }}>Kho:</span> <strong style={{ color: '#059669' }}>{product.stock}</strong>
                        </span>
                        <span>
                          <span style={{ color: '#94a3b8' }}>ĐVT:</span> <strong style={{ color: '#475569' }}>{product.base_unit || 'Cái'}</strong>
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#2563eb', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      {product.sell_price.toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderReport = () => {
    const rootCategories = salesReport.filter(r => !r.parent_id);
    const totalSales = rootCategories.reduce((sum, item) => sum + item.total_sales, 0);
    const topCategory = rootCategories.length > 0 
      ? rootCategories.reduce((max, item) => item.total_sales > max.total_sales ? item : max, rootCategories[0])
      : null;

    const buildReportHierarchy = (parentId: number | null = null, level = 0): React.ReactNode[] => {
      const children = salesReport.filter(r => r.parent_id === parentId);
      let rows: React.ReactNode[] = [];
      
      children.forEach(item => {
        const hasChildren = salesReport.some(r => r.parent_id === item.id);
        rows.push(
          <tr key={`rep-${item.id}`} style={{ 
            background: level === 0 ? '#f8fafc' : '#ffffff', 
            borderBottom: '1px solid #e2e8f0',
            transition: 'background 0.2s'
          }}>
            <td style={{ 
              padding: `14px 16px 14px ${24 + level * 40}px`, 
              color: level === 0 ? '#0f172a' : (level === 1 ? '#334155' : '#475569'),
              fontWeight: level === 0 ? '700' : (level === 1 ? '600' : '500'),
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              position: 'relative'
            }}>
              {level > 0 && (
                <>
                  <div style={{ position: 'absolute', left: `${24 + (level - 1) * 40 + 11}px`, top: '-14px', bottom: '50%', width: '2px', background: '#e2e8f0' }}></div>
                  <div style={{ position: 'absolute', left: `${24 + (level - 1) * 40 + 11}px`, top: '50%', width: '20px', height: '2px', background: '#e2e8f0' }}></div>
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', background: hasChildren ? '#eff6ff' : '#f8fafc', borderRadius: '6px', color: hasChildren ? '#3b82f6' : '#94a3b8', zIndex: 1, border: hasChildren ? '1px solid #bfdbfe' : '1px solid #e2e8f0' }}>
                {hasChildren ? <ChevronDown /> : <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#cbd5e1' }}></span>}
              </div>
              <span style={{ fontSize: level === 0 ? '15px' : '14.5px' }}>{item.name}</span>
            </td>
            <td style={{ padding: '14px 16px', textAlign: 'right', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
              {item.direct_sales > 0 ? `${item.direct_sales.toLocaleString('vi-VN')} ₫` : '-'}
            </td>
            <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: level === 0 ? '800' : '600', color: level === 0 ? '#1d4ed8' : '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
              {item.total_sales > 0 ? `${item.total_sales.toLocaleString('vi-VN')} ₫` : '0 ₫'}
            </td>
          </tr>
        );
        if (hasChildren) {
          rows = rows.concat(buildReportHierarchy(item.id, level + 1));
        }
      });
      return rows;
    };

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        {/* KPI Dashboard Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', padding: '24px', borderRadius: '20px', border: '1px solid #bfdbfe', boxShadow: '0 10px 25px -5px rgba(37,99,235,0.1)' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#1e3a8a', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Tổng doanh số toàn ngành</h4>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#1e40af', letterSpacing: '-0.02em' }}>
              {totalSales.toLocaleString('vi-VN')} <span style={{ fontSize: '18px' }}>VNĐ</span>
            </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', padding: '24px', borderRadius: '20px', border: '1px solid #bbf7d0', boxShadow: '0 10px 25px -5px rgba(22,163,74,0.1)' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#14532d', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Ngành hàng nổi bật</h4>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#166534', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {topCategory ? topCategory.name : 'Chưa có'}
            </div>
            <div style={{ fontSize: '14px', color: '#15803d', marginTop: '6px', fontWeight: '600' }}>
              {topCategory ? `Đạt ${topCategory.total_sales.toLocaleString('vi-VN')} VNĐ` : '0 VNĐ'}
            </div>
          </div>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Quy mô cấu trúc</h4>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a' }}>{salesReport.length}</span>
              <span style={{ fontSize: '15px', color: '#64748b', fontWeight: '500' }}>nhóm hàng & phân mục</span>
            </div>
          </div>
        </div>

        {/* Report Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0 }}>Chi tiết phân bổ doanh số</h3>
          
          <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '6px', borderRadius: '16px' }}>
            {['today', 'month', 'quarter', 'all'].map(period => {
              const labels: any = { today: 'Hôm nay', month: 'Tháng này', quarter: 'Quý này', all: 'Tất cả' };
              const isActive = reportPeriod === period;
              return (
                <button
                  key={period}
                  onClick={() => setReportPeriod(period as any)}
                  style={{
                    padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: '600',
                    background: isActive ? '#fff' : 'transparent',
                    color: isActive ? '#0f172a' : '#64748b',
                    border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                    boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  {labels[period]}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: '700' }}>Ngành Hàng / Nhóm Hàng</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700' }}>Doanh số trực tiếp</th>
                <th style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '700' }}>Tổng doanh số</th>
              </tr>
            </thead>
            <tbody>
              {salesReport.length === 0 ? (
                <tr><td colSpan={3} style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Chưa có dữ liệu thống kê phù hợp với bộ lọc</td></tr>
              ) : (
                buildReportHierarchy()
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        .category-tree-card:hover { transform: translateX(2px); box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important; }
        .product-drag-card:hover { transform: translateY(-2px); box-shadow: 0 6px 12px rgba(0,0,0,0.08) !important; border-color: #cbd5e1 !important; }
        .product-drag-card:active { cursor: grabbing !important; transform: scale(0.98); }
        .action-btn-add { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 10px; height: 32px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s; background: #dcfce7; color: #16a34a; font-weight: 600; font-size: 13px; }
        .action-btn-add:hover { background: #bbf7d0; transform: scale(1.05); }
        .action-btn-edit { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 10px; height: 32px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s; background: #fef3c7; color: #d97706; font-weight: 600; font-size: 13px; }
        .action-btn-edit:hover { background: #fde68a; transform: scale(1.05); }
        .action-btn-del { display: flex; align-items: center; justify-content: center; gap: 4px; padding: 0 10px; height: 32px; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s; background: #fee2e2; color: #dc2626; font-weight: 600; font-size: 13px; }
        .action-btn-del:hover { background: #fecaca; transform: scale(1.05); }
        .back-btn:hover { background: #f8fafc !important; border-color: #94a3b8 !important; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={onBackToHome}
            className="back-btn"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '0 16px', height: '42px', borderRadius: '12px',
              border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer',
              color: '#334155', fontWeight: '600', fontSize: '14.5px', transition: 'all 0.2s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            Quay lại kho
          </button>
          <div>
            <h2 style={{ fontSize: '30px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Quản Lý Ngành Hàng & Doanh Số
            </h2>
            <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '15px' }}>Tổ chức cấu trúc sản phẩm và theo dõi hiệu suất bán hàng chi tiết</p>
          </div>
        </div>
      </div>

      {/* Modern Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
        <button
          onClick={() => setActiveTab('manage')}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 28px', borderRadius: '16px', fontWeight: '700', fontSize: '15px',
            background: activeTab === 'manage' ? '#2563eb' : '#fff',
            color: activeTab === 'manage' ? '#fff' : '#64748b',
            border: activeTab === 'manage' ? 'none' : '1px solid #e2e8f0',
            cursor: 'pointer', transition: 'all 0.2s ease',
            boxShadow: activeTab === 'manage' ? '0 8px 20px -6px rgba(37,99,235,0.4)' : '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
          </svg>
          Sơ Đồ Ngành Hàng
        </button>
        <button
          onClick={() => setActiveTab('report')}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '12px 28px', borderRadius: '16px', fontWeight: '700', fontSize: '15px',
            background: activeTab === 'report' ? '#2563eb' : '#fff',
            color: activeTab === 'report' ? '#fff' : '#64748b',
            border: activeTab === 'report' ? 'none' : '1px solid #e2e8f0',
            cursor: 'pointer', transition: 'all 0.2s ease',
            boxShadow: activeTab === 'report' ? '0 8px 20px -6px rgba(37,99,235,0.4)' : '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="20" x2="12" y2="10"></line>
            <line x1="18" y1="20" x2="18" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="16"></line>
          </svg>
          Báo Cáo Doanh Thu
        </button>
      </div>

      {/* Main Content Area */}
      <div style={{ minHeight: '600px' }}>
        {activeTab === 'manage' && (
          <div style={{ animation: 'fadeIn 0.3s ease', display: 'flex', gap: '28px', alignItems: 'flex-start' }}>
            
            {/* Left: Category Tree */}
            <div style={{ flex: '1', minWidth: '400px', background: '#f8fafc', borderRadius: '24px', padding: '28px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ position: 'relative', width: '320px' }}>
                  <span style={{ position: 'absolute', left: '16px', top: '12px', color: '#94a3b8' }}><SearchIcon /></span>
                  <input 
                    type="text" 
                    placeholder="Tìm nhanh ngành hàng, nhóm hàng..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px 12px 44px', borderRadius: '14px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'border 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                  />
                </div>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setFormData({ name: '', parent_id: '' });
                    setIsModalOpen(true);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 24px', borderRadius: '14px', fontWeight: '700', fontSize: '14px',
                    background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)', transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  <PlusIcon /> Thêm Ngành Hàng
                </button>
              </div>
              
              <div>
                {isLoading ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                    <div style={{ fontSize: '14.5px', fontWeight: '500' }}>Đang nạp cấu trúc ngành hàng...</div>
                  </div>
                ) : filteredTreeData.length === 0 ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '14.5px' }}>
                    Không tìm thấy ngành hàng / nhóm hàng nào phù hợp.
                  </div>
                ) : (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                    {renderTree(filteredTreeData)}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Product Drag-Drop List */}
            {renderProductsList()}
            
          </div>
        )}

        {activeTab === 'report' && (
          <div>
            {isLoading ? (
              <div style={{ padding: '80px', textAlign: 'center', color: '#64748b', background: '#fff', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>📊</div>
                <div style={{ fontSize: '16px', fontWeight: '500' }}>Đang phân tích báo cáo doanh số...</div>
              </div>
            ) : renderReport()}
          </div>
        )}
      </div>

      {/* Modal - Premium Design */}
      {isModalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ background: '#fff', padding: '40px', borderRadius: '24px', width: '480px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '8px', fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
              {editingId ? 'Cập nhật thông tin' : 'Thêm mới Ngành Hàng / Nhóm Hàng'}
            </h3>
            <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '32px' }}>Điền thông tin chi tiết để quản lý hệ sinh thái hàng hóa.</p>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>Tên ngành hàng / loại sản phẩm <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đồ điện gia dụng, Áo Thun Nam..."
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>
              <div style={{ marginBottom: '36px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>Trực thuộc ngành hàng lớn (Tùy chọn)</label>
                <select
                  value={formData.parent_id}
                  onChange={e => setFormData({ ...formData, parent_id: e.target.value })}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: '#f8fafc' }}
                >
                  <option value="">-- Cấp cao nhất (Ngành Hàng Gốc) --</option>
                  {
                    (function flattenTree(nodes: CategoryTreeResponse[], level = 0): React.ReactNode[] {
                      let res: React.ReactNode[] = [];
                      nodes.forEach(n => {
                        if (editingId && n.id === editingId) return; 
                        res.push(<option key={n.id} value={n.id}>{'\u00A0'.repeat(level * 4)}↳ {n.name}</option>);
                        if (n.sub_categories) res = res.concat(flattenTree(n.sub_categories, level + 1));
                      });
                      return res;
                    })(treeData)
                  }
                </select>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#94a3b8' }}>Để trống nếu đây là cấp cao nhất.</p>
              </div>
              
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '14px 24px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700', color: '#475569', cursor: 'pointer', flex: 1, fontSize: '15px' }}>Hủy Bỏ</button>
                <button type="submit" style={{ padding: '14px 24px', borderRadius: '12px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '800', cursor: 'pointer', flex: 1, boxShadow: '0 4px 12px rgba(37,99,235,0.3)', fontSize: '15px' }}>Lưu Thông Tin</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '24px', width: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', background: '#fee2e2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: '#ef4444' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>Xác nhận xóa</h3>
            <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '32px', lineHeight: '1.6' }}>
              Bạn có chắc chắn muốn xóa nhóm hàng này không? Việc xóa sẽ thất bại nếu đang có nhóm con hoặc chứa sản phẩm.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button type="button" onClick={() => setDeleteConfirmId(null)} style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: '700', color: '#475569', cursor: 'pointer', flex: 1, fontSize: '15px', transition: 'all 0.2s' }}>Hủy Bỏ</button>
              <button type="button" onClick={confirmDelete} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: '700', cursor: 'pointer', flex: 1, boxShadow: '0 4px 12px rgba(239,68,68,0.3)', fontSize: '15px', transition: 'all 0.2s' }}>Xác Nhận Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
