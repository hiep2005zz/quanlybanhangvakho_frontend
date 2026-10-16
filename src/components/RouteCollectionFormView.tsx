import React, { useState, useEffect, useRef } from 'react';
import {
  DealerItem,
  PaymentCollectionItem,
  PaymentCollectionCreatePayload,
  createPaymentCollectionApi,
  getDealersApi,
  User,
} from '../services/api';
import { convertNumberToVietnameseWords } from '../utils/numberToWords';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface RouteCollectionFormViewProps {
  token: string;
  currentUser?: User | null;
  onBack: () => void;
  onSuccess: (collection: PaymentCollectionItem) => void;
  initialDealer?: DealerItem | null;
  initialOrderId?: number;
  initialOrderCode?: string;
  initialAmount?: number;
}

export const RouteCollectionFormView: React.FC<RouteCollectionFormViewProps> = ({
  token,
  currentUser,
  onBack,
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
  const [collectionDate, setCollectionDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [routeName, setRouteName] = useState<string>('');
  const [orderCode, setOrderCode] = useState<string>(initialOrderCode || '');
  const [note, setNote] = useState<string>('');

  // Ảnh biên lai (Bắt buộc theo Tiêu chí 1)
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [imageError, setImageError] = useState<string>('');
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load danh sách đại lý
  useEffect(() => {
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
  }, [initialDealer, token]);

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

  const handleClearAmount = () => {
    setAmountStr('');
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
      onBack();
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
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              &larr; Quay lại danh sách khoản thu
            </button>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Ghi nhận khoản thu mới</span>
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              color: '#0f172a',
              margin: 0,
            }}
          >
            Thu Tiền Theo Tuyến
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
            Ghi nhận khoản thu tiền mặt / chuyển khoản trực tiếp tại cửa hàng kèm ảnh biên lai đối chiếu
          </p>
        </div>
      </div>

      {formError && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#b91c1c',
            fontSize: '14px',
            fontWeight: 600,
            marginBottom: '24px',
          }}
        >
          {formError}
        </div>
      )}

      {/* Biểu Mẫu Nhập Liệu 1 Bảng ERP Thống Nhất */}
      <form onSubmit={handleSubmit}>
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px -2px rgba(15, 23, 42, 0.05)',
            overflow: 'hidden',
          }}
        >
          {/* Header Bảng Biểu Mẫu */}
          <div
            style={{
              padding: '16px 24px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  display: 'inline-block',
                  width: '4px',
                  height: '18px',
                  backgroundColor: '#2563eb',
                  borderRadius: '2px',
                }}
              />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                Biểu Mẫu Ghi Nhận Khoản Thu Tại Điểm Bán
              </span>
            </div>
            <span
              style={{
                fontSize: '12.5px',
                padding: '4px 12px',
                borderRadius: '6px',
                backgroundColor: '#fef3c7',
                color: '#92400e',
                fontWeight: 600,
              }}
            >
              Trạng thái: Chờ nộp quỹ
            </span>
          </div>

          {/* Thân Bảng: Bố cục 2 Cột Đối Xứng Liền Mạch */}
          <div
            style={{
              padding: '24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
              gap: '32px',
              alignItems: 'start',
            }}
          >
            {/* CỘT TRÁI: BẢNG THÔNG TIN KHOẢN THU, ĐẠI LÝ, TIỀN THU & GHI CHÚ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Mục 1: Khách hàng / Đại lý & Tuyến */}
              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginBottom: '14px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  1. Thông Tin Cửa Hàng & Tuyến Bán Hàng
                </div>

                {/* Đại lý picker */}
                <div ref={dropdownRef} style={{ position: 'relative', marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '6px',
                    }}
                  >
                    Cửa hàng / Đại lý nộp tiền <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Gõ tên, mã đại lý hoặc số điện thoại..."
                    value={dealerSearch}
                    onChange={(e) => {
                      setDealerSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      backgroundColor: selectedDealer ? '#f8fafc' : '#ffffff',
                    }}
                  />

                  {isDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        marginTop: '4px',
                      }}
                    >
                      {loadingDealers ? (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                          Đang tải danh sách đại lý...
                        </div>
                      ) : filteredDealers.length === 0 ? (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                          Không tìm thấy đại lý nào phù hợp.
                        </div>
                      ) : (
                        filteredDealers.map((d) => (
                          <div
                            key={d.id}
                            onClick={() => handleSelectDealer(d)}
                            style={{
                              padding: '10px 14px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #f1f5f9',
                              backgroundColor: selectedDealer?.id === d.id ? '#eff6ff' : '#ffffff',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{d.name}</strong>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#f1f5f9',
                                  color: '#475569',
                                }}
                              >
                                {d.code}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                              {d.phone ? `SĐT: ${d.phone}` : ''} {d.region ? `| Khu vực: ${d.region}` : ''}
                            </div>
                            {d.address && (
                              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                                {d.address}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {selectedDealer && (
                    <div
                      style={{
                        marginTop: '6px',
                        fontSize: '12px',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>Đã chọn: <strong>{selectedDealer.name}</strong> ({selectedDealer.code})</span>
                      {selectedDealer.region && (
                        <span
                          style={{
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          {selectedDealer.region}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Tuyến bán hàng & Ngày thu tiền (2 ô ngang) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: '6px',
                      }}
                    >
                      Tuyến bán hàng / Khu vực
                    </label>
                    <input
                      type="text"
                      placeholder="VD: Tuyến Q1, Tuyến Miền Đông..."
                      value={routeName}
                      onChange={(e) => setRouteName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13.5px',
                        color: '#0f172a',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 700,
                        color: '#334155',
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
                        fontSize: '13.5px',
                        color: '#0f172a',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                {/* Phương thức thanh toán & Mã đơn hàng (2 ô ngang) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: '6px',
                      }}
                    >
                      Hình thức thanh toán
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        style={{
                          flex: 1,
                          padding: '9px 12px',
                          borderRadius: '6px',
                          border: paymentMethod === 'cash' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: paymentMethod === 'cash' ? '#eff6ff' : '#ffffff',
                          color: paymentMethod === 'cash' ? '#1d4ed8' : '#64748b',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Tiền mặt
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('bank_transfer')}
                        style={{
                          flex: 1,
                          padding: '9px 12px',
                          borderRadius: '6px',
                          border: paymentMethod === 'bank_transfer' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          backgroundColor: paymentMethod === 'bank_transfer' ? '#eff6ff' : '#ffffff',
                          color: paymentMethod === 'bank_transfer' ? '#1d4ed8' : '#64748b',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Chuyển khoản
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: '6px',
                      }}
                    >
                      Mã đơn hàng (nếu có)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: ORD-20261016-001..."
                      value={orderCode}
                      onChange={(e) => setOrderCode(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13.5px',
                        color: '#0f172a',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Mục 2: Số tiền thu (Bảng Ngang Nổi Bật) */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '14px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    2. Số Tiền Thu (VNĐ) <span style={{ color: '#ef4444' }}>*</span>
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    NVKD kiểm đếm kỹ trước khi xác nhận
                  </span>
                </div>

                {/* Input số tiền to lớn */}
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="0"
                    value={
                      numAmount > 0
                        ? numAmount.toLocaleString('vi-VN')
                        : amountStr
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      setAmountStr(raw);
                    }}
                    style={{
                      width: '100%',
                      padding: '14px 60px 14px 18px',
                      borderRadius: '10px',
                      border: '2px solid #2563eb',
                      fontSize: '26px',
                      fontWeight: 800,
                      color: '#0f172a',
                      textAlign: 'right',
                      boxSizing: 'border-box',
                      backgroundColor: '#f8fafc',
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '18px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '16px',
                      fontWeight: 700,
                      color: '#64748b',
                    }}
                  >
                    VNĐ
                  </span>
                </div>

                {/* Số tiền bằng chữ tiếng Việt */}
                {words && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      color: '#1d4ed8',
                      fontSize: '13px',
                      fontStyle: 'italic',
                      marginBottom: '16px',
                    }}
                  >
                    Bằng chữ: <strong>{words}</strong>
                  </div>
                )}

                {/* Hàng phím số nhanh nằm ngang */}
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '8px' }}>
                    Cộng nhanh số tiền:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleAddQuickAmount(500000)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      +500k
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuickAmount(1000000)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      +1tr
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuickAmount(2000000)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      +2tr
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuickAmount(5000000)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      +5tr
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuickAmount(10000000)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      +10tr
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAmount}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        backgroundColor: '#fef2f2',
                        color: '#b91c1c',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Xóa về 0
                    </button>
                  </div>
                </div>
              </div>

              {/* Mục 3: Ghi chú */}
              <div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginBottom: '10px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  3. Ghi Chú Khoản Thu
                </div>
                <textarea
                  rows={3}
                  placeholder="VD: Thu tiền mặt đơn hàng đầu kỳ, Khách trả nợ đợt 1..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
                />
              </div>
            </div>

            {/* CỘT PHẢI: CHỨNG TỪ BIÊN LAI & TÓM TẮT ĐỐI CHIẾU */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {/* Mục 4: Ảnh biên lai (Bắt buộc) */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '14px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      Ảnh Biên Lai / Phiếu Thu Cửa Hàng <span style={{ color: '#ef4444' }}>*</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      Chứng từ đối chiếu bắt buộc theo Tiêu chí 1
                    </div>
                  </div>
                  {receiptImage && (
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                        padding: '3px 8px',
                        borderRadius: '6px',
                      }}
                    >
                      Đã đính kèm ảnh
                    </span>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                {!receiptImage ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: imageError ? '2px dashed #ef4444' : '2px dashed #94a3b8',
                      borderRadius: '12px',
                      padding: '40px 20px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: '#f8fafc',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.borderColor = '#3b82f6';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                      e.currentTarget.style.borderColor = imageError ? '#ef4444' : '#94a3b8';
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b', marginBottom: '6px' }}>
                      Bấm để chụp ảnh hoặc tải tệp biên lai
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                      Hỗ trợ chụp trực tiếp từ camera điện thoại/tablet hoặc tải tệp ảnh từ máy
                    </p>
                    <div style={{ marginTop: '14px' }}>
                      <span
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          display: 'inline-block',
                        }}
                      >
                        Chọn ảnh hoặc Chụp ngay
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <div
                      style={{
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#0f172a',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        maxHeight: '340px',
                      }}
                    >
                      <img
                        src={receiptImage}
                        alt="Biên lai cửa hàng"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '340px',
                          objectFit: 'contain',
                          cursor: 'pointer',
                        }}
                        onClick={() => setLightboxOpen(true)}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Xem phóng to
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ffffff',
                          color: '#2563eb',
                          border: '1px solid #2563eb',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Chụp lại / Đổi ảnh
                      </button>
                      <button
                        type="button"
                        onClick={() => setReceiptImage('')}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Xóa ảnh
                      </button>
                    </div>
                  </div>
                )}

                {isProcessingImage && (
                  <div style={{ fontSize: '12px', color: '#2563eb', marginTop: '8px', textAlign: 'center' }}>
                    Đang xử lý và tối ưu hóa hình ảnh biên lai...
                  </div>
                )}

                {imageError && (
                  <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '8px', fontWeight: 600 }}>
                    {imageError}
                  </div>
                )}
              </div>

              {/* Mục 5: Thẻ tóm tắt xác nhận đối chiếu */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  padding: '18px 20px',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#0f172a',
                    marginBottom: '14px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  Tóm Tắt Khoản Thu & Quy Trình
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Đại lý / Cửa hàng:</span>
                    <strong style={{ color: '#0f172a', textAlign: 'right' }}>
                      {selectedDealer ? selectedDealer.name : 'Chưa chọn'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Tuyến / Ngày thu:</span>
                    <span style={{ color: '#0f172a' }}>
                      {routeName || 'Tuyến mặc định'} | {collectionDate}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Hình thức:</span>
                    <span style={{ color: '#0f172a' }}>
                      {paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '8px',
                      borderTop: '1px dashed #e2e8f0',
                      fontSize: '15px',
                    }}
                  >
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>Tổng tiền thu:</span>
                    <strong style={{ color: '#2563eb', fontSize: '18px' }}>
                      {numAmount > 0 ? `${numAmount.toLocaleString('vi-VN')} đ` : '0 đ'}
                    </strong>
                  </div>

                  <div
                    style={{
                      marginTop: '8px',
                      padding: '10px 12px',
                      backgroundColor: '#fef3c7',
                      border: '1px solid #fde68a',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#92400e',
                      lineHeight: '1.5',
                    }}
                  >
                    <strong>Quy trình xử lý:</strong> Sau khi ghi nhận, khoản thu ở trạng thái{' '}
                    <span style={{ fontWeight: 700, color: '#b45309' }}>"Chờ nộp"</span>. NVKD sẽ nộp tiền
                    về công ty để Kế toán đối chiếu và duyệt khớp quỹ.
                  </div>

                  {/* Hành động Ghi nhận thu tiền & Hủy bỏ: Tích hợp vào trong chỗ trống của bảng tóm tắt */}
                  <div
                    style={{
                      marginTop: '16px',
                      paddingTop: '16px',
                      borderTop: '1px dashed #cbd5e1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      Người lập phiếu:{' '}
                      <strong style={{ color: '#0f172a' }}>
                        {currentUser?.full_name || currentUser?.username || 'Nhân viên kinh doanh'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={onBack}
                        disabled={submitting}
                        style={{
                          padding: '11px 18px',
                          backgroundColor: '#ffffff',
                          color: '#475569',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          fontWeight: 600,
                          fontSize: '14px',
                          cursor: submitting ? 'not-allowed' : 'pointer',
                        }}
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || isProcessingImage}
                        style={{
                          flex: 1,
                          padding: '11px 20px',
                          backgroundColor: submitting || isProcessingImage ? '#94a3b8' : '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '14px',
                          cursor: submitting || isProcessingImage ? 'not-allowed' : 'pointer',
                          boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
                          textAlign: 'center',
                        }}
                      >
                        {submitting ? 'Đang lưu khoản thu...' : 'Ghi nhận thu tiền'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Lightbox Modal phóng to ảnh biên lai */}
      {lightboxOpen && receiptImage && (
        <ModalPortal>
          <div
            onClick={() => setLightboxOpen(false)}
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
                  Ảnh Biên Lai Thu Tiền Cửa Hàng
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
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
                  src={receiptImage}
                  alt="Biên lai phóng to"
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
