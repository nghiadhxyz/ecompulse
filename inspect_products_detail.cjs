const XLSX = require('xlsx');

const wb = XLSX.readFile('./Báo cáo mẫu.xlsx');

const ws6 = wb.Sheets['Theo sản phẩm (đơn đã đặt)'];
const raw6 = XLSX.utils.sheet_to_json(ws6, { header: 1, defval: '' });
console.log('=== SHEET 6: Theo sản phẩm (đơn đã đặt) ===');
raw6.forEach((r, idx) => {
  if (r.some(c => c !== '')) console.log(`Row ${idx}:`, r.slice(0, 10));
});

const ws12 = wb.Sheets['Theo sản phẩm (đơn đã thanh...'];
const raw12 = XLSX.utils.sheet_to_json(ws12, { header: 1, defval: '' });
console.log('\n=== SHEET 12: Theo sản phẩm (đơn đã thanh...) ===');
raw12.forEach((r, idx) => {
  if (r.some(c => c !== '')) console.log(`Row ${idx}:`, r.slice(0, 10));
});
