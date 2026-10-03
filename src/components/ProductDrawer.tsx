import React, { useState, useEffect, useRef } from 'react';
import { ProductItem, ProductPayload, createProductApi, updateProductApi, deleteProductApi, API_BASE_URL } from '../services/api';
import { emitStatusToast } from './StatusToast';

interface ProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductItem | null; // null => Thêm mới, khác null => Chỉnh sửa
  token: string;
  isCostVisible: boolean; // RBAC: Sales Manager / Admin được xem & sửa cost_price
  categories: string[];
  onSuccess: (updatedProduct?: ProductItem, isDeleted?: boolean) => void;
}

const DEFAULT_UNITS = ['Cái', 'Chiếc', 'Hộp', 'Kg', 'Thùng', 'Bộ', 'Gói', 'Chai', 'Đôi'];

export const ProductDrawer: React.FC<ProductDrawerProps> = ({
  isOpen,
  onClose,
  product,
  token,
  isCostVisible,
  categories,
  onSuccess,
}) => {
  const isEditing = Boolean(product);
  const hasTransactions = Boolean(product && (product.transaction_count || 0) > 0);

  // Form states
  // Khối 1: Thông tin cơ bản
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

  // Khối 2: Quy cách & Đơn vị tính
  const [baseUnit, setBaseUnit] = useState('Cái');
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState('');
  const [packagingSpec, setPackagingSpec] = useState('');

  // Khối 3: Giá & Phân quyền dữ liệu
  const [sellPrice, setSellPrice] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);

  // Khối 4: Trạng thái & Vòng đời sản phẩm
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Submit / Delete states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wasOpenRef = useRef<boolean>(false);
  const prevProductIdRef = useRef<number | null | undefined>(undefined);

  // Khởi tạo và reset form: CHỈ chạy đúng 1 lần khi Drawer chuyển từ ĐÓNG -> MỞ hoặc khi đối tượng sản phẩm thay đổi
  useEffect(() => {
    const isNowOpen = Boolean(isOpen);
    const wasOpen = wasOpenRef.current;
    const currentProductId = product ? product.id : null;
    const isProductChanged = currentProductId !== prevProductIdRef.current;

    wasOpenRef.current = isNowOpen;
    prevProductIdRef.current = currentProductId;

    if (!isNowOpen) {
      // Khi đóng Drawer: reset sạch sẽ form
      setSkuCode('');
      setProductName('');
      setImages([]);
      setGeneralError(null);
      setSkuError(null);
      setNameError(null);
      setShowDeleteConfirm(false);
      setIsAddingNewCategory(false);
      setIsAddingUnit(false);
      return;
    }

    // Chỉ khởi tạo giá trị khi vừa mới mở Drawer hoặc khi chuyển sang chọn sản phẩm khác
    if (!wasOpen || isProductChanged) {
      setGeneralError(null);
      setSkuError(null);
      setNameError(null);
      setShowDeleteConfirm(false);
      setIsAddingNewCategory(false);
      setIsAddingUnit(false);

      if (product) {
        setSkuCode(product.code || '');
        setProductName(product.name || '');
        setCategory(product.category || (categories[0] || 'Thời trang'));
        setImages(product.images || []);
        setMainImageIdx(0);
        setBaseUnit(product.base_unit || 'Cái');
        setPackagingSpec(product.packaging_specification || '');
        setSellPrice(product.sell_price || 0);
        setCostPrice(product.cost_price || 0);
        setStatus(product.status === 'inactive' ? 'inactive' : 'active');
      } else {
        // Thêm mới: Sinh mã SKU tự động đúng 1 lần duy nhất lúc mở Form và lưu cố định trong State
        const generatedSku = `SP${Math.floor(1000 + Math.random() * 9000)}`;
        setSkuCode(generatedSku);
        setProductName('');
        setCategory(categories[0] || 'Thời trang');
        setImages([]);
        setMainImageIdx(0);
        setBaseUnit('Cái');
        setPackagingSpec('');
        setSellPrice(100000);
        setCostPrice(50000);
        setStatus('active');
      }
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  // Xử lý mã SKU: Auto-upper case & Trim whitespace
  const handleSkuChange = (val: string) => {
    const formatted = val.toUpperCase().replace(/\s+/g, '');
    setSkuCode(formatted);
    if (skuError) setSkuError(null);
  };

  // Blur validate SKU
  const handleSkuBlur = async () => {
    if (!skuCode.trim()) {
      setSkuError('Mã SKU là bắt buộc.');
      return;
    }
    // Nếu đang sửa và không đổi mã thì bỏ qua
    if (isEditing && product && product.code.toUpperCase() === skuCode.trim()) {
      return;
    }

    try {
      setSkuChecking(true);
      // Gọi trực tiếp fetch check-sku
      const excludeParam = isEditing && product ? `&exclude_id=${product.id}` : '';
      const res = await fetch(`${API_BASE_URL}/products/check-sku?sku=${encodeURIComponent(skuCode.trim())}${excludeParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.available) {
          setSkuError(data.message || 'Mã SKU đã tồn tại toàn hệ thống.');
        } else {
          setSkuError(null);
        }
      }
    } catch {
      // ignore check error
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

  // Xử lý upload ảnh (PNG, JPG, WEBP, <= 5MB, tối đa 5 ảnh)
  const handleImageUpload = (files: FileList | null) => {
    if (!files) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const maxFiles = 5;
    const currentCount = images.length;

    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowedTypes.includes(file.type)) {
        emitStatusToast({ message: `Ảnh "${file.name}" không hợp lệ. Chỉ chấp nhận PNG, JPG, WEBP.`, title: 'Ảnh không đúng định dạng' });
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

    // Convert sang Base64 Data URL để preview & lưu
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImages((prev) => [...prev, e.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Xóa ảnh
  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    if (mainImageIdx === index) {
      setMainImageIdx(0);
    } else if (mainImageIdx > index) {
      setMainImageIdx((prev) => prev - 1);
    }
  };

  // Đổi thứ tự đặt làm ảnh đại diện chính
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

  // Tạo nhanh Đơn vị tính
  const handleAddNewUnit = () => {
    const trimmed = newUnitInput.trim();
    if (!trimmed) return;
    if (!DEFAULT_UNITS.includes(trimmed) && !customUnits.includes(trimmed)) {
      setCustomUnits((prev) => [...prev, trimmed]);
    }
    setBaseUnit(trimmed);
    setNewUnitInput('');
    setIsAddingUnit(false);
    emitStatusToast({ message: `Đã thêm đơn vị tính "${trimmed}"`, title: 'Thêm đơn vị tính thành công' });
  };

  // Format currency VNĐ
  const formatCurrency = (val: number): string => {
    return val.toLocaleString('vi-VN');
  };

  const handleCurrencyChange = (valStr: string, setter: (n: number) => void) => {
    const cleanNum = parseInt(valStr.replace(/\D/g, ''), 10) || 0;
    setter(cleanNum);
  };

  // Xử lý Lưu sản phẩm (Submit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    // Validation
    const cleanSku = skuCode.trim().toUpperCase();
    if (!cleanSku) {
      setSkuError('Mã SKU là bắt buộc.');
      return;
    }
    if (skuError) {
      return;
    }

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

    // Sắp xếp đưa ảnh chính lên đầu danh sách images
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
        onClose();
      } else {
        const created = await createProductApi(token, payload);
        emitStatusToast({ message: `Đã thêm mới sản phẩm ${created.code} thành công.`, title: 'Thêm mới thành công' });
        onSuccess(created);
        onClose();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu sản phẩm.';
      setGeneralError(msg);
      emitStatusToast({ message: msg, title: 'Lỗi lưu sản phẩm' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý Xóa sản phẩm
  const handleDelete = async () => {
    if (!product) return;
    if (hasTransactions) {
      setGeneralError('Sản phẩm đã phát sinh giao dịch. Chỉ cho phép chuyển trạng thái sang "Ngừng kinh doanh"!');
      return;
    }

    setIsDeleting(true);
    try {
      await deleteProductApi(token, product.id);
      emitStatusToast({ message: `Đã xóa sản phẩm ${product.code} thành công.`, title: 'Xóa thành công' });
      onSuccess(product, true);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi xóa sản phẩm.';
      setGeneralError(msg);
      emitStatusToast({ message: msg, title: 'Lỗi xóa sản phẩm' });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const allCategories = Array.from(new Set([...categories, ...customCategories])).filter(Boolean);
  const filteredCategories = allCategories.filter((c) =>
    c.toLowerCase().includes(categorySearch.toLowerCase())
  );
  const allUnits = Array.from(new Set([...DEFAULT_UNITS, ...customUnits]));

  return (
    <>
      {/* Backdrop mờ che phủ phần còn lại */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
          transition: 'all 0.25s ease',
        }}
      />

      {/* Drawer trượt mượt mà từ bên phải */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '680px',
          maxWidth: '95vw',
          background: '#ffffff',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.18)',
          borderLeft: '1px solid #e2e8f0',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Header Drawer */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '700',
              }}
            >
              📦
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                {isEditing ? `Chỉnh Sửa Sản Phẩm: ${product?.code}` : 'Khai Báo Sản Phẩm Mới'}
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                {isEditing ? 'Cập nhật thông tin chi tiết và trạng thái kinh doanh' : 'Nhập đầy đủ thông tin chuẩn hóa theo 4 khối nghiệp vụ'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Đóng cửa sổ"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Nội dung Form cuộn được */}
        <form
          onSubmit={handleSubmit}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {generalError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                padding: '12px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>⚠️</span>
              <span>{generalError}</span>
            </div>
          )}

          {/* ================= KHỐI 1: THÔNG TIN CƠ BẢN ================= */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '10px',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                Khối 1: Thông tin cơ bản (Basic Information)
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Mã SKU (sku_code) */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Mã SKU <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={skuCode}
                    disabled={hasTransactions}
                    onChange={(e) => handleSkuChange(e.target.value)}
                    onBlur={handleSkuBlur}
                    placeholder="VD: SP001"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: skuError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      fontFamily: 'ui-monospace, monospace',
                      fontWeight: '600',
                      color: hasTransactions ? '#64748b' : '#0f172a',
                      background: hasTransactions ? '#f8fafc' : '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {skuChecking && (
                    <span style={{ position: 'absolute', right: '10px', top: '9px', fontSize: '12px', color: '#64748b' }}>
                      ⏳
                    </span>
                  )}
                </div>
                {hasTransactions ? (
                  <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                    🔒 Đã phát sinh giao dịch &rarr; Khóa chỉnh sửa mã SKU.
                  </div>
                ) : (
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                    Tự động viết hoa & xóa khoảng trắng. Duy nhất toàn hệ thống.
                  </div>
                )}
                {skuError && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '3px' }}>{skuError}</div>}
              </div>

              {/* Nhóm hàng (category_id) */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Nhóm hàng <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <div
                    onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      color: category ? '#0f172a' : '#94a3b8',
                      background: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span>{category || 'Chọn nhóm hàng...'}</span>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>▼</span>
                  </div>

                  {/* Dropdown Search & Add Category */}
                  {isCategoryDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
                        marginTop: '4px',
                        padding: '8px',
                      }}
                    >
                      <input
                        type="text"
                        placeholder="Tìm hoặc tạo nhóm hàng..."
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          fontSize: '12.5px',
                          outline: 'none',
                          boxSizing: 'border-box',
                          marginBottom: '6px',
                        }}
                      />
                      <div style={{ maxHeight: '140px', overflowY: 'auto' }}>
                        {filteredCategories.map((cat) => (
                          <div
                            key={cat}
                            onClick={() => {
                              setCategory(cat);
                              setIsCategoryDropdownOpen(false);
                            }}
                            style={{
                              padding: '7px 10px',
                              borderRadius: '6px',
                              fontSize: '13px',
                              cursor: 'pointer',
                              background: category === cat ? '#eff6ff' : 'transparent',
                              color: category === cat ? '#1d4ed8' : '#334155',
                              fontWeight: category === cat ? '600' : '400',
                            }}
                          >
                            {cat}
                          </div>
                        ))}
                      </div>

                      {/* Tạo nhanh nhóm hàng */}
                      <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '6px' }}>
                        {isAddingNewCategory ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                              type="text"
                              placeholder="Tên nhóm mới..."
                              value={newCategoryInput}
                              onChange={(e) => setNewCategoryInput(e.target.value)}
                              style={{
                                flex: 1,
                                padding: '4px 8px',
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
                                padding: '4px 8px',
                                fontSize: '12px',
                                cursor: 'pointer',
                              }}
                            >
                              Lưu
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsAddingNewCategory(true)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#2563eb',
                              fontSize: '12.5px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              padding: '2px 0',
                            }}
                          >
                            + Thêm nhanh nhóm hàng mới
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tên sản phẩm (product_name) */}
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Tên sản phẩm <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={handleNameBlur}
                placeholder="VD: Áo Thun Polo Nam Cao Cấp Phối Bo Dệt"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: nameError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>Độ dài quy định từ 5 đến 255 ký tự.</span>
                <span style={{ fontSize: '11.5px', color: productName.length < 5 || productName.length > 255 ? '#ef4444' : '#64748b' }}>
                  {productName.length}/255
                </span>
              </div>
              {nameError && <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '2px' }}>{nameError}</div>}
            </div>

            {/* Hình ảnh sản phẩm (images) */}
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Hình ảnh sản phẩm (Tối đa 5 ảnh, &le; 5MB, PNG/JPG/WEBP)
              </label>

              {/* Vùng Drag & Drop */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleImageUpload(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: '10px',
                  padding: '16px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload(e.target.files)}
                />
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>🖼️</div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  Kéo thả ảnh vào đây hoặc <span style={{ color: '#2563eb' }}>bấm để chọn file</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                  Hỗ trợ PNG, JPG, WEBP. Ảnh đầu tiên hoặc được đánh dấu sao sẽ làm ảnh đại diện chính.
                </div>
              </div>

              {/* Danh sách ảnh Preview */}
              {images.length > 0 && (
                <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {images.map((img, idx) => {
                    const isMain = idx === mainImageIdx;
                    return (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: '84px',
                          height: '84px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: isMain ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: '#f1f5f9',
                        }}
                      >
                        <img src={img} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {isMain && (
                          <span
                            style={{
                              position: 'absolute',
                              top: 2,
                              left: 2,
                              background: '#2563eb',
                              color: '#ffffff',
                              fontSize: '9px',
                              fontWeight: '700',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            Chính
                          </span>
                        )}
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0, 0, 0, 0.65)',
                            display: 'flex',
                            justifyContent: 'space-around',
                            padding: '3px 0',
                          }}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetMainImage(idx);
                            }}
                            title="Đặt làm ảnh chính"
                            style={{ background: 'none', border: 'none', color: isMain ? '#fbbf24' : '#cbd5e1', cursor: 'pointer', fontSize: '11px' }}
                          >
                            ★
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(idx);
                            }}
                            title="Xóa ảnh này"
                            style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '11px' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ================= KHỐI 2: QUY CÁCH & ĐƠN VỊ TÍNH ================= */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '10px',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                Khối 2: Quy cách & Đơn vị tính (Packaging & Unit)
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Đơn vị tính cơ sở (base_unit) */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Đơn vị tính cơ sở <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {isAddingUnit ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      placeholder="VD: Thùng, Set, Lọ..."
                      value={newUnitInput}
                      onChange={(e) => setNewUnitInput(e.target.value)}
                      style={{
                        flex: 1,
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewUnit}
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0 12px',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      Thêm
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingUnit(false)}
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0 10px',
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
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13.5px',
                        color: '#0f172a',
                        background: '#ffffff',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {allUnits.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsAddingUnit(true)}
                      title="Thêm đơn vị mới"
                      style={{
                        padding: '0 10px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#2563eb',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      + Mới
                    </button>
                  </div>
                )}
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                  Đơn vị nhỏ nhất để kiểm kê và giao dịch.
                </div>
              </div>

              {/* Quy cách đóng gói (packaging_specification) */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Quy cách đóng gói
                </label>
                <input
                  type="text"
                  value={packagingSpec}
                  onChange={(e) => setPackagingSpec(e.target.value)}
                  placeholder="Ví dụ: 1 Thùng = 24 Hộp"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                  Mô tả chuẩn cách đóng gói để toàn công ty áp dụng đồng nhất.
                </div>
              </div>
            </div>
          </div>

          {/* ================= KHỐI 3: GIÁ & PHÂN QUYỀN DỮ LIỆU ================= */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '10px',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                Khối 3: Giá & Phân quyền dữ liệu (Pricing & Security)
              </span>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: '600',
                  color: isCostVisible ? '#15803d' : '#d97706',
                  background: isCostVisible ? '#f0fdf4' : '#fffbeb',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: isCostVisible ? '1px solid #bbf7d0' : '1px solid #fde68a',
                }}
              >
                {isCostVisible ? '🛡️ RBAC: Được phép quản lý Giá vốn' : '🔒 RBAC: Giá vốn được bảo mật (Masked)'}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Giá niêm yết bán lẻ */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Giá niêm yết bán lẻ (VNĐ) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formatCurrency(sellPrice)}
                  onChange={(e) => handleCurrencyChange(e.target.value, setSellPrice)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#0f172a',
                    fontVariantNumeric: 'tabular-nums',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                  Tự động format phân cách hàng nghìn.
                </div>
              </div>

              {/* Giá vốn (cost_price) - RBAC */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Giá vốn nhập kho (cost_price)
                </label>
                {isCostVisible ? (
                  <>
                    <input
                      type="text"
                      value={formatCurrency(costPrice)}
                      onChange={(e) => handleCurrencyChange(e.target.value, setCostPrice)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#0f172a',
                        fontVariantNumeric: 'tabular-nums',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ fontSize: '11.5px', color: '#15803d', marginTop: '4px' }}>
                      Quản lý kinh doanh (Sales Manager): Cho phép Xem và Chỉnh sửa.
                    </div>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value="***,*** VNĐ"
                      disabled
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        fontSize: '13.5px',
                        color: '#94a3b8',
                        background: '#f8fafc',
                        fontFamily: 'monospace',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ fontSize: '11.5px', color: '#d97706', marginTop: '4px' }}>
                      Các Role khác (NVKD, Kho, Mua hàng...): Ẩn hoàn toàn trường này (***).
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ================= KHỐI 4: TRẠNG THÁI & VÒNG ĐỜI SẢN PHẨM ================= */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '10px',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                Khối 4: Trạng thái & Vòng đời sản phẩm (Lifecycle & Status)
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
                Trạng thái kinh doanh
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: status === 'active' ? '2px solid #22c55e' : '1px solid #cbd5e1',
                    background: status === 'active' ? '#f0fdf4' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={status === 'active'}
                    onChange={() => setStatus('active')}
                  />
                  <span style={{ fontWeight: '600', color: '#15803d', fontSize: '13.5px' }}>
                    Đang kinh doanh (Active)
                  </span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: status === 'inactive' ? '2px solid #ef4444' : '1px solid #cbd5e1',
                    background: status === 'inactive' ? '#fef2f2' : '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="status"
                    value="inactive"
                    checked={status === 'inactive'}
                    onChange={() => setStatus('inactive')}
                  />
                  <span style={{ fontWeight: '600', color: '#b91c1c', fontSize: '13.5px' }}>
                    Ngừng kinh doanh (Inactive)
                  </span>
                </label>
              </div>

              {/* Ràng buộc logic xóa / ngừng kinh doanh */}
              <div
                style={{
                  marginTop: '14px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                  color: '#475569',
                  lineHeight: '1.5',
                }}
              >
                {hasTransactions ? (
                  <div>
                    ⚠️ <strong>Đã phát sinh giao dịch ({product?.transaction_count} đơn hàng/phiếu kho):</strong>{' '}
                    Hệ thống ẩn nút Xóa. Bắt buộc chỉ cho phép chuyển trạng thái sang <em>Ngừng kinh doanh</em> để bảo toàn lịch sử sổ sách.
                  </div>
                ) : (
                  <div>
                    ℹ️ <strong>Sản phẩm mới tạo (chưa có giao dịch):</strong> Bạn có toàn quyền sửa mã SKU hoặc dùng nút Xóa vĩnh viễn khỏi danh mục.
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div>
            {isEditing && !hasTransactions && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting || isSubmitting}
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  borderRadius: '8px',
                  padding: '9px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>🗑️</span>
                <span>{isDeleting ? 'Đang xóa...' : 'Xóa sản phẩm'}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isDeleting}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#475569',
                borderRadius: '8px',
                padding: '9px 18px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || isDeleting}
              style={{
                background: '#2563eb',
                border: 'none',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '9px 24px',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
              }}
            >
              {isSubmitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
            </button>
          </div>
        </div>

        {/* Modal xác nhận xóa */}
        {showDeleteConfirm && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                padding: '24px',
                maxWidth: '420px',
                width: '90%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              }}
            >
              <h4 style={{ margin: '0 0 10px', fontSize: '17px', color: '#dc2626', fontWeight: '700' }}>
                Xác nhận xóa sản phẩm?
              </h4>
              <p style={{ margin: '0 0 20px', fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
                Bạn có chắc chắn muốn xóa vĩnh viễn sản phẩm <strong>{product?.code} - {product?.name}</strong>? Thao tác này không thể hoàn tác.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Không xóa
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  style={{
                    background: '#dc2626',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '8px 18px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  {isDeleting ? 'Đang xóa...' : 'Đồng ý xóa'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
