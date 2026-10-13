import React, { useState, useEffect } from 'react';
import {
  createPriceBookApi,
  updatePriceBookApi,
  fetchPriceBookDetailApi,
  getProductsApi,
  PriceBookItem,
  ProductItem,
  User,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { useNavigate, useParams } from '../hooks/useLocation';

export interface CreatePriceListPageProps {
  token: string;
  currentUser?: User | null;
  products?: ProductItem[];
  editId?: string | number;
  isEdit?: boolean;
  onClose?: () => void;
  onSuccess?: () => void;
}

export const CreatePriceListPage: React.FC<CreatePriceListPageProps> = ({
  token,
  currentUser: _currentUser,
  products: initialProducts,
  editId: propEditId,
  isEdit: propIsEdit,
  onClose,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();

  const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
  const isEditRoute = pathname.endsWith('/edit') || Boolean(propIsEdit);
  const targetEditId = propEditId || (isEditRoute ? paramId : undefined);
  const isEditMode = Boolean(isEditRoute && targetEditId);

  // Helper định dạng ngày giờ cho input datetime-local
  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 1. Quản lý State của Form
  const [formData, setFormData] = useState({
    code: `BG-${Date.now().toString().slice(-6)}`,
    name: '',
    customer_group: 'dai_ly_cap_1',
    valid_from: formatDateTimeLocal(now),
    valid_to: formatDateTimeLocal(thirtyDaysLater),
    status: 'ACTIVE',
    note: '',
  });

  // 2. State điều hướng Tabs
  const [activeTab, setActiveTab] = useState<'info' | 'items'>('info');

  // 3. State danh mục sản phẩm & sản phẩm đã chọn
  const [products, setProducts] = useState<ProductItem[]>(initialProducts || []);
  const [formItems, setFormItems] = useState<PriceBookItem[]>([]);
  const [newProductId, setNewProductId] = useState('');
  const [newSalePrice, setNewSalePrice] = useState('');
  const [newFloorPrice, setNewFloorPrice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Tải danh mục sản phẩm nếu props chưa có
  useEffect(() => {
    if (!initialProducts || initialProducts.length === 0) {
      getProductsApi(token)
        .then((data) => setProducts(data.items || []))
        .catch((err) => console.error('Lỗi tải danh mục sản phẩm:', err));
    } else {
      setProducts(initialProducts);
    }
  }, [token, initialProducts]);

  // Điều hướng quay lại danh sách
  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/price-books');
    }
  };

  // Nạp dữ liệu cũ khi ở chế độ Sửa (Edit mode)
  useEffect(() => {
    if (isEditMode && targetEditId) {
      setIsLoadingDetail(true);
      fetchPriceBookDetailApi(token, Number(targetEditId))
        .then((detail) => {
          if (detail.is_locked) {
            emitStatusToast({
              message: 'Bảng giá đã phát sinh đơn hàng, không được phép chỉnh sửa. Vui lòng tạo phiên bản mới.',
              title: 'Bảng giá đã bị khóa',
              type: 'warning',
            });
            handleBack();
            return;
          }
          setFormData({
            code: detail.code,
            name: detail.name,
            customer_group: detail.customer_group,
            valid_from: detail.valid_from ? detail.valid_from.slice(0, 16) : formatDateTimeLocal(now),
            valid_to: detail.valid_to ? detail.valid_to.slice(0, 16) : formatDateTimeLocal(thirtyDaysLater),
            status: detail.status || 'ACTIVE',
            note: detail.note || '',
          });
          setFormItems(detail.items || []);
        })
        .catch((err) => {
          emitStatusToast({
            message: err.message || 'Lỗi khi tải chi tiết bảng giá',
            title: 'Lỗi',
            type: 'error',
          });
          handleBack();
        })
        .finally(() => {
          setIsLoadingDetail(false);
        });
    }
  }, [token, isEditMode, targetEditId]);

  // Chọn sản phẩm và tự động điền giá niêm yết / giá sàn đề xuất
  const handleProductSelect = (productIdStr: string) => {
    setNewProductId(productIdStr);
    const pid = parseInt(productIdStr, 10);
    const prod = products.find((p) => p.id === pid);
    if (prod) {
      const currentSellPrice = prod.sell_price != null ? prod.sell_price : 0;
      setNewSalePrice(currentSellPrice > 0 ? currentSellPrice.toString() : '');
      const currentFloorPrice =
        prod.floor_price != null && prod.floor_price > 0
          ? prod.floor_price
          : Math.round(currentSellPrice * 0.85);
      setNewFloorPrice(currentFloorPrice > 0 ? currentFloorPrice.toString() : '');
    } else {
      setNewSalePrice('');
      setNewFloorPrice('');
    }
  };

  // Thêm sản phẩm vào danh sách bảng giá
  const addFormItem = () => {
    const pid = parseInt(newProductId, 10);
    const sp = parseFloat(newSalePrice);
    const fp = parseFloat(newFloorPrice);

    if (!pid || isNaN(pid)) {
      emitStatusToast({ message: 'Vui lòng chọn sản phẩm' });
      return;
    }

    if (formItems.some((i) => i.product_id === pid)) {
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

    const prod = products.find((p) => p.id === pid);

    setFormItems([
      {
        product_id: pid,
        product_code: prod?.code,
        product_name: prod?.name,
        price: sp,
        min_price: fp,
        sale_price: sp,
        floor_price: fp,
      },
      ...formItems,
    ]);

    setNewProductId('');
    setNewSalePrice('');
    setNewFloorPrice('');
  };

  // Xóa sản phẩm khỏi danh sách
  const removeFormItem = (pid: number) => {
    setFormItems(formItems.filter((i) => i.product_id !== pid));
  };

  // Chỉnh sửa trực tiếp giá niêm yết hoặc giá sàn trong bảng
  const handleInlineEdit = (pid: number, field: 'sale_price' | 'floor_price', val: string) => {
    if (val !== '' && isNaN(parseFloat(val))) return;
    setFormItems(
      formItems.map((item) => {
        if (item.product_id === pid) {
          const num = val === '' ? ('' as any) : parseFloat(val);
          return {
            ...item,
            [field]: num,
            price: field === 'sale_price' ? (val === '' ? 0 : parseFloat(val)) : item.sale_price || 0,
            min_price: field === 'floor_price' ? (val === '' ? 0 : parseFloat(val)) : item.floor_price || 0,
          };
        }
        return item;
      })
    );
  };

  // Xử lý gửi form (Tạo mới hoặc Cập nhật)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      emitStatusToast({ message: 'Vui lòng nhập Tên Bảng Giá', title: 'Thông báo', type: 'warning' });
      setActiveTab('info');
      return;
    }

    if (new Date(formData.valid_to) < new Date(formData.valid_from)) {
      emitStatusToast({
        message: 'Ngày kết thúc không được nhỏ hơn ngày bắt đầu',
        title: 'Thông báo',
        type: 'warning',
      });
      setActiveTab('info');
      return;
    }

    if (formItems.length === 0) {
      emitStatusToast({
        message: 'Vui lòng thêm ít nhất 1 sản phẩm vào bảng giá',
        title: 'Thông báo',
        type: 'warning',
      });
      setActiveTab('items');
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedValidFrom = new Date(formData.valid_from).toISOString();
      const formattedValidTo = new Date(formData.valid_to).toISOString();

      const normalizedItems = formItems.map((item) => ({
        product_id: Number(item.product_id),
        sale_price: Number(item.sale_price) || 0,
        floor_price: Number(item.floor_price) || 0,
        price: Number(item.sale_price) || 0,
        min_price: Number(item.floor_price) || 0,
      }));

      if (isEditMode && targetEditId) {
        await updatePriceBookApi(token, Number(targetEditId), {
          name: formData.name.trim(),
          customer_group: formData.customer_group,
          valid_from: formattedValidFrom,
          valid_to: formattedValidTo,
          status: formData.status,
          note: formData.note.trim() || undefined,
          items: normalizedItems,
        });

        emitStatusToast({
          message: 'Cập nhật Bảng giá thành công!',
          title: 'Thành công',
          type: 'success',
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
          items: normalizedItems,
        });

        emitStatusToast({
          message: 'Thêm mới Bảng giá thành công!',
          title: 'Thành công',
          type: 'success',
        });
      }

      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/price-books');
      }
    } catch (err: any) {
      emitStatusToast({
        message: err.message || 'Lỗi lưu bảng giá',
        title: 'Thất bại',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAddingWarning = Boolean(
    newSalePrice && newFloorPrice && parseFloat(newSalePrice) < parseFloat(newFloorPrice)
  );

  const isDateInvalid = Boolean(
    formData.valid_to &&
    formData.valid_from &&
    new Date(formData.valid_to) < new Date(formData.valid_from)
  );

  if (isLoadingDetail) {
    return (
      <div className="w-full flex-1 bg-slate-50 flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-semibold text-slate-600">Đang tải dữ liệu bảng giá...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex-1 bg-slate-50 flex flex-col min-h-full">
      {/* 1. Header Trang Độc Lập - 100% Full Width */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              title="Quay lại danh sách bảng giá"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Quay lại</span>
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              {isEditMode ? `Cập nhật Bảng Giá: ${formData.code}` : 'Thêm mới Bảng Giá'}
            </h1>
          </div>
        </div>
      </div>

      {/* 2. Main Container & Form - 100% Full Width (Không khoảng trắng thừa 2 bên) */}
      <form onSubmit={handleSubmitForm} className="flex-1 w-full px-4 sm:px-8 py-6 space-y-6 pb-16">
        {/* Navigation Tabs */}
        <div className="w-full flex border-b border-slate-200 gap-8 bg-slate-50 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`pb-3 px-1 text-sm sm:text-base font-bold transition-all relative cursor-pointer border-0 bg-transparent ${
              activeTab === 'info' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Thông tin chung
            {activeTab === 'info' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.75 bg-blue-600 rounded-t-full"></span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`pb-3 px-1 text-sm sm:text-base font-bold transition-all relative flex items-center gap-2 cursor-pointer border-0 bg-transparent ${
              activeTab === 'items' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Danh sách sản phẩm</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === 'items'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {formItems.length}
            </span>
            {activeTab === 'items' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.75 bg-blue-600 rounded-t-full"></span>
            )}
          </button>
        </div>

        {/* TAB 1: THÔNG TIN CHUNG */}
        {activeTab === 'info' && (
          <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Mã Bảng Giá */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Mã Bảng Giá <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  disabled={isEditMode}
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="Ví dụ: BG-312810"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    isEditMode
                      ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed font-mono font-bold'
                      : 'border-slate-300 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                  }`}
                />
                {isEditMode && (
                  <p className="text-xs text-slate-400 mt-1">Mã bảng giá là định danh duy nhất và không thể thay đổi.</p>
                )}
              </div>

              {/* Tên Bảng Giá */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Tên Bảng Giá <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: Bảng giá Đại lý cấp 1 - Quý 4"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Nhóm Khách Hàng */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Nhóm Khách Hàng <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.customer_group}
                  onChange={(e) => setFormData({ ...formData, customer_group: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="dai_ly_cap_1">Đại lý cấp 1</option>
                  <option value="dai_ly_cap_2">Đại lý cấp 2</option>
                  <option value="khach_si">Khách sỉ</option>
                  <option value="khach_le">Khách lẻ</option>
                </select>
              </div>

              {/* Trạng thái */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Trạng thái
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all cursor-pointer"
                >
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="INACTIVE">Ngừng hoạt động</option>
                </select>
              </div>

              {/* Ngày bắt đầu */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Ngày bắt đầu <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Ngày kết thúc */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Ngày kết thúc <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  min={formData.valid_from}
                  value={formData.valid_to}
                  onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 transition-all ${
                    isDateInvalid
                      ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500'
                      : 'border-slate-300 focus:ring-emerald-500/20 focus:border-emerald-500'
                  }`}
                />
                {isDateInvalid && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    Ngày kết thúc không được nhỏ hơn ngày bắt đầu
                  </p>
                )}
              </div>

              {/* Ghi chú */}
              <div className="col-span-1 md:col-span-2 lg:col-span-3">
                <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Ghi chú
                </label>
                <textarea
                  rows={3}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  placeholder="Nhập ghi chú hoặc điều kiện áp dụng nếu có..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-y"
                />
              </div>
            </div>

            {/* Action Buttons ở cuối card */}
            <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#0fad89] hover:bg-[#0c9576] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Đang lưu...' : isEditMode ? 'Lưu Thay Đổi' : 'Lưu Bảng Giá'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: DANH SÁCH SẢN PHẨM */}
        {activeTab === 'items' && (
          <div className="w-full space-y-6">
            {/* Khối Thêm Sản Phẩm Mới Vào Bảng Giá */}
            <div className="w-full bg-white rounded-2xl border border-slate-200 p-5 sm:p-7 shadow-xs">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Thêm sản phẩm vào bảng giá
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Chọn Sản phẩm (5 cột) */}
                <div className="md:col-span-5">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Sản phẩm
                  </label>
                  <select
                    value={newProductId}
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">-- Chọn Sản phẩm --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name} (Niêm yết: {(p.sell_price || 0).toLocaleString('vi-VN')} đồng)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Giá Niêm Yết (3 cột) */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Giá niêm yết (đồng)
                  </label>
                  <input
                    type="number"
                    placeholder="Giá niêm yết (đồng)..."
                    value={newSalePrice}
                    onChange={(e) => setNewSalePrice(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 ${
                      isAddingWarning
                        ? 'border-red-500 text-red-600 focus:ring-red-500/20'
                        : 'border-slate-300 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-500'
                    }`}
                  />
                </div>

                {/* Giá Sàn (2 cột) */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Giá sàn (đồng)
                  </label>
                  <input
                    type="number"
                    placeholder="Giá sàn (đồng)..."
                    value={newFloorPrice}
                    onChange={(e) => setNewFloorPrice(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                {/* Nút Thêm sản phẩm (2 cột) */}
                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={addFormItem}
                    className="w-full h-11 px-3 bg-[#0fad89] hover:bg-[#0c9576] text-white font-bold text-sm rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                  >
                    <span>Thêm sản phẩm</span>
                  </button>
                </div>
              </div>

              {/* Cảnh báo Giá niêm yết < Giá sàn */}
              {isAddingWarning && (
                <div className="mt-2.5 text-xs text-red-600 font-semibold">
                  Cảnh báo: Đơn giá niêm yết nhỏ hơn giá sàn quy định! Đơn hàng sẽ phải chuyển sang Quản lý phê duyệt.
                </div>
              )}
            </div>

            {/* Bảng Danh Sách Sản Phẩm Đã Thêm - Full Width */}
            <div className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm border-collapse min-w-[640px]">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 text-xs uppercase font-extrabold tracking-wider border-b border-slate-200">
                      <th className="py-3.5 px-6">Mã Sản Phẩm</th>
                      <th className="py-3.5 px-6">Tên Sản Phẩm</th>
                      <th className="py-3.5 px-6 text-right">Giá Niêm Yết (đồng)</th>
                      <th className="py-3.5 px-6 text-right">Giá Sàn (đồng)</th>
                      <th className="py-3.5 px-6 text-center w-24">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formItems.map((item) => {
                      const isBelowFloor = (item.sale_price || 0) < (item.floor_price || 0);
                      return (
                        <tr
                          key={item.product_id}
                          className={`transition-colors ${
                            isBelowFloor ? 'bg-red-50/70 hover:bg-red-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3.5 px-6 font-mono font-bold text-slate-800 text-xs">
                            <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              {item.product_code || `#${item.product_id}`}
                            </span>
                          </td>
                          <td className="py-3.5 px-6 font-semibold text-slate-800">
                            {item.product_name || '-'}
                          </td>
                          <td className="py-2.5 px-6 text-right">
                            <input
                              type="number"
                              value={item.sale_price != null ? item.sale_price : ''}
                              onChange={(e) =>
                                handleInlineEdit(item.product_id, 'sale_price', e.target.value)
                              }
                              className={`w-36 px-2.5 py-1.5 text-right font-bold text-sm rounded-lg border focus:outline-none focus:ring-2 ${
                                isBelowFloor
                                  ? 'border-red-400 text-red-600 focus:ring-red-400/20'
                                  : 'border-slate-300 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-500'
                              }`}
                            />
                          </td>
                          <td className="py-2.5 px-6 text-right">
                            <input
                              type="number"
                              value={item.floor_price != null ? item.floor_price : ''}
                              onChange={(e) =>
                                handleInlineEdit(item.product_id, 'floor_price', e.target.value)
                              }
                              className="w-36 px-2.5 py-1.5 text-right font-semibold text-sm text-slate-700 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                          </td>
                          <td className="py-3.5 px-6 text-center">
                            <button
                              type="button"
                              onClick={() => removeFormItem(item.product_id)}
                              className="px-2.5 py-1 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors cursor-pointer"
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
                        <td colSpan={5} className="py-12 px-6 text-center text-slate-400">
                          Chưa có sản phẩm nào trong bảng giá. Hãy chọn sản phẩm ở ô trên và nhấn "Thêm sản phẩm".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons ở cuối Tab 2 */}
            <div className="w-full bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="px-5 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-bold text-white bg-[#0fad89] hover:bg-[#0c9576] rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? 'Đang lưu...' : isEditMode ? 'Lưu Thay Đổi' : 'Lưu Bảng Giá'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default CreatePriceListPage;
