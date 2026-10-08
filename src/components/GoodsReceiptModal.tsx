import React, { useState, useEffect, useRef } from 'react';
import {
  ProductItem,
  Supplier,
  getSuppliersApi,
  Warehouse,
  getWarehousesApi,
  createGoodsReceiptApi,
  updateGoodsReceiptApi,
  confirmGoodsReceiptApi,
  deleteGoodsReceiptApi,
  GoodsReceiptItemCreatePayload,
} from '../services/api';
import { ModalPortal } from './ModalPortal';
import { emitStatusToast } from './StatusToast';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  products: ProductItem[];
  currentUserWarehouse?: string;
  onSuccess: () => void;
}

interface ReceiptItemFormRow {
  product_id: number | '';
  product_code: string;
  product_name: string;
  is_batch_managed: boolean;
  base_unit: string;
  unit_name: string;
  conversion_rate: number;
  quantity: number | string;
  unit_price: number | string;
  batch_number: string;
  expiry_date: string;
  note: string;
}

export interface StockInDraftItem {
  draft_id: string; // ID duy nhất của bản nháp
  created_at: string; // Thời gian lưu (VD: "20:05 - 08/10/2026")
  supplier_id: number | '';
  supplier_name: string; // Tên NCC hoặc "Chưa chọn NCC"
  warehouse_id: number | '';
  reference_number: string;
  receipt_date: string;
  total_items: number;
  items: ReceiptItemFormRow[];
  server_draft_id?: number | null;
  server_draft_code?: string | null;
}

const DRAFT_STORAGE_KEY = 'stock_in_draft_data';

const getDefaultReceiptDate = (): string => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
};

const createEmptyRow = (): ReceiptItemFormRow => ({
  product_id: '',
  product_code: '',
  product_name: '',
  is_batch_managed: false,
  base_unit: '',
  unit_name: '',
  conversion_rate: 1.0,
  quantity: 1,
  unit_price: 0,
  batch_number: '',
  expiry_date: '',
  note: '',
});

// Helper đọc danh sách bản nháp từ LocalStorage (tương thích cả bản ghi cũ đơn lẻ)
const loadDraftsFromStorage = (): StockInDraftItem[] => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    } else if (parsed && typeof parsed === 'object') {
      // Tự động nâng cấp bản nháp đơn lẻ cũ sang danh sách
      const legacyDraft: StockInDraftItem = {
        draft_id: 'draft_legacy_' + Date.now(),
        created_at: parsed.savedAt || 'Trước đó',
        supplier_id: parsed.supplierId || '',
        supplier_name: parsed.supplierId ? `NCC #${parsed.supplierId}` : 'Chưa chọn NCC',
        warehouse_id: parsed.warehouseId || '',
        reference_number: parsed.referenceNumber || '',
        receipt_date: parsed.receiptDate || getDefaultReceiptDate(),
        total_items: (parsed.items || []).filter((it: any) => Boolean(it.product_id)).length,
        items: parsed.items || [],
        server_draft_id: parsed.serverDraftId,
        server_draft_code: parsed.serverDraftCode,
      };
      const migrated = [legacyDraft];
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (err) {
    console.warn('Lỗi đọc danh sách bản nháp:', err);
  }
  return [];
};

export const GoodsReceiptModal: React.FC<GoodsReceiptModalProps> = ({
  isOpen,
  onClose,
  token,
  products,
  currentUserWarehouse,
  onSuccess,
}) => {
  // Metadata dropdowns
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoadingMeta, setIsLoadingMeta] = useState(false);

  // Form Lập Phiếu
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [receiptDate, setReceiptDate] = useState<string>(getDefaultReceiptDate);
  const [warehouseId, setWarehouseId] = useState<number | ''>('');
  const [items, setItems] = useState<ReceiptItemFormRow[]>([]);
  const [serverDraftId, setServerDraftId] = useState<number | null>(null);

  // Quản lý nhiều bản nháp (Multiple Drafts)
  const [draftsList, setDraftsList] = useState<StockInDraftItem[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isDraftMenuOpen, setIsDraftMenuOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const draftMenuRef = useRef<HTMLDivElement | null>(null);

  // Validation & Submit State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tải metadata và nạp danh sách bản nháp khi mở modal
  useEffect(() => {
    if (!isOpen || !token) return;

    setIsLoadingMeta(true);
    Promise.all([
      getSuppliersApi(token, { status: 'active' }).catch(() => ({ items: [] })),
      getWarehousesApi(token).catch(() => []),
    ])
      .then(([suppRes, whList]) => {
        setSuppliers(suppRes.items || []);
        setWarehouses(whList);

        // Khởi tạo mặc định kho nếu chưa chọn
        if (whList.length > 0 && !warehouseId) {
          const matchedWh = currentUserWarehouse
            ? whList.find((w) => w.name.toLowerCase().includes(currentUserWarehouse.toLowerCase()))
            : null;
          setWarehouseId(matchedWh ? matchedWh.id : whList[0].id);
        }
      })
      .finally(() => {
        setIsLoadingMeta(false);
      });

    // Nạp danh sách các bản nháp từ storage
    const loadedDrafts = loadDraftsFromStorage();
    setDraftsList(loadedDrafts);
    setIsBannerDismissed(false);

    // Reset danh sách dòng nếu đang rỗng
    if (items.length === 0) {
      setItems([createEmptyRow()]);
    }
  }, [isOpen, token, currentUserWarehouse]);

  // Click outside để đóng menu dropdown Bản nháp
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (draftMenuRef.current && !draftMenuRef.current.contains(e.target as Node)) {
        setIsDraftMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Xóa lỗi khi đóng modal
  useEffect(() => {
    if (!isOpen) {
      setFieldErrors({});
      setGeneralError(null);
      setIsDraftMenuOpen(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Xử lý nạp dữ liệu từ một bản nháp cụ thể
  const handleSelectDraft = (draft: StockInDraftItem) => {
    setCurrentDraftId(draft.draft_id);
    setSupplierId(draft.supplier_id || '');
    if (draft.warehouse_id) {
      setWarehouseId(draft.warehouse_id);
    }
    setReferenceNumber(draft.reference_number || '');
    setReceiptDate(draft.receipt_date || getDefaultReceiptDate());
    if (Array.isArray(draft.items) && draft.items.length > 0) {
      setItems(draft.items);
    } else {
      setItems([createEmptyRow()]);
    }
    setServerDraftId(draft.server_draft_id || null);
    setIsDraftMenuOpen(false);
    setIsBannerDismissed(true);
    setFieldErrors({});
    setGeneralError(null);

    emitStatusToast({
      title: 'Đã mở bản nháp',
      message: `Đã nạp bản nháp "${draft.supplier_name}" (${draft.created_at}).`,
    });
  };

  // Bắt đầu lập một phiếu mới trắng tinh
  const handleStartNewReceipt = () => {
    setCurrentDraftId(null);
    setServerDraftId(null);
    setSupplierId('');
    setReferenceNumber('');
    setReceiptDate(getDefaultReceiptDate());

    if (warehouses.length > 0) {
      const matchedWh = currentUserWarehouse
        ? warehouses.find((w) => w.name.toLowerCase().includes(currentUserWarehouse.toLowerCase()))
        : null;
      setWarehouseId(matchedWh ? matchedWh.id : warehouses[0].id);
    }

    setItems([createEmptyRow()]);
    setFieldErrors({});
    setGeneralError(null);
    setIsDraftMenuOpen(false);

    emitStatusToast({
      title: 'Lập phiếu mới',
      message: 'Đã tạo form mới để lập phiếu nhập kho.',
    });
  };

  // Xóa một bản nháp đơn lẻ
  const handleDeleteSingleDraft = (draftIdToDelete: string) => {
    const draftToDelete = draftsList.find((d) => d.draft_id === draftIdToDelete);
    if (draftToDelete?.server_draft_id) {
      deleteGoodsReceiptApi(token, draftToDelete.server_draft_id).catch(() => {});
    }

    const updated = draftsList.filter((d) => d.draft_id !== draftIdToDelete);
    setDraftsList(updated);
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(updated));

    // Nếu đang mở đúng bản nháp bị xóa, reset form về mới
    if (currentDraftId === draftIdToDelete) {
      handleStartNewReceipt();
    }

    emitStatusToast({
      title: 'Đã xóa bản nháp',
      message: 'Bản nháp đã được xóa khỏi hệ thống.',
    });
  };

  // Xử lý thay đổi sản phẩm trong dòng hàng
  const handleProductChange = (index: number, newProductId: number | '') => {
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[`item_${index}_product`];
      return copy;
    });

    if (!newProductId) {
      setItems((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          product_id: '',
          product_code: '',
          product_name: '',
          is_batch_managed: false,
          base_unit: '',
          unit_name: '',
          conversion_rate: 1.0,
          batch_number: '',
          expiry_date: '',
        };
        return copy;
      });
      return;
    }

    const prod = products.find((p) => p.id === newProductId);
    if (!prod) return;

    setItems((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        product_id: prod.id,
        product_code: prod.code,
        product_name: prod.name,
        is_batch_managed: Boolean(prod.is_batch_managed),
        base_unit: prod.base_unit || 'Cái',
        unit_name: prod.base_unit || 'Cái',
        conversion_rate: 1.0,
        batch_number: '',
        expiry_date: '',
      };
      return copy;
    });
  };

  // Xử lý thay đổi đơn vị tính trong dòng hàng
  const handleUnitChange = (index: number, newUnitName: string) => {
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[`item_${index}_unit`];
      return copy;
    });

    setItems((prev) => {
      const copy = [...prev];
      const row = copy[index];
      const prod = products.find((p) => p.id === row.product_id);
      let newRate = 1.0;

      if (prod) {
        if (newUnitName.toLowerCase() === (prod.base_unit || 'cái').toLowerCase()) {
          newRate = 1.0;
        } else {
          const matched = (prod.units || []).find(
            (u) => u.unit_name.toLowerCase() === newUnitName.toLowerCase()
          );
          if (matched && matched.conversion_rate > 0) {
            newRate = matched.conversion_rate;
          }
        }
      }

      copy[index] = {
        ...row,
        unit_name: newUnitName,
        conversion_rate: newRate,
      };
      return copy;
    });
  };

  // Thêm dòng hàng mới
  const handleAddItemRow = () => {
    setItems((prev) => [...prev, createEmptyRow()]);
  };

  // Xóa dòng hàng
  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) {
      setGeneralError('Phiếu nhập kho bắt buộc phải có ít nhất 1 dòng mặt hàng.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors((prev) => {
      const copy = { ...prev };
      delete copy[`item_${index}_product`];
      delete copy[`item_${index}_quantity`];
      delete copy[`item_${index}_unit`];
      delete copy[`item_${index}_batch_number`];
      delete copy[`item_${index}_expiry_date`];
      return copy;
    });
  };

  // Tính tổng
  const totalBaseQuantity = items.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
    return sum + qty * item.conversion_rate;
  }, 0);

  // Ràng buộc dữ liệu (Validation) khi nhấn Xác nhận & Ghi sổ
  const validateForConfirm = (): boolean => {
    const errors: Record<string, string> = {};
    const errorList: string[] = [];

    // 1. Thông tin chung
    if (!supplierId) {
      errors['supplier_id'] = 'Vui lòng chọn Nhà cung cấp giao hàng.';
      errorList.push('Nhà cung cấp: Bắt buộc chọn.');
    }

    if (!warehouseId) {
      errors['warehouse_id'] = 'Vui lòng chọn Kho nhập hàng.';
      errorList.push('Kho nhập hàng: Bắt buộc chọn.');
    }

    if (!receiptDate) {
      errors['receipt_date'] = 'Vui lòng chọn Ngày nhập kho.';
      errorList.push('Ngày nhập kho: Bắt buộc chọn.');
    } else {
      const selectedTime = new Date(receiptDate).getTime();
      const nowTime = Date.now() + 60000;
      if (selectedTime > nowTime) {
        errors['receipt_date'] = 'Ngày nhập kho không được chọn ngày trong tương lai (phải <= hiện tại).';
        errorList.push('Ngày nhập kho: Không được lớn hơn thời điểm hiện tại.');
      }
    }

    if (referenceNumber && referenceNumber.trim().length > 50) {
      errors['reference_number'] = 'Số chứng từ / Hóa đơn tối đa 50 ký tự.';
      errorList.push(`Số chứng từ: Tối đa 50 ký tự (hiện có ${referenceNumber.trim().length} ký tự).`);
    }

    // 2. Danh sách hàng nhập
    if (!items || items.length === 0) {
      errorList.push('Danh sách hàng nhập: Tối thiểu phải có ít nhất 1 dòng sản phẩm.');
    }

    const receiptDateDay = receiptDate ? receiptDate.slice(0, 10) : '';

    items.forEach((item, idx) => {
      const rowNum = idx + 1;

      if (!item.product_id) {
        errors[`item_${idx}_product`] = `Dòng #${rowNum}: Vui lòng chọn sản phẩm dỡ xe.`;
        errorList.push(`Dòng #${rowNum}: Chưa chọn sản phẩm dỡ xe.`);
        return;
      }

      const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        errors[`item_${idx}_quantity`] = `Dòng #${rowNum}: Số lượng nhập phải lớn hơn 0.`;
        errorList.push(`Dòng #${rowNum} (${item.product_name || 'Sản phẩm'}): Số lượng nhập phải lớn hơn 0.`);
      }

      if (!item.unit_name || !item.unit_name.trim() || !item.conversion_rate || item.conversion_rate <= 0) {
        errors[`item_${idx}_unit`] = `Dòng #${rowNum}: Đơn vị tính hoặc hệ số quy đổi phải > 0.`;
        errorList.push(`Dòng #${rowNum} (${item.product_name}): ĐVT hoặc hệ số quy đổi không hợp lệ.`);
      }

      // 3. Quản lý Lô & HSD
      if (item.is_batch_managed) {
        const batchTrimmed = (item.batch_number || '').trim();
        if (!batchTrimmed || batchTrimmed.length < 3 || batchTrimmed.length > 50) {
          errors[`item_${idx}_batch_number`] = `Dòng #${rowNum}: Số lô bắt buộc từ 3 đến 50 ký tự.`;
          errorList.push(`Dòng #${rowNum} (${item.product_name}): Số lô bắt buộc từ 3 đến 50 ký tự.`);
        }

        if (!item.expiry_date || !item.expiry_date.trim()) {
          errors[`item_${idx}_expiry_date`] = `Dòng #${rowNum}: Bắt buộc khai báo Hạn sử dụng.`;
          errorList.push(`Dòng #${rowNum} (${item.product_name}): Bắt buộc khai báo Hạn sử dụng.`);
        } else if (receiptDateDay && item.expiry_date <= receiptDateDay) {
          errors[`item_${idx}_expiry_date`] = `Dòng #${rowNum}: Hạn sử dụng phải lớn hơn Ngày nhập kho.`;
          errorList.push(
            `Dòng #${rowNum} (${item.product_name}): Hạn sử dụng (${item.expiry_date}) phải lớn hơn Ngày nhập kho (${receiptDateDay}).`
          );
        }
      }
    });

    setFieldErrors(errors);

    if (errorList.length > 0) {
      setGeneralError(errorList[0]);
      return false;
    }

    setGeneralError(null);
    return true;
  };

  // Xử lý Lưu Nháp (Lưu nhiều bản nháp không ghi đè)
  const handleSaveDraft = async () => {
    setIsSubmitting(true);
    setGeneralError(null);

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} - ${String(
      now.getDate()
    ).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const matchedSupp = suppliers.find((s) => s.id === supplierId);
    const suppName = matchedSupp
      ? `[${matchedSupp.code}] ${matchedSupp.name}`
      : supplierId
      ? `NCC #${supplierId}`
      : 'Chưa chọn NCC';
    const validItemsCount = items.filter((it) => Boolean(it.product_id)).length;

    let currentServerDraftId = serverDraftId;
    let currentServerDraftCode: string | undefined = undefined;

    // Lưu vào database nếu đủ thông tin cơ bản
    const validItems = items.filter((it) => Boolean(it.product_id));
    if (supplierId && warehouseId && validItems.length > 0) {
      try {
        const payloadItems: GoodsReceiptItemCreatePayload[] = validItems.map((it) => {
          const qty = typeof it.quantity === 'number' ? it.quantity : parseFloat(it.quantity) || 1;
          const price = typeof it.unit_price === 'number' ? it.unit_price : parseFloat(it.unit_price) || 0;
          return {
            product_id: Number(it.product_id),
            unit_name: it.unit_name.trim() || it.base_unit || 'Cái',
            quantity: qty > 0 ? qty : 1,
            conversion_rate: it.conversion_rate > 0 ? it.conversion_rate : 1.0,
            unit_price: price,
            batch_number: it.batch_number.trim() || undefined,
            expiry_date: it.expiry_date ? `${it.expiry_date}T00:00:00Z` : undefined,
            note: it.note.trim() || undefined,
          };
        });

        const payload = {
          supplier_id: Number(supplierId),
          warehouse_id: Number(warehouseId),
          reference_number: referenceNumber.trim() || undefined,
          receipt_date: receiptDate ? new Date(receiptDate).toISOString() : undefined,
          note: undefined,
          items: payloadItems,
        };

        if (currentServerDraftId) {
          const updated = await updateGoodsReceiptApi(token, currentServerDraftId, payload);
          currentServerDraftCode = updated.code;
        } else {
          const created = await createGoodsReceiptApi(token, payload);
          currentServerDraftId = created.id;
          currentServerDraftCode = created.code;
          setServerDraftId(created.id);
        }
      } catch (err) {
        console.warn('Lưu nháp vào DB thất bại, fallback lưu vào localStorage:', err);
      }
    }

    // XỬ LÝ LƯU MẢNG BẢN NHÁP (ARRAY OF DRAFTS)
    let updatedDrafts: StockInDraftItem[] = [];
    let savedDraftId = currentDraftId;

    if (currentDraftId && draftsList.some((d) => d.draft_id === currentDraftId)) {
      // Đang chỉnh sửa một bản nháp cũ -> CẬP NHẬT (UPDATE) đúng bản nháp đó
      updatedDrafts = draftsList.map((d) => {
        if (d.draft_id === currentDraftId) {
          return {
            ...d,
            created_at: timeStr,
            supplier_id: supplierId,
            supplier_name: suppName,
            warehouse_id: warehouseId,
            reference_number: referenceNumber,
            receipt_date: receiptDate,
            total_items: validItemsCount,
            items: items,
            server_draft_id: currentServerDraftId,
            server_draft_code: currentServerDraftCode,
          };
        }
        return d;
      });
    } else {
      // Đang tạo phiếu mới -> THÊM MỚI (INSERT / push) vào mảng, TUYỆT ĐỐI không ghi đè
      savedDraftId = 'draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const newDraftItem: StockInDraftItem = {
        draft_id: savedDraftId,
        created_at: timeStr,
        supplier_id: supplierId,
        supplier_name: suppName,
        warehouse_id: warehouseId,
        reference_number: referenceNumber,
        receipt_date: receiptDate,
        total_items: validItemsCount,
        items: items,
        server_draft_id: currentServerDraftId,
        server_draft_code: currentServerDraftCode,
      };
      updatedDrafts = [newDraftItem, ...draftsList];
      setCurrentDraftId(savedDraftId);
    }

    setDraftsList(updatedDrafts);
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(updatedDrafts));

    setIsSubmitting(false);
    emitStatusToast({
      title: 'Đã lưu bản nháp thành công',
      message: `Đã lưu bản nháp "${suppName}" (chưa cộng tồn kho).`,
    });
  };

  // Xử lý Xác nhận nhập kho & Ghi sổ
  const handleConfirmSubmit = async () => {
    if (!validateForConfirm()) return;

    setIsSubmitting(true);
    setGeneralError(null);

    try {
      const payloadItems: GoodsReceiptItemCreatePayload[] = items.map((it) => {
        const qty = typeof it.quantity === 'number' ? it.quantity : parseFloat(it.quantity) || 0;
        const price = typeof it.unit_price === 'number' ? it.unit_price : parseFloat(it.unit_price) || 0;
        return {
          product_id: Number(it.product_id),
          unit_name: it.unit_name.trim(),
          quantity: qty,
          conversion_rate: it.conversion_rate,
          unit_price: price,
          batch_number: it.is_batch_managed ? it.batch_number.trim() : undefined,
          expiry_date: it.is_batch_managed && it.expiry_date ? `${it.expiry_date}T00:00:00Z` : undefined,
          note: it.note.trim() || undefined,
        };
      });

      const payload = {
        supplier_id: Number(supplierId),
        warehouse_id: Number(warehouseId),
        reference_number: referenceNumber.trim() || undefined,
        receipt_date: receiptDate ? new Date(receiptDate).toISOString() : undefined,
        note: undefined,
        items: payloadItems,
      };

      let targetReceiptId = serverDraftId;

      if (targetReceiptId) {
        await updateGoodsReceiptApi(token, targetReceiptId, payload);
      } else {
        const created = await createGoodsReceiptApi(token, payload);
        targetReceiptId = created.id;
      }

      // Xác nhận ghi sổ và cộng tồn kho
      const confirmed = await confirmGoodsReceiptApi(token, targetReceiptId);

      // Dọn dẹp: Tự động xóa bản nháp tương ứng (currentDraftId) ra khỏi danh sách bản nháp
      if (currentDraftId) {
        const remaining = draftsList.filter((d) => d.draft_id !== currentDraftId);
        setDraftsList(remaining);
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(remaining));
      }

      setCurrentDraftId(null);
      setServerDraftId(null);

      emitStatusToast({
        title: 'Nhập kho thành công',
        message: `Phiếu ${confirmed.code} đã được xác nhận ghi sổ! Toàn bộ số lượng và lô hàng đã được cộng vào kho.`,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Lỗi khi xác nhận nhập kho:', err);
      setGeneralError(err.message || 'Không thể xác nhận phiếu nhập kho. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting) onClose();
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1020px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Header Modal */}
          <div
            style={{
              padding: '14px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                }}
              >
                Lập Phiếu Nhập Kho Từ Nhà Cung Cấp
              </h2>

              {/* Nút Tạo mới / Làm mới form */}
              <button
                type="button"
                onClick={handleStartNewReceipt}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: currentDraftId ? '1px solid #cbd5e1' : '1px solid #bae6fd',
                  background: currentDraftId ? '#ffffff' : '#e0f2fe',
                  color: currentDraftId ? '#475569' : '#0369a1',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
                title="Xóa form và bắt đầu lập phiếu mới"
              >
                <span>+ Lập phiếu mới</span>
              </button>

              {currentDraftId && (
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: '600',
                    color: '#b45309',
                    background: '#fef3c7',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid #fde68a',
                  }}
                >
                  Đang sửa nháp
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Menu Dropdown Quản lý các bản nháp [ Bản nháp ({drafts.length}) ▾ ] */}
              <div style={{ position: 'relative' }} ref={draftMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsDraftMenuOpen((prev) => !prev)}
                  disabled={draftsList.length === 0}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: draftsList.length > 0 ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                    background: draftsList.length > 0 ? '#ffffff' : '#f1f5f9',
                    color: draftsList.length > 0 ? '#1e293b' : '#94a3b8',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: draftsList.length > 0 ? 'pointer' : 'not-allowed',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  title={
                    draftsList.length > 0
                      ? `Có ${draftsList.length} bản nháp đã lưu`
                      : 'Chưa có bản nháp nào được lưu'
                  }
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  <span>Bản nháp ({draftsList.length})</span>
                  <span style={{ fontSize: '10px' }}>▼</span>
                </button>

                {/* Danh sách bản nháp xổ xuống */}
                {isDraftMenuOpen && draftsList.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      width: '330px',
                      maxHeight: '380px',
                      background: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #cbd5e1',
                      boxShadow: '0 12px 28px rgba(0, 0, 0, 0.15)',
                      zIndex: 1000,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #f1f5f9',
                        background: '#f8fafc',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#475569',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>DANH SÁCH BẢN NHÁP ({draftsList.length})</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>Mới nhất trước</span>
                    </div>

                    <div style={{ overflowY: 'auto', maxHeight: '310px' }}>
                      {draftsList.map((d) => {
                        const isSelected = d.draft_id === currentDraftId;
                        return (
                          <div
                            key={d.draft_id}
                            onClick={() => handleSelectDraft(d)}
                            style={{
                              padding: '10px 14px',
                              borderBottom: '1px solid #f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '10px',
                              cursor: 'pointer',
                              background: isSelected ? '#eff6ff' : '#ffffff',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = '#ffffff';
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Dòng 1: Tên NCC • X mặt hàng */}
                              <div
                                style={{
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  color: isSelected ? '#1d4ed8' : '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={d.supplier_name}
                              >
                                {d.supplier_name}
                                <span style={{ fontWeight: '500', color: '#64748b', fontSize: '12px', marginLeft: '6px' }}>
                                  • {d.total_items} mặt hàng
                                </span>
                              </div>

                              {/* Dòng 2: Thời gian tạo */}
                              <div
                                style={{
                                  fontSize: '11.5px',
                                  color: '#64748b',
                                  marginTop: '3px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                }}
                              >
                                <span>🕒 {d.created_at}</span>
                                {isSelected && (
                                  <span
                                    style={{
                                      fontSize: '10.5px',
                                      background: '#dbeafe',
                                      color: '#1e40af',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      fontWeight: '600',
                                    }}
                                  >
                                    Đang mở
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Nút Xóa riêng bản nháp */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSingleDraft(d.draft_id);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                padding: '6px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                              }}
                              title="Xóa bản nháp này"
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.background = '#fee2e2';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = '#94a3b8';
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              flex: 1,
            }}
          >
            {/* Banner Thông Báo Phục Hồi Bản Nháp (Chỉ hiển thị khi có bản nháp và chưa chọn sửa) */}
            {draftsList.length > 0 && !currentDraftId && !isBannerDismissed && (
              <div
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '12px 18px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '14px',
                  boxShadow: '0 1px 3px rgba(37, 99, 235, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>
                      Bạn có <strong>{draftsList.length}</strong> bản nháp chưa ghi sổ (Gần nhất: {draftsList[0].created_at} -{' '}
                      {draftsList[0].supplier_name}). Bạn muốn tiếp tục?
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#3b82f6', marginTop: '2px' }}>
                      Chọn từ menu <strong>[Bản nháp ({draftsList.length}) ▾]</strong> ở góc phải hoặc nhấn "Tiếp tục điền" để mở bản gần nhất.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleSelectDraft(draftsList[0])}
                    style={{
                      padding: '6px 14px',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '7px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Tiếp tục điền
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBannerDismissed(true)}
                    style={{
                      padding: '6px 12px',
                      background: '#ffffff',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      borderRadius: '7px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Đóng thông báo
                  </button>
                </div>
              </div>
            )}

            {/* Thông báo lỗi tổng quan */}
            {generalError && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '12px 16px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#b91c1c',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{generalError}</span>
              </div>
            )}

            {/* 1. KHAI BÁO CHỨNG TỪ & NHÀ CUNG CẤP */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#0f172a',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                1. Khai báo thông tin nhập hàng
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '14px',
                }}
              >
                {/* Nhà cung cấp */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Nhà cung cấp <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => {
                      setSupplierId(Number(e.target.value) || '');
                      if (fieldErrors['supplier_id']) {
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy['supplier_id'];
                          return copy;
                        });
                      }
                    }}
                    disabled={isLoadingMeta}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: fieldErrors['supplier_id'] ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      background: fieldErrors['supplier_id'] ? '#fef2f2' : '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  >
                    <option value="">-- Chọn nhà cung cấp --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{s.code}] {s.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors['supplier_id'] && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                      {fieldErrors['supplier_id']}
                    </div>
                  )}
                </div>

                {/* Số chứng từ tham chiếu */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Số chứng từ / Hóa đơn NCC
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    placeholder="VD: HĐ-2026/089, PG-789 (Tối đa 50 ký tự)"
                    value={referenceNumber}
                    onChange={(e) => {
                      setReferenceNumber(e.target.value);
                      if (fieldErrors['reference_number']) {
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy['reference_number'];
                          return copy;
                        });
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: fieldErrors['reference_number'] ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      background: fieldErrors['reference_number'] ? '#fef2f2' : '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  {fieldErrors['reference_number'] && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                      {fieldErrors['reference_number']}
                    </div>
                  )}
                </div>

                {/* Ngày giờ nhập */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Ngày nhập kho <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={receiptDate}
                    onChange={(e) => {
                      setReceiptDate(e.target.value);
                      if (fieldErrors['receipt_date']) {
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy['receipt_date'];
                          return copy;
                        });
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: fieldErrors['receipt_date'] ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      background: fieldErrors['receipt_date'] ? '#fef2f2' : '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  {fieldErrors['receipt_date'] && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                      {fieldErrors['receipt_date']}
                    </div>
                  )}
                </div>

                {/* Kho nhận */}
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Kho nhập hàng <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={warehouseId}
                    onChange={(e) => {
                      setWarehouseId(Number(e.target.value) || '');
                      if (fieldErrors['warehouse_id']) {
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy['warehouse_id'];
                          return copy;
                        });
                      }
                    }}
                    disabled={isLoadingMeta}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: fieldErrors['warehouse_id'] ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      background: fieldErrors['warehouse_id'] ? '#fef2f2' : '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                    }}
                  >
                    <option value="">-- Chọn kho nhập --</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        [{w.code}] {w.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors['warehouse_id'] && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                      {fieldErrors['warehouse_id']}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 2. DANH SÁCH MẶT HÀNG DỠ XE */}
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#0f172a',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    2. Chi tiết hàng nhập ({items.length} mặt hàng)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAddItemRow}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#059669',
                    padding: '6px 14px',
                    borderRadius: '7px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  + Thêm mặt hàng
                </button>
              </div>

              {/* Bảng dòng hàng */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  overflowX: 'auto',
                  background: '#ffffff',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        fontWeight: '600',
                        textAlign: 'left',
                        borderBottom: '1px solid #cbd5e1',
                      }}
                    >
                      <th style={{ padding: '10px 12px', width: '30px' }}>#</th>
                      <th style={{ padding: '10px 12px', minWidth: '220px' }}>Sản phẩm</th>
                      <th style={{ padding: '10px 12px', minWidth: '130px' }}>ĐVT Nhập</th>
                      <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right' }}>Số lượng</th>
                      <th style={{ padding: '10px 12px', minWidth: '130px' }}>Quy đổi cơ sở</th>
                      <th style={{ padding: '10px 12px', minWidth: '170px' }}>Số lô & Hạn dùng</th>
                      <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}>Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row, idx) => {
                      const currentProd = products.find((p) => p.id === row.product_id);
                      const availableUnits = [
                        { unit_name: row.base_unit || 'Cái', conversion_rate: 1.0 },
                        ...(currentProd?.units || []).map((u) => ({
                          unit_name: u.unit_name,
                          conversion_rate: u.conversion_rate,
                        })),
                      ];

                      const numQty =
                        typeof row.quantity === 'number' ? row.quantity : parseFloat(row.quantity) || 0;
                      const calculatedBaseQty = Math.round(numQty * row.conversion_rate * 1000) / 1000;

                      const prodError = fieldErrors[`item_${idx}_product`];
                      const qtyError = fieldErrors[`item_${idx}_quantity`];
                      const unitError = fieldErrors[`item_${idx}_unit`];
                      const batchError = fieldErrors[`item_${idx}_batch_number`];
                      const expiryError = fieldErrors[`item_${idx}_expiry_date`];

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                          }}
                        >
                          <td style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: '600' }}>
                            {idx + 1}
                          </td>

                          {/* Chọn sản phẩm */}
                          <td style={{ padding: '10px 12px' }}>
                            <select
                              value={row.product_id}
                              onChange={(e) => handleProductChange(idx, e.target.value ? Number(e.target.value) : '')}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: prodError
                                  ? '1.5px solid #ef4444'
                                  : !row.product_id
                                  ? '1px dashed #94a3b8'
                                  : '1px solid #cbd5e1',
                                background: prodError ? '#fef2f2' : '#ffffff',
                                fontSize: '12.5px',
                                color: !row.product_id ? '#64748b' : '#0f172a',
                                outline: 'none',
                              }}
                            >
                              <option value="">-- Chọn sản phẩm dỡ xe --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  [{p.code}] {p.name}{p.is_batch_managed ? ' (★ Có quản lý lô)' : ''}
                                </option>
                              ))}
                            </select>

                            {prodError && (
                              <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                                {prodError}
                              </div>
                            )}

                            {row.product_id ? (
                              row.is_batch_managed ? (
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: '#b45309',
                                    marginTop: '4px',
                                    fontWeight: '600',
                                  }}
                                >
                                  ★ Bắt buộc khai báo Số lô & HSD
                                </div>
                              ) : (
                                <div
                                  style={{
                                    fontSize: '11px',
                                    color: '#94a3b8',
                                    marginTop: '4px',
                                  }}
                                >
                                  Hàng không quản lý lô
                                </div>
                              )
                            ) : (
                              !prodError && (
                                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontStyle: 'italic' }}>
                                  Vui lòng chọn sản phẩm
                                </div>
                              )
                            )}
                          </td>

                          {/* ĐVT nhập */}
                          <td style={{ padding: '10px 12px' }}>
                            <select
                              value={row.unit_name}
                              onChange={(e) => handleUnitChange(idx, e.target.value)}
                              disabled={!row.product_id}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: unitError ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                background: unitError ? '#fef2f2' : !row.product_id ? '#f1f5f9' : '#ffffff',
                                fontSize: '12.5px',
                                color: '#0f172a',
                                outline: 'none',
                              }}
                            >
                              {!row.product_id ? (
                                <option value="">-- ĐVT --</option>
                              ) : (
                                availableUnits.map((u, uIdx) => (
                                  <option key={uIdx} value={u.unit_name}>
                                    {u.unit_name} (x{u.conversion_rate})
                                  </option>
                                ))
                              )}
                            </select>
                            {unitError && (
                              <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                                {unitError}
                              </div>
                            )}
                          </td>

                          {/* Số lượng nhập */}
                          <td style={{ padding: '10px 12px' }}>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={row.quantity}
                              disabled={!row.product_id}
                              onChange={(e) => {
                                const val = e.target.value;
                                setFieldErrors((prev) => {
                                  const copy = { ...prev };
                                  delete copy[`item_${idx}_quantity`];
                                  return copy;
                                });
                                setItems((prev) => {
                                  const copy = [...prev];
                                  copy[idx].quantity = val;
                                  return copy;
                                });
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: qtyError ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                background: qtyError ? '#fef2f2' : !row.product_id ? '#f1f5f9' : '#ffffff',
                                fontSize: '12.5px',
                                textAlign: 'right',
                                color: '#0f172a',
                                fontWeight: '600',
                                boxSizing: 'border-box',
                                outline: 'none',
                              }}
                            />
                            {qtyError && (
                              <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                                {qtyError}
                              </div>
                            )}
                          </td>

                          {/* Quy đổi cơ sở */}
                          <td style={{ padding: '10px 12px' }}>
                            {row.product_id ? (
                              <>
                                <div style={{ fontWeight: '700', color: '#059669', fontSize: '13px' }}>
                                  {calculatedBaseQty.toLocaleString('vi-VN')} {row.base_unit}
                                </div>
                                {row.conversion_rate !== 1 && (
                                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                    1 {row.unit_name} = {row.conversion_rate} {row.base_unit}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>--</span>
                            )}
                          </td>

                          {/* Quản lý Lô & Hạn sử dụng (Dynamic Validation) */}
                          <td style={{ padding: '10px 12px' }}>
                            {!row.product_id ? (
                              <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic', padding: '6px 0' }}>
                                --
                              </div>
                            ) : row.is_batch_managed ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <input
                                  type="text"
                                  maxLength={50}
                                  placeholder="Số lô * (3-50 ký tự)"
                                  value={row.batch_number}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFieldErrors((prev) => {
                                      const copy = { ...prev };
                                      delete copy[`item_${idx}_batch_number`];
                                      return copy;
                                    });
                                    setItems((prev) => {
                                      const copy = [...prev];
                                      copy[idx].batch_number = val;
                                      return copy;
                                    });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '5px 8px',
                                    borderRadius: '5px',
                                    border: batchError
                                      ? '1.5px solid #ef4444'
                                      : !row.batch_number.trim()
                                      ? '1.5px solid #f59e0b'
                                      : '1px solid #10b981',
                                    background: batchError ? '#fef2f2' : '#fffbeb',
                                    fontSize: '12px',
                                    color: '#0f172a',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                  }}
                                />
                                {batchError && (
                                  <div style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: '500' }}>
                                    {batchError}
                                  </div>
                                )}

                                <input
                                  type="date"
                                  title="Hạn sử dụng (> Ngày nhập)"
                                  value={row.expiry_date}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setFieldErrors((prev) => {
                                      const copy = { ...prev };
                                      delete copy[`item_${idx}_expiry_date`];
                                      return copy;
                                    });
                                    setItems((prev) => {
                                      const copy = [...prev];
                                      copy[idx].expiry_date = val;
                                      return copy;
                                    });
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '4px 8px',
                                    borderRadius: '5px',
                                    border: expiryError
                                      ? '1.5px solid #ef4444'
                                      : !row.expiry_date.trim()
                                      ? '1.5px solid #f59e0b'
                                      : '1px solid #10b981',
                                    background: expiryError ? '#fef2f2' : '#fffbeb',
                                    fontSize: '12px',
                                    color: '#0f172a',
                                    boxSizing: 'border-box',
                                    outline: 'none',
                                  }}
                                />
                                {expiryError && (
                                  <div style={{ fontSize: '10.5px', color: '#dc2626', fontWeight: '500' }}>
                                    {expiryError}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                style={{
                                  color: '#94a3b8',
                                  fontSize: '12px',
                                  fontStyle: 'italic',
                                  padding: '8px 0',
                                }}
                              >
                                Không quản lý lô
                              </div>
                            )}
                          </td>

                          {/* Nút xóa dòng */}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              disabled={items.length <= 1}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: items.length <= 1 ? '#cbd5e1' : '#ef4444',
                                cursor: items.length <= 1 ? 'not-allowed' : 'pointer',
                                padding: '4px 6px',
                                fontSize: '12px',
                                fontWeight: '500',
                              }}
                              title="Xóa dòng này"
                            >
                              Xóa
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tổng kết phiếu */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '12px 18px',
                  marginTop: '12px',
                }}
              >
                <div style={{ fontSize: '13px', color: '#475569' }}>
                  Tổng số mặt hàng: <strong>{items.length}</strong> mặt hàng
                </div>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    Tổng tồn cơ sở quy về:{' '}
                    <strong style={{ color: '#059669', fontSize: '15px' }}>
                      {totalBaseQuantity.toLocaleString('vi-VN')}
                    </strong>{' '}
                    (ĐVT cơ sở)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Modal Actions */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#f8fafc',
            }}
          >
            {/* Nút Lưu Nháp */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #f59e0b',
                background: '#fffbeb',
                color: '#b45309',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Lưu phiếu ở trạng thái nháp, không cộng tồn kho"
            >
              {isSubmitting ? 'Đang lưu...' : currentDraftId ? 'Cập nhật nháp' : 'Lưu nháp'}
            </button>

            {/* Nút Xác Nhận Nhập Kho & Ghi Sổ */}
            <button
              type="button"
              onClick={handleConfirmSubmit}
              disabled={isSubmitting}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)',
              }}
              title="Xác nhận dỡ xe xong và cộng tồn kho ngay"
            >
              {isSubmitting ? 'Đang xử lý...' : 'Xác nhận nhập kho & Ghi sổ'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
