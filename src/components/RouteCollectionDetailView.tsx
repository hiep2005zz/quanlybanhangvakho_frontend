import React, { useState, useEffect } from 'react';
import {
  PaymentCollectionItem,
  User,
  getPaymentCollectionDetailApi,
  submitRemittanceApi,
  confirmPaymentCollectionApi,
  rejectPaymentCollectionApi,
} from '../services/api';
import { convertNumberToVietnameseWords } from '../utils/numberToWords';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface RouteCollectionDetailViewProps {
  collection: PaymentCollectionItem | null;
  collectionId?: number;
  token: string;
  currentUser: User | null;
  onBack: () => void;
  onUpdated: () => void;
}

export const RouteCollectionDetailView: React.FC<RouteCollectionDetailViewProps> = ({
  collection: initialCollection,
  collectionId,
  token,
  currentUser,
  onBack,
  onUpdated,
}) => {
  const [collection, setCollection] = useState<PaymentCollectionItem | null>(initialCollection);
  const [loading, setLoading] = useState<boolean>(!initialCollection && Boolean(collectionId));
  const [error, setError] = useState<string | null>(null);

  // Modals / Actions
  const [isRemitOpen, setIsRemitOpen] = useState(false);
  const [remitNote, setRemitNote] = useState('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmNote, setConfirmNote] = useState('');
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Lightbox
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isAccountant = currentUser?.role === 'accountant';
  const isSalesManager = currentUser?.role === 'sales_manager';
  const isSales = currentUser?.role === 'sales';
  const canConfirm = isAdmin || isAccountant;
  const canCollect = isAdmin || isSales || isSalesManager;

  // Tải chi tiết nếu chưa có object
  useEffect(() => {
    if (initialCollection) {
      setCollection(initialCollection);
      return;
    }

    if (collectionId && token) {
      setLoading(true);
      setError(null);
      getPaymentCollectionDetailApi(collectionId, token)
        .then((res) => {
          setCollection(res);
        })
        .catch((err: any) => {
          console.error('Lỗi tải chi tiết khoản thu:', err);
          setError(err.message || 'Không thể tải chi tiết khoản thu.');
        })
        .finally(() => setLoading(false));
    }
  }, [initialCollection, collectionId, token]);

  const formatMoney = (val?: number | null) => {
    if (val === undefined || val === null) return '0 đ';
    return `${Number(val).toLocaleString('vi-VN')} đ`;
  };

  const formatDateOnly = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    const cleanStr = String(dateStr).trim();
    const d = cleanStr.split('T')[0];
    const parts = d.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handleRemit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collection) return;
    setActionLoading(true);
    try {
      const res = await submitRemittanceApi(collection.id, { remittance_note: remitNote }, token);
      emitStatusToast({
        title: 'Nộp tiền thành công',
        message: `Đã nộp khoản thu ${res.code} về công ty, chờ Kế toán đối chiếu và khớp quỹ.`,
        type: 'success',
      });
      setCollection(res);
      setIsRemitOpen(false);
      setRemitNote('');
      onUpdated();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi nộp tiền',
        message: err.message || 'Không thể nộp tiền về công ty.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collection) return;
    setActionLoading(true);
    try {
      const res = await confirmPaymentCollectionApi(collection.id, { confirmation_note: confirmNote }, token);
      emitStatusToast({
        title: 'Khớp quỹ thành công',
        message: `Khoản thu ${res.code} (${formatMoney(res.amount)}) đã được Kế toán xác nhận và ghi nhận vào sổ quỹ.`,
        type: 'success',
      });
      setCollection(res);
      setIsConfirmOpen(false);
      setConfirmNote('');
      onUpdated();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi xác nhận nhận tiền',
        message: err.message || 'Không thể xác nhận nhận tiền.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collection) return;
    if (!rejectReason.trim()) {
      emitStatusToast({
        title: 'Thiếu lý do',
        message: 'Vui lòng nhập lý do từ chối / báo lệch.',
        type: 'error',
      });
      return;
    }
    setActionLoading(true);
    try {
      const res = await rejectPaymentCollectionApi(
        collection.id,
        { rejection_reason: rejectReason.trim(), reason: rejectReason.trim() },
        token
      );
      emitStatusToast({
        title: 'Đã báo lệch / từ chối',
        message: `Khoản thu ${res.code} đã được chuyển về trạng thái Từ chối để NVKD kiểm tra lại.`,
        type: 'warning',
      });
      setCollection(res);
      setIsRejectOpen(false);
      setRejectReason('');
      onUpdated();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi từ chối khoản thu',
        message: err.message || 'Không thể từ chối khoản thu.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '15px' }}>
        Đang tải thông tin chi tiết khoản thu...
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div style={{ padding: '32px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
        <div
          style={{
            padding: '24px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            color: '#b91c1c',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>
            Không tìm thấy thông tin khoản thu
          </h3>
          <p style={{ margin: 0, fontSize: '14px' }}>
            {error || 'Khoản thu không tồn tại hoặc bạn không có quyền truy cập.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: '10px 20px',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          &larr; Quay lại danh sách khoản thu
        </button>
      </div>
    );
  }

  const isOwnCollection = currentUser?.id === collection.sales_id;
  const canUserConfirmThis = canConfirm && (!isOwnCollection || isAdmin);

  return (
    <div
      style={{
        padding: '24px 32px',
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        color: '#0f172a',
      }}
    >
      {/* DUY NHẤT 1 BẢNG CHI TIẾT PHIẾU THU LIỀN MẠCH, GỌN GÀNG */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
          marginBottom: '32px',
        }}
      >
        {/* Phần 1: Header Bảng - Chứa Nút quay lại, Tiêu đề, Badge trạng thái & Các nút thao tác */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                transition: 'all 0.15s ease',
              }}
            >
              &larr; Quay lại danh sách khoản thu
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Chi Tiết Phiếu Thu: {collection.code}
              </h1>
            </div>
          </div>
        </div>

        {/* Phần 2: Thanh tóm tắt 4 nhóm thông tin chính (Sub-Header Bảng) */}
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#15803d', textTransform: 'uppercase' }}>
              Số tiền đã thu
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
              {formatMoney(collection.amount)}
            </div>
            <div style={{ fontSize: '12px', color: '#166534', fontStyle: 'italic', marginTop: '2px' }}>
              {convertNumberToVietnameseWords(collection.amount)}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Hình thức & Ngày thu
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
              {collection.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
            </div>
            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
              Ngày thu tại tuyến: <strong>{formatDateOnly(collection.collection_date)}</strong>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Cửa hàng / Đại lý
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {collection.dealer_name}
            </div>
            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
              Tuyến: <strong>{collection.route_name || 'Không xác định'}</strong>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
              Nhân viên kinh doanh
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '4px' }}>
              {collection.sales_name}
            </div>
            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
              Mã đơn: <strong>{collection.order_code || 'Không gắn đơn'}</strong>
            </div>
          </div>
        </div>

        {/* Phần 3: Thân Bảng Bố Cục 2 Cột Cân Xứng Hoàn Hảo (Loại bỏ khoảng trống thừa) */}
        <div
          style={{
            padding: '24px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: '24px',
            alignItems: 'stretch',
          }}
        >
          {/* CỘT TRÁI: 1. THÔNG TIN CHI TIẾT GIAO DỊCH */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '15.5px',
                  fontWeight: 700,
                  color: '#0f172a',
                  marginBottom: '16px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                1. Thông Tin Chi Tiết Giao Dịch
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13.5px' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px', fontSize: '12.5px' }}>Mã chứng từ thu:</span>
                  <strong style={{ color: '#0f172a', fontSize: '14px' }}>{collection.code}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px', fontSize: '12.5px' }}>Cửa hàng / Đại lý nộp:</span>
                  <strong style={{ color: '#0f172a' }}>{collection.dealer_name}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px', fontSize: '12.5px' }}>Tuyến bán hàng / Khu vực:</span>
                  <strong style={{ color: '#0f172a' }}>{collection.route_name || 'Không xác định'}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px', fontSize: '12.5px' }}>Ngày thu tại tuyến:</span>
                  <strong style={{ color: '#0f172a' }}>{formatDateOnly(collection.collection_date)}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px', fontSize: '12.5px' }}>Hình thức thanh toán:</span>
                  <strong style={{ color: '#0f172a' }}>
                    {collection.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                  </strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px', fontSize: '12.5px' }}>Đơn hàng liên quan:</span>
                  <strong style={{ color: '#0f172a' }}>{collection.order_code || 'Không gắn đơn'}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px', fontSize: '12.5px' }}>Nhân viên thu tiền:</span>
                  <strong style={{ color: '#0f172a' }}>{collection.sales_name}</strong>
                </div>

                <div>
                  <span style={{ color: '#64748b', display: 'block', marginBottom: '2px', fontSize: '12.5px' }}>Thời gian lập phiếu:</span>
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>
                    {collection.created_at ? new Date(collection.created_at).toLocaleString('vi-VN') : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Ghi chú khi thu tiền */}
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
              <span style={{ color: '#64748b', display: 'block', marginBottom: '4px', fontSize: '12.5px' }}>Ghi chú khi thu tiền:</span>
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#ffffff',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  color: '#1e293b',
                  fontSize: '13px',
                  minHeight: '38px',
                  boxSizing: 'border-box',
                }}
              >
                {collection.note || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Không có ghi chú</span>}
              </div>
            </div>
          </div>

          {/* CỘT PHẢI: CHỨNG TỪ BIÊN LAI & THAO TÁC NGHIỆP VỤ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Khối Ảnh Biên Lai */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#0f172a' }}>
                    Chứng Từ Biên Lai / Phiếu Thu Cửa Hàng
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Chứng từ gốc bắt buộc theo Tiêu chí 1
                  </div>
                </div>
                {collection.receipt_image_url && (
                  <button
                    type="button"
                    onClick={() => setIsLightboxOpen(true)}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Xem phóng to
                  </button>
                )}
              </div>

              {collection.receipt_image_url ? (
                <div>
                  <div
                    onClick={() => setIsLightboxOpen(true)}
                    style={{
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: '1px solid #e2e8f0',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      cursor: 'pointer',
                      minHeight: '140px',
                      maxHeight: '220px',
                      padding: '6px',
                    }}
                  >
                    <img
                      src={collection.receipt_image_url}
                      alt={`Biên lai ${collection.code}`}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '208px',
                        objectFit: 'contain',
                        borderRadius: '4px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '11.5px',
                      color: '#64748b',
                      textAlign: 'center',
                    }}
                  >
                    Nhấp vào ảnh để kiểm tra chi tiết con dấu và chữ ký cửa hàng
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#64748b',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                    fontSize: '13px',
                    minHeight: '100px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <span style={{ fontSize: '20px', marginBottom: '4px' }}>📄</span>
                  Chưa có ảnh biên lai đính kèm.
                </div>
              )}
            </div>

            {/* Khối Thao Tác Nghiệp Vụ */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '14.5px',
                  fontWeight: 700,
                  color: '#0f172a',
                  marginBottom: '10px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #f1f5f9',
                }}
              >
                Thao Tác Nghiệp Vụ
              </div>

              {/* Trạng thái 1: Chờ nộp -> Cho phép NVKD nộp tiền */}
              {(collection.status === 'PENDING_REMITTANCE' || collection.status === 'REJECTED') && (
                <div>
                  <div style={{ fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
                    Khoản thu hiện do NVKD <strong>{collection.sales_name}</strong> nắm giữ. Bấm để nộp tiền về công ty:
                  </div>
                  {canCollect ? (
                    <button
                      type="button"
                      onClick={() => setIsRemitOpen(true)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13.5px',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Nộp tiền về công ty
                    </button>
                  ) : (
                    <div style={{ fontSize: '12.5px', color: '#64748b', fontStyle: 'italic' }}>
                      Chỉ NVKD lập phiếu hoặc Quản trị viên mới có quyền nộp tiền.
                    </div>
                  )}
                </div>
              )}

              {/* Trạng thái 2: Đã nộp -> Cho phép Kế toán duyệt hoặc từ chối */}
              {collection.status === 'SUBMITTED' && (
                <div>
                  <div style={{ fontSize: '13px', color: '#475569', marginBottom: '10px' }}>
                    NVKD đã nộp tiền lúc{' '}
                    <strong>{collection.remitted_at ? new Date(collection.remitted_at).toLocaleString('vi-VN') : '—'}</strong>.
                  </div>
                  {canUserConfirmThis ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setIsConfirmOpen(true)}
                        style={{
                          padding: '10px 8px',
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Duyệt nhận tiền
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRejectOpen(true)}
                        style={{
                          padding: '10px 8px',
                          backgroundColor: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Báo lệch / Từ chối
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: '12.5px', color: '#b45309', fontWeight: 600 }}>
                      Chỉ Kế toán hoặc Quản trị viên mới có thẩm quyền xác nhận khớp quỹ.
                    </div>
                  )}
                </div>
              )}

              {/* Trạng thái 3: Đã khớp quỹ */}
              {collection.status === 'CONFIRMED' && (
                <div
                  style={{
                    padding: '12px 14px',
                    backgroundColor: '#f0fdf4',
                    borderRadius: '8px',
                    border: '1px solid #bbf7d0',
                    color: '#15803d',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>✓</span> Quy trình đã hoàn tất 100%
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#166534' }}>
                    Khoản tiền đã được kiểm đếm và ghi nhận chính xác vào sổ quỹ công ty. Không còn phát sinh chênh lệch.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Phần 4: 2. Nhật Ký Quy Trình Xử Lý & Đối Chiếu Quỹ (3 Bước Trải Rộng 100% Hết Khoảng Trống) */}
        <div
          style={{
            padding: '20px 24px 28px 24px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
          }}
        >
          <div
            style={{
              fontSize: '15.5px',
              fontWeight: 700,
              color: '#0f172a',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <span>2. Nhật Ký Quy Trình Xử Lý & Đối Chiếu Quỹ</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
              Quy trình đối chiếu 3 bước minh bạch
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Bước 1 */}
            <div
              style={{
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#334155' }}>
                    1. Ghi nhận tại tuyến
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#dbeafe',
                      color: '#1e40af',
                    }}
                  >
                    Đã lập phiếu
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#0f172a' }}>
                  Lập bởi: <strong>{collection.sales_name}</strong>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  Thời gian: {collection.created_at ? new Date(collection.created_at).toLocaleString('vi-VN') : '—'}
                </div>
              </div>
            </div>

            {/* Bước 2 */}
            <div
              style={{
                padding: '16px',
                backgroundColor: collection.remitted_at ? '#eff6ff' : '#fefce8',
                borderRadius: '10px',
                border: collection.remitted_at ? '1px solid #bfdbfe' : '1px solid #fde047',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '13.5px',
                      color: collection.remitted_at ? '#1d4ed8' : '#854d0e',
                    }}
                  >
                    2. Nộp về công ty
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: collection.remitted_at ? '#dbeafe' : '#fef3c7',
                      color: collection.remitted_at ? '#1e40af' : '#92400e',
                    }}
                  >
                    {collection.remitted_at ? 'Đã bàn giao' : 'Chưa nộp'}
                  </span>
                </div>
                {collection.remitted_at ? (
                  <>
                    <div style={{ fontSize: '13px', color: '#0f172a' }}>
                      Bàn giao lúc: <strong>{new Date(collection.remitted_at).toLocaleString('vi-VN')}</strong>
                    </div>
                    {collection.remittance_note && (
                      <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic', marginTop: '4px' }}>
                        Ghi chú: "{collection.remittance_note}"
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '12.5px', color: '#b45309', fontWeight: 600 }}>
                    NVKD đang giữ tiền mặt / tài khoản, chưa nộp về quỹ công ty.
                  </div>
                )}
              </div>
            </div>

            {/* Bước 3 */}
            <div
              style={{
                padding: '16px',
                backgroundColor:
                  collection.status === 'CONFIRMED'
                    ? '#f0fdf4'
                    : collection.status === 'REJECTED'
                    ? '#fef2f2'
                    : '#f8fafc',
                borderRadius: '10px',
                border:
                  collection.status === 'CONFIRMED'
                    ? '1px solid #bbf7d0'
                    : collection.status === 'REJECTED'
                    ? '1px solid #fecaca'
                    : '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '13.5px',
                      color:
                        collection.status === 'CONFIRMED'
                          ? '#15803d'
                          : collection.status === 'REJECTED'
                          ? '#b91c1c'
                          : '#64748b',
                    }}
                  >
                    3. Khớp quỹ kế toán
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor:
                        collection.status === 'CONFIRMED'
                          ? '#dcfce7'
                          : collection.status === 'REJECTED'
                          ? '#fee2e2'
                          : '#f1f5f9',
                      color:
                        collection.status === 'CONFIRMED'
                          ? '#166534'
                          : collection.status === 'REJECTED'
                          ? '#991b1b'
                          : '#475569',
                    }}
                  >
                    {collection.status === 'CONFIRMED'
                      ? 'Đã khớp quỹ'
                      : collection.status === 'REJECTED'
                      ? 'Báo lệch'
                      : 'Chờ khớp quỹ'}
                  </span>
                </div>
                {collection.status === 'CONFIRMED' ? (
                  <>
                    <div style={{ fontSize: '13px', color: '#166534' }}>
                      Khớp quỹ bởi: <strong>{collection.confirmed_by_name || 'Kế toán'}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                      Thời gian: {collection.confirmed_at ? new Date(collection.confirmed_at).toLocaleString('vi-VN') : '—'}
                    </div>
                    {collection.confirmation_note && (
                      <div style={{ fontSize: '12px', fontStyle: 'italic', color: '#14532d', marginTop: '4px' }}>
                        Ghi chú: "{collection.confirmation_note}"
                      </div>
                    )}
                  </>
                ) : collection.status === 'REJECTED' ? (
                  <>
                    <div style={{ fontSize: '13px', color: '#991b1b' }}>
                      Báo lệch bởi: <strong>{collection.confirmed_by_name || 'Kế toán'}</strong>
                    </div>
                    <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '2px' }}>
                      Thời gian: {collection.confirmed_at ? new Date(collection.confirmed_at).toLocaleString('vi-VN') : '—'}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#7f1d1d', marginTop: '4px' }}>
                      Lý do: "{collection.rejection_reason}"
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                    Chờ Kế toán kiểm đếm thực tế và bấm xác nhận khớp quỹ công ty.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: NỘP TIỀN VỀ CÔNG TY */}
      {isRemitOpen && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '500px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                Nộp Tiền Về Công Ty
              </h3>
              <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                Xác nhận chuyển giao khoản thu <strong>{collection.code}</strong> cho Kế toán / Thủ quỹ
              </p>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                <div>Đại lý nộp: <strong>{collection.dealer_name}</strong></div>
                <div style={{ marginTop: '4px' }}>
                  Số tiền nộp: <strong style={{ color: '#0284c7', fontSize: '15px' }}>{formatMoney(collection.amount)}</strong>
                </div>
              </div>

              <form onSubmit={handleRemit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                    Ghi chú nộp tiền (nếu có)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="VD: Nộp tiền mặt ca sáng, Nộp chuyển khoản ủy nhiệm chi..."
                    value={remitNote}
                    onChange={(e) => setRemitNote(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsRemitOpen(false)}
                    disabled={actionLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading ? 'Đang nộp...' : 'Xác nhận Nộp tiền'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 2: KẾ TOÁN XÁC NHẬN NHẬN TIỀN */}
      {isConfirmOpen && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '500px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#15803d' }}>
                Kế Toán Xác Nhận Khớp Quỹ
              </h3>
              <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                Xác nhận đã kiểm đếm và nhận đủ số tiền từ NVKD <strong>{collection.sales_name}</strong>
              </p>

              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                <div>Mã khoản thu: <strong>{collection.code}</strong></div>
                <div style={{ marginTop: '4px' }}>
                  Số tiền khớp quỹ: <strong style={{ color: '#15803d', fontSize: '16px' }}>{formatMoney(collection.amount)}</strong>
                </div>
              </div>

              <form onSubmit={handleConfirm}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                    Ghi chú của Kế toán (nếu có)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="VD: Đã kiểm đếm đủ tiền mặt, Đã nhận tiền vào tài khoản VCB..."
                    value={confirmNote}
                    onChange={(e) => setConfirmNote(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsConfirmOpen(false)}
                    disabled={actionLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading ? 'Đang duyệt...' : 'Duyệt nhận tiền'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 3: KẾ TOÁN TỪ CHỐI / BÁO LỆCH */}
      {isRejectOpen && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '500px',
                border: '1px solid #fecaca',
                padding: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#b91c1c' }}>
                Từ Chối / Báo Lệch Khoản Thu
              </h3>
              <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                Khoản thu <strong>{collection.code}</strong> sẽ được trả lại cho NVKD{' '}
                <strong>{collection.sales_name}</strong> để đối chiếu lại.
              </p>

              <form onSubmit={handleReject}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '6px' }}>
                    Lý do từ chối / Báo lệch <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="VD: Thiếu 200,000 đ so với biên lai cửa hàng; Ảnh biên lai bị mờ..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsRejectOpen(false)}
                    disabled={actionLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !rejectReason.trim()}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: actionLoading || !rejectReason.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading ? 'Đang gửi...' : 'Xác nhận Từ chối'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Lightbox Modal phóng to ảnh */}
      {isLightboxOpen && collection.receipt_image_url && (
        <ModalPortal>
          <div
            onClick={() => setIsLightboxOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '24px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'relative',
                maxWidth: '90vw',
                maxHeight: '90vh',
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  padding: '12px 18px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  Biên Lai: {collection.code} - {collection.dealer_name}
                </span>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '20px',
                    cursor: 'pointer',
                  }}
                >
                  &times;
                </button>
              </div>
              <div style={{ padding: '12px', overflow: 'auto', textAlign: 'center' }}>
                <img
                  src={collection.receipt_image_url}
                  alt={`Biên lai ${collection.code}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '80vh',
                    objectFit: 'contain',
                    borderRadius: '6px',
                  }}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
