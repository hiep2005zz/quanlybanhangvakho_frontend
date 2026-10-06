import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listDealersApi,
  listDeliveryPointsApi,
  listAllDeliveryPointsApi,
  AllDeliveryPointItem,
  createDeliveryPointApi,
  updateDeliveryPointApi,
  setDefaultDeliveryPointApi,
  deleteDeliveryPointApi,
  createMasterDeliveryPointApi,
  updateMasterDeliveryPointApi,
  deleteMasterDeliveryPointApi,
  DealerOption,
  User,
} from '../services/api';
import type { DeliveryPoint, DeliveryPointInput } from '../types/deliveryPoint';
import { emitStatusToast } from './StatusToast';

interface DeliveryPointsViewProps {
  currentUser?: User;
  token: string;
  onBackToHome?: () => void;
}

const EMPTY_FORM: DeliveryPointInput = {
  label: '',
  address: '',
  receiver_name: '',
  receiver_phone: '',
  route_note: '',
  is_default: false,
};

export default function DeliveryPointsView({
  token,
  onBackToHome: _onBackToHome,
}: DeliveryPointsViewProps) {
  // Dealers list
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<number | null>(null);
  const [dealerSearchQuery, setDealerSearchQuery] = useState('');
  const [loadingDealers, setLoadingDealers] = useState(false);

  // Delivery points of selected dealer
  const [points, setPoints] = useState<DeliveryPoint[]>([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [pointsError, setPointsError] = useState('');

  // Modal: All Delivery Points Overview
  const [isAllPointsModalOpen, setIsAllPointsModalOpen] = useState(false);
  const [allPoints, setAllPoints] = useState<AllDeliveryPointItem[]>([]);
  const [loadingAllPoints, setLoadingAllPoints] = useState(false);
  const [allPointsSearch, setAllPointsSearch] = useState('');

  // Modal: Chọn điểm giao có sẵn cho đại lý
  const [isSelectPointModalOpen, setIsSelectPointModalOpen] = useState(false);
  const [selectPointSearch, setSelectPointSearch] = useState('');
  const [selectingPointId, setSelectingPointId] = useState<number | null>(null);
  const [deselectingPointId, setDeselectingPointId] = useState<number | null>(null);

  // Modal: create/edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<DeliveryPoint | null>(null);
  const [formDealerId, setFormDealerId] = useState<number | null>(null);
  const [form, setForm] = useState<DeliveryPointInput>(EMPTY_FORM);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal: delete dealer point
  const [deletingPoint, setDeletingPoint] = useState<DeliveryPoint | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Master point specific state
  const [isEditingMaster, setIsEditingMaster] = useState(false);
  const [deletingMasterPoint, setDeletingMasterPoint] = useState<AllDeliveryPointItem | null>(null);
  const [isDeletingMaster, setIsDeletingMaster] = useState(false);

  // Load dealers
  const loadDealers = useCallback(async () => {
    setLoadingDealers(true);
    try {
      const data = await listDealersApi(token);
      setDealers(data);
      if (data.length > 0 && !selectedDealerId) {
        setSelectedDealerId(data[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách đại lý';
      emitStatusToast({ title: 'Lỗi tải đại lý', message: msg, type: 'error' });
    } finally {
      setLoadingDealers(false);
    }
  }, [token, selectedDealerId]);

  useEffect(() => {
    loadDealers();
  }, [loadDealers]);

  // Load delivery points for current dealer
  const loadPoints = useCallback(async () => {
    if (!selectedDealerId) {
      setPoints([]);
      return;
    }
    setLoadingPoints(true);
    setPointsError('');
    try {
      const data = await listDeliveryPointsApi(token, selectedDealerId);
      setPoints(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách điểm giao hàng';
      setPointsError(msg);
    } finally {
      setLoadingPoints(false);
    }
  }, [token, selectedDealerId]);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  // Load all delivery points
  const loadAllPoints = useCallback(async () => {
    setLoadingAllPoints(true);
    try {
      const data = await listAllDeliveryPointsApi(token);
      setAllPoints(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách tất cả điểm giao';
      emitStatusToast({ title: 'Lỗi', message: msg, type: 'error' });
    } finally {
      setLoadingAllPoints(false);
    }
  }, [token]);

  const handleOpenAllPointsModal = () => {
    setIsAllPointsModalOpen(true);
    loadAllPoints();
  };

  // Selected dealer object
  const selectedDealer = useMemo(() => {
    return dealers.find((d) => d.id === selectedDealerId) || null;
  }, [dealers, selectedDealerId]);

  // Filtered dealers in left column
  const filteredDealers = useMemo(() => {
    const q = dealerSearchQuery.trim().toLowerCase();
    if (!q) return dealers;
    return dealers.filter(
      (d) =>
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.code && d.code.toLowerCase().includes(q)) ||
        (d.phone && d.phone.toLowerCase().includes(q)) ||
        (d.address && d.address.toLowerCase().includes(q))
    );
  }, [dealers, dealerSearchQuery]);

  // Filtered all points in modal (không lọc theo đại lý phụ trách, chỉ tìm kiếm chung)
  const filteredAllPoints = useMemo(() => {
    const q = allPointsSearch.trim().toLowerCase();
    if (!q) return allPoints;
    return allPoints.filter(
      (p) =>
        (p.label && p.label.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.receiver_name && p.receiver_name.toLowerCase().includes(q)) ||
        (p.receiver_phone && p.receiver_phone.toLowerCase().includes(q)) ||
        (p.route_note && p.route_note.toLowerCase().includes(q))
    );
  }, [allPoints, allPointsSearch]);

  // Danh sách các điểm giao có sẵn (lọc trùng theo label + address) để chọn cho đại lý
  const availablePointsToSelect = useMemo(() => {
    const q = selectPointSearch.trim().toLowerCase();
    const filtered = allPoints.filter((p) => {
      if (!q) return true;
      return (
        (p.label && p.label.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q)) ||
        (p.receiver_name && p.receiver_name.toLowerCase().includes(q)) ||
        (p.receiver_phone && p.receiver_phone.toLowerCase().includes(q)) ||
        (p.route_note && p.route_note.toLowerCase().includes(q))
      );
    });

    const seen = new Set<string>();
    const uniqueList: AllDeliveryPointItem[] = [];
    for (const item of filtered) {
      const key = `${(item.label || '').trim().toLowerCase()}_@_${(item.address || '').trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueList.push(item);
      }
    }
    return uniqueList;
  }, [allPoints, selectPointSearch]);

  // Tìm điểm giao tương ứng đã được gán cho đại lý hiện tại (nếu có)
  const getAssignedPointForDealer = useCallback(
    (targetPoint: AllDeliveryPointItem) => {
      const targetKey = `${(targetPoint.label || '').trim().toLowerCase()}_@_${(targetPoint.address || '').trim().toLowerCase()}`;
      return (
        points.find((p) => {
          const pKey = `${(p.label || '').trim().toLowerCase()}_@_${(p.address || '').trim().toLowerCase()}`;
          return pKey === targetKey;
        }) || null
      );
    },
    [points]
  );

  // Mở modal Chọn điểm giao cho đại lý đang chọn
  const handleOpenSelectPointModal = () => {
    if (!selectedDealerId) {
      emitStatusToast({
        title: 'Chưa chọn đại lý',
        message: 'Vui lòng chọn một đại lý trước khi chọn điểm giao.',
        type: 'warning',
      });
      return;
    }
    setSelectPointSearch('');
    setIsSelectPointModalOpen(true);
    loadAllPoints();
  };

  // Gán điểm giao có sẵn cho đại lý đang chọn
  const handleSelectPointForDealer = async (item: AllDeliveryPointItem) => {
    if (!selectedDealerId) return;
    setSelectingPointId(item.id);
    try {
      const willBeDefault = points.length === 0;
      await createDeliveryPointApi(token, selectedDealerId, {
        label: item.label,
        address: item.address,
        receiver_name: item.receiver_name || selectedDealer?.name || '',
        receiver_phone: item.receiver_phone || selectedDealer?.phone || '',
        route_note: item.route_note || '',
        is_default: willBeDefault,
      });
      emitStatusToast({
        title: 'Đã thêm điểm giao',
        message: `Đã thêm điểm giao "${item.label}" cho đại lý "${selectedDealer?.name || ''}"`,
        type: 'success',
      });
      await loadPoints();
      await loadAllPoints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể thêm điểm giao này';
      emitStatusToast({
        title: 'Lỗi',
        message: msg,
        type: 'error',
      });
    } finally {
      setSelectingPointId(null);
    }
  };

  // Bỏ chọn điểm giao khỏi đại lý đang chọn
  const handleDeselectPointFromDealer = async (item: AllDeliveryPointItem, assignedId: number) => {
    if (!selectedDealerId) return;
    setDeselectingPointId(item.id);
    try {
      await deleteDeliveryPointApi(token, selectedDealerId, assignedId);
      emitStatusToast({
        title: 'Đã bỏ chọn',
        message: `Đã bỏ chọn điểm giao "${item.label}" khỏi đại lý "${selectedDealer?.name || ''}"`,
        type: 'info',
      });
      await loadPoints();
      await loadAllPoints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể bỏ chọn điểm giao';
      emitStatusToast({
        title: 'Lỗi',
        message: msg,
        type: 'error',
      });
    } finally {
      setDeselectingPointId(null);
    }
  };

  // Open modal for Create
  const handleOpenCreateModal = (customDealerId?: number) => {
    const targetDealerId = customDealerId || selectedDealerId || (dealers.length > 0 ? dealers[0].id : null);
    if (!targetDealerId) {
      emitStatusToast({
        title: 'Chưa có đại lý',
        message: 'Hệ thống chưa có đại lý nào để tạo điểm giao.',
        type: 'warning',
      });
      return;
    }
    const targetDealer = dealers.find((d) => d.id === targetDealerId);
    setIsEditingMaster(false);
    setFormDealerId(targetDealerId);
    setEditingPoint(null);
    setForm({
      ...EMPTY_FORM,
      receiver_name: targetDealer?.name || '',
      receiver_phone: targetDealer?.phone || '',
      address: '',
      is_default: false,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Open modal for Create in Master Catalog
  const handleOpenCreateMasterModal = () => {
    setIsEditingMaster(true);
    setEditingPoint(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  // Open modal for Edit Dealer Point
  const handleOpenEditModal = (p: DeliveryPoint) => {
    setIsEditingMaster(false);
    setFormDealerId(p.dealer_id || selectedDealerId);
    setEditingPoint(p);
    const rawPhone = (p.receiver_phone || '').trim();
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const phoneVal = cleanDigits.length > 10 ? cleanDigits.slice(0, 10) : rawPhone;
    setForm({
      label: p.label,
      address: p.address,
      receiver_name: p.receiver_name || '',
      receiver_phone: phoneVal,
      route_note: p.route_note || '',
      is_default: Boolean(p.is_default),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Open modal for Edit Master Catalog Point
  const handleOpenEditMasterModal = (item: AllDeliveryPointItem) => {
    setIsEditingMaster(true);
    setEditingPoint(item);
    const rawPhone = (item.receiver_phone || '').trim();
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const phoneVal = cleanDigits.length > 10 ? cleanDigits.slice(0, 10) : rawPhone;
    setForm({
      label: item.label,
      address: item.address,
      receiver_name: item.receiver_name || '',
      receiver_phone: phoneVal,
      route_note: item.route_note || '',
      is_default: false,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  // Submit create or edit
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) {
      setFormError('Vui lòng nhập tên điểm giao hàng.');
      return;
    }
    if (!form.address.trim()) {
      setFormError('Vui lòng nhập địa chỉ nhận hàng.');
      return;
    }

    const phoneClean = (form.receiver_phone || '').trim();
    let finalPhone = phoneClean;
    if (!editingPoint) {
      if (!phoneClean) {
        setFormError('Vui lòng nhập số điện thoại người nhận.');
        return;
      }
      if (!/^[0-9]{10}$/.test(phoneClean)) {
        setFormError('Số điện thoại người nhận phải bao gồm đúng 10 chữ số.');
        return;
      }
    } else {
      if (phoneClean) {
        const cleanDigits = phoneClean.replace(/\D/g, '');
        if (cleanDigits.length === 10) {
          finalPhone = cleanDigits;
        } else if (cleanDigits.length > 10) {
          finalPhone = cleanDigits.slice(0, 10);
        } else {
          setFormError('Số điện thoại người nhận phải bao gồm đúng 10 chữ số.');
          return;
        }
      }
    }

    const submitPayload = {
      ...form,
      receiver_phone: finalPhone,
    };

    setFormSubmitting(true);
    setFormError('');
    try {
      if (isEditingMaster) {
        if (editingPoint) {
          await updateMasterDeliveryPointApi(token, editingPoint.id, submitPayload);
          emitStatusToast({
            title: 'Cập nhật thành công',
            message: `Đã cập nhật điểm giao "${form.label}" trong danh sách chung`,
            type: 'success',
          });
        } else {
          await createMasterDeliveryPointApi(token, submitPayload);
          emitStatusToast({
            title: 'Thêm mới thành công',
            message: `Đã thêm điểm giao "${form.label}" vào danh sách chung`,
            type: 'success',
          });
        }
      } else {
        const targetDealerId = formDealerId || selectedDealerId;
        if (!targetDealerId) {
          setFormError('Vui lòng chọn đại lý áp dụng điểm giao hàng.');
          return;
        }
        if (editingPoint) {
          await updateDeliveryPointApi(token, targetDealerId, editingPoint.id, submitPayload);
          emitStatusToast({
            title: 'Cập nhật thành công',
            message: `Đã cập nhật điểm giao "${form.label}" cho đại lý`,
            type: 'success',
          });
        } else {
          await createDeliveryPointApi(token, targetDealerId, submitPayload);
          emitStatusToast({
            title: 'Thêm mới thành công',
            message: `Đã thêm điểm giao "${form.label}" cho đại lý`,
            type: 'success',
          });
        }
      }
      setIsModalOpen(false);
      setEditingPoint(null);
      setIsEditingMaster(false);
      setForm(EMPTY_FORM);
      await loadPoints();
      await loadAllPoints();
    } catch (err: unknown) {
      let msg = 'Có lỗi xảy ra khi lưu';
      if (err instanceof Error) {
        msg = err.message;
      } else if (typeof err === 'string') {
        msg = err;
      } else if (typeof err === 'object' && err !== null) {
        msg = (err as any).message || (err as any).detail || JSON.stringify(err);
      }
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete from dealer (only unlinks from dealer, does NOT remove from master list)
  const handleDelete = async () => {
    if (!deletingPoint) return;
    const targetDealerId = deletingPoint.dealer_id || selectedDealerId;
    if (!targetDealerId) return;
    setIsDeleting(true);
    try {
      await deleteDeliveryPointApi(token, targetDealerId, deletingPoint.id);
      emitStatusToast({
        title: 'Đã gỡ điểm giao',
        message: `Đã gỡ điểm giao "${deletingPoint.label}" khỏi đại lý`,
        type: 'success',
      });
      setDeletingPoint(null);
      await loadPoints();
      await loadAllPoints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể gỡ điểm giao';
      emitStatusToast({ title: 'Lỗi', message: msg, type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete from Master Catalog
  const handleDeleteMaster = async () => {
    if (!deletingMasterPoint) return;
    setIsDeletingMaster(true);
    try {
      await deleteMasterDeliveryPointApi(token, deletingMasterPoint.id);
      emitStatusToast({
        title: 'Đã xóa',
        message: `Đã xóa điểm giao "${deletingMasterPoint.label}" khỏi danh sách chung`,
        type: 'success',
      });
      setDeletingMasterPoint(null);
      await loadAllPoints();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa điểm giao';
      emitStatusToast({ title: 'Lỗi xóa', message: msg, type: 'error' });
    } finally {
      setIsDeletingMaster(false);
    }
  };

  // Set default point
  const handleSetDefault = async (point: DeliveryPoint) => {
    const targetDealerId = point.dealer_id || selectedDealerId;
    if (!targetDealerId || point.is_default) return;
    try {
      await setDefaultDeliveryPointApi(token, targetDealerId, point.id);
      emitStatusToast({
        title: 'Đã đổi mặc định',
        message: `Đã đặt "${point.label}" làm điểm giao mặc định`,
        type: 'success',
      });
      await loadPoints();
      if (isAllPointsModalOpen) {
        await loadAllPoints();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể đặt làm mặc định';
      emitStatusToast({ title: 'Lỗi', message: msg, type: 'error' });
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px', fontFamily: 'inherit' }}>
      {/* 1. Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Quản lý Điểm Giao Hàng
              </h2>
            </div>
          </div>
        </div>

        {/* Action buttons on top right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={loadPoints}
            style={{
              padding: '9px 14px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Làm mới danh sách"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            <span>Làm mới</span>
          </button>

          {/* Nút Xem Danh sách điểm giao hệ thống */}
          <button
            type="button"
            onClick={handleOpenAllPointsModal}
            style={{
              padding: '9px 16px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              border: 'none',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            title="Xem danh sách tất cả các điểm giao hàng đang có trong hệ thống"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
            <span>Danh sách điểm giao</span>
          </button>
        </div>
      </div>

      {/* 2. Main Content: 1 Unified Block (Khối thống nhất Master - Detail) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'minmax(300px, 360px) 1fr',
          minHeight: 'calc(100vh - 210px)',
          alignItems: 'stretch',
        }}
      >
        {/* LEFT COLUMN: Dealers Selector List */}
        <div
          style={{
            background: '#fafbfc',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          {/* Header of dealer list */}
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Danh sách đại lý</span>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#475569',
                  background: '#e2e8f0',
                  padding: '2px 8px',
                  borderRadius: '999px',
                }}
              >
                {dealers.length} đại lý
              </span>
            </div>

            {/* Quick search input */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Tìm mã, tên, SĐT đại lý..."
                value={dealerSearchQuery}
                onChange={(e) => setDealerSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '9px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13px',
                  color: '#1e293b',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: 'absolute', left: '11px', top: '10px' }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          {/* Dealer cards scrollable list */}
          <div style={{ flex: 1, maxHeight: 'calc(100vh - 280px)', overflowY: 'auto', padding: '10px 8px' }}>
            {loadingDealers ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13.5px' }}>
                Đang tải danh sách đại lý...
              </div>
            ) : filteredDealers.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13.5px' }}>
                Không tìm thấy đại lý nào phù hợp.
              </div>
            ) : (
              filteredDealers.map((d) => {
                const isSelected = d.id === selectedDealerId;
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDealerId(d.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      marginBottom: '6px',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #3b82f6' : '1px solid transparent',
                      background: isSelected ? '#eff6ff' : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          background: isSelected ? '#dbeafe' : '#f1f5f9',
                          color: isSelected ? '#1e40af' : '#475569',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {d.code || `DL-${d.id}`}
                      </span>

                      {d.phone && (
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {d.phone}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: isSelected ? '700' : '600',
                        color: isSelected ? '#1d4ed8' : '#0f172a',
                        marginTop: '4px',
                        lineHeight: 1.35,
                      }}
                    >
                      {d.name}
                    </div>

                    {d.address && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginTop: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={d.address}
                      >
                        {d.address}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Delivery Points of Selected Dealer */}
        <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', minWidth: 0 }}>
          {/* Dealer Info Banner Header with 'Chọn điểm giao' button */}
          {selectedDealer ? (
            <div
              style={{
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span
                    style={{
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      fontSize: '12px',
                      fontWeight: '800',
                      padding: '3px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    {selectedDealer.code || `DL-${selectedDealer.id}`}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '750', color: '#0f172a' }}>
                    {selectedDealer.name}
                  </h3>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    marginTop: '6px',
                    fontSize: '13px',
                    color: '#475569',
                    flexWrap: 'wrap',
                  }}
                >
                  {selectedDealer.phone && (
                    <span>
                      <strong style={{ color: '#334155' }}>SĐT:</strong> {selectedDealer.phone}
                    </span>
                  )}
                  {selectedDealer.address && (
                    <span>
                      <strong style={{ color: '#334155' }}>Địa chỉ chính:</strong> {selectedDealer.address}
                    </span>
                  )}
                </div>
              </div>

              {/* Nút Chọn điểm giao cho đại lý đang chọn */}
              <button
                type="button"
                onClick={() => handleOpenSelectPointModal()}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                <span>Chọn điểm giao</span>
              </button>
            </div>
          ) : (
            <div
              style={{
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                padding: '24px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '13.5px',
              }}
            >
              Vui lòng chọn một đại lý ở danh sách bên trái.
            </div>
          )}

          {/* Delivery Points Section (Integrated into Unified Panel) */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '20px 24px',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '18px',
                paddingBottom: '14px',
                borderBottom: '1px solid #f1f5f9',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Điểm giao của đại lý này ({points.length})
                </h4>
              </div>
            </div>

            {loadingPoints ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: '15px', fontWeight: '600' }}>Đang tải danh sách điểm giao...</div>
              </div>
            ) : pointsError ? (
              <div
                style={{
                  padding: '16px 20px',
                  borderRadius: '12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{pointsError}</span>
                <button
                  type="button"
                  onClick={loadPoints}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: '#ffffff',
                    border: '1px solid #fca5a5',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}
                >
                  Thử lại
                </button>
              </div>
            ) : points.length === 0 ? (
              /* Empty state */
              <div
                style={{
                  padding: '60px 24px',
                  textAlign: 'center',
                  background: '#f8fafc',
                  borderRadius: '14px',
                  border: '1px dashed #cbd5e1',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    background: '#e0e7ff',
                    color: '#4f46e5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Chưa có điểm giao hàng nào
                </h4>
              </div>
            ) : (
              /* Points List */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {points.map((p) => {
                  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`;
                  return (
                    <div
                      key={p.id}
                      style={{
                        borderRadius: '14px',
                        border: p.is_default ? '2px solid #6366f1' : '1px solid #e2e8f0',
                        background: p.is_default ? '#fbfcfe' : '#ffffff',
                        boxShadow: p.is_default ? '0 4px 14px rgba(99, 102, 241, 0.12)' : '0 1px 3px rgba(0, 0, 0, 0.03)',
                        padding: '18px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '14px',
                        position: 'relative',
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                      }}
                    >
                      {/* Top Header */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: p.is_default ? '#e0e7ff' : '#f1f5f9',
                                color: p.is_default ? '#4f46e5' : '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                            </div>
                            <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                              {p.label}
                            </span>
                          </div>

                          {p.is_default ? (
                            <span
                              style={{
                                background: '#e0e7ff',
                                color: '#4338ca',
                                border: '1px solid #c7d2fe',
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '3px 8px',
                                borderRadius: '999px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              ★ Mặc định
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleSetDefault(p)}
                              style={{
                                background: 'transparent',
                                border: '1px solid #cbd5e1',
                                color: '#64748b',
                                fontSize: '11px',
                                fontWeight: '600',
                                padding: '3px 8px',
                                borderRadius: '999px',
                                cursor: 'pointer',
                              }}
                              title="Đặt làm điểm giao hàng mặc định"
                            >
                              Đặt mặc định
                            </button>
                          )}
                        </div>

                        {/* Address */}
                        <div style={{ marginTop: '12px', fontSize: '13.5px', color: '#334155', lineHeight: '1.45' }}>
                          <span style={{ fontWeight: '600', color: '#64748b' }}>Địa chỉ: </span>
                          {p.address}
                        </div>

                        {/* Map Directions link */}
                        <div style={{ marginTop: '6px' }}>
                          <a
                            href={mapUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#2563eb',
                              textDecoration: 'none',
                            }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="3 11 22 2 13 21 11 13 3 11" />
                            </svg>
                            <span>Mở bản đồ / Chỉ đường</span>
                          </a>
                        </div>

                        {/* Receiver Info */}
                        {(p.receiver_name || p.receiver_phone) && (
                          <div
                            style={{
                              marginTop: '10px',
                              padding: '8px 12px',
                              background: '#f8fafc',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              fontSize: '13px',
                              color: '#475569',
                            }}
                          >
                            {p.receiver_name && (
                              <div>
                                <strong>Người nhận:</strong> {p.receiver_name}
                              </div>
                            )}
                            {p.receiver_phone && (
                              <div style={{ marginTop: '2px' }}>
                                <strong>SĐT:</strong>{' '}
                                <a
                                  href={`tel:${p.receiver_phone}`}
                                  style={{ color: '#0284c7', textDecoration: 'none', fontWeight: '600' }}
                                >
                                  {p.receiver_phone}
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Route Note */}
                        {p.route_note && (
                          <div
                            style={{
                              marginTop: '8px',
                              fontSize: '12px',
                              color: '#64748b',
                              fontStyle: 'italic',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '5px',
                            }}
                          >
                            <span>📝</span>
                            <span>{p.route_note}</span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          alignItems: 'center',
                          gap: '8px',
                          paddingTop: '12px',
                          borderTop: '1px solid #f1f5f9',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(p)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            fontSize: '12.5px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                          </svg>
                          <span>Sửa</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeletingPoint(p)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            fontSize: '12.5px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          <span>Xóa</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. MODAL: Danh sách TẤT CẢ các điểm giao hàng đang có trong hệ thống */}
      {isAllPointsModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99998,
            padding: '16px',
          }}
          onClick={() => setIsAllPointsModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              maxWidth: '860px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#e0e7ff',
                    color: '#4338ca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>
                      Danh sách các điểm giao đang có
                    </h3>
                    <span
                      style={{
                        background: '#e0e7ff',
                        color: '#4338ca',
                        fontSize: '12px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}
                    >
                      {allPoints.length} điểm giao
                    </span>
                  </div>
                  <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                    Tổng hợp toàn bộ các điểm giao hàng của tất cả đại lý trong hệ thống
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAllPointsModalOpen(false)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  fontSize: '16px',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Filter and Action Bar */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                flexWrap: 'wrap',
                background: '#ffffff',
              }}
            >
              {/* Search input */}
              <div style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Tìm theo tên điểm giao, địa chỉ, người nhận, SĐT..."
                  value={allPointsSearch}
                  onChange={(e) => setAllPointsSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 34px',
                    borderRadius: '9px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ position: 'absolute', left: '11px', top: '11px' }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>

              <button
                type="button"
                onClick={loadAllPoints}
                style={{
                  padding: '9px 14px',
                  borderRadius: '9px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Làm mới
              </button>

              {/* Nút + Thêm điểm giao mới trực tiếp từ modal này */}
              <button
                type="button"
                onClick={() => handleOpenCreateMasterModal()}
                style={{
                  padding: '9px 16px',
                  borderRadius: '9px',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
                  whiteSpace: 'nowrap',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Thêm điểm giao mới</span>
              </button>
            </div>

            {/* Modal Body: Table / List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {loadingAllPoints ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  Đang tải danh sách điểm giao hàng toàn hệ thống...
                </div>
              ) : filteredAllPoints.length === 0 ? (
                <div
                  style={{
                    padding: '48px 20px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                    fontSize: '14px',
                  }}
                >
                  Không tìm thấy điểm giao hàng nào phù hợp với bộ lọc tìm kiếm.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                      <th style={{ padding: '12px 14px', width: '28%' }}>Tên điểm giao</th>
                      <th style={{ padding: '12px 14px', width: '38%' }}>Địa chỉ nhận</th>
                      <th style={{ padding: '12px 14px', width: '24%' }}>Người nhận / SĐT</th>
                      <th style={{ padding: '12px 14px', width: '10%', textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAllPoints.map((item) => {
                      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`;
                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {/* Tên điểm giao */}
                          <td style={{ padding: '14px', verticalAlign: 'top', width: '30%' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ color: '#0f172a', fontSize: '14.5px' }}>{item.label}</strong>
                              {item.is_default && (
                                <span
                                  style={{
                                    background: '#e0e7ff',
                                    color: '#4338ca',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    padding: '2px 7px',
                                    borderRadius: '999px',
                                  }}
                                >
                                  ★ Mặc định
                                </span>
                              )}
                            </div>
                            {item.route_note && (
                              <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '3px' }}>
                                📝 {item.route_note}
                              </div>
                            )}
                          </td>

                          {/* Địa chỉ */}
                          <td style={{ padding: '14px', verticalAlign: 'top', width: '40%' }}>
                            <div style={{ color: '#334155', lineHeight: 1.4 }}>{item.address}</div>
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '12px',
                                fontWeight: '600',
                                color: '#2563eb',
                                textDecoration: 'none',
                                marginTop: '4px',
                              }}
                            >
                              Mở bản đồ chỉ đường
                            </a>
                          </td>

                          {/* Người nhận & SĐT */}
                          <td style={{ padding: '14px', verticalAlign: 'top', width: '24%' }}>
                            {item.receiver_name && <div style={{ color: '#0f172a', fontWeight: '500' }}>{item.receiver_name}</div>}
                            {item.receiver_phone && (
                              <div style={{ marginTop: '2px' }}>
                                <a
                                  href={`tel:${item.receiver_phone}`}
                                  style={{ color: '#0284c7', textDecoration: 'none', fontWeight: '600' }}
                                >
                                  {item.receiver_phone}
                                </a>
                              </div>
                            )}
                            {!item.receiver_name && !item.receiver_phone && (
                              <span style={{ color: '#94a3b8' }}>-</span>
                            )}
                          </td>

                          {/* Thao tác: Sửa / Xóa trong danh sách chung */}
                          <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'center', width: '14%' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenEditMasterModal(item)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '7px',
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  color: '#1e293b',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Chỉnh sửa thông tin điểm giao trong danh sách chung"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 20h9" />
                                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                </svg>
                                <span>Sửa</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingMasterPoint(item)}
                                style={{
                                  padding: '5px 10px',
                                  borderRadius: '7px',
                                  background: '#fff1f2',
                                  border: '1px solid #fecdd3',
                                  color: '#e11d48',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                                title="Xóa khỏi danh sách điểm giao chung"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                <span>Xóa</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Hiển thị <strong>{filteredAllPoints.length}</strong> / <strong>{allPoints.length}</strong> điểm giao hàng
              </span>

              <button
                type="button"
                onClick={() => setIsAllPointsModalOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '9px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Chọn điểm giao từ danh sách có sẵn cho đại lý */}
      {isSelectPointModalOpen && selectedDealer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99998,
            padding: '16px',
          }}
          onClick={() => setIsSelectPointModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              maxWidth: '860px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 11l3 3L22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '18.5px', fontWeight: '800', color: '#0f172a' }}>
                      Chọn điểm giao cho đại lý
                    </h3>
                    <span
                      style={{
                        background: '#e0e7ff',
                        color: '#4338ca',
                        fontSize: '12px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '999px',
                      }}
                    >
                      {selectedDealer.code}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                    Đại lý: <strong style={{ color: '#0f172a' }}>{selectedDealer.name}</strong> • Chọn điểm giao trong các điểm giao đã có sẵn
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSelectPointModalOpen(false)}
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '18px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Search toolbar */}
            <div
              style={{
                padding: '12px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                background: '#ffffff',
              }}
            >
              <div style={{ position: 'relative', flex: 1 }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="Tìm điểm giao theo tên, địa chỉ, người nhận, SĐT..."
                  value={selectPointSearch}
                  onChange={(e) => setSelectPointSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 36px',
                    borderRadius: '9px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Shortcut to create new if not existing */}
              <button
                type="button"
                onClick={() => {
                  handleOpenCreateModal(selectedDealerId || undefined);
                }}
                style={{
                  padding: '9px 15px',
                  borderRadius: '9px',
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
                title="Tạo điểm giao mới hoàn toàn cho đại lý này"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Tạo điểm giao mới</span>
              </button>
            </div>

            {/* Modal Body: Available points list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
              {loadingAllPoints ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#94a3b8' }}>
                  Đang tải danh sách điểm giao hàng...
                </div>
              ) : availablePointsToSelect.length === 0 ? (
                <div
                  style={{
                    padding: '48px 20px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px dashed #cbd5e1',
                    color: '#64748b',
                    fontSize: '14px',
                  }}
                >
                  <p style={{ margin: '0 0 12px 0' }}>Không tìm thấy điểm giao hàng có sẵn nào phù hợp.</p>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateModal(selectedDealerId || undefined)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    + Tạo điểm giao mới ngay
                  </button>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>
                      <th style={{ padding: '12px 14px', width: '26%' }}>Tên điểm giao</th>
                      <th style={{ padding: '12px 14px', width: '38%' }}>Địa chỉ nhận</th>
                      <th style={{ padding: '12px 14px', width: '20%' }}>Người nhận / SĐT</th>
                      <th style={{ padding: '12px 14px', width: '16%', textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availablePointsToSelect.map((item) => {
                      const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address)}`;
                      const assignedPoint = getAssignedPointForDealer(item);
                      const isAssigned = Boolean(assignedPoint);
                      const isSelecting = selectingPointId === item.id;
                      const isDeselecting = deselectingPointId === item.id;

                      return (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: isAssigned ? '#fafafa' : '#ffffff',
                            transition: 'background 0.1s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isAssigned) e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            if (!isAssigned) e.currentTarget.style.backgroundColor = '#ffffff';
                          }}
                        >
                          {/* Tên điểm giao */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            <strong style={{ color: '#0f172a', fontSize: '14px' }}>{item.label}</strong>
                            {item.route_note && (
                              <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', marginTop: '3px' }}>
                                📝 {item.route_note}
                              </div>
                            )}
                          </td>

                          {/* Địa chỉ */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            <div style={{ color: '#334155', lineHeight: 1.4 }}>{item.address}</div>
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '11.5px',
                                color: '#2563eb',
                                textDecoration: 'none',
                                marginTop: '4px',
                                fontWeight: '600',
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <polygon points="3 11 22 2 13 21 11 13 3 11" />
                              </svg>
                              <span>Bản đồ</span>
                            </a>
                          </td>

                          {/* Người nhận / SĐT */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            {item.receiver_name ? (
                              <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.receiver_name}</div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                            {item.receiver_phone && (
                              <div style={{ fontSize: '12.5px', color: '#0284c7', marginTop: '2px', fontWeight: '500' }}>
                                {item.receiver_phone}
                              </div>
                            )}
                          </td>

                          {/* Thao tác: Bỏ chọn HOẶC Thêm */}
                          <td style={{ padding: '14px', verticalAlign: 'top', textAlign: 'center' }}>
                            {assignedPoint ? (
                              <button
                                type="button"
                                disabled={isDeselecting}
                                onClick={() => handleDeselectPointFromDealer(item, assignedPoint.id)}
                                style={{
                                  padding: '6px 16px',
                                  borderRadius: '8px',
                                  background: '#fff1f2',
                                  color: '#e11d48',
                                  border: '1px solid #fecdd3',
                                  fontSize: '12.5px',
                                  fontWeight: '600',
                                  cursor: isDeselecting ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isDeselecting) {
                                    e.currentTarget.style.backgroundColor = '#ffe4e6';
                                    e.currentTarget.style.borderColor = '#fda4af';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isDeselecting) {
                                    e.currentTarget.style.backgroundColor = '#fff1f2';
                                    e.currentTarget.style.borderColor = '#fecdd3';
                                  }
                                }}
                                title="Bỏ điểm giao này khỏi đại lý"
                              >
                                {isDeselecting ? (
                                  'Đang bỏ...'
                                ) : (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                    <span>Bỏ chọn</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={isSelecting}
                                onClick={() => handleSelectPointForDealer(item)}
                                style={{
                                  padding: '6px 16px',
                                  borderRadius: '8px',
                                  background: '#2563eb',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '12.5px',
                                  fontWeight: '600',
                                  cursor: isSelecting ? 'not-allowed' : 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelecting) e.currentTarget.style.backgroundColor = '#1d4ed8';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelecting) e.currentTarget.style.backgroundColor = '#2563eb';
                                }}
                              >
                                {isSelecting ? (
                                  'Đang thêm...'
                                ) : (
                                  <>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <line x1="12" y1="5" x2="12" y2="19" />
                                      <line x1="5" y1="12" x2="19" y2="12" />
                                    </svg>
                                    <span>Thêm</span>
                                  </>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                Hiển thị <strong>{availablePointsToSelect.length}</strong> điểm giao có sẵn
              </span>

              <button
                type="button"
                onClick={() => setIsSelectPointModalOpen(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '9px',
                  border: '1px solid #2563eb',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: Thêm / Sửa điểm giao hàng (Thiết kế compact, không bị tràn màn hình) */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px',
          }}
          onClick={() => {
            if (!formSubmitting) setIsModalOpen(false);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Compact) */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
                flexShrink: 0,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                  {editingPoint ? 'Chỉnh sửa điểm giao hàng' : 'Thêm điểm giao hàng mới'}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Điểm nhận hàng sẽ được áp dụng khi xuất hàng & lập đơn
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={formSubmitting}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  width: '28px',
                  height: '28px',
                  fontSize: '15px',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body Form (Scrollable with compact grid) */}
            <form
              onSubmit={handleSubmitForm}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {formError && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '12.5px',
                  }}
                >
                  {formError}
                </div>
              )}

              {/* Hàng 1 (2 cột): Đại lý & Tên điểm giao */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Thuộc Đại lý <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={formDealerId || ''}
                    onChange={(e) => setFormDealerId(Number(e.target.value))}
                    disabled={Boolean(editingPoint)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      background: editingPoint ? '#f1f5f9' : '#ffffff',
                      cursor: editingPoint ? 'not-allowed' : 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    {dealers.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code ? `[${d.code}] ` : ''}{d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Tên điểm giao <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Kho tổng, Chi nhánh 1..."
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Hàng 2: Địa chỉ nhận hàng */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Địa chỉ nhận hàng chi tiết <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Số 123 Đường ABC, Phường X, Quận Y, TP. HCM"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Hàng 3 (2 cột): Người nhận & Số điện thoại */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Người nhận hàng
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Anh Minh"
                    value={form.receiver_name || ''}
                    onChange={(e) => setForm({ ...form, receiver_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Số điện thoại nhận {!editingPoint && <span style={{ color: '#ef4444' }}>*</span>}
                  </label>
                  <input
                    type="tel"
                    placeholder="VD: 0912345678"
                    maxLength={10}
                    required={!editingPoint}
                    value={form.receiver_phone || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setForm({ ...form, receiver_phone: val });
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Hàng 4: Ghi chú lộ trình */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Ghi chú lộ trình / giao hàng (tuỳ chọn)
                </label>
                <input
                  type="text"
                  placeholder="VD: Xe tải vào được, giao giờ hành chính..."
                  value={form.route_note || ''}
                  onChange={(e) => setForm({ ...form, route_note: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Hàng 5: Checkbox Mặc định (Compact) */}
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: '7px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  marginTop: '2px',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                  style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155' }}>
                  Đặt làm điểm giao hàng mặc định cho đại lý này
                </span>
              </label>

              {/* Hidden submit trigger so Enter key works */}
              <button type="submit" style={{ display: 'none' }} />
            </form>

            {/* Modal Footer (Cố định ở đáy, luôn nhìn thấy rõ) */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '10px',
                background: '#f8fafc',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={formSubmitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleSubmitForm}
                disabled={formSubmitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: formSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }}
              >
                {formSubmitting ? 'Đang lưu...' : editingPoint ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 5. Modal: Xác nhận xóa điểm giao */}
      {deletingPoint && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px',
          }}
          onClick={() => {
            if (!isDeleting) setDeletingPoint(null);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                border: '1px solid #fee2e2',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
              Gỡ điểm giao khỏi đại lý?
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5', margin: '0 0 24px 0' }}>
              Điểm giao <strong>"{deletingPoint.label}"</strong> sẽ được gỡ khỏi danh sách của đại lý này. Điểm giao vẫn được lưu trong <strong>Danh sách điểm giao</strong> chung của hệ thống và đại lý có thể chọn lại bất cứ lúc nào.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingPoint(null)}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                }}
              >
                {isDeleting ? 'Đang gỡ...' : 'Gỡ khỏi đại lý'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Xóa điểm giao khỏi Danh sách chung */}
      {deletingMasterPoint && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px',
          }}
          onClick={() => setDeletingMasterPoint(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '18px',
              maxWidth: '440px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
              border: '1px solid #fecdd3',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                border: '1px solid #fecdd3',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
              Xóa khỏi danh sách điểm giao chung?
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5', margin: '0 0 24px 0' }}>
              Điểm giao <strong>"{deletingMasterPoint.label}"</strong> sẽ bị xóa khỏi danh mục điểm giao chung của hệ thống.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setDeletingMasterPoint(null)}
                disabled={isDeletingMaster}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={handleDeleteMaster}
                disabled={isDeletingMaster}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isDeletingMaster ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                }}
              >
                {isDeletingMaster ? 'Đang xóa...' : 'Xóa điểm giao'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
