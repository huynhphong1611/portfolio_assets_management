/**
 * CSV templates offered next to the import dialogs.
 * Headers match what the backend importer recognises (and what "Xuất CSV" writes).
 */
export const TRANSACTION_TEMPLATE = [
  'Ngày giờ,Loại giao dịch,Loại tài sản,Mã,Số lượng,Đơn giá,Loại tiền,Tỷ giá,Thành tiền (VNĐ),Nơi lưu trữ,Ghi chú',
  '02/01/2026 09:00:00,Nạp tiền,Tiền mặt VNĐ,,,,VNĐ,1,100000000,Techcombank,Nạp vốn',
  '03/01/2026 10:15:00,Mua,Cổ phiếu,VNM,500,70000,VNĐ,1,35000000,SSI,',
  '05/01/2026 14:00:00,Mua,Vàng,NHAN9999,2,8450000,VNĐ,1,16900000,PNJ,Vàng nhẫn tính theo chỉ',
  '10/03/2026 11:00:00,Bán,Cổ phiếu,VNM,200,75000,VNĐ,1,15000000,SSI,Chốt lời',
  '15/07/2026 09:00:00,Cổ tức,Cổ phiếu,VNM,300,1500,VNĐ,1,450000,SSI,Cổ tức tiền mặt',
  '20/07/2026 09:00:00,Rút tiền,Tiền mặt VNĐ,,,,VNĐ,1,10000000,Techcombank,',
].join('\n');

export const PRICE_TEMPLATE = [
  'Ngày,Giá',
  '01/09/2026,8450000',
  '02/09/2026,8470000',
  '03/09/2026,8500000',
].join('\n');

export function downloadText(text, filename, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + text : text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
