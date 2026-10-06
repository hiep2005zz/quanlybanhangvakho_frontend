import React, { useState, useEffect, useRef } from 'react';
import {
  ProductItem,
  ProductPayload,
  createProductApi,
  updateProductApi,
  deleteProductApi,
  API_BASE_URL,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import './sales-order-entry.css';

interface ProductFormViewProps {
  product: ProductItem | null;
  token: string;
  isCostVisible: boolean;
  categories: string[];
  onBack: () => void;
  onSuccess: (updatedProduct?: ProductItem, isDeleted?: boolean) => void;
}

const DEFAULT_UNITS = ['Cái', 'Chiếc', 'Hộp', 'Kg', 'Thùng', 'Bộ', 'Gói', 'Chai', 'Đôi'];

export const ProductFormView: React.FC<ProductFormViewProps> = ({
  product,
  token,
  isCostVisible,
  categories,
  onBack,
  onSuccess,
}) => {
  const isEditing = Boolean(product);
  const hasTransactions = Boolean(product && (product.transaction_count || 0) > 0);

  const [skuCode, setSkuCode] = useState('');
  const [skuError, setSkuError] = useState<string | null>(null);
  const [skuChecking, setSkuChecking] = useState(false);

  const [productName, setProductName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const [category, setCategory] = useState('');
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [images, setImages] = useState<string[]>([]);
  const [mainImageIdx, setMainImageIdx] = useState<number>(0);

  const [baseUnit, setBaseUnit] = useState('Cái');
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState('');
  const [unitError, setUnitError] = useState<string | null>(null);
  const [packagingSpec, setPackagingSpec] = useState('');

  const [sellPrice, setSellPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);

  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);

  // Khởi tạo state khi mở form
  useEffect(() => {
    if (product) {
      setSkuCode(product.code || '');
      setProductName(product.name || '');
      setCategory(product.category || '');
      setBaseUnit(product.base_unit || 'Cái');
      setPackagingSpec(product.packaging_specification || '');
      setSellPrice(product.sell_price || 0);
      setCostPrice(product.cost_price || 0);
      setStatus(product.status === 'inactive' ? 'inactive' : 'active');

      let parsedImgs: string[] = [];
      if (Array.isArray(product.images) && product.images.length > 0) {
        parsedImgs = product.images;
      }
      setImages(parsedImgs);
      setMainImageIdx(0);
    } else {
      setSkuCode('');
      setProductName('');
      setCategory(categories[0] || 'Thời trang');
      setBaseUnit('Cái');
      setPackagingSpec('');
      setSellPrice(0);
      setCostPrice(0);
      setStatus('active');
      setImages([]);
      setMainImageIdx(0);
    }
    setSkuError(null);
    setNameError(null);
    setUnitError(null);
    setGeneralError(null);
    setIsAddingUnit(false);
    setIsAddingNewCategory(false);
  }, [product, categories]);

  // Đóng dropdown ngành hàng khi click ngoài
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Cuộn trang lên đầu khi mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Validate SKU
  const handleSkuChange = (val: string) => {
    const upper = val.toUpperCase();
    setSkuCode(upper);
    if (skuError) setSkuError(null);
  };

  const handleSkuBlur = async () => {
    const trimmedSku = skuCode.trim().toUpperCase();
    if (!trimmedSku) {
      setSkuError('Mã SKU không được để trống.');
      return;
    }

    const skuRegex = /^[A-Z0-9_-]+$/;
    if (!skuRegex.test(trimmedSku)) {
      setSkuError('Mã SKU chỉ được chứa chữ cái không dấu, chữ số và dấu gạch (- hoặc _).');
      return;
    }

    if (isEditing && product && product.code.toUpperCase() === trimmedSku) {
      setSkuError(null);
      return;
    }

    try {
      setSkuChecking(true);
      const excludeParam = isEditing && product ? `&exclude_id=${product.id}` : '';
      const res = await fetch(
        `${API_BASE_URL}/products/check-sku?sku=${encodeURIComponent(trimmedSku)}${excludeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (!data.available) {
          setSkuError(data.message || 'Mã SKU đã tồn tại trên toàn hệ thống.');
        } else {
          setSkuError(null);
        }
      }
    } catch {
      // ignore
    } finally {
      setSkuChecking(false);
    }
  };

  // Validate Tên sản phẩm
  const handleNameChange = (val: string) => {
    setProductName(val);
    if (nameError) setNameError(null);
  };

  const handleNameBlur = () => {
    const trimmed = productName.trim();
    if (!trimmed) {
      setNameError('Tên sản phẩm là bắt buộc.');
    } else if (trimmed.length < 5 || trimmed.length > 255) {
      setNameError('Độ dài tên sản phẩm phải từ 5 đến 255 ký tự.');
    } else {
      setNameError(null);
    }
  };

  // Upload ảnh
  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const maxFiles = 5;
    const currentCount = images.length;

    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowedTypes.includes(file.type)) {
        emitStatusToast({
          message: `Ảnh "${file.name}" không hợp lệ. Chỉ chấp nhận PNG, JPG, WEBP.`,
          title: 'Ảnh không đúng định dạng',
        });
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        emitStatusToast({ message: `Ảnh "${file.name}" vượt quá 5MB.`, title: 'Ảnh quá dung lượng' });
        continue;
      }
      if (currentCount + newFiles.length >= maxFiles) {
        emitStatusToast({ message: `Chỉ được tải lên tối đa ${maxFiles} ảnh.`, title: 'Giới hạn số lượng ảnh' });
        break;
      }
      newFiles.push(file);
    }

    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImages((prev) => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (mainImageIdx === index) {
      setMainImageIdx(0);
    } else if (mainImageIdx > index) {
      setMainImageIdx((prev) => prev - 1);
    }
  };

  const handleSetMainImage = (index: number) => {
    setMainImageIdx(index);
    emitStatusToast({ message: 'Đã chọn làm ảnh đại diện chính', title: 'Cập nhật ảnh đại diện' });
  };

  // Tạo nhanh nhóm hàng
  const handleAddNewCategory = () => {
    const trimmed = newCategoryInput.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed) && !customCategories.includes(trimmed)) {
      setCustomCategories((prev) => [...prev, trimmed]);
    }
    setCategory(trimmed);
    setNewCategoryInput('');
    setIsAddingNewCategory(false);
    setIsCategoryDropdownOpen(false);
    emitStatusToast({ message: `Đã thêm nhóm hàng "${trimmed}"`, title: 'Thêm nhóm hàng thành công' });
  };

  // Tạo nhanh ĐVT
  const handleAddNewUnit = () => {
    const trimmed = newUnitInput.trim();
    if (!trimmed) {
      setUnitError('Vui lòng nhập tên đơn vị tính.');
      return;
    }
    const isDuplicate = allUnits.some((u) => u.trim().toLowerCase() === trimmed.toLowerCase());
    if (isDuplicate) {
      const errMsg = `Đơn vị tính "${trimmed}" đã tồn tại. Không thể tạo trùng lặp!`;
      setUnitError(errMsg);
      emitStatusToast({ message: errMsg, title: 'Không thể tạo đơn vị tính' });
      return;
    }
    setCustomUnits((prev) => [...prev, trimmed]);
    setBaseUnit(trimmed);
    setNewUnitInput('');
    setUnitError(null);
    setIsAddingUnit(false);
    emitStatusToast({ message: `Đã thêm đơn vị tính "${trimmed}"`, title: 'Thêm đơn vị tính thành công' });
  };

  const formatCurrency = (val: number): string => {
    return val.toLocaleString('vi-VN');
  };

  const handleCurrencyChange = (valStr: string, setter: (n: number) => void) => {
    const cleanNum = parseInt(valStr.replace(/\D/g, ''), 10) || 0;
    setter(cleanNum);
  };

  // Submit
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setGeneralError(null);

    const cleanSku = skuCode.trim().toUpperCase();
    if (!cleanSku) {
      setSkuError('Mã SKU là bắt buộc.');
      return;
    }
    if (skuError) return;

    const cleanName = productName.trim();
    if (!cleanName || cleanName.length < 5 || cleanName.length > 255) {
      setNameError('Tên sản phẩm phải có độ dài từ 5 đến 255 ký tự.');
      return;
    }

    if (!category.trim()) {
      setGeneralError('Vui lòng chọn nhóm hàng.');
      return;
    }

    if (!baseUnit.trim()) {
      setGeneralError('Vui lòng chọn đơn vị tính cơ sở.');
      return;
    }

    let sortedImages = [...images];
    if (sortedImages.length > 0 && mainImageIdx < sortedImages.length && mainImageIdx !== 0) {
      const mainImg = sortedImages.splice(mainImageIdx, 1)[0];
      sortedImages.unshift(mainImg);
    }

    const payload: ProductPayload = {
      code: cleanSku,
      name: cleanName,
      category: category.trim(),
      base_unit: baseUnit.trim(),
      packaging_specification: packagingSpec.trim(),
      sell_price: sellPrice,
      cost_price: isCostVisible ? costPrice : (product?.cost_price ?? 0),
      images: sortedImages,
      status: status,
    };

    setIsSubmitting(true);
    try {
      if (isEditing && product) {
        const updated = await updateProductApi(token, product.id, payload);
        emitStatusToast({ message: `Đã cập nhật sản phẩm ${updated.code} thành công.`, title: 'Cập nhật thành công' });
        onSuccess(updated);
      } else {
        const created = await createProductApi(token, payload);
        emitStatusToast({ message: `Đã thêm mới sản phẩm ${created.code} thành công.`, title: 'Thêm mới thành công' });
        onSuccess(created);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu sản phẩm.';
      setGeneralError(msg);
      emitStatusToast({ message: msg, title: 'Lỗi lưu sản phẩm' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!product) return;

    setIsDeleting(true);
    try {
      await deleteProductApi(token, product.id, true);
      emitStatusToast({ message: `Đã xóa sản phẩm ${product.code} thành công.`, title: 'Xóa thành công' });
      onSuccess(product, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi xóa sản phẩm.';
      setGeneralError(msg);
      emitStatusToast({ message: msg, title: 'Lỗi xóa sản phẩm' });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Nhanh chóng chuyển sang ngừng kinh doanh từ modal
  const handleSwitchToInactive = async () => {
    if (!product) return;
    setStatus('inactive');
    setShowDeleteConfirm(false);
    emitStatusToast({
      message: 'Đã chuyển trạng thái sang "Ngừng kinh doanh". Hãy bấm "Lưu thay đổi" để áp dụng.',
      title: 'Thông báo',
    });
  };

  const allCategories = Array.from(new Set([...categories, ...customCategories])).filter(Boolean);
  const filteredCategories = allCategories.filter((c) =>
    c.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const allUnits = Array.from(new Set([...DEFAULT_UNITS, ...customUnits]));

  const profitMargin =
    sellPrice > 0 && isCostVisible
      ? (((sellPrice - costPrice) / sellPrice) * 100).toFixed(1)
      : null;

  return (
    <main className="sales-order-page" style={{ paddingBottom: '40px' }}>
      {/* Tiêu đề trang khớp với thiết kế Ảnh 2 */}
      <div className="sales-order-heading" style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px' }}>
        <div>
          <p className="sales-order-eyebrow">QUẢN LÝ KHO HÀNG</p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{isEditing ? `Chỉnh sửa sản phẩm: ${product?.code}` : 'Khai báo sản phẩm mới'}</span>
            {isEditing && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  padding: '3px 10px',
                  borderRadius: '16px',
                  background: status === 'active' ? '#ecfdf5' : '#fef2f2',
                  color: status === 'active' ? '#047857' : '#dc2626',
                  border: status === 'active' ? '1px solid #a7f3d0' : '1px solid #fecaca',
                }}
              >
                {status === 'active' ? 'Đang kinh doanh' : 'Ngừng kinh doanh'}
              </span>
            )}
          </h1>
          <p className="sales-order-subtitle">
            {isEditing
              ? 'Cập nhật thông tin chi tiết, quy cách đóng gói và chính sách giá của sản phẩm.'
              : 'Nhập đầy đủ thông tin chuẩn hóa để quản lý sản phẩm trong hệ thống kho.'}
          </p>
        </div>

        {/* Các nút thao tác góc phải */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isEditing && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting || isSubmitting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '9px',
                padding: '9px 14px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#dc2626',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isDeleting) {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.borderColor = '#f87171';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDeleting) {
                  e.currentTarget.style.background = '#fef2f2';
                  e.currentTarget.style.borderColor = '#fecaca';
                }
              }}
              title="Xóa sản phẩm này khỏi hệ thống"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              <span>{isDeleting ? 'Đang xóa...' : 'Xóa sản phẩm'}</span>
            </button>
          )}

          {/* Nút Quay lại danh sách */}
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '9px',
              padding: '9px 16px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Quay lại danh sách</span>
          </button>
        </div>
      </div>

      {generalError && (
        <div className="sales-order-alert error" role="alert" style={{ marginBottom: '20px' }}>
          ⚠️ {generalError}
        </div>
      )}

      {/* Bố cục 2 cột toàn màn hình theo phong cách Ảnh 2 */}
      <form onSubmit={handleSubmit} className="sales-order-layout">
        {/* CỘT CHÍNH (TRÁI): CÁC KHỐI NHẬP LIỆU */}
        <section className="sales-order-main">
          {/* Card 1: Thông tin cơ bản */}
          <section className="sales-order-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>📝</span>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
                Thông tin cơ bản
              </h2>
            </div>

            <div className="sales-order-fields">
              {/* Mã SKU */}
              <label className="sales-order-field">
                <span>
                  Mã SKU <b aria-hidden="true">*</b>
                </span>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={skuCode}
                    disabled={hasTransactions}
                    onChange={(e) => handleSkuChange(e.target.value)}
                    onBlur={handleSkuBlur}
                    placeholder="VD: SP001"
                    style={{
                      fontFamily: 'ui-monospace, monospace',
                      fontWeight: '600',
                      letterSpacing: '0.04em',
                      borderColor: skuError ? '#ef4444' : undefined,
                      background: hasTransactions ? '#f8fafc' : '#ffffff',
                      color: hasTransactions ? '#64748b' : '#0f172a',
                    }}
                  />
                  {skuChecking && (
                    <span style={{ position: 'absolute', right: '12px', top: '12px', fontSize: '12px', color: '#64748b' }}>
                      ⏳ Đang kiểm tra...
                    </span>
                  )}
                </div>
                {hasTransactions && (
                  <span style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                    🔒 Đã phát sinh giao dịch &rarr; Khóa chỉnh sửa mã SKU.
                  </span>
                )}
                {skuError && (
                  <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px', fontWeight: '600' }}>
                    {skuError}
                  </span>
                )}
              </label>

              {/* Nhóm hàng */}
              <div className="sales-order-field" ref={categoryDropdownRef} style={{ position: 'relative' }}>
                <span>
                  Ngành hàng / Nhóm hàng <b aria-hidden="true">*</b>
                </span>
                <div
                  onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                  style={{
                    height: '42px',
                    padding: '9px 12px',
                    borderRadius: '9px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                    fontWeight: '600',
                    color: category ? '#0f172a' : '#94a3b8',
                  }}
                >
                  <span>{category || 'Chọn nhóm hàng...'}</span>
                  <span style={{ fontSize: '11px', color: '#64748b' }}>▼</span>
                </div>

                {isCategoryDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '72px',
                      left: 0,
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
                      padding: '8px',
                      zIndex: 200,
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Tìm kiếm nhóm hàng..."
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12.5px',
                        marginBottom: '6px',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                      {filteredCategories.map((cat) => (
                        <div
                          key={cat}
                          onClick={() => {
                            setCategory(cat);
                            setIsCategoryDropdownOpen(false);
                          }}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            fontSize: '13px',
                            cursor: 'pointer',
                            background: category === cat ? '#eff6ff' : 'transparent',
                            color: category === cat ? '#1d4ed8' : '#334155',
                            fontWeight: category === cat ? '700' : '500',
                          }}
                        >
                          {cat}
                        </div>
                      ))}
                    </div>

                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '6px' }}>
                      {isAddingNewCategory ? (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            placeholder="Tên nhóm mới..."
                            value={newCategoryInput}
                            onChange={(e) => setNewCategoryInput(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              flex: 1,
                              padding: '5px 8px',
                              borderRadius: '4px',
                              border: '1px solid #94a3b8',
                              fontSize: '12px',
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleAddNewCategory}
                            style={{
                              background: '#2563eb',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '5px 10px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '600',
                            }}
                          >
                            Lưu
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsAddingNewCategory(true);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#2563eb',
                            fontSize: '12.5px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            padding: '4px 0',
                          }}
                        >
                          + Thêm nhanh nhóm hàng mới
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Tên sản phẩm chiếm full width 2 cột */}
              <label className="sales-order-field" style={{ gridColumn: 'span 2' }}>
                <span>
                  Tên sản phẩm <b aria-hidden="true">*</b>
                </span>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  onBlur={handleNameBlur}
                  placeholder="Nhập tên sản phẩm đầy đủ (từ 5 đến 255 ký tự)..."
                  style={{
                    borderColor: nameError ? '#ef4444' : undefined,
                    fontWeight: '600',
                  }}
                />
                {nameError && (
                  <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px', fontWeight: '600' }}>
                    {nameError}
                  </span>
                )}
              </label>
            </div>
          </section>

          {/* Card 2: Đơn vị tính & Quy cách đóng gói */}
          <section className="sales-order-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>📏</span>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
                Đơn vị tính & Quy cách đóng gói
              </h2>
            </div>

            <div className="sales-order-fields">
              {/* Đơn vị tính cơ sở */}
              <label className="sales-order-field">
                <span>
                  Đơn vị tính cơ sở <b aria-hidden="true">*</b>
                </span>
                {isAddingUnit ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      placeholder="Nhập tên ĐVT..."
                      value={newUnitInput}
                      onChange={(e) => setNewUnitInput(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewUnit}
                      style={{
                        padding: '0 14px',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '9px',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Lưu
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingUnit(false)}
                      style={{
                        padding: '0 10px',
                        background: '#f1f5f9',
                        color: '#64748b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '9px',
                        fontSize: '12.5px',
                        cursor: 'pointer',
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={baseUnit}
                      onChange={(e) => setBaseUnit(e.target.value)}
                      style={{ flex: 1, fontWeight: '600' }}
                    >
                      {allUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingUnit(true);
                        setUnitError(null);
                        setNewUnitInput('');
                      }}
                      title="Thêm đơn vị mới"
                      style={{
                        padding: '0 12px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '9px',
                        fontSize: '12.5px',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      + Thêm ĐVT
                    </button>
                  </div>
                )}
                {unitError && (
                  <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px' }}>
                    ⚠️ {unitError}
                  </span>
                )}
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Đơn vị cơ sở là đơn vị nhỏ nhất để kiểm kê và lưu kho.
                </span>
              </label>

              {/* Quy cách đóng gói */}
              <label className="sales-order-field">
                <span>Quy cách đóng gói</span>
                <input
                  type="text"
                  value={packagingSpec}
                  onChange={(e) => setPackagingSpec(e.target.value)}
                  placeholder="Ví dụ: 1 Thùng = 24 Hộp, 1 Lốc = 6 Chai"
                  style={{ fontWeight: '500' }}
                />
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Ghi chú quy đổi đóng gói phục vụ quá trình bốc dỡ và xuất kho.
                </span>
              </label>
            </div>
          </section>

          {/* Card 3: Chính sách giá & Trạng thái */}
          <section className="sales-order-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <span style={{ fontSize: '18px' }}>💰</span>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
                Chính sách giá & Trạng thái kinh doanh
              </h2>
            </div>

            <div className="sales-order-fields">
              {/* Giá niêm yết bán */}
              <label className="sales-order-field">
                <span>
                  Giá niêm yết bán lẻ (VNĐ) <b aria-hidden="true">*</b>
                </span>
                <input
                  type="text"
                  value={formatCurrency(sellPrice)}
                  onChange={(e) => handleCurrencyChange(e.target.value, setSellPrice)}
                  style={{
                    fontSize: '15px',
                    fontWeight: '750',
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Giá bán tiêu chuẩn đã bao gồm thuế GTGT (VAT).
                </span>
              </label>

              {/* Giá vốn nhập kho */}
              <label className="sales-order-field">
                <span>Giá vốn nhập kho (VNĐ)</span>
                {isCostVisible ? (
                  <input
                    type="text"
                    value={formatCurrency(costPrice)}
                    onChange={(e) => handleCurrencyChange(e.target.value, setCostPrice)}
                    style={{
                      fontSize: '15px',
                      fontWeight: '750',
                      color: '#0f172a',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value="***,*** VNĐ"
                    disabled
                    style={{
                      background: '#f8fafc',
                      color: '#94a3b8',
                      fontFamily: 'monospace',
                    }}
                  />
                )}
                <span style={{ fontSize: '11.5px', color: isCostVisible ? '#64748b' : '#f59e0b' }}>
                  {isCostVisible
                    ? 'Dữ liệu nội bộ bảo mật phục vụ tính lãi gộp.'
                    : '🔒 Bị ẩn bởi cơ chế bảo mật (Chỉ Admin / Quản lý kinh doanh).'}
                </span>
              </label>

              {/* Trạng thái kinh doanh */}
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '6px' }}>
                  Trạng thái sản phẩm
                </span>
                <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: status === 'active' ? '1.5px solid #10b981' : '1px solid #cbd5e1',
                      background: status === 'active' ? '#ecfdf5' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: status === 'active' ? '#047857' : '#64748b',
                    }}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="active"
                      checked={status === 'active'}
                      onChange={() => setStatus('active')}
                      style={{
                        width: '15px',
                        height: '15px',
                        minWidth: '15px',
                        maxWidth: '15px',
                        margin: 0,
                        cursor: 'pointer',
                        accentColor: '#10b981',
                      }}
                    />
                    <span>✓ Đang kinh doanh</span>
                  </label>

                  <label
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: status === 'inactive' ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      background: status === 'inactive' ? '#fef2f2' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: status === 'inactive' ? '#b91c1c' : '#64748b',
                    }}
                  >
                    <input
                      type="radio"
                      name="status"
                      value="inactive"
                      checked={status === 'inactive'}
                      onChange={() => setStatus('inactive')}
                      style={{
                        width: '15px',
                        height: '15px',
                        minWidth: '15px',
                        maxWidth: '15px',
                        margin: 0,
                        cursor: 'pointer',
                        accentColor: '#ef4444',
                      }}
                    />
                    <span>✕ Ngừng kinh doanh</span>
                  </label>
                </div>
              </div>
            </div>
          </section>

          {/* Card 4: Hình ảnh sản phẩm */}
          <section className="sales-order-card">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png, image/jpeg, image/webp"
              style={{ display: 'none' }}
              onChange={(e) => handleImageUpload(e.target.files)}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>🖼️</span>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
                  Hình ảnh sản phẩm
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Đã tải: <strong>{images.length}</strong> / 5 ảnh
                </span>
                {images.length > 0 && images.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#2563eb',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    + Thêm ảnh
                  </button>
                )}
              </div>
            </div>

            {/* Vùng kéo thả upload to (chỉ hiện khi chưa có ảnh) */}
            {images.length === 0 && (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '24px 20px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#2563eb';
                  e.currentTarget.style.background = '#eff6ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.background = '#f8fafc';
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>📷</div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                  Nhấn vào đây để tải ảnh lên
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Hoặc kéo thả file ảnh vào khung này (Tối đa 5 ảnh, định dạng PNG, JPG, WEBP &le; 5MB)
                </div>
              </div>
            )}

            {/* Danh sách ảnh đã upload */}
            {images.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'relative',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: mainImageIdx === idx ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: '#f8fafc',
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <img
                      src={img}
                      alt={`Sản phẩm ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {mainImageIdx === idx && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '6px',
                          left: '6px',
                          background: '#2563eb',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: '700',
                          padding: '2px 6px',
                          borderRadius: '4px',
                        }}
                      >
                        ⭐ Ảnh chính
                      </span>
                    )}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'rgba(15, 23, 42, 0.75)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px',
                      }}
                    >
                      {mainImageIdx !== idx ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetMainImage(idx);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#93c5fd',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Đặt làm chính
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#ffffff' }}>Mặc định</span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(idx);
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f87171',
                          fontSize: '13px',
                          cursor: 'pointer',
                          padding: 0,
                          fontWeight: '700',
                        }}
                        title="Xóa ảnh này"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}

                {/* Ô nhỏ thêm ảnh khi chưa đạt tối đa 5 ảnh */}
                {images.length < 5 && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      borderRadius: '10px',
                      border: '2px dashed #cbd5e1',
                      background: '#f8fafc',
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                      color: '#64748b',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#2563eb';
                      e.currentTarget.style.background = '#eff6ff';
                      e.currentTarget.style.color = '#2563eb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.color = '#64748b';
                    }}
                    title="Thêm ảnh khác"
                  >
                    <span style={{ fontSize: '24px', lineHeight: 1 }}>+</span>
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Thêm ảnh</span>
                    <span style={{ fontSize: '10.5px', color: '#94a3b8' }}>({images.length}/5)</span>
                  </div>
                )}
              </div>
            )}
          </section>
        </section>

        {/* CỘT PHỤ (PHẢI): TỔNG KẾT & THAO TÁC */}
        <aside className="sales-order-sidebar">
          {/* Card 1: Tổng kết & Thao tác */}
          <section className="sales-order-card" style={{ position: 'sticky', top: '16px' }}>
            <h2 style={{ fontSize: '17px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '14px' }}>
              Tổng kết sản phẩm
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Mã SKU:</span>
                <strong style={{ fontFamily: 'monospace', color: '#0f172a' }}>{skuCode || '---'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Ngành hàng:</span>
                <strong style={{ color: '#0f172a' }}>{category || '---'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>ĐVT cơ sở:</span>
                <strong style={{ color: '#0f172a' }}>{baseUnit || '---'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Giá niêm yết:</span>
                <strong style={{ color: '#2563eb', fontSize: '14px' }}>{formatCurrency(sellPrice)} đ</strong>
              </div>

              {isCostVisible && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>Giá vốn:</span>
                    <strong style={{ color: '#475569' }}>{formatCurrency(costPrice)} đ</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0' }}>
                    <span style={{ color: '#64748b' }}>Biên lợi nhuận:</span>
                    <span
                      style={{
                        fontWeight: '750',
                        color: Number(profitMargin) > 0 ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {profitMargin ? `+${profitMargin}%` : '---'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Các nút bấm thao tác */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Nút Tạo / Lưu chính màu xanh giống Tạo đơn hàng trong ảnh 2 */}
              <button
                type="submit"
                disabled={isSubmitting || isDeleting}
                style={{
                  width: '100%',
                  padding: '12px 20px',
                  background: '#10b981',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '14.5px',
                  fontWeight: '700',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 3px 8px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => {
                  if (!isSubmitting) e.currentTarget.style.background = '#059669';
                }}
                onMouseLeave={(e) => {
                  if (!isSubmitting) e.currentTarget.style.background = '#10b981';
                }}
              >
                {isSubmitting ? (
                  <span>⏳ Đang lưu dữ liệu...</span>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{isEditing ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</span>
                  </>
                )}
              </button>

              {/* Nút Hủy / Quay lại */}
              <button
                type="button"
                onClick={onBack}
                disabled={isSubmitting || isDeleting}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  color: '#475569',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                Hủy bỏ & Quay lại
              </button>

              {/* Nút Xóa sản phẩm khi đang chỉnh sửa */}
              {isEditing && (
                <div style={{ marginTop: '8px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={isDeleting || isSubmitting}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '10px',
                      color: '#dc2626',
                      fontSize: '13.5px',
                      fontWeight: '700',
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isDeleting) {
                        e.currentTarget.style.background = '#fee2e2';
                        e.currentTarget.style.borderColor = '#f87171';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isDeleting) {
                        e.currentTarget.style.background = '#fef2f2';
                        e.currentTarget.style.borderColor = '#fecaca';
                      }
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                    <span>{isDeleting ? 'Đang xóa...' : 'Xóa sản phẩm này'}</span>
                  </button>

                  {hasTransactions && (
                    <p style={{ margin: '8px 0 0', fontSize: '11.5px', color: '#64748b', textAlign: 'center', lineHeight: '1.4' }}>
                      🔒 Sản phẩm có {product?.transaction_count} giao dịch liên quan
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        </aside>
      </form>

      {/* Modal xác nhận xóa */}
      {showDeleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(3px)',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              padding: '24px',
              maxWidth: '460px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontSize: '24px' }}>🗑️</span>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '750', color: '#0f172a' }}>
                Xác nhận xóa sản phẩm
              </h3>
            </div>

            <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
              Bạn có chắc chắn muốn xóa sản phẩm <strong>{product?.code} - {product?.name}</strong> khỏi danh mục hệ thống?
            </p>

            {hasTransactions && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '12.5px',
                  color: '#92400e',
                  marginBottom: '16px',
                  lineHeight: '1.45',
                }}
              >
                ⚠️ <strong>Lưu ý:</strong> Sản phẩm này đã phát sinh <strong>{product?.transaction_count}</strong> giao dịch (đơn hàng/kho). Bạn có thể chọn xóa trực tiếp hoặc chuyển sang trạng thái <em>Ngừng kinh doanh</em>.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                style={{
                  padding: '8px 16px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>

              {hasTransactions && (
                <button
                  type="button"
                  onClick={handleSwitchToInactive}
                  disabled={isDeleting}
                  style={{
                    padding: '8px 14px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '8px',
                    color: '#1d4ed8',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Chuyển sang Ngừng KD
                </button>
              )}

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  padding: '8px 18px',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                }}
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
