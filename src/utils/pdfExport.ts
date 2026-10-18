import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Xuất và tải trực tiếp phần tử DOM dạng file PDF (khổ A4 chuẩn).
 * Tự động tính toán tỷ lệ, hỗ trợ nhiều trang nếu nội dung dài, và giữ nguyên giao diện sắc nét.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  fileName: string = 'document.pdf'
): Promise<void> {
  const safeFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

  const canvas = await html2canvas(element, {
    scale: 2, // Đảm bảo độ nét cao (2x DPI)
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    windowWidth: element.scrollWidth,
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.98);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210; // A4 width mm
  const pageHeight = 297; // A4 height mm

  // Tính chiều cao của ảnh theo tỷ lệ khổ A4
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  // Thêm trang đầu tiên
  pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
  heightLeft -= pageHeight;

  // Nếu nội dung dài hơn 1 trang A4, tự động thêm các trang tiếp theo
  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;
  }

  // Lưu file về máy của người dùng
  pdf.save(safeFileName);
}
