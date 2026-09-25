const XLSX = require('xlsx');

const wb = XLSX.readFile('./Báo cáo mẫu.xlsx');

// Let's inspect Sheet 4: "Nguồn truy cập cho Đơn hàng..." and Sheet 5: "(đơn đã đặt)Theo nguồn lưu ..."
console.log('=== SHEET 4: Nguồn truy cập cho Đơn hàng... ===');
const ws4 = wb.Sheets['Nguồn truy cập cho Đơn hàng...'];
const raw4 = XLSX.utils.sheet_to_json(ws4, { header: 1, defval: '' });
raw4.forEach((r, idx) => {
  if (r.some(c => c !== '')) console.log(`Row ${idx}:`, r);
});

console.log('\n=== SHEET 10: Nguồn truy cập từ Đơn hàng ... ===');
const ws10 = wb.Sheets['Nguồn truy cập từ Đơn hàng ...'];
const raw10 = XLSX.utils.sheet_to_json(ws10, { header: 1, defval: '' });
raw10.forEach((r, idx) => {
  if (r.some(c => c !== '')) console.log(`Row ${idx}:`, r);
});
