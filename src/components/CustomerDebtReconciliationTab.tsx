import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getDebtReconciliationsApi,
  confirmDebtReconciliationApi,
  disputeDebtReconciliationApi,
  DebtReconciliationItemResponse,
  User,
} from '../services/api';
import { DebtReconciliationPrintModal } from './DebtReconciliationPrintModal';
import { emitStatusToast } from './StatusToast';

interface CustomerDebtReconciliationTabProps {
  token: string;
  currentUser: User;
  refreshTrigger?: number;
}

export const CustomerDebtReconciliationTab: React.FC<CustomerDebtReconciliationTabProps> = ({
  token,
  currentUser: _currentUser,
  refreshTrigger,
}) => {
  const [items, setItems] = useState<DebtReconciliationItemResponse[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 20;
  const [pendingTotal, setPendingTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filter State
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  // Modal Print / Xem chi tiết
  const [selectedRec, setSelectedRec] = useState<DebtReconciliationItemResponse | null>(null);

  // Modal Dispute (Báo lệch)
  const [disputingRec, setDisputingRec] = useState<DebtReconciliationItemResponse | null>(null);
  const [reportedBalance, setReportedBalance] = useState<string>('');
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState<boolean>(false);

  // Modal Confirm
  const [confirmingRec, setConfirmingRec] = useState<DebtReconciliationItemResponse | null>(null);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState<boolean>(false);

  // Thao tác 3 chấm (Action Dropdown Menu)
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.rec-action-menu-container')) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setOpenActionMenuId(null);
    try {
      const res = await getDebtReconciliationsApi(token, {
        page,
        page_size: pageSize,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: debouncedSearch.trim() || undefined,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
      setPendingTotal(res.kpi_summary?.pending_count ?? (res.items || []).filter((r) => r.status === 'SENT').length);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi tải danh sách biên bản đối chiếu.');
    } finally {
      setIsLoading(false);
    }
  }, [token, page, statusFilter, debouncedSearch]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  // Lắng nghe sự kiện cập nhật đối chiếu công nợ từ tab khác hoặc sự kiện hệ thống
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'debt_reconciliation_last_updated') {
        loadData();
      }
    };
    const handleCustomEvent = () => {
      loadData();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('debt-reconciliation-updated', handleCustomEvent);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('debt-reconciliation-updated', handleCustomEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadData]);

  const showToast = (msg: string) => {
    emitStatusToast({
      title: 'Thành công',
      message: msg,
      type: 'success',
    });
  };

  const formatVND = (val?: number) => {
    return (val || 0).toLocaleString('vi-VN') + ' đ';
  };

  // Xác nhận khớp
  const handleConfirm = async () => {
    if (!confirmingRec) return;
    setIsSubmittingConfirm(true);
    try {
      await confirmDebtReconciliationApi(token, confirmingRec.id);
      showToast(`Đã xác nhận đối chiếu thành công biên bản ${confirmingRec.code}!`);
      setConfirmingRec(null);
      try {
        localStorage.setItem('debt_reconciliation_last_updated', Date.now().toString());
        window.dispatchEvent(new CustomEvent('debt-reconciliation-updated'));
      } catch (_) {}
      loadData();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi',
        message: err.message || 'Lỗi xác nhận biên bản đối chiếu.',
        type: 'error',
      });
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  // Báo lệch
  const handleDispute = async () => {
    if (!disputingRec) return;
    const num = parseFloat(reportedBalance.replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) {
      emitStatusToast({
        title: 'Thông báo',
        message: 'Vui lòng nhập số tiền công nợ theo ghi nhận của bạn.',
        type: 'warning',
      });
      return;
    }
    if (!disputeReason.trim()) {
      emitStatusToast({
        title: 'Thông báo',
        message: 'Vui lòng nhập lý do hoặc chứng từ chênh lệch.',
        type: 'warning',
      });
      return;
    }

    setIsSubmittingDispute(true);
    try {
      await disputeDebtReconciliationApi(token, disputingRec.id, {
        dealer_reported_balance: num,
        reason: disputeReason.trim(),
      });
      showToast(`Đã gửi phản hồi chênh lệch cho biên bản ${disputingRec.code}. Kế toán sẽ liên hệ hỗ trợ bạn!`);
      setDisputingRec(null);
      setReportedBalance('');
      setDisputeReason('');
      try {
        localStorage.setItem('debt_reconciliation_last_updated', Date.now().toString());
        window.dispatchEvent(new CustomEvent('debt-reconciliation-updated'));
      } catch (_) {}
      loadData();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi',
        message: err.message || 'Lỗi gửi phản hồi chênh lệch.',
        type: 'error',
      });
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pendingCount = pendingTotal;

  return (
    <div style={{ marginTop: '16px' }}>

      {/* Error */}
      {errorMessage && (
        <div style={{ padding: '12px 18px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#991b1b', marginBottom: '14px', fontSize: '13.5px', fontWeight: '600' }}>
          {errorMessage}
        </div>
      )}

      {/* Banner nhắc nhở nếu có biên bản mới (KHÔNG ICON) */}
      {pendingCount > 0 && (
        <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: '700', color: '#1e40af', fontSize: '14px' }}>
              Quý đại lý có {pendingCount} biên bản đối chiếu công nợ mới cần xác nhận
            </div>
            <div style={{ fontSize: '12.5px', color: '#3b82f6', marginTop: '2px' }}>
              Vui lòng kiểm tra các số liệu mua hàng, thanh toán và bấm xác nhận để chốt công nợ định kỳ.
            </div>
          </div>
        </div>
      )}

      {/* Thanh công cụ tìm kiếm, lọc trạng thái và nút Làm mới trực tiếp */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '520px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }}>
            <input
              type="text"
              id="input-search-rec"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="Tìm theo mã biên bản..."
              style={{
                width: '100%',
                padding: '6px 28px 6px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#1f2937',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchKeyword && (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          <select
            id="select-status-rec"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#374151',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="ALL">-- Tất cả trạng thái --</option>
            <option value="SENT">Cần xác nhận</option>
            <option value="CONFIRMED">Đã đối chiếu khớp</option>
            <option value="DISPUTED">Đang báo lệch</option>
          </select>
        </div>

        <div>
          <button
            type="button"
            id="btn-refresh-rec-list"
            onClick={() => loadData()}
            disabled={isLoading}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: '#ffffff',
              border: '1px solid #d1d5db',
              color: '#374151',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? 'Đang tải...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {/* Bảng danh sách */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', minHeight: '180px', width: '100%', boxSizing: 'border-box' }}>
        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '12px' }}>
              <th style={{ width: '15%', padding: '10px 8px' }}>Mã biên bản</th>
              <th style={{ width: '18%', padding: '10px 8px' }}>Kỳ đối chiếu</th>
              <th style={{ width: '10%', padding: '10px 6px', textAlign: 'right' }}>Dư nợ đầu kỳ</th>
              <th style={{ width: '12%', padding: '10px 6px', textAlign: 'right' }}>Mua trong kỳ</th>
              <th style={{ width: '12%', padding: '10px 6px', textAlign: 'right' }}>Đã trả trong kỳ</th>
              <th style={{ width: '13%', padding: '10px 6px', textAlign: 'right' }}>Dư nợ cuối kỳ</th>
              <th style={{ width: '13%', padding: '10px 6px', textAlign: 'center' }}>Trạng thái</th>
              <th style={{ width: '7%', padding: '10px 4px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                  Đang tải biên bản đối chiếu...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Hiện chưa có biên bản đối chiếu nào gửi đến Quý đại lý.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: r.status === 'SENT' ? '#f0fdf4' : '#ffffff' }}>
                  <td style={{ padding: '10px 8px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.code}</td>
                  <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.period_label}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>{formatVND(r.opening_balance)}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', color: '#b91c1c', fontWeight: '600', whiteSpace: 'nowrap' }}>+{formatVND(r.total_increase)}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', color: '#15803d', fontWeight: '600', whiteSpace: 'nowrap' }}>-{formatVND(r.total_decrease)}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>{formatVND(r.closing_balance)}</td>
                  <td style={{ padding: '10px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {r.status === 'CONFIRMED' ? (
                      <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d', whiteSpace: 'nowrap', display: 'inline-block' }}>
                        Đã đối chiếu khớp
                      </span>
                    ) : r.status === 'DISPUTED' ? (
                      <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fee2e2', color: '#b91c1c', whiteSpace: 'nowrap', display: 'inline-block' }}>
                        Đang báo lệch
                      </span>
                    ) : (
                      <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fef3c7', color: '#b45309', whiteSpace: 'nowrap', display: 'inline-block' }}>
                        Cần xác nhận
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '8px 4px',
                      textAlign: 'center',
                      position: 'relative',
                      zIndex: openActionMenuId === r.id ? 40 : 1,
                    }}
                  >
                    <div
                      className="rec-action-menu-container"
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenActionMenuId(openActionMenuId === r.id ? null : r.id);
                        }}
                        style={{
                          width: '32px',
                          height: '32px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: openActionMenuId === r.id ? '#f1f5f9' : '#ffffff',
                          color: openActionMenuId === r.id ? '#0f172a' : '#475569',
                          border: '1px solid',
                          borderColor: openActionMenuId === r.id ? '#94a3b8' : '#e2e8f0',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '18px',
                          fontWeight: '700',
                          lineHeight: 1,
                          transition: 'all 0.15s ease',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                        onMouseEnter={(e) => {
                          if (openActionMenuId !== r.id) {
                            e.currentTarget.style.backgroundColor = '#f8fafc';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.color = '#0f172a';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (openActionMenuId !== r.id) {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.color = '#475569';
                          }
                        }}
                        title="Thao tác"
                      >
                        ⋮
                      </button>

                      {openActionMenuId === r.id && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 'calc(100% + 4px)',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                            padding: '6px',
                            minWidth: '210px',
                            zIndex: 100,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                            textAlign: 'left',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRec(r);
                              setOpenActionMenuId(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              backgroundColor: 'transparent',
                              color: '#1e293b',
                              fontSize: '12.5px',
                              fontWeight: '600',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                              textAlign: 'left',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#eff6ff';
                              e.currentTarget.style.color = '#1d4ed8';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#1e293b';
                            }}
                          >
                            <span style={{ fontSize: '14px' }}>📄</span>
                            <span>Xem &amp; In biên bản</span>
                          </button>

                          {r.status === 'SENT' && (
                            <>
                              <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '2px 0' }} />
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmingRec(r);
                                  setOpenActionMenuId(null);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  color: '#15803d',
                                  fontSize: '12.5px',
                                  fontWeight: '600',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  textAlign: 'left',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f0fdf4';
                                  e.currentTarget.style.color = '#166534';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = '#15803d';
                                }}
                              >
                                <span style={{ fontSize: '14px' }}>✅</span>
                                <span>Xác nhận số liệu đúng</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setDisputingRec(r);
                                  setReportedBalance(String(r.closing_balance));
                                  setOpenActionMenuId(null);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: 'none',
                                  backgroundColor: 'transparent',
                                  color: '#c2410c',
                                  fontSize: '12.5px',
                                  fontWeight: '600',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s',
                                  textAlign: 'left',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#fff7ed';
                                  e.currentTarget.style.color = '#9a3412';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = '#c2410c';
                                }}
                              >
                                <span style={{ fontSize: '14px' }}>⚠️</span>
                                <span>Báo lệch / Khiếu nại</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Chân bảng: Phân trang (Pagination) */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'stretch',
              border: '1px solid #d1d5db',
              borderRadius: '5px',
              overflow: 'hidden',
              background: '#ffffff',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              height: '24px',
            }}
          >
            {/* Danh sách các số trang */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                  acc.push('...');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx, arr) => {
                const isLastItem = idx === arr.length - 1;
                if (typeof p === 'string') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      style={{
                        minWidth: '22px',
                        height: '100%',
                        padding: '0 4px',
                        borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                        background: '#ffffff',
                        color: '#6b7280',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        userSelect: 'none',
                      }}
                    >
                      ...
                    </span>
                  );
                }

                const isActive = p === safePage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    style={{
                      minWidth: '24px',
                      height: '100%',
                      padding: '0 7px',
                      border: 'none',
                      borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                      background: isActive ? '#2ba1f4' : '#ffffff',
                      color: isActive ? '#ffffff' : '#374151',
                      cursor: isActive ? 'default' : 'pointer',
                      fontSize: '11.5px',
                      fontWeight: isActive ? '700' : '500',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    {p}
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* Modal Xác nhận đúng */}
      {confirmingRec && createPortal(
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '17px', color: '#15803d' }}>
              Xác nhận số liệu biên bản đối chiếu
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
              Quý đại lý xác nhận đã kiểm tra và đồng ý số dư nợ kỳ <strong>{confirmingRec.period_label}</strong> tính đến ngày {confirmingRec.to_date} là:
            </p>
            <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px', textAlign: 'center', marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', color: '#166534' }}>Số dư nợ chốt cuối kỳ:</div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803d', marginTop: '2px' }}>
                {formatVND(confirmingRec.closing_balance)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setConfirmingRec(null)}
                style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
              >
                Xem lại
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmittingConfirm}
                style={{ padding: '8px 20px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
              >
                {isSubmittingConfirm ? 'Đang xác nhận...' : 'Đồng ý & Ký xác nhận'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Báo lệch số liệu */}
      {disputingRec && createPortal(
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(5px)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '17px', color: '#ea580c' }}>
              Báo chênh lệch số liệu đối chiếu
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#64748b' }}>
              Biên bản: <strong>{disputingRec.code}</strong> (Hệ thống ghi nhận nợ: {formatVND(disputingRec.closing_balance)})
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                Số tiền nợ theo ghi nhận của Quý đại lý (VNĐ) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="number"
                value={reportedBalance}
                onChange={(e) => setReportedBalance(e.target.value)}
                placeholder="Ví dụ: 15000000"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                Lý do chênh lệch hoặc chứng từ thanh toán đính kèm <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Ví dụ: Đã chuyển khoản 5 triệu ngày 28/10 theo ủy nhiệm chi số 12345 nhưng chưa thấy trừ trong biên bản..."
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setDisputingRec(null)}
                style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                onClick={handleDispute}
                disabled={isSubmittingDispute}
                style={{ padding: '8px 18px', backgroundColor: '#ea580c', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
              >
                {isSubmittingDispute ? 'Đang gửi...' : 'Gửi phản hồi cho Kế toán'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal In */}
      <DebtReconciliationPrintModal
        isOpen={!!selectedRec}
        onClose={() => setSelectedRec(null)}
        reconciliation={selectedRec}
      />
    </div>
  );
};
