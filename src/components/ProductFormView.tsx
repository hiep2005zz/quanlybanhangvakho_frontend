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

const DEFAULT_UNITS = ['Cái', 'Chiếc', 'Hộp', 'Kg', 'Thùng', 'Bộ', 'Gói', 'Chai', 'Đôi', 'Lon'];
const CUSTOM_UNITS_STORAGE_KEY = 'ttcs_custom_product_units';

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

  // 1. Mã SKU
  const [skuCode, setSkuCode] = useState('');
  const [skuError, setSkuError] = useState<string | null>(null);
  const [skuChecking, setSkuChecking] = useState(false);

  // 2. Tên sản phẩm
  const [productName, setProductName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  // 3. Nhóm hàng
  const [category, setCategory] = useState('');

  // 4. Đơn vị tính cơ sở & Custom units
  const [baseUnit, setBaseUnit] = useState('Cái');
  const [customUnits, setCustomUnits] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_UNITS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState('');
  const [unitError, setUnitError] = useState<string | null>(null);

  // 5. Quy cách đóng gói
  const [packagingSpec, setPackagingSpec] = useState('');

  // 6. Giá vốn & Giá bán
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [floorPrice, setFloorPrice] = useState<number>(0);

  // 7. Ảnh sản phẩm (1 ảnh đại diện duy nhất)
  const [image, setImage] = useState<string | null>(null);

  // 8. Trạng thái kinh doanh
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Khởi tạo state khi mở form
  useEffect(() => {
    if (product) {
      setSkuCode(product.code || '');
      setProductName(product.name || '');
      setCategory(product.category || (categories[0] || 'Thời trang'));
      setBaseUnit(product.base_unit || 'Cái');
      setPackagingSpec(product.packaging_specification || '');
      setCostPrice(product.cost_price || 0);
      setSellPrice(product.sell_price || 0);
      setFloorPrice(product.floor_price || 0);
      setStatus(product.status === 'inactive' ? 'inactive' : 'active');
      setImage(Array.isArray(product.images) && product.images.length > 0 ? product.images[0] : null);
    } else {
      setSkuCode('');
      setProductName('');
      setCategory(categories[0] || 'Thời trang');
      setBaseUnit('Cái');
      setPackagingSpec('');
      setCostPrice(0);
      setSellPrice(0);
      setFloorPrice(0);
      setStatus('active');
      setImage(null);
    }
    setSkuError(null);
    setNameError(null);
    setGeneralError(null);
    setIsAddingUnit(false);
    setNewUnitInput('');
    setUnitError(null);
  }, [product, categories]);

  // Cuộn trang lên đầu khi mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Validate SKU realtime
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

  // Upload 1 ảnh đại diện sản phẩm
  const handleImageUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
      emitStatusToast({
        message: `Ảnh "${file.name}" không hợp lệ. Chỉ chấp nhận định dạng PNG, JPG, WEBP.`,
        title: 'Ảnh không đúng định dạng',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      emitStatusToast({ message: `Ảnh "${file.name}" vượt quá 5MB.`, title: 'Ảnh quá dung lượng' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImage(e.target.result as string);
        emitStatusToast({ message: 'Tải ảnh sản phẩm thành công.', title: 'Ảnh sản phẩm' });
      }
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatCurrency = (val: number): string => {
    return val.toLocaleString('vi-VN');
  };

  const handleCurrencyChange = (valStr: string, setter: (n: number) => void) => {
    const cleanNum = parseInt(valStr.replace(/\D/g, ''), 10) || 0;
    setter(cleanNum);
  };

  // Danh sách hợp nhất tất cả các đơn vị tính
  const allUnits = Array.from(new Set([...DEFAULT_UNITS, ...customUnits, baseUnit].filter(Boolean)));

  // Thêm Đơn vị tính cơ sở mới
  const handleAddNewUnit = () => {
    const trimmed = newUnitInput.trim();
    if (!trimmed) {
      setUnitError('Vui lòng nhập tên đơn vị tính.');
      return;
    }

    const isDuplicate = allUnits.some(
      (u) => u.trim().toLowerCase() === trimmed.toLowerCase()
    );

    if (isDuplicate) {
      const existing = allUnits.find((u) => u.trim().toLowerCase() === trimmed.toLowerCase()) || trimmed;
      setBaseUnit(existing);
      setIsAddingUnit(false);
      setNewUnitInput('');
      setUnitError(null);
      emitStatusToast({ message: `Đã chọn đơn vị tính "${existing}".`, title: 'Đơn vị tính' });
      return;
    }

    const updated = [...customUnits, trimmed];
    setCustomUnits(updated);
    try {
      localStorage.setItem(CUSTOM_UNITS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    setBaseUnit(trimmed);
    setNewUnitInput('');
    setUnitError(null);
    setIsAddingUnit(false);
    emitStatusToast({ message: `Đã thêm đơn vị tính "${trimmed}".`, title: 'Thêm đơn vị tính thành công' });
  };

  // Submit form
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

    const payload: ProductPayload = {
      code: cleanSku,
      name: cleanName,
      category: category.trim(),
      base_unit: baseUnit.trim(),
      packaging_specification: packagingSpec.trim(),
      sell_price: sellPrice,
      floor_price: floorPrice,
      cost_price: isCostVisible ? costPrice : (product?.cost_price ?? 0),
      images: image ? [image] : [],
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

  // Xóa sản phẩm
  const handleDelete = async () => {
    if (!product) return;
    if (hasTransactions) {
      const msg = `Sản phẩm đã phát sinh giao dịch (${product.transaction_count} giao dịch). Không thể xóa, chỉ cho phép chuyển sang "Ngừng kinh doanh".`;
      setGeneralError(msg);
      emitStatusToast({ message: msg, title: 'Không thể xóa sản phẩm' });
      setShowDeleteConfirm(false);
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProductApi(token, product.id);
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

  // Chuyển nhanh sang ngừng kinh doanh
  const handleSwitchToInactive = async () => {
    if (!product) return;
    setStatus('inactive');
    setShowDeleteConfirm(false);
    emitStatusToast({
      message: 'Đã chuyển trạng thái sang "Ngừng kinh doanh". Hãy bấm "Lưu thay đổi" để áp dụng.',
      title: 'Thông báo',
    });
  };

  return (
    <div className="sales-order-page" style={{ paddingBottom: '60px' }}>
      {/* Tiêu đề trang */}
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
              ? 'Cập nhật thông tin chi tiết, quy cách đóng gói và giá vốn của sản phẩm.'
              : 'Nhập đầy đủ thông tin chuẩn hóa để quản lý sản phẩm trong hệ thống kho.'}
          </p>
        </div>

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

      {generalError && (
        <div className="sales-order-alert error" role="alert" style={{ marginBottom: '20px' }}>
          {generalError}
        </div>
      )}

      {/* Bố cục 2 cột */}
      <form onSubmit={handleSubmit} className="sales-order-layout">
        {/* CỘT CHÍNH (TRÁI): CÁC KHỐI NHẬP LIỆU */}
        <section className="sales-order-main">
          {/* Card 1: Thông tin cơ bản */}
          <section className="sales-order-card">
            <div style={{ marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
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
                      Đang kiểm tra...
                    </span>
                  )}
                </div>
                {hasTransactions && (
                  <span style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                    Đã phát sinh giao dịch &rarr; Khóa chỉnh sửa mã SKU.
                  </span>
                )}
                {skuError && (
                  <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px', fontWeight: '600' }}>
                    {skuError}
                  </span>
                )}
              </label>

              {/* Nhóm hàng */}
              <label className="sales-order-field">
                <span>
                  Ngành hàng / Nhóm hàng <b aria-hidden="true">*</b>
                </span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    height: '42px',
                    padding: '9px 12px',
                    borderRadius: '9px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    color: '#0f172a',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="">-- Chọn nhóm hàng --</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>

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
            <div style={{ marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
                Đơn vị tính & Quy cách đóng gói
              </h2>
            </div>

            <div className="sales-order-fields">
              {/* Đơn vị tính cơ sở */}
              <div className="sales-order-field">
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '8px' }}>
                  Đơn vị tính cơ sở <b aria-hidden="true" style={{ color: '#ef4444' }}>*</b>
                </span>

                {isAddingUnit ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="text"
                      autoFocus
                      placeholder="VD: Cuộn, Mét, Bao, Lon..."
                      value={newUnitInput}
                      onChange={(e) => {
                        setNewUnitInput(e.target.value);
                        if (unitError) setUnitError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddNewUnit();
                        } else if (e.key === 'Escape') {
                          setIsAddingUnit(false);
                          setUnitError(null);
                          setNewUnitInput('');
                        }
                      }}
                      style={{
                        flex: 1,
                        height: '42px',
                        padding: '9px 12px',
                        borderRadius: '9px',
                        border: unitError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                        fontSize: '13.5px',
                        boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewUnit}
                      style={{
                        height: '42px',
                        padding: '0 14px',
                        background: '#10b981',
                        border: 'none',
                        borderRadius: '9px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Lưu
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingUnit(false);
                        setUnitError(null);
                        setNewUnitInput('');
                      }}
                      style={{
                        height: '42px',
                        padding: '0 12px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '9px',
                        color: '#475569',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Hủy
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={baseUnit}
                      onChange={(e) => {
                        if (e.target.value === '__add_new__') {
                          setIsAddingUnit(true);
                          setUnitError(null);
                          setNewUnitInput('');
                        } else {
                          setBaseUnit(e.target.value);
                        }
                      }}
                      style={{
                        flex: 1,
                        height: '42px',
                        padding: '9px 12px',
                        borderRadius: '9px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '13.5px',
                        fontWeight: '600',
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    >
                      {allUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                      <option value="__add_new__">+ Thêm đơn vị tính mới...</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingUnit(true);
                        setUnitError(null);
                        setNewUnitInput('');
                      }}
                      title="Thêm đơn vị tính mới"
                      style={{
                        height: '42px',
                        padding: '0 12px',
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '9px',
                        fontSize: '13px',
                        color: '#1d4ed8',
                        cursor: 'pointer',
                        fontWeight: '700',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      + Thêm ĐVT
                    </button>
                  </div>
                )}

                {unitError && (
                  <span style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px', fontWeight: '600', display: 'block' }}>
                    {unitError}
                  </span>
                )}
                <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Đơn vị cơ sở là đơn vị nhỏ nhất để kiểm kê và lưu kho.
                </span>
              </div>

              {/* Quy cách đóng gói */}
              <label className="sales-order-field">
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', display: 'block', marginBottom: '8px' }}>
                  Quy cách đóng gói
                </span>
                <input
                  type="text"
                  value={packagingSpec}
                  onChange={(e) => setPackagingSpec(e.target.value)}
                  placeholder="Ví dụ: 24 lon / thùng, 1 lốc = 6 chai"
                  style={{ height: '42px', fontWeight: '500' }}
                />
                <span style={{ fontSize: '11.5px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  Ghi chú quy đổi đóng gói phục vụ quá trình bốc dỡ và xuất kho.
                </span>
              </label>
            </div>
          </section>

          {/* Card 3: Giá bán, Giá sàn, Giá vốn & Trạng thái kinh doanh */}
          <section className="sales-order-card">
            <div style={{ marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
                Giá bán, Giá sàn & Trạng thái kinh doanh
              </h2>
            </div>

            <div className="sales-order-fields">
              {/* Giá bán niêm yết */}
              <label className="sales-order-field">
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  Giá bán niêm yết (VNĐ)
                </span>
                <input
                  type="text"
                  placeholder="0 đ (hoặc nhập từ Bảng giá)"
                  value={sellPrice > 0 ? formatCurrency(sellPrice) : ''}
                  onChange={(e) => handleCurrencyChange(e.target.value, setSellPrice)}
                  style={{
                    fontSize: '15px',
                    fontWeight: '750',
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Giá niêm yết chuẩn hoặc tự động đồng bộ theo Bảng giá.
                </span>
              </label>

              {/* Giá sàn bán */}
              <label className="sales-order-field">
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  Giá sàn bán tối thiểu (VNĐ)
                </span>
                <input
                  type="text"
                  placeholder="0 đ (hoặc nhập từ Bảng giá)"
                  value={floorPrice > 0 ? formatCurrency(floorPrice) : ''}
                  onChange={(e) => handleCurrencyChange(e.target.value, setFloorPrice)}
                  style={{
                    fontSize: '15px',
                    fontWeight: '750',
                    color: '#0284c7',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                  Mức giá tối thiểu nhân viên kinh doanh được phép bán (dưới mức này cần duyệt).
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
                    ? 'Dữ liệu nội bộ bảo mật của Quản lý kinh doanh.'
                    : 'Bị ẩn bởi cơ chế bảo mật (Chỉ Quản lý kinh doanh và Admin).'}
                </span>
              </label>

              {/* Trạng thái kinh doanh */}
              <div className="sales-order-field">
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '8px' }}>
                  Trạng thái sản phẩm
                </span>
                <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', height: '42px' }}>
                  <button
                    type="button"
                    onClick={() => setStatus('active')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '999px',
                      border: status === 'active' ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                      background: status === 'active' ? '#dcfce7' : '#ffffff',
                      color: status === 'active' ? '#15803d' : '#64748b',
                      fontSize: '12.5px',
                      fontWeight: '750',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: status === 'active' ? '0 1px 3px rgba(22, 163, 74, 0.15)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: status === 'active' ? '#16a34a' : '#cbd5e1',
                        flexShrink: 0,
                      }}
                    />
                    <span>Đang giao dịch</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('inactive')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      borderRadius: '999px',
                      border: status === 'inactive' ? '1px solid #fecaca' : '1px solid #cbd5e1',
                      background: status === 'inactive' ? '#fee2e2' : '#ffffff',
                      color: status === 'inactive' ? '#b91c1c' : '#64748b',
                      fontSize: '12.5px',
                      fontWeight: '750',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: status === 'inactive' ? '0 1px 3px rgba(220, 38, 38, 0.15)' : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: status === 'inactive' ? '#dc2626' : '#cbd5e1',
                        flexShrink: 0,
                      }}
                    />
                    <span>Ngừng giao dịch</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Card 4: Hình ảnh sản phẩm (1 ảnh) */}
          <section className="sales-order-card">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              style={{ display: 'none' }}
              onChange={(e) => handleImageUpload(e.target.files)}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '750', color: '#0f172a' }}>
                  Ảnh sản phẩm
                </h2>
              </div>
              {image && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
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
                    Đổi ảnh
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#dc2626',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Xóa ảnh
                  </button>
                </div>
              )}
            </div>

            {/* Vùng ảnh */}
            {!image ? (
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
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>
                  Nhấn vào đây để tải ảnh sản phẩm
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Định dạng PNG, JPG, WEBP (dung lượng tối đa &le; 5MB)
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '140px',
                    height: '140px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                  }}
                >
                  <img
                    src={image}
                    alt="Ảnh sản phẩm"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                  Ảnh đã được tải lên thành công. Bạn có thể nhấn <strong>Đổi ảnh</strong> hoặc <strong>Xóa ảnh</strong> ở góc trên bên phải.
                </div>
              </div>
            )}
          </section>
        </section>

        {/* CỘT PHỤ (PHẢI): TỔNG KẾT & THAO TÁC */}
        <aside className="sales-order-sidebar">
          {/* Card: Tổng kết & Thao tác */}
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
              {packagingSpec && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Quy cách:</span>
                  <strong style={{ color: '#0f172a' }}>{packagingSpec}</strong>
                </div>
              )}

              {isCostVisible && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Giá vốn:</span>
                  <strong style={{ color: '#059669', fontSize: '14px' }}>{formatCurrency(costPrice)} đ</strong>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>Trạng thái:</span>
                <strong style={{ color: status === 'active' ? '#16a34a' : '#dc2626' }}>
                  {status === 'active' ? 'Đang giao dịch' : 'Ngừng giao dịch'}
                </strong>
              </div>
            </div>

            {/* Các nút bấm thao tác */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Nút Tạo / Lưu chính */}
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
                  <span>Đang lưu dữ liệu...</span>
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
                <div style={{ marginTop: '10px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                  {hasTransactions ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        type="button"
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px 16px',
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          color: '#94a3b8',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                        }}
                        title={`Sản phẩm đã có ${product?.transaction_count} giao dịch phát sinh. Không thể xóa, chỉ cho phép chọn Ngừng kinh doanh.`}
                      >
                        <span>Không thể xóa sản phẩm</span>
                      </button>
                    </div>
                  ) : (
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
            {hasTransactions ? (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '750', color: '#b91c1c' }}>
                    Không thể xóa sản phẩm
                  </h3>
                </div>

                <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
                  Sản phẩm <strong>{product?.code} - {product?.name}</strong> đã phát sinh{' '}
                  <strong>{product?.transaction_count}</strong> giao dịch (đơn hàng/phiếu kho).
                </p>

                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    fontSize: '13px',
                    color: '#991b1b',
                    marginBottom: '18px',
                    lineHeight: '1.5',
                  }}
                >
                  <strong>Quy định bảo toàn dữ liệu:</strong> Sản phẩm đã phát sinh giao dịch không thể xóa khỏi hệ thống để bảo đảm tính toàn vẹn chứng từ kế toán và lịch sử kho. Vui lòng chuyển sang trạng thái <strong>Ngừng kinh doanh</strong>.
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
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
                    Đóng
                  </button>

                  <button
                    type="button"
                    onClick={handleSwitchToInactive}
                    style={{
                      padding: '8px 16px',
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '8px',
                      color: '#1d4ed8',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Chuyển sang Ngừng kinh doanh
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '750', color: '#0f172a' }}>
                    Xác nhận xóa sản phẩm
                  </h3>
                </div>

                <p style={{ margin: '0 0 14px', fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
                  Bạn có chắc chắn muốn xóa sản phẩm <strong>{product?.code} - {product?.name}</strong> khỏi danh mục hệ thống? Thao tác này không thể hoàn tác.
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
                      cursor: isDeleting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
