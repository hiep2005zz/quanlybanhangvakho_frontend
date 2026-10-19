import React, { useState, useMemo, useEffect } from 'react';
import {
  ProductItem,
  createBatchApi,
  formatErrorMessage,
  getWarehousesApi,
  WarehouseItem,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ProductSelectDropdown } from './ProductSelectDropdown';

export interface BatchCreateViewProps {
  token: string;
  products?: ProductItem[];
  onBack: () => void;
  onSuccess: () => void;
}

export const BatchCreateView: React.FC<BatchCreateViewProps> = ({
  token,
  products: initialProducts,
  onBack,
  onSuccess,
}) => {
  // Form states
  const [selectedProductId, setSelectedProductId] = useState<number>(() => {
    return initialProducts && initialProducts.length > 0 ? initialProducts[0].id : 0;
  });
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(() => {
    return initialProducts && initialProducts.length > 0 ? initialProducts[0] : null;
  });
  const [warehouseId, setWarehouseId] = useState<number>(1);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [batchNumber, setBatchNumber] = useState<string>('');
  const [mfgDate, setMfgDate] = useState<string>('');
  const [expDate, setExpDate] = useState<string>('');
  const [initialQty, setInitialQty] = useState<string>('0');
  const [note, setNote] = useState<string>('');

  // Tải danh sách kho thực tế từ backend
  useEffect(() => {
    let active = true;
    getWarehousesApi(token)
      .then((data) => {
        if (active && data && data.length > 0) {
          setWarehouses(data);
          setWarehouseId((prev) => (data.some((w) => w.id === prev) ? prev : data[0].id));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);

  // Trạng thái xử lý
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Sinh mã lô tự động chuẩn WMS: LOT-YYYYMMDD-XXX
  const handleGenerateBatchNumber = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const skuCode = selectedProduct?.code ? selectedProduct.code.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() : 'SKU';
    const generated = `LOT-${skuCode}-${yyyy}${mm}${dd}-${randomSuffix}`;
    setBatchNumber(generated);
  };

  // Tính toán nhanh hạn sử dụng (+N tháng từ NSX hoặc hôm nay)
  const handleApplyExpiryPreset = (monthsToAdd: number) => {
    const base = mfgDate ? new Date(mfgDate) : new Date();
    if (isNaN(base.getTime())) return;
    const target = new Date(base);
    target.setMonth(target.getMonth() + monthsToAdd);
    const yyyy = target.getFullYear();
    const mm = String(target.getMonth() + 1).padStart(2, '0');
    const dd = String(target.getDate()).padStart(2, '0');
    setExpDate(`${yyyy}-${mm}-${dd}`);
  };

  // Tính toán thông số hạn dùng theo thời gian thực
  const shelfLifeMetrics = useMemo(() => {
    if (!expDate) return null;
    const exp = new Date(expDate);
    if (isNaN(exp.getTime())) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let totalShelfDays: number | null = null;
    if (mfgDate) {
      const mfg = new Date(mfgDate);
      if (!isNaN(mfg.getTime())) {
        totalShelfDays = Math.ceil((exp.getTime() - mfg.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    let status: 'EXPIRED' | 'NEAR_EXPIRY' | 'SAFE' = 'SAFE';
    if (diffDays <= 0) {
      status = 'EXPIRED';
    } else if (diffDays <= 30) {
      status = 'NEAR_EXPIRY';
    } else {
      status = 'SAFE';
    }

    return {
      diffDays,
      totalShelfDays,
      status,
    };
  }, [mfgDate, expDate]);

  // Xử lý gửi biểu mẫu tạo lô
  // Xử lý gửi biểu mẫu tạo lô
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: 'Vui lòng chọn sản phẩm cần khởi tạo lô.',
        type: 'warning',
      });
      return;
    }

    const cleanBatch = batchNumber.trim().toUpperCase();
    if (!cleanBatch) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: 'Vui lòng nhập số lô hàng (Batch Number).',
        type: 'warning',
      });
      return;
    }

    if (!expDate) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: 'Vui lòng chọn hạn sử dụng (HSD).',
        type: 'warning',
      });
      return;
    }

    if (mfgDate && expDate <= mfgDate) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: 'Hạn sử dụng bắt buộc phải sau Ngày sản xuất.',
        type: 'error',
      });
      return;
    }

    const parsedQty = parseFloat(initialQty);
    if (isNaN(parsedQty) || parsedQty < 0) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: 'Số lượng tồn kho ban đầu không được âm (>= 0).',
        type: 'warning',
      });
      return;
    }

    setSubmitting(true);
    try {
      await createBatchApi(token, {
        product_id: selectedProductId,
        warehouse_id: warehouseId,
        batch_number: cleanBatch,
        manufacturing_date: mfgDate ? new Date(mfgDate).toISOString() : null,
        expiry_date: new Date(expDate).toISOString(),
        initial_quantity: parsedQty,
        note: note.trim() || undefined,
      });

      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: `Khởi tạo lô thành công! Đã tạo số lô ${cleanBatch} cho sản phẩm ${selectedProduct?.name || ''}.`,
        type: 'success',
        actionType: 'create',
      });

      onSuccess();
    } catch (err: any) {
      const msg = err?.message || 'Lỗi khi khởi tạo lô hàng.';
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: formatErrorMessage(msg),
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full flex-1 bg-slate-50 flex flex-col min-h-full">
      {/* 1. Header Trang Độc Lập */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              title="Quay lại danh sách theo dõi lô & hạn sử dụng"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Quay lại danh sách</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quản lý kho / Lô & Hạn sử dụng
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Khởi Tạo Lô Hàng Mới
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Đang tạo lô mới
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Content & Form (2 Cột Responsive) */}
      {/* 2. Main Content & Form: Trải rộng toàn màn hình (full-width), loại bỏ 2 khoảng trắng thừa */}
      <form onSubmit={handleSubmit} className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-5 pb-14">


        {/* Khung Bảng Duy Nhất (Single Unified Card Container - Full Width) */}
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden divide-y divide-slate-200">
          {/* PHẦN 1: Thông tin sản phẩm & SKU */}
          <div className="p-5 sm:p-6 space-y-3.5">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                1
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Thông Tin Sản Phẩm & SKU Hàng Hóa
              </h2>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                Sản phẩm / SKU <span className="text-red-500">*</span>
              </label>
              <ProductSelectDropdown
                token={token}
                selectedProductId={selectedProductId}
                onSelectProduct={(p) => {
                  setSelectedProductId(p.id);
                  setSelectedProduct(p);
                }}
                placeholder="Bấm vào để tìm và chọn sản phẩm / SKU..."
                autoSelectFirst={true}
              />

              {/* Bảng chi tiết sản phẩm đã chọn */}
              {selectedProduct && (
                <div className="mt-2.5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-2xs">
                        <tr>
                          <th className="py-2.5 px-3">Mã SKU</th>
                          <th className="py-2.5 px-3">Tên sản phẩm</th>
                          <th className="py-2.5 px-3">Ngành hàng</th>
                          <th className="py-2.5 px-3 text-center">ĐVT</th>
                          <th className="py-2.5 px-3 text-right">Tồn kho hiện tại</th>
                          <th className="py-2.5 px-3 text-center">Chế độ quản lý lô</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800">
                        <tr className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                            {selectedProduct.code}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-900" title={selectedProduct.name}>
                            {selectedProduct.name}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {selectedProduct.category || 'Chưa phân loại'}
                          </td>
                          <td className="py-2.5 px-3 text-center text-slate-600 whitespace-nowrap">
                            {selectedProduct.base_unit || 'Cái'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700 whitespace-nowrap">
                            {selectedProduct.stock ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center whitespace-nowrap">
                            {selectedProduct.is_batch_managed ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                Đang Bật
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-semibold bg-blue-50 text-blue-700 border border-blue-200" title="Khi tạo lô mới, sản phẩm sẽ được tự động kích hoạt quản lý lô">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                Tự động bật khi tạo lô
                              </span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PHẦN 2: Định Danh Lô & Vòng Đời Hạn Dùng (Lưới 2 Cột Thoáng Đãng) */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                2
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Thông Số Định Danh Lô & Vòng Đời Hạn Sử Dụng
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Cột 1: Kho hàng lưu trữ */}
              <div>
                <div className="flex items-center justify-between h-7 mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                    Kho hàng lưu trữ <span className="text-red-500">*</span>
                  </label>
                </div>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(Number(e.target.value))}
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors outline-none cursor-pointer"
                >
                  {warehouses.length > 0 ? (
                    warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} {wh.code ? `(${wh.code})` : ''} - ID: {wh.id}
                      </option>
                    ))
                  ) : (
                    <option value={1}>Kho Tổng (Kho chính - ID: 1)</option>
                  )}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Quản lý độc lập theo từng kho bãi.
                </p>
              </div>

              {/* Cột 2: Số lô hàng */}
              <div>
                <div className="flex items-center justify-between h-7 mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                    Số lô hàng (Batch / Lot) <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateBatchNumber}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    title="Tạo mã định danh lô tự động theo chuẩn WMS"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 21h5v-5" />
                    </svg>
                    <span>Tạo mã tự động</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value.toUpperCase())}
                  placeholder="VD: LOT-SP001-202610-001"
                  className="w-full h-11 px-3.5 bg-slate-50/50 focus:bg-white border border-slate-300 rounded-lg text-sm font-mono font-bold tracking-wider text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all outline-none uppercase placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Mã in hoa, không trùng SKU trong cùng kho.
                </p>
              </div>

              {/* Cột 3 (Hàng 2): Ngày sản xuất */}
              <div>
                <div className="flex items-center h-7 mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                    Ngày sản xuất (NSX)
                  </label>
                </div>
                <input
                  type="date"
                  value={mfgDate}
                  onChange={(e) => setMfgDate(e.target.value)}
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Để trống nếu sản phẩm không ghi rõ NSX.
                </p>
              </div>

              {/* Cột 4 (Hàng 2): Hạn sử dụng */}
              <div>
                <div className="flex items-center h-7 mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                    Hạn sử dụng (HSD) <span className="text-red-500">*</span>
                  </label>
                </div>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-lg text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Bắt buộc sau NSX (kích hoạt FEFO).
                </p>
              </div>
            </div>

            {/* Phím bấm chọn nhanh HSD */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-xs font-semibold text-slate-500">Chọn nhanh HSD:</span>
              {[
                { label: '+6 Tháng', months: 6 },
                { label: '+12 Tháng (1 năm)', months: 12 },
                { label: '+24 Tháng (2 năm)', months: 24 },
                { label: '+36 Tháng (3 năm)', months: 36 },
              ].map((preset) => (
                <button
                  key={preset.months}
                  type="button"
                  onClick={() => handleApplyExpiryPreset(preset.months)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 text-slate-700 border border-slate-200 transition-all cursor-pointer shadow-2xs"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Hộp phân tích hạn sử dụng thời gian thực */}
            {shelfLifeMetrics && (
              <div className={`p-3.5 rounded-xl border transition-all ${
                shelfLifeMetrics.status === 'EXPIRED'
                  ? 'bg-red-50/90 border-red-200 text-red-900'
                  : shelfLifeMetrics.status === 'NEAR_EXPIRY'
                  ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                  : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      shelfLifeMetrics.status === 'EXPIRED'
                        ? 'bg-red-600 animate-pulse'
                        : shelfLifeMetrics.status === 'NEAR_EXPIRY'
                        ? 'bg-amber-600 animate-pulse'
                        : 'bg-emerald-600'
                    }`} />
                    <span className="font-bold text-sm">
                      {shelfLifeMetrics.status === 'EXPIRED'
                        ? 'Cảnh báo: Lô hàng đã quá hạn sử dụng!'
                        : shelfLifeMetrics.status === 'NEAR_EXPIRY'
                        ? 'Cảnh báo: Lô hàng sắp hết hạn trong 30 ngày!'
                        : 'Hạn sử dụng an toàn'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-medium">
                    {shelfLifeMetrics.totalShelfDays !== null && (
                      <span className="px-2.5 py-1 rounded-md bg-white/80 border border-slate-200/60">
                        Tổng vòng đời: <strong className="font-bold">{shelfLifeMetrics.totalShelfDays} ngày</strong>
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-md bg-white/80 border border-slate-200/60">
                      Thời gian còn lại: <strong className="font-bold">{shelfLifeMetrics.diffDays > 0 ? `${shelfLifeMetrics.diffDays} ngày` : 'Đã hết hạn'}</strong>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PHẦN 3: Tồn Kho Thực Nhập & Ghi Chú Chứng Từ (Lưới 2 Cột) */}
          <div className="p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                3
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Tồn Kho Thực Nhập & Ghi Chú Chứng Từ Nguồn Gốc
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Số lượng tồn kho ban đầu (Cột 1) */}
              <div>
                <div className="flex items-center h-7 mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                    Số lượng tồn kho ban đầu ({selectedProduct?.base_unit || 'Cái'})
                  </label>
                </div>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={initialQty}
                  onChange={(e) => setInitialQty(e.target.value)}
                  placeholder="0"
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Nếu lô chỉ đăng ký mã trước khi nhập kho thực tế, nhập số 0.
                </p>
              </div>

              {/* Ghi chú nguồn gốc & chứng từ (Cột 2) */}
              <div>
                <div className="flex items-center h-7 mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                    Ghi chú nguồn gốc & chứng từ kiểm định
                  </label>
                </div>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: Số hóa đơn NCC, chứng nhận kiểm nghiệm chất lượng CO/CQ, số vận đơn..."
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-colors outline-none placeholder:text-slate-400"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Lưu trữ số hóa đơn, chứng từ kiểm tra chất lượng phục vụ đối soát và Audit Log.
                </p>
              </div>
            </div>
          </div>

          {/* PHẦN 4: Thanh hành động chân bảng */}
          <div className="p-4 sm:p-5 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>
                {selectedProduct ? (
                  <>Đang thiết lập lô hàng cho: <strong className="text-slate-800 font-semibold">{selectedProduct.name}</strong> ({selectedProduct.code})</>
                ) : (
                  'Vui lòng điền các thông tin bắt buộc (*)'
                )}
              </span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onBack}
                disabled={submitting}
                className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-xs hover:shadow-sm transition-all cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Đang khởi tạo...</span>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="M12 5v14" />
                    </svg>
                    <span>Xác nhận & Khởi tạo lô hàng</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

