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
  getGoodsReceiptsApi,
  GoodsReceiptResponse,
} from '../services/api';
import { ModalPortal } from './ModalPortal';
import { emitStatusToast } from './StatusToast';

interface GoodsReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  products: ProductItem[];
  currentUserWarehouse?: string;
  initialTab?: 'form' | 'list';
  onSuccess: () => void;
  onRequestAdjust?: (product: ProductItem | null, receiptCode: string) => void;
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

// Helper kiểm tra bản nháp có rỗng hoàn toàn không (chưa chọn NCC, chưa điền số HĐ và chưa chọn sản phẩm nào)
export const isDraftDataEmpty = (d: Partial<StockInDraftItem>): boolean => {
  const hasSupplier = Boolean(d.supplier_id);
  const hasRef = Boolean(d.reference_number && d.reference_number.trim().length > 0);
  const hasItems =
    Array.isArray(d.items) &&
    d.items.some(
      (it: any) =>
        Boolean(it.product_id) ||
        Boolean(it.product_name && it.product_name.trim().length > 0) ||
        Boolean(it.note && it.note.trim().length > 0) ||
        Boolean(it.batch_number && it.batch_number.trim().length > 0)
    );
  return !hasSupplier && !hasRef && !hasItems;
};

// Helper đọc danh sách bản nháp từ LocalStorage (tự động loại bỏ các bản nháp rỗng chưa điền gì)
const loadDraftsFromStorage = (): StockInDraftItem[] => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const validDrafts = parsed.filter((d: StockInDraftItem) => !isDraftDataEmpty(d));
      if (validDrafts.length !== parsed.length) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(validDrafts));
      }
      return validDrafts;
    } else if (parsed && typeof parsed === 'object') {
      if (isDraftDataEmpty(parsed)) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return [];
      }
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
  initialTab = 'form',
  onSuccess,
  onRequestAdjust,
}) => {
  // Tab điều hướng chính: 'form' (Lập / Xem chi tiết phiếu) hoặc 'list' (Danh sách phiếu)
  const [activeTab, setActiveTab] = useState<'form' | 'list'>(initialTab);
  const [listSearchQuery, setListSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

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

  // Quản lý phiếu từ Server (CONFIRMED / DRAFT)
  const [serverReceipts, setServerReceipts] = useState<GoodsReceiptResponse[]>([]);
  const [viewingReceipt, setViewingReceipt] = useState<GoodsReceiptResponse | null>(null);
  const [justConfirmedReceiptId, setJustConfirmedReceiptId] = useState<number | null>(null);

  const confirmedReceiptsCount = React.useMemo(() => {
    return serverReceipts.filter((rc) => rc.status === 'CONFIRMED').length;
  }, [serverReceipts]);

  const filteredReceipts = React.useMemo(() => {
    return serverReceipts.filter((rc) => {
      // LỊCH SỬ CHỨNG TỪ: CHỈ HIỆN PHIẾU ĐÃ XÁC NHẬN (KHÔNG HIỆN BẢN NHÁP)
      if (rc.status !== 'CONFIRMED') return false;
      if (listSearchQuery.trim()) {
        const q = listSearchQuery.trim().toLowerCase();
        const codeMatch = (rc.code || '').toLowerCase().includes(q);
        const suppMatch = (rc.supplier_name || '').toLowerCase().includes(q);
        const whMatch = (rc.warehouse_name || '').toLowerCase().includes(q);
        const refMatch = (rc.reference_number || '').toLowerCase().includes(q);
        if (!codeMatch && !suppMatch && !whMatch && !refMatch) return false;
      }
      return true;
    });
  }, [serverReceipts, listSearchQuery]);

  // Validation & Submit State
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tải metadata, danh sách phiếu server và nạp danh sách bản nháp khi mở modal
  useEffect(() => {
    if (!isOpen || !token) return;

    setIsLoadingMeta(true);
    Promise.all([
      getSuppliersApi(token, { status: 'active' }).catch(() => ({ items: [] })),
      getWarehousesApi(token).catch(() => []),
      getGoodsReceiptsApi(token, { limit: 50 }).catch(() => ({ items: [], total: 0 })),
    ])
      .then(([suppRes, whList, rcList]) => {
        setSuppliers(suppRes.items || []);
        setWarehouses(whList);
        setServerReceipts(rcList.items || []);

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

    // Nạp danh sách các bản nháp từ storage (đã tự động loại trừ bản nháp rỗng)
    const loadedDrafts = loadDraftsFromStorage();
    setDraftsList(loadedDrafts);
    setIsBannerDismissed(false);
    setCurrentDraftId((prev) => (prev && loadedDrafts.some((d) => d.draft_id === prev) ? prev : null));

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

  // Cờ nhận diện phiếu đã ghi sổ bất biến
  const isConfirmed = Boolean(viewingReceipt && viewingReceipt.status === 'CONFIRMED');

  // Xử lý nạp dữ liệu từ một bản nháp cụ thể
  const handleSelectDraft = (draft: StockInDraftItem) => {
    setViewingReceipt(null);
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

  // Xử lý nạp dữ liệu từ một phiếu nhập trên Server (CONFIRMED hoặc DRAFT)
  const handleSelectServerReceipt = (receipt: GoodsReceiptResponse) => {
    setViewingReceipt(receipt);
    setCurrentDraftId(null);
    setServerDraftId(receipt.status === 'DRAFT' ? receipt.id : null);
    setIsDraftMenuOpen(false);
    setIsBannerDismissed(true);

    setSupplierId(receipt.supplier_id);
    setReferenceNumber(receipt.reference_number || '');
    setReceiptDate(receipt.receipt_date ? receipt.receipt_date.slice(0, 16) : getDefaultReceiptDate());
    setWarehouseId(receipt.warehouse_id);

    if (receipt.items && receipt.items.length > 0) {
      const mappedRows: ReceiptItemFormRow[] = receipt.items.map((it) => {
        const prod = products.find((p) => p.id === it.product_id);
        const baseU = prod?.base_unit || 'Cái';
        return {
          product_id: it.product_id,
          product_code: it.product_code || prod?.code || '',
          product_name: it.product_name || prod?.name || '',
          is_batch_managed: Boolean(prod?.is_batch_managed),
          base_unit: baseU,
          unit_name: it.unit_name || baseU,
          conversion_rate: it.conversion_rate || 1.0,
          quantity: it.quantity,
          unit_price: it.unit_price,
          batch_number: it.batch_number || '',
          expiry_date: it.expiry_date ? it.expiry_date.slice(0, 10) : '',
          note: it.note || '',
        };
      });
      setItems(mappedRows);
    } else {
      setItems([createEmptyRow()]);
    }

    setFieldErrors({});
    setGeneralError(null);

    emitStatusToast({
      title: receipt.status === 'CONFIRMED' ? 'Phiếu đã xác nhận' : 'Phiếu nháp server',
      message: `Đã mở phiếu ${receipt.code} (${receipt.status === 'CONFIRMED' ? 'Đã ghi sổ - Không thể sửa' : 'Nháp'}).`,
    });
  };

  // Xử lý Lập Phiếu Điều Chỉnh Kho từ phiếu đã xác nhận
  const handleTriggerAdjust = (targetProductId?: number | '', customReceipt?: GoodsReceiptResponse) => {
    const rc = customReceipt || viewingReceipt;
    if (!rc) return;
    const pid =
      targetProductId ||
      (rc.items && rc.items.length > 0 ? rc.items[0].product_id : undefined);
    const targetProd = pid ? products.find((p) => p.id === pid) || null : null;

    emitStatusToast({
      type: 'info',
      title: 'Lập phiếu điều chỉnh kho',
      message: `Đang mở phiếu điều chỉnh theo chứng từ ${rc.code}...`,
    });

    if (onRequestAdjust) {
      onRequestAdjust(targetProd, rc.code);
    }
    onClose();
  };

  // Bắt đầu lập một phiếu mới trắng tinh
  const handleStartNewReceipt = () => {
    setViewingReceipt(null);
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
      emitStatusToast({
        type: 'warning',
        title: 'Chưa đủ điều kiện nhập kho',
        message: errorList[0],
      });
      return false;
    }

    setGeneralError(null);
    return true;
  };

  // Xử lý Lưu Nháp (Lưu nhiều bản nháp không ghi đè, nếu chưa điền gì thì không lưu)
  const handleSaveDraft = async () => {
    // Kiểm tra xem người dùng đã điền thông tin nào chưa (nếu chưa điền gì thì không lưu)
    const hasSupplier = Boolean(supplierId);
    const hasRef = Boolean(referenceNumber && referenceNumber.trim().length > 0);
    const hasValidItem = items.some(
      (it) =>
        Boolean(it.product_id) ||
        Boolean(it.product_name && it.product_name.trim().length > 0) ||
        Boolean(it.note && it.note.trim().length > 0) ||
        Boolean(it.batch_number && it.batch_number.trim().length > 0)
    );

    if (!hasSupplier && !hasRef && !hasValidItem) {
      if (currentDraftId) {
        // Nếu người dùng xóa trắng dữ liệu của một bản nháp cũ -> dọn dẹp bản nháp đó luôn
        handleDeleteSingleDraft(currentDraftId);
      }
      emitStatusToast({
        title: 'Chưa có thông tin để lưu',
        message: 'Bạn chưa điền thông tin nào (chưa chọn nhà cung cấp hoặc sản phẩm) nên không cần lưu bản nháp.',
      });
      return;
    }

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

      // Đồng bộ lại danh sách phiếu từ server
      try {
        const rcList = await getGoodsReceiptsApi(token, { limit: 50 });
        const listItems = rcList.items || [];
        if (!listItems.some((x) => x.id === confirmed.id)) {
          setServerReceipts([confirmed, ...listItems]);
        } else {
          setServerReceipts(listItems);
        }
      } catch {
        setServerReceipts((prev) => [confirmed, ...prev.filter((x) => x.id !== confirmed.id)]);
      }

      // Tự động chuyển ngay sang tab "Lịch sử nhập kho"
      // Phiếu đã xác nhận là chứng từ lịch sử bất biến, lưu vào lịch sử chứng từ và hiển thị ngay đầu danh sách
      setJustConfirmedReceiptId(confirmed.id);
      setViewingReceipt(null);
      setActiveTab('list');

      emitStatusToast({
        title: 'Nhập kho thành công',
        message: `Phiếu ${confirmed.code} đã được xác nhận ghi sổ và lưu vào Lịch sử chứng từ! Phiếu đã xác nhận không sửa được, chỉ lập phiếu điều chỉnh.`,
      });

      onSuccess();
    } catch (err: any) {
      console.error('Lỗi khi xác nhận nhập kho:', err);
      const errorMsg = err.message || 'Không thể xác nhận phiếu nhập kho. Vui lòng kiểm tra lại thông tin.';
      setGeneralError(errorMsg);
      emitStatusToast({
        type: 'error',
        title: 'Lỗi xác nhận nhập kho',
        message: errorMsg,
      });
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
            width: '96%',
            maxWidth: '1260px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '17px',
                  fontWeight: '700',
                  color: '#0f172a',
                  letterSpacing: '-0.01em',
                }}
              >
                {activeTab === 'list'
                  ? 'Lịch Sử Chứng Từ Nhập Kho'
                  : isConfirmed
                  ? `Chi Tiết Chứng Từ Nhập Kho: ${viewingReceipt?.code}`
                  : viewingReceipt
                  ? `Phiếu Nháp Server: ${viewingReceipt?.code}`
                  : 'Lập Phiếu Nhập Kho Từ Nhà Cung Cấp'}
              </h2>

              {/* Chuyển đổi Tab: Lập phiếu mới vs Lịch sử nhập kho (Chỉ hiện khi KHÔNG ở chế độ xem chi tiết) */}
              {!(activeTab === 'form' && isConfirmed) && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: '#f1f5f9',
                    padding: '3px 4px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    gap: '3px',
                    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.03)',
                  }}
                >
                  {activeTab !== 'list' && (
                    <button
                      type="button"
                      id="tab-btn-form"
                      onClick={() => {
                        handleStartNewReceipt();
                        setActiveTab('form');
                      }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '7px',
                        border: '1px solid rgba(0, 0, 0, 0.06)',
                        background: activeTab === 'form' ? '#ffffff' : 'transparent',
                        color: activeTab === 'form' ? '#0f172a' : '#64748b',
                        fontWeight: activeTab === 'form' ? '700' : '600',
                        fontSize: '12.5px',
                        cursor: 'pointer',
                        boxShadow: activeTab === 'form' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
                        transition: 'all 0.18s ease',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <span>Lập phiếu mới</span>
                    </button>
                  )}

                  <button
                    type="button"
                    id="tab-btn-list"
                    onClick={() => {
                      setViewingReceipt(null);
                      setActiveTab('list');
                    }}
                    style={{
                      padding: '6px 13px',
                      borderRadius: '7px',
                      border: '1px solid rgba(0, 0, 0, 0.06)',
                      background: activeTab === 'list' ? '#ffffff' : 'transparent',
                      color: activeTab === 'list' ? '#0f172a' : '#64748b',
                      fontWeight: activeTab === 'list' ? '700' : '600',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      boxShadow: activeTab === 'list' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
                      transition: 'all 0.18s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span>Lịch sử nhập kho</span>
                    <span
                      style={{
                        background: activeTab === 'list' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#cbd5e1',
                        color: activeTab === 'list' ? '#ffffff' : '#334155',
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '1.5px 7px',
                        borderRadius: '999px',
                        boxShadow: activeTab === 'list' ? '0 1px 2px rgba(37, 99, 235, 0.3)' : 'none',
                      }}
                    >
                      {confirmedReceiptsCount}
                    </span>
                  </button>
                </div>
              )}

              {activeTab === 'form' && isConfirmed && (
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: '700',
                    color: '#047857',
                    background: '#ecfdf5',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #a7f3d0',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  ĐÃ XÁC NHẬN (BẤT BIẾN)
                </span>
              )}

              {currentDraftId && (
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: '600',
                    color: '#b45309',
                    background: '#fef3c7',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #fde68a',
                  }}
                >
                  Đang sửa nháp
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Menu Dropdown Quản lý các bản nháp [ Bản nháp ({draftsList.length}) ] */}
              {draftsList.length > 0 && !isConfirmed && activeTab === 'form' && (
                <div style={{ position: 'relative' }} ref={draftMenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsDraftMenuOpen((prev) => !prev)}
                    style={{
                      padding: '6px 13px',
                      borderRadius: '8px',
                      border: '1px solid #fcd34d',
                      background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                      color: '#92400e',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 3px rgba(245, 158, 11, 0.15)',
                      transition: 'all 0.15s ease',
                    }}
                    title={`Có ${draftsList.length} bản nháp đã lưu`}
                  >
                    <span>Bản nháp ({draftsList.length})</span>
                  </button>

                  {/* Danh sách bản nháp xổ xuống */}
                  {isDraftMenuOpen && (
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
                                  <span>{d.created_at}</span>
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
                                <span style={{ fontSize: '13px', fontWeight: '700' }}>✕</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  color: '#64748b',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.18s ease',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = '#fca5a5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.color = '#64748b';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
                title="Đóng cửa sổ"
              >
                <span style={{ fontSize: '18px', fontWeight: '600', lineHeight: 1 }}>✕</span>
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
            {activeTab === 'list' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Thanh tìm kiếm, lọc trạng thái & Tạo mới */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                    background: '#f8fafc',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                      <input
                        type="text"
                        placeholder="Tìm theo mã phiếu, NCC, kho..."
                        value={listSearchQuery}
                        onChange={(e) => setListSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 12px',
                          borderRadius: '7px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          color: '#0f172a',
                          background: '#ffffff',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#065f46',
                      }}
                    >
                      <span>Đã xác nhận & Ghi sổ:</span>
                      <span
                        style={{
                          background: '#059669',
                          color: '#ffffff',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: '700',
                        }}
                      >
                        {confirmedReceiptsCount}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleStartNewReceipt();
                      setActiveTab('form');
                    }}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.filter = 'brightness(1.08)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 10px rgba(5, 150, 105, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.filter = 'brightness(1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(5, 150, 105, 0.3)';
                    }}
                  >
                    <span>Lập phiếu mới</span>
                  </button>
                </div>

                {/* Thông Báo Thành Công Vừa Ghi Sổ Chuyển Sang Lịch Sử */}
                {justConfirmedReceiptId && (
                  <div
                    style={{
                      background: '#ecfdf5',
                      border: '1.5px solid #10b981',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: '0 2px 6px rgba(16, 185, 129, 0.15)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', color: '#065f46', fontSize: '13.5px' }}>
                        Đã xác nhận ghi sổ và lưu phiếu vào Lịch sử chứng từ!
                      </div>
                      <div style={{ fontSize: '12px', color: '#047857', marginTop: '2px' }}>
                        Phiếu nhập đã được lưu giữ bất biến trong Lịch sử và cộng tồn kho. Phiếu đã xác nhận không sửa được, chỉ lập phiếu điều chỉnh!
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setJustConfirmedReceiptId(null)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #a7f3d0',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        color: '#065f46',
                        cursor: 'pointer',
                        fontWeight: '600',
                        fontSize: '12px',
                      }}
                    >
                      Đã rõ
                    </button>
                  </div>
                )}

                {/* Banner Nhắc Nhở Quy Tắc Bất Biến */}
                <div
                  style={{
                    background: '#fffdf5',
                    border: '1px solid #fde68a',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    fontSize: '13px',
                    boxShadow: '0 1px 2px rgba(245, 158, 11, 0.05)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '700', color: '#854d0e', fontSize: '12.5px' }}>
                      Quy tắc bảo toàn chứng từ: Phiếu đã xác nhận không sửa được, chỉ lập phiếu điều chỉnh
                    </div>
                    <div style={{ fontSize: '12px', color: '#a16207', marginTop: '2px' }}>
                      Toàn bộ phiếu nhập đã ghi sổ kế toán kho được lưu trữ vĩnh viễn trong <strong>Lịch sử chứng từ</strong>. Mọi sai lệch hoặc điều chỉnh số lượng tồn thực tế bắt buộc phải lập <strong>Phiếu điều chỉnh kho</strong>.
                    </div>
                  </div>
                </div>

                {/* Bảng Danh Sách Phiếu Nhập Trong Lịch Sử */}
                <div
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    overflowX: 'auto',
                    background: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <table style={{ width: '100%', minWidth: '1080px', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                      <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', background: '#f8fafc' }}>Mã phiếu</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', background: '#f8fafc' }}>Ngày nhập</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', background: '#f8fafc' }}>Nhà cung cấp</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', background: '#f8fafc' }}>Kho nhập</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', whiteSpace: 'nowrap', background: '#f8fafc' }}>Mặt hàng</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', whiteSpace: 'nowrap', background: '#f8fafc' }}>Trạng thái</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', background: '#f8fafc' }}>Quy tắc nghiệp vụ</th>
                        <th style={{ padding: '12px 16px', fontWeight: '700', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', whiteSpace: 'nowrap', background: '#f8fafc' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReceipts.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ padding: '36px 16px', textAlign: 'center', color: '#94a3b8' }}>
                            Không tìm thấy phiếu nhập kho nào phù hợp trong lịch sử.
                          </td>
                        </tr>
                      ) : (
                        filteredReceipts.map((rc) => {
                          const isJustConfirmed = rc.id === justConfirmedReceiptId;
                          return (
                            <tr
                              key={rc.id}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: isJustConfirmed ? '#f0fdf4' : '#ffffff',
                                transition: 'background 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = isJustConfirmed ? '#ecfdf5' : '#f8fafc')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = isJustConfirmed ? '#f0fdf4' : '#ffffff')}
                            >
                              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSelectServerReceipt(rc);
                                      setActiveTab('form');
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      background: '#eff6ff',
                                      border: '1px solid #dbeafe',
                                      color: '#1d4ed8',
                                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#dbeafe';
                                      e.currentTarget.style.borderColor = '#bfdbfe';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#eff6ff';
                                      e.currentTarget.style.borderColor = '#dbeafe';
                                    }}
                                    title="Nhấn để xem chi tiết chứng từ nhập kho này"
                                  >
                                    {rc.code}
                                  </button>
                                  {isJustConfirmed && (
                                    <span
                                      style={{
                                        background: '#ecfdf5',
                                        border: '1px solid #a7f3d0',
                                        color: '#065f46',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      VỪA GHI SỔ
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                {(() => {
                                  if (!rc.receipt_date) return <span style={{ color: '#94a3b8' }}>—</span>;
                                  const d = new Date(rc.receipt_date);
                                  if (isNaN(d.getTime())) return <span style={{ color: '#475569' }}>{rc.receipt_date}</span>;
                                  const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                  const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                  return (
                                    <div style={{ lineHeight: '1.4' }}>
                                      <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px' }}>{dateStr}</div>
                                      <div style={{ color: '#64748b', fontSize: '11px', fontFamily: 'ui-monospace, monospace' }}>{timeStr}</div>
                                    </div>
                                  );
                                })()}
                              </td>
                              <td style={{ padding: '12px 16px', color: '#0f172a', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                {rc.supplier_name || `NCC #${rc.supplier_id}`}
                              </td>
                              <td style={{ padding: '12px 16px', color: '#334155', fontWeight: '500', whiteSpace: 'nowrap' }}>
                                {rc.warehouse_name || `Kho #${rc.warehouse_id}`}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <div style={{ lineHeight: '1.4' }}>
                                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '12.5px' }}>
                                    {rc.total_items} SP
                                  </div>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                                    ({rc.total_quantity?.toLocaleString('vi-VN')} {rc.items?.[0]?.unit_name || 'cái'})
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    padding: '4px 10px',
                                    borderRadius: '999px',
                                    background: '#ecfdf5',
                                    color: '#065f46',
                                    border: '1px solid #a7f3d0',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <span
                                    style={{
                                      width: '6px',
                                      height: '6px',
                                      borderRadius: '50%',
                                      background: '#10b981',
                                      display: 'inline-block',
                                    }}
                                  />
                                  ĐÃ XÁC NHẬN
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontSize: '11.5px',
                                    color: '#475569',
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    padding: '3px 9px',
                                    borderRadius: '6px',
                                    fontWeight: '600',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title="Chứng từ đã vào sổ kế toán, không thể chỉnh sửa trực tiếp. Để thay đổi cần lập phiếu điều chỉnh."
                                >
                                  Bất biến (Không sửa được)
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleSelectServerReceipt(rc);
                                      setActiveTab('form');
                                    }}
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      color: '#1e293b',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                      transition: 'all 0.15s ease',
                                      whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#f8fafc';
                                      e.currentTarget.style.borderColor = '#94a3b8';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#ffffff';
                                      e.currentTarget.style.borderColor = '#cbd5e1';
                                    }}
                                    title="Xem chi tiết chứng từ nhập kho"
                                  >
                                    <span>Xem</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleTriggerAdjust(undefined, rc)}
                                    style={{
                                      padding: '5px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #bfdbfe',
                                      background: '#eff6ff',
                                      color: '#1d4ed8',
                                      fontSize: '12px',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      boxShadow: '0 1px 2px rgba(37, 99, 235, 0.08)',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      transition: 'all 0.15s ease',
                                      whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#2563eb';
                                      e.currentTarget.style.borderColor = '#2563eb';
                                      e.currentTarget.style.color = '#ffffff';
                                      e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.25)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = '#eff6ff';
                                      e.currentTarget.style.borderColor = '#bfdbfe';
                                      e.currentTarget.style.color = '#1d4ed8';
                                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(37, 99, 235, 0.08)';
                                    }}
                                    title="Lập phiếu điều chỉnh kho cho phiếu này"
                                  >
                                    <span>Lập phiếu điều chỉnh</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <>
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
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>
                    Bạn có <strong>{draftsList.length}</strong> bản nháp chưa ghi sổ (Gần nhất: {draftsList[0].created_at} -{' '}
                    {draftsList[0].supplier_name}). Bạn muốn tiếp tục?
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#3b82f6', marginTop: '2px' }}>
                    Chọn từ menu <strong>[Bản nháp ({draftsList.length})]</strong> ở góc phải hoặc nhấn "Tiếp tục điền" để mở bản gần nhất.
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
                    }}
                  >
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>1. Khai báo thông tin nhập hàng</span>
                {isConfirmed && (
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500', textTransform: 'none' }}>
                    Đang khóa (Bất biến)
                  </span>
                )}
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
                      if (isConfirmed) return;
                      setSupplierId(Number(e.target.value) || '');
                      if (fieldErrors['supplier_id']) {
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy['supplier_id'];
                          return copy;
                        });
                      }
                    }}
                    disabled={isConfirmed || isLoadingMeta}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: fieldErrors['supplier_id'] ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      background: isConfirmed ? '#f1f5f9' : fieldErrors['supplier_id'] ? '#fef2f2' : '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      cursor: isConfirmed ? 'not-allowed' : 'pointer',
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
                    disabled={isConfirmed}
                    onChange={(e) => {
                      if (isConfirmed) return;
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
                      background: isConfirmed ? '#f1f5f9' : fieldErrors['reference_number'] ? '#fef2f2' : '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      cursor: isConfirmed ? 'not-allowed' : 'text',
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
                    disabled={isConfirmed}
                    onChange={(e) => {
                      if (isConfirmed) return;
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
                      background: isConfirmed ? '#f1f5f9' : fieldErrors['receipt_date'] ? '#fef2f2' : '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      cursor: isConfirmed ? 'not-allowed' : 'text',
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
                      if (isConfirmed) return;
                      setWarehouseId(Number(e.target.value) || '');
                      if (fieldErrors['warehouse_id']) {
                        setFieldErrors((prev) => {
                          const copy = { ...prev };
                          delete copy['warehouse_id'];
                          return copy;
                        });
                      }
                    }}
                    disabled={isConfirmed || isLoadingMeta}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: fieldErrors['warehouse_id'] ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      background: isConfirmed ? '#f1f5f9' : fieldErrors['warehouse_id'] ? '#fef2f2' : '#ffffff',
                      fontSize: '13px',
                      color: '#0f172a',
                      cursor: isConfirmed ? 'not-allowed' : 'pointer',
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

                {!isConfirmed && (
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                      border: '1.5px solid #10b981',
                      color: '#065f46',
                      padding: '7px 16px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(16, 185, 129, 0.15)',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 3px 8px rgba(16, 185, 129, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(16, 185, 129, 0.15)';
                    }}
                  >
                    <span>Thêm mặt hàng</span>
                  </button>
                )}
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
                      {!isConfirmed && (
                        <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}>
                          Xóa
                        </th>
                      )}
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
                              disabled={isConfirmed}
                              onChange={(e) => {
                                if (isConfirmed) return;
                                handleProductChange(idx, e.target.value ? Number(e.target.value) : '');
                              }}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: isConfirmed
                                  ? '1px solid #cbd5e1'
                                  : prodError
                                  ? '1.5px solid #ef4444'
                                  : !row.product_id
                                  ? '1px dashed #94a3b8'
                                  : '1px solid #cbd5e1',
                                background: isConfirmed ? '#f1f5f9' : prodError ? '#fef2f2' : '#ffffff',
                                fontSize: '12.5px',
                                color: !row.product_id ? '#64748b' : '#0f172a',
                                cursor: isConfirmed ? 'not-allowed' : 'pointer',
                                outline: 'none',
                              }}
                            >
                              <option value="">-- Chọn sản phẩm dỡ xe --</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  [{p.code}] {p.name}{p.is_batch_managed ? ' (Có quản lý lô)' : ''}
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
                                  Bắt buộc khai báo Số lô & HSD
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
                              onChange={(e) => {
                                if (isConfirmed) return;
                                handleUnitChange(idx, e.target.value);
                              }}
                              disabled={isConfirmed || !row.product_id}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: isConfirmed
                                  ? '1px solid #cbd5e1'
                                  : unitError
                                  ? '1.5px solid #ef4444'
                                  : '1px solid #cbd5e1',
                                background: isConfirmed
                                  ? '#f1f5f9'
                                  : unitError
                                  ? '#fef2f2'
                                  : !row.product_id
                                  ? '#f1f5f9'
                                  : '#ffffff',
                                fontSize: '12.5px',
                                color: '#0f172a',
                                cursor: isConfirmed ? 'not-allowed' : 'pointer',
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
                              disabled={isConfirmed || !row.product_id}
                              onChange={(e) => {
                                if (isConfirmed) return;
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
                                border: isConfirmed
                                  ? '1px solid #cbd5e1'
                                  : qtyError
                                  ? '1.5px solid #ef4444'
                                  : '1px solid #cbd5e1',
                                background: isConfirmed
                                  ? '#f1f5f9'
                                  : qtyError
                                  ? '#fef2f2'
                                  : !row.product_id
                                  ? '#f1f5f9'
                                  : '#ffffff',
                                fontSize: '12.5px',
                                textAlign: 'right',
                                color: '#0f172a',
                                fontWeight: '600',
                                cursor: isConfirmed ? 'not-allowed' : 'text',
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
                                  disabled={isConfirmed}
                                  onChange={(e) => {
                                    if (isConfirmed) return;
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
                                    border: isConfirmed
                                      ? '1px solid #cbd5e1'
                                      : batchError
                                      ? '1.5px solid #ef4444'
                                      : !row.batch_number.trim()
                                      ? '1.5px solid #f59e0b'
                                      : '1px solid #10b981',
                                    background: isConfirmed ? '#f1f5f9' : batchError ? '#fef2f2' : '#fffbeb',
                                    fontSize: '12px',
                                    color: '#0f172a',
                                    cursor: isConfirmed ? 'not-allowed' : 'text',
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
                                  disabled={isConfirmed}
                                  onChange={(e) => {
                                    if (isConfirmed) return;
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
                                    border: isConfirmed
                                      ? '1px solid #cbd5e1'
                                      : expiryError
                                      ? '1.5px solid #ef4444'
                                      : !row.expiry_date.trim()
                                      ? '1.5px solid #f59e0b'
                                      : '1px solid #10b981',
                                    background: isConfirmed ? '#f1f5f9' : expiryError ? '#fef2f2' : '#fffbeb',
                                    fontSize: '12px',
                                    color: '#0f172a',
                                    cursor: isConfirmed ? 'not-allowed' : 'text',
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

                          {/* Cột thao tác / xóa dòng */}
                          {!isConfirmed && (
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
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  if (items.length > 1) {
                                    e.currentTarget.style.background = '#fee2e2';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                                title={items.length <= 1 ? 'Phải có ít nhất 1 mặt hàng' : 'Xóa mặt hàng này'}
                              >
                                <span>Xóa</span>
                              </button>
                            </td>
                          )}
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
          </>
        )}
      </div>

          {/* Footer Modal Actions */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: activeTab === 'list' ? 'space-between' : isConfirmed ? 'space-between' : 'flex-end',
              gap: '10px',
              background: '#f8fafc',
            }}
          >
            {activeTab === 'list' ? (
              <>
                <div style={{ color: '#64748b', fontSize: '13px' }}>
                  Hiển thị <strong style={{ color: '#0f172a' }}>{filteredReceipts.length}</strong> / {confirmedReceiptsCount} chứng từ nhập kho đã ghi sổ
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </>
            ) : isConfirmed ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '12.5px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      color: '#047857',
                      fontWeight: '700',
                      background: '#ecfdf5',
                      padding: '3px 8px',
                      borderRadius: '5px',
                      border: '1px solid #a7f3d0',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>ĐÃ XÁC NHẬN - BẤT BIẾN</span>
                  </span>
                  {viewingReceipt?.confirmed_by && (
                    <span>• Người xác nhận: <strong style={{ color: '#0f172a' }}>{viewingReceipt.confirmed_by}</strong></span>
                  )}
                  {viewingReceipt?.confirmed_at && (
                    <span> lúc {new Date(viewingReceipt.confirmed_at).toLocaleString('vi-VN')}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('list');
                      setViewingReceipt(null);
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#1e293b',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                      e.currentTarget.style.borderColor = '#94a3b8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.borderColor = '#cbd5e1';
                    }}
                    title="Quay lại danh sách Lịch sử chứng từ nhập kho"
                  >
                    <span>Về Lịch sử nhập kho</span>
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    Đóng
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Nút Lưu Nháp */}
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1.5px solid #fcd34d',
                    background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
                    color: '#92400e',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 1px 3px rgba(245, 158, 11, 0.15)',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.background = '#fef3c7';
                      e.currentTarget.style.borderColor = '#f59e0b';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 3px 8px rgba(245, 158, 11, 0.25)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)';
                    e.currentTarget.style.borderColor = '#fcd34d';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(245, 158, 11, 0.15)';
                  }}
                  title="Lưu phiếu ở trạng thái nháp, không cộng tồn kho"
                >
                  <span>{isSubmitting ? 'Đang lưu...' : currentDraftId ? 'Cập nhật nháp' : 'Lưu nháp'}</span>
                </button>

                {/* Nút Xác Nhận Nhập Kho & Ghi Sổ */}
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={isSubmitting}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 60%, #047857 100%)',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.filter = 'brightness(1.08)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 18px rgba(5, 150, 105, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.filter = 'brightness(1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(5, 150, 105, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
                  }}
                  title="Xác nhận dỡ xe xong và cộng tồn kho ngay"
                >
                  <span>{isSubmitting ? 'Đang xử lý...' : 'Xác nhận nhập kho & Ghi sổ'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
