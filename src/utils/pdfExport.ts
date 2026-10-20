import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Xuất và tải trực tiếp phần tử DOM dạng file PDF (khổ A4 chuẩn).
 * Tự động tính toán tỷ lệ, hỗ trợ nhiều trang nếu nội dung dài, và giữ nguyên giao diện sắc nét.
 * Kiểm soát dung sai chống tràn trang: Không bao giờ sinh trang trắng thừa ở cuối.
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

  // Nếu nội dung vừa vặn trong 1 trang hoặc chỉ vượt nhẹ dưới 8mm do padding/làm tròn pixel:
  // Gói gọn trong đúng 1 trang duy nhất, tuyệt đối không sinh trang thứ 2!
  if (imgHeight <= pageHeight + 8) {
    const finalHeight = Math.min(imgHeight, pageHeight);
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, finalHeight, undefined, 'FAST');
  } else {
    // Tài liệu nhiều trang thực sự (ví dụ bảng có nhiều hàng hóa)
    let heightLeft = imgHeight;
    let position = 0;

    // Trang 1
    pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Các trang tiếp theo: chỉ thêm khi phần dư còn lại thực sự có nội dung (> 15mm)
    while (heightLeft > 15) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pageWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }
  }

  // Tải file về máy của người dùng
  pdf.save(safeFileName);
}


