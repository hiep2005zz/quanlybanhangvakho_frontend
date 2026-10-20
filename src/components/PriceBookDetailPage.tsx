import React, { useState, useEffect, useMemo } from 'react';
import {
  PriceBook,
  PriceBookItem,
  fetchPriceBookDetailApi,
  clonePriceBookApi,
  User,
} from '../services/api';
import { useParams, useNavigate, Link } from '../hooks/useLocation';
import { emitStatusToast } from './StatusToast';

export interface PriceBookDetailPageProps {
  token: string;
  currentUser?: User | null;
  priceBookId?: string | number;
  onBack?: () => void;
  onRefreshProducts?: () => void;
}

export const PriceBookDetailPage: React.FC<PriceBookDetailPageProps> = ({
  token,
  currentUser,
  priceBookId: propPriceBookId,
  onBack,
  onRefreshProducts,
}) => {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const bookId = propPriceBookId || paramId || '';

  const [book, setBook] = useState<PriceBook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');

  // Quyền thao tác
  const userRoles = useMemo(() => {
    if (currentUser?.roles && currentUser.roles.length > 0) return currentUser.roles;
    return [currentUser?.role || ''];
  }, [currentUser]);
  const canManagePriceBooks = userRoles.some((r) => ['admin', 'sales_manager'].includes(r));

  // Tải chi tiết bảng giá
  const loadDetail = async () => {
    if (!bookId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPriceBookDetailApi(token, Number(bookId));
      setBook(data);
    } catch (err: any) {
      console.error('Lỗi khi tải chi tiết bảng giá:', err);
      setError(err.message || 'Không thể tải thông tin bảng giá');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [token, bookId]);

  // Điều hướng quay lại
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/price-books');
    }
  };

  // Nhân bản bảng giá
  const handleClone = async () => {
    if (!book || cloning) return;
    try {
      setCloning(true);
      const cloned = await clonePriceBookApi(token, book.id);
      emitStatusToast({
        message: `Đã nhân bản thành công bảng giá "${cloned.name}" (Mã: ${cloned.code}, Phiên bản: Phiên bản ${cloned.version || 2})!`,
        title: 'Nhân bản thành công',
        type: 'success',
      });
      if (onRefreshProducts) onRefreshProducts();
      navigate(`/price-books/${cloned.id}`);
    } catch (err: any) {
      emitStatusToast({
        message: err.message || 'Lỗi nhân bản bảng giá',
        title: 'Thất bại',
        type: 'error',
      });
    } finally {
      setCloning(false);
    }
  };

  // Định dạng nhóm khách hàng
  const formatGroupName = (grp?: string) => {
    if (!grp) return 'Tất cả';
    if (grp === 'CAP_1' || grp === 'Dai_ly_cap_1' || grp === 'Đại lý cấp 1' || grp === 'dai_ly_cap_1') return 'Đại lý cấp 1';
    if (grp === 'CAP_2' || grp === 'Dai_ly_cap_2' || grp === 'Đại lý cấp 2' || grp === 'dai_ly_cap_2') return 'Đại lý cấp 2';
    if (grp === 'khach_si' || grp === 'Khach_si' || grp === 'Khách sỉ') return 'Khách sỉ';
    if (grp === 'RETAIL' || grp === 'Khach_le' || grp === 'Khách lẻ' || grp === 'khach_le') return 'Khách lẻ';
    return grp;
  };

  // Định dạng badge trạng thái
  const renderStatusBadge = (pb: PriceBook) => {
    if (pb.status === 'INACTIVE') {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
          Ngừng hoạt động
        </span>
      );
    }
    const now = new Date();
    if (pb.status === 'EXPIRED' || new Date(pb.valid_to) < now) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
          Đã hết hạn
        </span>
      );
    }
    if (new Date(pb.valid_from) > now) {
      return (
        <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">
          Chờ áp dụng
        </span>
      );
    }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        Đang áp dụng
      </span>
    );
  };

  // Lọc sản phẩm trong bảng giá theo từ khóa
  const filteredItems = useMemo(() => {
    if (!book?.items) return [];
    const q = searchProduct.trim().toLowerCase();
    if (!q) return book.items;
    return book.items.filter((item) => {
      const code = String(item.product_code || item.product_id || '').toLowerCase();
      const name = String(item.product_name || '').toLowerCase();
      return code.includes(q) || name.includes(q);
    });
  }, [book?.items, searchProduct]);

  if (loading) {
    return (
      <div className="w-full flex-1 bg-slate-50 flex items-center justify-center p-12">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-semibold text-slate-600">Đang tải thông tin chi tiết bảng giá...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="w-full flex-1 bg-slate-50 flex items-center justify-center p-12">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-lg text-center shadow-xs">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Không tìm thấy Bảng giá</h2>
          <p className="text-sm text-slate-600 mb-6">{error || 'Bảng giá không tồn tại hoặc đã bị gỡ bỏ.'}</p>
          <button
            type="button"
            onClick={handleBack}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
          >
            Quay lại danh sách
          </button>
        </div>
      </div>
    );
  }

  const isLocked = Boolean(book.is_locked);

  return (
    <div className="w-full flex-1 bg-slate-50 flex flex-col min-h-full">
      {/* 1. Header Trang Độc Lập - Full Width */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          {/* Tiêu đề & Thông tin bảng giá - Bên trái */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {book.name}
            </h1>
            <span className="font-mono bg-slate-100 text-slate-800 text-xs sm:text-sm px-2.5 py-0.5 rounded-md border border-slate-200 font-bold">
              {book.code}
            </span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
              Phiên bản {book.version || 1}
            </span>
            {renderStatusBadge(book)}
          </div>

          {/* Action buttons & Nút Quay lại - Bên phải */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {canManagePriceBooks && (
              <>
                {isLocked ? (
                  <button
                    type="button"
                    disabled
                    className="px-4 py-2 bg-slate-100 border border-slate-300 text-slate-400 rounded-xl text-xs sm:text-sm font-semibold cursor-not-allowed"
                    title="Bảng giá đã phát sinh đơn hàng, không thể chỉnh sửa"
                  >
                    Đã khóa sửa
                  </button>
                ) : (
                  <Link
                    to={`/price-books/${book.id}/edit`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0fad89] hover:bg-[#0c9576] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
                    title="Chỉnh sửa bảng giá này trên trang riêng"
                  >
                    <span>Sửa Bảng Giá</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleClone}
                  disabled={cloning}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  title="Nhân bản tạo phiên bản mới"
                >
                  <span>{cloning ? 'Đang nhân bản...' : 'Tạo phiên bản mới'}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors cursor-pointer shadow-xs"
              title="Quay lại danh sách bảng giá"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Quay lại</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Content Container - Full Width */}
      <div className="flex-1 w-full px-4 sm:px-8 py-6 space-y-6 pb-16">
        {/* Thẻ 1: Thông tin tổng quan */}
        <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 pb-2 border-b border-slate-100">
            Thông tin chi tiết bảng giá
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-sm">
            {/* Nhóm khách hàng */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Nhóm khách hàng áp dụng</span>
              <strong className="text-slate-900 text-base">{formatGroupName(book.customer_group)}</strong>
            </div>

            {/* Thời hạn hiệu lực */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Thời hạn hiệu lực</span>
              <div className="font-semibold text-slate-800 text-xs sm:text-sm leading-tight">
                {new Date(book.valid_from).toLocaleDateString('vi-VN')} → {new Date(book.valid_to).toLocaleDateString('vi-VN')}
              </div>
            </div>

            {/* Tình trạng khóa */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Tình trạng chỉnh sửa</span>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 text-red-600 font-bold text-xs sm:text-sm">
                  Đã khóa (Đã có đơn hàng)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs sm:text-sm">
                  Cho phép chỉnh sửa
                </span>
              )}
            </div>

            {/* Người tạo */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Người tạo bảng giá</span>
              <strong className="text-slate-800 text-sm">{book.created_by || 'admin'}</strong>
            </div>
          </div>

          {book.note && (
            <div className="mt-4 p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs sm:text-sm text-slate-700">
              <span className="font-bold text-blue-900">Ghi chú:</span> {book.note}
            </div>
          )}
        </div>

        {/* Thẻ 2: Danh sách sản phẩm trong bảng giá */}
        <div className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            {/* Ô tìm kiếm nhanh trong bảng giá - Bên trái */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  pointerEvents: 'none',
                  color: '#94a3b8',
                  zIndex: 2,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                placeholder="Tìm mã hoặc tên sản phẩm..."
                style={{
                  width: '100%',
                  paddingLeft: '35px',
                  paddingRight: searchProduct ? '30px' : '12px',
                  paddingTop: '8px',
                  paddingBottom: '8px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#0fad89';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(15, 173, 137, 0.15)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
                }}
              />
              {searchProduct && (
                <button
                  type="button"
                  onClick={() => setSearchProduct('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Xoá tìm kiếm"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Tiêu đề & mô tả - Bên phải */}
            <div className="text-left sm:text-right">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Danh sách sản phẩm áp dụng ({book.items?.length || 0})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Các sản phẩm thuộc bảng giá kèm đơn giá niêm yết và giá sàn tối thiểu
              </p>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-xs uppercase font-extrabold tracking-wider border-b border-slate-200">
                  <th className="py-3.5 px-6">Mã Sản Phẩm</th>
                  <th className="py-3.5 px-6">Tên Sản Phẩm</th>
                  <th className="py-3.5 px-6 text-right">Giá Niêm Yết (đồng)</th>
                  <th className="py-3.5 px-6 text-right">Giá Sàn (đồng)</th>
                  <th className="py-3.5 px-6 text-right">Biên Độ Giá (đồng)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item: PriceBookItem, idx) => {
                  const salePrice = item.sale_price !== undefined && item.sale_price !== null ? Number(item.sale_price) : Number(item.price || 0);
                  const floorPrice = item.floor_price !== undefined && item.floor_price !== null ? Number(item.floor_price) : Number(item.min_price || 0);
                  const margin = Math.max(0, salePrice - floorPrice);

                  return (
                    <tr key={item.id || item.product_id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-6 font-mono font-bold text-slate-900 text-xs">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.product_code || `#${item.product_id}`}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-slate-800">
                        {item.product_name || `Sản phẩm #${item.product_id}`}
                      </td>
                      <td className="py-3.5 px-6 text-right font-extrabold text-emerald-700 text-sm">
                        {salePrice.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold text-slate-700 text-sm">
                        {floorPrice.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="py-3.5 px-6 text-right font-semibold text-blue-600 text-xs sm:text-sm">
                        +{margin.toLocaleString('vi-VN')} đ
                      </td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 px-6 text-center text-slate-400">
                      {searchProduct ? 'Không tìm thấy sản phẩm nào khớp với từ khóa tìm kiếm.' : 'Chưa có sản phẩm nào trong bảng giá này.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Chân bảng tổng kết */}
          {book.items && book.items.length > 0 && (
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
              <div>
                Tổng số: <strong className="text-slate-900 font-bold">{book.items.length}</strong> sản phẩm trong bảng giá
              </div>
              <div className="flex gap-6">
                <span>
                  Giá niêm yết cao nhất:{' '}
                  <strong className="text-emerald-700 font-bold">
                    {Math.max(...book.items.map((i) => Number(i.sale_price || i.price || 0))).toLocaleString('vi-VN')} đ
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PriceBookDetailPage;
