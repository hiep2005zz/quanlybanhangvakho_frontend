// frontend/src/components/AgencyInvoiceDetailPage.tsx
import React, { useEffect, useState } from 'react';
import type { AgencyInvoiceDetail } from '../types/agencyDebt';
import { getAgencyInvoiceDetailApi, downloadAgencyInvoiceApi } from '../services/agencyDebtApi';
import './agency-debt.css';

export interface AgencyInvoiceDetailPageProps {
  token: string;
  invoiceCode: string;
  onBack: () => void;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(val || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('vi-VN');
};

export const AgencyInvoiceDetailPage: React.FC<AgencyInvoiceDetailPageProps> = ({
  token,
  invoiceCode,
  onBack,
}) => {
  const [detail, setDetail] = useState<AgencyInvoiceDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    getAgencyInvoiceDetailApi(token, invoiceCode)
      .then((res) => {
        if (isMounted) setDetail(res);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Không thể tải chi tiết hóa đơn.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, invoiceCode]);

  const handleDownload = async (format: 'xml' | 'json' | 'pdf') => {
    try {
      setDownloadingFormat(format);
      const { blob, filename } = await downloadAgencyInvoiceApi(token, invoiceCode, format);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      alert(`Lỗi khi tải file: ${err.message || 'Không thể tải file'}`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="agency-invoice-page-container">
      {/* 1. Header Trang Chi Tiết Hóa Đơn (Thanh điều hướng & Thao tác) */}
      <div className="agency-invoice-page-header agency-modal-hide-on-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            id="btn-back-to-invoices"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 transition-colors cursor-pointer shadow-2xs"
          >
            <span className="text-sm font-bold">←</span>
            <span>Quay lại danh sách</span>
          </button>

          <div className="h-5 w-px bg-gray-200 hidden sm:block"></div>

          <div>
            <h1 className="text-sm sm:text-base font-bold text-gray-900 leading-tight">
              Chi tiết Hóa đơn #{invoiceCode}
            </h1>
            <p className="text-[11px] text-gray-500">Xem nội dung và chứng từ phát hành chính thức</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-download-pdf"
            onClick={() => handleDownload('pdf')}
            disabled={loading || !detail || downloadingFormat !== null}
            className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-2xs cursor-pointer transition-colors disabled:opacity-50"
          >
            {downloadingFormat === 'pdf' ? 'Đang tải PDF...' : 'Tải PDF hóa đơn'}
          </button>
        </div>
      </div>

      {/* 2. Thân Trang: Hiển thị Hóa Đơn Trắng Sạch Chuẩn Nghiệp Vụ - Full Trang */}
      <div className="agency-invoice-page-body">
        {loading ? (
          <div className="p-16 text-center text-gray-500 bg-white rounded-xl shadow-xs w-full border border-gray-200">
            <p className="text-sm font-semibold">Đang tải dữ liệu hóa đơn #{invoiceCode}...</p>
          </div>
        ) : error ? (
          <div className="p-10 text-center bg-rose-50 border border-rose-200 rounded-xl text-rose-700 w-full">
            <p className="text-base font-bold mb-1">Lỗi tải thông tin</p>
            <p className="text-sm">{error}</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-4 px-4 py-1.5 bg-white border border-rose-300 rounded-md text-xs font-semibold text-rose-700 hover:bg-rose-100 cursor-pointer"
            >
              ← Quay lại danh sách
            </button>
          </div>
        ) : detail ? (
          <div className="agency-invoice-paper w-full bg-white">
            {/* Tiêu đề & Thông tin đơn vị */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-gray-200">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-gray-900 uppercase">
                  HÓA ĐƠN BÁN HÀNG
                </h1>
                <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                  KIÊM BIÊN BẢN GIAO NHẬN &amp; XÁC NHẬN CÔNG NỢ
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Mã hóa đơn: <strong className="text-gray-900">{detail.invoice_code}</strong> | Mã đơn hàng: <strong className="text-gray-900">{detail.order_code}</strong>
                </p>
              </div>
              <div className="text-left sm:text-right text-xs text-gray-600">
                <p>Ngày phát hành: <strong>{formatDate(detail.issue_date)}</strong></p>
                <p className="mt-1">
                  Hạn thanh toán:{' '}
                  <strong className={detail.days_until_due < 0 && detail.status !== 'PAID' ? 'text-rose-600' : 'text-gray-900'}>
                    {formatDate(detail.due_date)}
                  </strong>
                </p>
                <div className="mt-2">
                  <span
                    className={`agency-status-badge ${
                      detail.status === 'PAID'
                        ? 'agency-badge-paid'
                        : detail.status === 'OVERDUE'
                        ? 'agency-badge-overdue'
                        : detail.status === 'PARTIAL'
                        ? 'agency-badge-partial'
                        : 'agency-badge-unpaid'
                    }`}
                  >
                    {detail.status_label}
                  </span>
                </div>
              </div>
            </div>

            {/* Thông tin 2 bên Mua & Bán */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-5 border-b border-gray-200 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                <p className="font-bold uppercase text-slate-800 tracking-wider mb-1.5">
                  ĐƠN VỊ BÁN HÀNG
                </p>
                <p className="font-bold text-gray-900">{detail.seller.name}</p>
                <p className="text-gray-600 mt-1">Mã số thuế: {detail.seller.tax_code}</p>
                <p className="text-gray-600">Địa chỉ: {detail.seller.address}</p>
                <p className="text-gray-600">Điện thoại: {detail.seller.phone}</p>
                <p className="text-gray-600 mt-1 font-mono text-[11px]">
                  Số tài khoản: {detail.seller.bank_account}
                </p>
              </div>

              <div className="bg-emerald-50/50 p-3.5 rounded-lg border border-emerald-200">
                <p className="font-bold uppercase text-emerald-900 tracking-wider mb-1.5">
                  ĐẠI LÝ MUA HÀNG
                </p>
                <p className="font-bold text-gray-900">{detail.dealer.name}</p>
                <p className="text-gray-600 mt-1">Mã đại lý: {detail.dealer.code}</p>
                {detail.dealer.tax_code && <p className="text-gray-600">Mã số thuế: {detail.dealer.tax_code}</p>}
                {detail.dealer.phone && <p className="text-gray-600">Điện thoại: {detail.dealer.phone}</p>}
                {detail.dealer.address && <p className="text-gray-600">Địa chỉ: {detail.dealer.address}</p>}
              </div>
            </div>

            {/* Bảng chi tiết mặt hàng */}
            <div className="py-5 border-b border-gray-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-3">
                Danh Mục Hàng Hóa &amp; Dịch Vụ
              </h3>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-300 bg-slate-50 text-gray-700">
                    <th className="py-2 px-3 text-center w-10">Số thứ tự</th>
                    <th className="py-2 px-3">Tên Hàng Hóa / Dịch Vụ</th>
                    <th className="py-2 px-3 text-center">Đơn vị tính</th>
                    <th className="py-2 px-3 text-right">Số Lượng</th>
                    <th className="py-2 px-3 text-right">Đơn Giá</th>
                    <th className="py-2 px-3 text-right">Thành Tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {detail.items && detail.items.length > 0 ? (
                    detail.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 text-center text-gray-500">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-gray-900">{it.product_name}</td>
                        <td className="py-2.5 px-3 text-center text-gray-600">{it.unit_name || 'Chiếc'}</td>
                        <td className="py-2.5 px-3 text-right font-semibold">{it.quantity}</td>
                        <td className="py-2.5 px-3 text-right text-gray-700">{formatCurrency(it.price)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                          {formatCurrency(it.total || it.quantity * it.price)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-gray-400">
                        Theo hợp đồng đơn hàng #{detail.order_code}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Bảng tổng kết số tiền */}
            <div className="py-5 border-b border-gray-200 flex justify-end">
              <div className="w-72 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Tổng tiền hàng:</span>
                  <strong className="text-gray-900">{formatCurrency(detail.total_amount)}</strong>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Đã thanh toán:</span>
                  <strong className="text-emerald-700">{formatCurrency(detail.paid_amount)}</strong>
                </div>
                <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200">
                  <span className="text-amber-800">Còn nợ:</span>
                  <span className="text-amber-800">{formatCurrency(detail.remaining_debt)}</span>
                </div>
              </div>
            </div>

            {/* Ghi chú & Chữ ký */}
            <div className="pt-5 text-xs text-gray-500">
              <p className="italic">
                * Ghi chú: {detail.note || 'Thanh toán theo điều khoản tín dụng hợp đồng đại lý.'}
              </p>
              <div className="grid grid-cols-2 gap-4 mt-8 pt-4 text-center">
                <div>
                  <p className="font-bold text-gray-800 uppercase">ĐẠI DIỆN BÊN MUA</p>
                  <p className="text-[11px] text-gray-400 italic">(Ký, ghi rõ họ tên)</p>
                </div>
                <div>
                  <p className="font-bold text-gray-800 uppercase">ĐẠI DIỆN BÊN BÁN</p>
                  <p className="text-[11px] text-gray-400 italic">(Ký, đóng dấu)</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AgencyInvoiceDetailPage;
