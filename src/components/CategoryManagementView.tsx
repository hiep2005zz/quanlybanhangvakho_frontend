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
  onBackToHome?: () => void;
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

export function CategoryManagementView({ token, onBackToHome: _onBackToHome }: CategoryManagementViewProps) {
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
        emitStatusToast({ message: 'Cập nhật thành công', title: 'Thành công' });
      } else {
        await createCategoryApi(token, payload);
        emitStatusToast({ 
          message: formData.parent_id ? 'Tạo phân loại mới thành công' : 'Tạo nhóm hàng mới thành công', 
          title: 'Thành công' 
        });
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
    const levelColors = ['#2563eb', '#059669', '#d97706', '#7c3aed'];
    const color = levelColors[Math.min(level, levelColors.length - 1)];

    return nodes.map(node => {
      const hasChildren = node.sub_categories && node.sub_categories.length > 0;
      const isExpanded = searchTerm.trim() ? true : expandedNodes.has(node.id);
      const isSelected = selectedCategoryId === node.id;
      const prodCount = categoryProductCountMap.get(node.id) || 0;
      
      return (
        <React.Fragment key={node.id}>
          <div 
            onClick={() => setSelectedCategoryId(prev => prev === node.id ? null : node.id)}
            onDragOver={(e) => handleDragOver(e, color)}
            onDragLeave={(e) => handleDragLeave(e, isSelected, '#e2e8f0')}
            onDrop={(e) => handleDrop(e, node.id, node.name, isSelected, '#e2e8f0')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '9px 12px',
              marginLeft: `${level * 20}px`,
              background: isSelected ? '#eff6ff' : '#ffffff',
              borderRadius: '8px',
              border: `1px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
              borderLeft: `4px solid ${isSelected ? '#2563eb' : color}`,
              boxShadow: isSelected ? '0 2px 6px rgba(37,99,235,0.12)' : '0 1px 2px rgba(0,0,0,0.03)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginBottom: '6px',
              position: 'relative',
              overflow: 'hidden'
            }}
            className="category-tree-card"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
              {/* Expand Toggle */}
              {hasChildren ? (
                <button 
                  onClick={(e) => toggleExpand(node.id, e)}
                  style={{ 
                    background: isExpanded ? `${color}15` : '#f1f5f9', 
                    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: color, width: '22px', height: '22px', borderRadius: '6px', transition: 'all 0.15s', flexShrink: 0
                  }}
                  title={isExpanded ? "Thu gọn" : "Mở rộng"}
                >
                  {isExpanded ? <ChevronDown /> : <ChevronRight />}
                </button>
              ) : (
                <span style={{ width: '22px', flexShrink: 0 }}></span>
              )}
              
              {/* Icon & Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0, flex: 1 }}>
                <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                  <FolderIcon open={isExpanded} color={color} />
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: isSelected ? '700' : '600', color: isSelected ? '#1d4ed8' : '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {node.name}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b', background: '#f8fafc', padding: '1px 5px', borderRadius: '5px', border: '1px solid #e2e8f0', flexShrink: 0 }}>
                  #{node.id}
                </span>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  color: prodCount > 0 ? '#0369a1' : '#94a3b8',
                  background: prodCount > 0 ? '#e0f2fe' : '#f1f5f9',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  flexShrink: 0
                }}
                title={`${prodCount} sản phẩm trực thuộc nhóm này`}
                >
                  {prodCount} SP
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, marginLeft: '6px' }} className="category-actions" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => {
                  setEditingId(null);
                  setFormData({ name: '', parent_id: String(node.id) });
                  setIsModalOpen(true);
                }}
                title="Thêm phân loại"
                className="action-btn-add"
                style={{ height: '26px', padding: '0 7px', fontSize: '11.5px', borderRadius: '6px' }}
              >
                <PlusIcon /> Con
              </button>
              <button
                onClick={() => {
                  setEditingId(node.id);
                  setFormData({ name: node.name, parent_id: node.parent_id ? String(node.parent_id) : '' });
                  setIsModalOpen(true);
                }}
                title="Sửa nhóm"
                className="action-btn-edit"
                style={{ height: '26px', padding: '0 7px', fontSize: '11.5px', borderRadius: '6px' }}
              >
                <EditIcon />
              </button>
              <button
                onClick={(e) => handleDelete(node.id, e)}
                title="Xóa nhóm"
                className="action-btn-del"
                style={{ height: '26px', padding: '0 7px', fontSize: '11.5px', borderRadius: '6px' }}
              >
                <TrashIcon />
              </button>
            </div>
          </div>
          
          {/* Render Children if expanded */}
          {hasChildren && isExpanded && (
            <div style={{ animation: 'slideDown 0.2s ease' }}>
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

  // Bản đồ đếm số lượng sản phẩm theo từng nhóm ngành hàng
  const categoryProductCountMap = useMemo(() => {
    const map = new Map<number, number>();
    products.forEach(p => {
      if (p.category_id) {
        map.set(p.category_id, (map.get(p.category_id) || 0) + 1);
      }
    });
    return map;
  }, [products]);

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
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', background: '#ffffff', minWidth: '460px', overflow: 'hidden' }}>
        {/* Header Cột Phải */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                Danh Sách Sản Phẩm
              </h3>
              <span style={{ fontSize: '11.5px', color: '#475569', fontWeight: '700', background: '#e2e8f0', padding: '2px 8px', borderRadius: '10px' }}>
                {displayedProducts.length} / {products.length} SP
              </span>
            </div>

            {/* Quick Filter Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', padding: '3px', borderRadius: '8px' }}>
              <button
                onClick={() => { setProductFilter('all'); setSelectedCategoryId(null); }}
                style={{
                  padding: '5px 11px', borderRadius: '6px', border: 'none',
                  background: (!selectedCategoryId && productFilter === 'all') ? '#ffffff' : 'transparent',
                  color: (!selectedCategoryId && productFilter === 'all') ? '#0f172a' : '#64748b',
                  fontWeight: (!selectedCategoryId && productFilter === 'all') ? '700' : '600',
                  fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: (!selectedCategoryId && productFilter === 'all') ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Tất cả ({products.length})
              </button>
              <button
                onClick={() => { setProductFilter('unassigned'); setSelectedCategoryId(null); }}
                style={{
                  padding: '5px 11px', borderRadius: '6px', border: 'none',
                  background: (!selectedCategoryId && productFilter === 'unassigned') ? '#fef3c7' : 'transparent',
                  color: (!selectedCategoryId && productFilter === 'unassigned') ? '#b45309' : (unassignedCount > 0 ? '#b45309' : '#64748b'),
                  fontWeight: (!selectedCategoryId && productFilter === 'unassigned') ? '700' : '600',
                  fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: (!selectedCategoryId && productFilter === 'unassigned') ? '0 1px 2px rgba(180,83,9,0.15)' : 'none'
                }}
              >
                Chưa gán ({unassignedCount})
              </button>
              <button
                onClick={() => { setProductFilter('assigned'); setSelectedCategoryId(null); }}
                style={{
                  padding: '5px 11px', borderRadius: '6px', border: 'none',
                  background: (!selectedCategoryId && productFilter === 'assigned') ? '#ffffff' : 'transparent',
                  color: (!selectedCategoryId && productFilter === 'assigned') ? '#0f172a' : '#64748b',
                  fontWeight: (!selectedCategoryId && productFilter === 'assigned') ? '700' : '600',
                  fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s',
                  boxShadow: (!selectedCategoryId && productFilter === 'assigned') ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                Đã gán ({assignedCount})
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Product Search Input */}
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Tìm theo tên hoặc mã SP..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '8px 12px',
                  borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px',
                  outline: 'none', background: '#ffffff', color: '#0f172a'
                }}
              />
              {productSearch && (
                <button
                  onClick={() => setProductSearch('')}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
              🖐️ Kéo thả SP sang cột bên trái để gán nhóm
            </span>
          </div>

          {/* Active Tree Category Filter Alert */}
          {selectedCategoryId && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '7px 12px', background: '#eff6ff', borderRadius: '8px',
              border: '1px solid #bfdbfe', marginTop: '10px', fontSize: '12.5px', color: '#1e40af'
            }}>
              <div>
                Đang xem nhóm: <strong>{selectedCategoryName || `ID ${selectedCategoryId}`}</strong> ({displayedProducts.length} sản phẩm)
              </div>
              <button
                onClick={() => setSelectedCategoryId(null)}
                style={{
                  background: '#ffffff', border: '1px solid #93c5fd', borderRadius: '6px',
                  padding: '3px 9px', fontSize: '11.5px', color: '#1d4ed8', fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                ✕ Xem tất cả
              </button>
            </div>
          )}
        </div>

        {/* Table Column Headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 65px 60px 110px 130px',
          gap: '8px',
          alignItems: 'center',
          padding: '9px 16px',
          background: '#f1f5f9',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '11px',
          fontWeight: '700',
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          <div style={{ textAlign: 'center' }}>⋮⋮</div>
          <div>Sản phẩm & Mã SKU</div>
          <div style={{ textAlign: 'center' }}>Kho</div>
          <div style={{ textAlign: 'center' }}>ĐVT</div>
          <div style={{ textAlign: 'right' }}>Đơn giá</div>
          <div style={{ textAlign: 'right' }}>Phân nhóm</div>
        </div>

        {/* Products List Rows */}
        <div style={{ padding: '8px 12px', overflowY: 'auto', flex: 1, maxHeight: 'calc(100vh - 380px)', minHeight: '440px' }}>
          {displayedProducts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>
                {productFilter === 'unassigned' ? '🎉' : '📦'}
              </div>
              <div style={{ fontSize: '14.5px', fontWeight: '700', color: '#475569' }}>
                {productFilter === 'unassigned' 
                  ? 'Tuyệt vời! Tất cả sản phẩm đã được phân nhóm.' 
                  : 'Không có sản phẩm nào phù hợp'}
              </div>
              {selectedCategoryId && (
                <button
                  onClick={() => setSelectedCategoryId(null)}
                  style={{
                    marginTop: '10px', padding: '5px 12px', borderRadius: '6px',
                    border: '1px solid #cbd5e1', background: '#ffffff', color: '#2563eb',
                    fontWeight: '600', fontSize: '12.5px', cursor: 'pointer'
                  }}
                >
                  Bỏ lọc để xem tất cả
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {displayedProducts.map(product => {
                const unassigned = isProductUnassigned(product);
                return (
                  <div
                    key={product.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, product.id)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '32px 1fr 65px 60px 110px 130px',
                      gap: '8px',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: unassigned ? '#fffdf5' : '#ffffff',
                      border: `1px solid ${unassigned ? '#fde68a' : '#e2e8f0'}`,
                      borderRadius: '8px',
                      cursor: 'grab',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                      opacity: isMoving ? 0.6 : 1
                    }}
                    className="product-drag-card"
                    title={`Kéo thả sản phẩm "${product.name}" vào ngành hàng bên trái để phân nhóm`}
                  >
                    <div style={{ cursor: 'grab', color: unassigned ? '#d97706' : '#94a3b8', display: 'flex', justifyContent: 'center' }}>
                      <DragIcon />
                    </div>
                    
                    {/* Tên & Mã */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {product.name}
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '1px' }}>
                        Mã: <code style={{ fontFamily: 'monospace', fontWeight: '600', color: '#334155', background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>{product.code}</code>
                      </div>
                    </div>

                    {/* Kho */}
                    <div style={{ textAlign: 'center', fontSize: '12.5px', fontWeight: '700', color: '#059669' }}>
                      {product.stock}
                    </div>

                    {/* ĐVT */}
                    <div style={{ textAlign: 'center', fontSize: '12px', color: '#475569' }}>
                      {product.base_unit || 'Cái'}
                    </div>

                    {/* Giá bán */}
                    <div style={{ textAlign: 'right', fontSize: '13px', fontWeight: '700', color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>
                      {product.sell_price.toLocaleString('vi-VN')} đ
                    </div>

                    {/* Trạng thái phân nhóm */}
                    <div style={{ textAlign: 'right' }}>
                      {unassigned ? (
                        <span style={{
                          fontSize: '11px', fontWeight: '700', color: '#b45309',
                          background: '#fef3c7', border: '1px solid #fde68a',
                          padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap'
                        }}>
                          Chưa gán
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '11px', fontWeight: '600', color: '#0369a1',
                          background: '#e0f2fe', border: '1px solid #bae6fd',
                          padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap',
                          display: 'inline-block', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}
                        title={product.category || 'Đã phân nhóm'}
                        >
                          📁 {product.category || 'Đã phân nhóm'}
                        </span>
                      )}
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
          <div
            style={{
              animation: 'fadeIn 0.25s ease',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              overflow: 'hidden',
              minHeight: '620px',
            }}
          >
            {/* Cột trái: Cây Ngành Hàng */}
            <div
              style={{
                width: '42%',
                minWidth: '380px',
                maxWidth: '480px',
                borderRight: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                background: '#fafbfc',
              }}
            >
              {/* Header Cột Trái */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                      Cơ Cấu Ngành Hàng
                    </h3>
                    <span style={{ fontSize: '11.5px', color: '#64748b', background: '#e2e8f0', padding: '2px 8px', borderRadius: '10px', fontWeight: '700' }}>
                      {treeData.length} Gốc
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ name: '', parent_id: '' });
                      setIsModalOpen(true);
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      padding: '7px 14px', borderRadius: '8px', fontWeight: '700', fontSize: '12.5px',
                      background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)', transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10b981'}
                  >
                    <PlusIcon /> Thêm Ngành Hàng
                  </button>
                </div>

                {/* Ô tìm kiếm ngành hàng */}
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', display: 'flex' }}><SearchIcon /></span>
                  <input 
                    type="text" 
                    placeholder="Tìm nhanh ngành hàng, nhóm hàng..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 36px',
                      borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px',
                      outline: 'none', background: '#ffffff', color: '#0f172a', transition: 'border-color 0.15s'
                    }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      style={{
                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px'
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Vùng cuộn danh sách cây ngành hàng */}
              <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1, maxHeight: 'calc(100vh - 380px)', minHeight: '440px' }}>
                {isLoading ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
                    <div style={{ fontSize: '13.5px', fontWeight: '500' }}>Đang nạp cấu trúc ngành hàng...</div>
                  </div>
                ) : filteredTreeData.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                    Không tìm thấy ngành hàng / nhóm hàng nào phù hợp.
                  </div>
                ) : (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                    {renderTree(filteredTreeData)}
                  </div>
                )}
              </div>
            </div>

            {/* Cột phải: Danh Sách Sản Phẩm */}
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
              {editingId ? 'Cập nhật thông tin' : (formData.parent_id ? 'Thêm mới Phân Loại' : 'Thêm mới Nhóm Hàng')}
            </h3>
            <p style={{ fontSize: '15px', color: '#64748b', marginBottom: '32px' }}>
              {formData.parent_id ? 'Thêm phân loại mới trực thuộc nhóm hàng đã chọn.' : 'Tạo nhóm hàng mới để phân cấp và theo dõi sản phẩm.'}
            </p>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>
                  {formData.parent_id ? 'Tên phân loại' : 'Tên nhóm hàng'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={formData.parent_id ? "Ví dụ: Áo Thun Nam, Phụ Kiện..." : "Ví dụ: Thời trang, Gia dụng, Điện tử..."}
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', transition: 'border 0.2s', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>
              <div style={{ marginBottom: '36px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '700', fontSize: '14px', color: '#1e293b' }}>Trực thuộc nhóm hàng</label>
                <select
                  value={formData.parent_id}
                  onChange={e => setFormData({ ...formData, parent_id: e.target.value })}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '15px', background: '#f8fafc' }}
                >
                  <option value="">-- Cấp cao nhất (Nhóm Hàng Gốc) --</option>
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
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#94a3b8' }}>Để trống nếu đây là cấp cao nhất (Nhóm hàng gốc).</p>
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
              Bạn có chắc chắn muốn xóa nhóm hàng này không? Việc xóa sẽ thất bại nếu đang có phân loại trực thuộc hoặc chứa sản phẩm.
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
