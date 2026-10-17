import React, { useState, useEffect, useRef } from 'react';
import { ModalPortal } from './ModalPortal';
import {
  DealerItem,
  PaymentCollectionItem,
  PaymentCollectionCreatePayload,
  createPaymentCollectionApi,
  getDealersApi,
} from '../services/api';
import { convertNumberToVietnameseWords } from '../utils/numberToWords';
import { emitStatusToast } from './StatusToast';

interface RouteCollectionModalProps {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onSuccess: (collection: PaymentCollectionItem) => void;
  initialDealer?: DealerItem | null;
  initialOrderId?: number;
  initialOrderCode?: string;
  initialAmount?: number;
}

export const RouteCollectionModal: React.FC<RouteCollectionModalProps> = ({
  isOpen,
  token,
  onClose,
  onSuccess,
  initialDealer,
  initialOrderId,
  initialOrderCode,
  initialAmount,
}) => {
  const [dealers, setDealers] = useState<DealerItem[]>([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [dealerSearch, setDealerSearch] = useState('');
  const [selectedDealer, setSelectedDealer] = useState<DealerItem | null>(initialDealer || null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [amountStr, setAmountStr] = useState<string>(
    initialAmount && initialAmount > 0 ? String(initialAmount) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer'>('cash');
  const [collectionDate, setCollectionDate] = useState<string>(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [routeName, setRouteName] = useState<string>('');
  const [orderCode, setOrderCode] = useState<string>(initialOrderCode || '');
  const [note, setNote] = useState<string>('');

  // Ảnh biên lai (Bắt buộc theo Tiêu chí 1)
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [imageError, setImageError] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load danh sách đại lý nếu chưa có
  useEffect(() => {
    if (!isOpen) return;

    if (initialDealer) {
      setSelectedDealer(initialDealer);
      setDealerSearch(`${initialDealer.name} (${initialDealer.code})`);
      if (initialDealer.region) {
        setRouteName(`Tuyến ${initialDealer.region}`);
      }
    }

    if (dealers.length === 0 && token) {
      setLoadingDealers(true);
      getDealersApi(token)
        .then((items) => {
          setDealers(items);
        })
        .catch((err) => {
          console.error('Lỗi tải danh sách đại lý:', err);
        })
        .finally(() => setLoadingDealers(false));
    }
  }, [isOpen, initialDealer, token]);

  // Click outside listener for dealer dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const numAmount = parseFloat(amountStr.replace(/,/g, '')) || 0;
  const words = numAmount > 0 ? convertNumberToVietnameseWords(numAmount) : '';

  // Xử lý nén và chuyển ảnh sang base64 data URL
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setImageError('Vui lòng chọn tệp định dạng hình ảnh (.jpg, .png, .jpeg, .webp)');
      return;
    }

    setImageError('');
    setIsProcessingImage(true);

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        // Tối ưu kích thước tối đa 1280px để giữ nét chữ ký/biên lai mà dung lượng nhỏ
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1280;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setReceiptImage(compressedDataUrl);
        } else {
          setReceiptImage(readerEvent.target?.result as string);
        }
        setIsProcessingImage(false);
      };
      img.onerror = () => {
        setImageError('Không thể xử lý hình ảnh này.');
        setIsProcessingImage(false);
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => {
      setImageError('Lỗi đọc tệp.');
      setIsProcessingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectDealer = (dealer: DealerItem) => {
    setSelectedDealer(dealer);
    setDealerSearch(`${dealer.name} (${dealer.code})`);
    if (dealer.region && !routeName) {
      setRouteName(`Tuyến ${dealer.region}`);
    }
    setIsDropdownOpen(false);
  };

  const handleAddQuickAmount = (extra: number) => {
    const current = parseFloat(amountStr.replace(/,/g, '')) || 0;
    const nextVal = current + extra;
    setAmountStr(String(nextVal));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedDealer) {
      setFormError('Vui lòng chọn Khách hàng / Đại lý thu tiền.');
      return;
    }

    if (numAmount <= 0) {
      setFormError('Số tiền thu phải lớn hơn 0 đồng.');
      return;
    }

    if (!receiptImage) {
      setFormError('Tiêu chí bắt buộc: Vui lòng tải lên hoặc chụp ảnh biên lai / hóa đơn thu tiền.');
      setImageError('Biên lai là chứng từ đối chiếu bắt buộc!');
      return;
    }

    const payload: PaymentCollectionCreatePayload = {
      dealer_id: selectedDealer.id,
      dealer_name: selectedDealer.name,
      order_id: initialOrderId,
      order_code: orderCode.trim() || undefined,
      amount: numAmount,
      payment_method: paymentMethod,
      receipt_image_url: receiptImage,
      collection_date: collectionDate,
      route_name: routeName.trim() || undefined,
      note: note.trim() || undefined,
    };

    setSubmitting(true);
    try {
      const res = await createPaymentCollectionApi(payload, token);
      emitStatusToast({
        title: 'Ghi nhận thu tiền thành công',
        message: `Mã khoản thu: ${res.code} (${numAmount.toLocaleString('vi-VN')} đ). Khoản thu ở trạng thái CHỜ NỘP về công ty.`,
        type: 'success',
      });
      onSuccess(res);
      onClose();
    } catch (err: any) {
      console.error('Lỗi ghi nhận thu tiền:', err);
      setFormError(err.message || 'Không thể ghi nhận khoản thu. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredDealers = dealers.filter((d) => {
    const query = dealerSearch.toLowerCase();
    return (
      (d.name && d.name.toLowerCase().includes(query)) ||
      (d.code && d.code.toLowerCase().includes(query)) ||
      (d.phone && d.phone.toLowerCase().includes(query)) ||
      (d.address && d.address.toLowerCase().includes(query))
    );
  });

  return (
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
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  Thu Tiền Theo Tuyến
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: '13px',
                    color: '#64748b',
                  }}
                >
                  Ghi nhận khoản thu ngay tại cửa hàng kèm ảnh chụp biên lai
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '22px',
                cursor: 'pointer',
                color: '#64748b',
                padding: '4px 8px',
                borderRadius: '6px',
              }}
            >
              ×
            </button>
          </div>

          {/* Body Form */}
          <form
            onSubmit={handleSubmit}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {formError && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#b91c1c',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>{formError}</span>
              </div>
            )}

            {/* Khách hàng / Đại lý */}
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#1e293b',
                  marginBottom: '6px',
                }}
              >
                Cửa hàng / Đại lý nộp tiền <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Gõ tên, mã đại lý hoặc số điện thoại..."
                  value={dealerSearch}
                  onChange={(e) => {
                    setDealerSearch(e.target.value);
                    setIsDropdownOpen(true);
                    if (selectedDealer) setSelectedDealer(null);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: selectedDealer ? '1.5px solid #22c55e' : '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {selectedDealer && (
                  <span
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#16a34a',
                      fontSize: '14px',
                      fontWeight: 600,
                    }}
                  >
                    Đã chọn
                  </span>
                )}
              </div>

              {isDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                    border: '1px solid #e2e8f0',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 100,
                    marginTop: '4px',
                  }}
                >
                  {loadingDealers ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>
                      Đang tải danh sách đại lý...
                    </div>
                  ) : filteredDealers.length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8' }}>
                      Không tìm thấy đại lý phù hợp
                    </div>
                  ) : (
                    filteredDealers.slice(0, 20).map((d) => (
                      <div
                        key={d.id}
                        onClick={() => handleSelectDealer(d)}
                        style={{
                          padding: '10px 14px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '14px' }}>
                          {d.name} <span style={{ color: '#64748b', fontWeight: 400 }}>({d.code})</span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          {d.address ? `Địa chỉ: ${d.address}` : 'Chưa cập nhật địa chỉ'} • {d.phone ? `SĐT: ${d.phone}` : 'Chưa có SĐT'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Tuyến thu tiền & Ngày thu */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Tuyến bán hàng / Khu vực
                </label>
                <input
                  type="text"
                  placeholder="VD: Tuyến Q1, Tuyến miền Đông..."
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Ngày thu tiền <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="date"
                  value={collectionDate}
                  onChange={(e) => setCollectionDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Số tiền thu & Phím chọn nhanh */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                >
                  Số tiền thu (VNĐ) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: paymentMethod === 'cash' ? '#2563eb' : '#cbd5e1',
                      backgroundColor: paymentMethod === 'cash' ? '#eff6ff' : '#ffffff',
                      color: paymentMethod === 'cash' ? '#1d4ed8' : '#64748b',
                    }}
                  >
                    Tiền mặt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: paymentMethod === 'bank_transfer' ? '#2563eb' : '#cbd5e1',
                      backgroundColor: paymentMethod === 'bank_transfer' ? '#eff6ff' : '#ffffff',
                      color: paymentMethod === 'bank_transfer' ? '#1d4ed8' : '#64748b',
                    }}
                  >
                    Chuyển khoản
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="0"
                  value={
                    amountStr
                      ? Number(amountStr.replace(/,/g, '')).toLocaleString('vi-VN')
                      : ''
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setAmountStr(raw);
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '2px solid #3b82f6',
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                    textAlign: 'right',
                  }}
                />
              </div>

              {words && (
                <div
                  style={{
                    fontSize: '12px',
                    color: '#2563eb',
                    fontStyle: 'italic',
                    marginTop: '6px',
                    textAlign: 'right',
                  }}
                >
                  Bằng chữ: <strong>{words}</strong>
                </div>
              )}

              {/* Nút cộng nhanh */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  marginTop: '10px',
                  flexWrap: 'wrap',
                }}
              >
                {[500000, 1000000, 2000000, 5000000, 10000000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleAddQuickAmount(val)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#334155',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    +{val >= 1000000 ? `${val / 1000000}tr` : `${val / 1000}k`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmountStr('')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Xóa
                </button>
              </div>
            </div>

            {/* Ảnh chụp Biên lai / Hóa đơn (TIÊU CHÍ 1 - BẮT BUỘC) */}
            <div
              style={{
                border: imageError ? '2px dashed #ef4444' : '2px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                backgroundColor: receiptImage ? '#f8fafc' : '#ffffff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    Ảnh chụp biên lai / phiếu thu cửa hàng{' '}
                    <span style={{ color: '#ef4444' }}>*</span>
                  </span>
                </div>
                {receiptImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptImage('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    style={{
                      fontSize: '12px',
                      color: '#ef4444',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Bỏ ảnh
                  </button>
                )}
              </div>

              {receiptImage ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <img
                    src={receiptImage}
                    alt="Biên lai thu tiền"
                    style={{
                      maxHeight: '180px',
                      maxWidth: '100%',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      border: '1px solid #e2e8f0',
                      objectFit: 'contain',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      fontSize: '12px',
                      color: '#2563eb',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Chụp lại hoặc chọn ảnh khác
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    cursor: 'pointer',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                    Bấm để chụp ảnh hoặc tải tệp biên lai
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Hỗ trợ chụp trực tiếp từ máy ảnh điện thoại/tablet hoặc tải tệp ảnh từ máy
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />

              {isProcessingImage && (
                <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '6px' }}>
                  Đang tối ưu dung lượng ảnh...
                </div>
              )}

              {imageError && (
                <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px', fontWeight: 500 }}>
                  {imageError}
                </div>
              )}
            </div>

            {/* Mã đơn hàng (tùy chọn) & Ghi chú */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '16px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Mã đơn hàng (nếu có)
                </label>
                <input
                  type="text"
                  placeholder="VD: ORD-00123"
                  value={orderCode}
                  onChange={(e) => setOrderCode(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#1e293b',
                    marginBottom: '6px',
                  }}
                >
                  Ghi chú khoản thu
                </label>
                <input
                  type="text"
                  placeholder="Ghi chú thêm: VD khách thanh toán đợt 1, ký thay..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Status indicator note */}
            <div
              style={{
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                color: '#92400e',
              }}
            >
              Khoản thu sẽ ở trạng thái <strong>Chờ nộp</strong> cho đến khi bạn nộp về công ty và
              Kế toán xác nhận nhận tiền.
            </div>

            {/* Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '8px',
                paddingTop: '16px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedDealer || numAmount <= 0 || !receiptImage}
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  backgroundColor:
                    submitting || !selectedDealer || numAmount <= 0 || !receiptImage
                      ? '#94a3b8'
                      : '#2563eb',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor:
                    submitting || !selectedDealer || numAmount <= 0 || !receiptImage
                      ? 'not-allowed'
                      : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
                }}
              >
                {submitting ? 'Đang lưu...' : 'Ghi nhận khoản thu'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
