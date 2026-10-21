/**
 * Utility hỗ trợ tải file an toàn trên trình duyệt (Chrome, Edge, Firefox, Safari).
 * Khắc phục triệt để lỗi Chromium tự ý đặt tên file thành chuỗi UUID không có đuôi mở rộng (.xlsx / .pdf)
 * do việc gỡ bỏ phần tử <a> khỏi DOM quá sớm hoặc URL bị thu hồi (revoke) ngay lập tức.
 */

export function downloadBlobFile(
  blob: Blob,
  filename: string,
  mimeType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
): void {
  // Đảm bảo Blob có đúng MIME type để trình duyệt nhận diện ứng dụng mở (Excel, PDF, ...)
  const finalBlob = blob.type ? blob : new Blob([blob], { type: mimeType });
  const url = window.URL.createObjectURL(finalBlob);

  const link = document.createElement('a');
  link.style.display = 'none';
  link.style.position = 'fixed';
  link.style.left = '-9999px';
  link.href = url;
  link.setAttribute('download', filename);
  link.download = filename;

  document.body.appendChild(link);

  // Kích hoạt hành động tải xuống
  link.click();

  // Trì hoãn việc gỡ bỏ phần tử và thu hồi URL để Chromium Download Pipeline
  // hoàn tất việc lấy thông tin thuộc tính 'download' và tên tệp.
  setTimeout(() => {
    try {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      window.URL.revokeObjectURL(url);
    } catch {
      // Bỏ qua nếu đã được dọn dẹp
    }
  }, 1500);
}
