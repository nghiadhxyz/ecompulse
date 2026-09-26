const XLSX = require('xlsx');
const fs = require('fs');

const wb = XLSX.readFile('./Báo cáo mẫu.xlsx');

const ws12 = wb.Sheets['Theo sản phẩm (đơn đã thanh...'];

function testCurrentParser(ws) {
  const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('Total raw lines in Sheet 12:', rawRows.length);
  
  // Let's filter out overview/summary rows and invalid product names
  const isInvalidProductName = (name, id) => {
    if (!name) return true;
    const lower = name.trim().toLowerCase();
    const idLower = String(id || '').trim().toLowerCase();
    
    if (
      lower.includes('đơn đã thanh toán') ||
      lower.includes('đơn hàng đã đặt') ||
      lower.includes('đơn đã xác nhận') ||
      lower.includes('loại đơn hàng') ||
      lower === 'tổng' ||
      lower === 'tổng cộng' ||
      lower === 'total' ||
      lower === 'sản phẩm' ||
      lower === 'tên sản phẩm' ||
      lower === 'ngày' ||
      lower === 'date'
    ) return true;
    
    // If id is a date range or date
    if (idLower.includes(' - ') || (idLower.match(/\d{2,4}/g) || []).length >= 4) return true;
    if (/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(idLower)) return true;
    
    return false;
  };

  const items = [];
  let currentSection = 'Thẻ sản phẩm';
  let headerMap = null;

  for (let r = 0; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const cell0 = String(row[0] || '').trim();
    const cell1 = String(row[1] || '').trim();
    const rowJoined = row.map(c => String(c).trim().toLowerCase()).join(' ');

    if (!rowJoined) continue;

    // Check if this is the overview summary block at top of sheet (rows 0-1)
    if (rowJoined.includes('loại đơn hàng') || rowJoined.includes('doanh thu từ thẻ sản phẩm') || (rowJoined.match(/\d{2,4}/g) || []).length >= 4 && rowJoined.includes('đơn')) {
      continue;
    }

    const lower0 = cell0.toLowerCase();
    const isSectionHeader =
      (cell0.length > 0 &&
        cell1.length === 0 &&
        !lower0.includes('mã') &&
        !lower0.includes('ngày') &&
        !lower0.includes('stt') &&
        !lower0.includes('tổng')) ||
      lower0 === 'thẻ sản phẩm' ||
      lower0 === 'live' ||
      lower0 === 'video' ||
      lower0.includes('tiếp thị liên kết') ||
      lower0.includes('cửa hàng') ||
      lower0.includes('tìm kiếm');

    if (isSectionHeader && !rowJoined.includes('mã sản phẩm') && !rowJoined.includes('sản phẩm')) {
      currentSection = cell0;
      headerMap = null;
      continue;
    }

    // Check if row is a column header row
    if (
      rowJoined.includes('mã sản phẩm') ||
      (rowJoined.includes('sản phẩm') && (rowJoined.includes('doanh số') || rowJoined.includes('tỷ lệ') || rowJoined.includes('tổng số đơn')))
    ) {
      headerMap = {};
      row.forEach((colVal, colIdx) => {
        if (colVal) headerMap[colIdx] = String(colVal).trim().toLowerCase();
      });
      continue;
    }

    // Only process rows if we are inside a section with valid headerMap!
    if (!headerMap) continue;

    const findExactColIdx = (predicate, fallbackIdx) => {
      for (const [idxStr, hName] of Object.entries(headerMap)) {
        if (predicate(hName)) return Number(idxStr);
      }
      return fallbackIdx !== undefined ? fallbackIdx : -1;
    };

    const prodIdCol = findExactColIdx((h) => (h.includes('mã') || h.includes('item id') || h.includes('product id')) && !h.includes('phiên') && !h.includes('video'), 0);
    const nameCol = findExactColIdx((h) => (h === 'sản phẩm' || h.includes('tên sản phẩm') || h.includes('tên sp') || h === 'tên') && !h.includes('mã') && !h.includes('tỷ lệ') && !h.includes('tỉ lệ') && !h.includes('lượt') && !h.includes('nhấp'), 1);
    const revCol = findExactColIdx((h) => (h.includes('doanh số') || h.includes('doanh thu') || h.includes('revenue')) && !h.includes('tỷ lệ') && !h.includes('tỉ lệ') && !h.includes('trên mỗi') && !h.includes('đơn hủy'), 4);
    const ordCol = findExactColIdx((h) => (h.includes('tổng số đơn hàng') || h.includes('số đơn hàng') || h.includes('orders')) && !h.includes('không bao gồm'), 7);
    const impCol = findExactColIdx((h) => h.includes('hiển thị') || h.includes('impressions'), 5);
    const clickCol = findExactColIdx((h) => h.includes('lượt nhấp') || h.includes('clicks') || (h.includes('nhấp') && !h.includes('duy nhất')), 6);
    const shareCol = findExactColIdx((h) => h.includes('tỷ lệ doanh số') || h.includes('tỉ lệ doanh số'), 3);
    const crCol = findExactColIdx((h) => h.includes('chuyển đổi') || h === 'cr', 10);

    const prodId = String(prodIdCol >= 0 ? row[prodIdCol] : `PROD-${r}`).trim();
    const name = String(nameCol >= 0 ? row[nameCol] : '').trim();

    if (isInvalidProductName(name, prodId)) continue;

    const cleanNum = (v) => parseFloat(String(v || '0').replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '')) || 0;

    items.push({
      id: prodId,
      name,
      channel: currentSection,
      revenue: revCol >= 0 ? cleanNum(row[revIdx]) : 0,
      orders: ordIdx >= 0 ? cleanNum(row[ordIdx]) : 0,
      impressions: impCol >= 0 ? cleanNum(row[impCol]) : 0,
      clicks: clickCol >= 0 ? cleanNum(row[clickCol]) : 0,
      share: shareCol >= 0 ? String(row[shareCol]) : '0%',
      cr: crCol >= 0 ? String(row[crCol]) : '0%'
    });
  }

  return items;
}

const cleanedProducts = testCurrentParser(ws12);
console.log('\nCleaned Products count from Sheet 12:', cleanedProducts.length);
cleanedProducts.forEach((p, idx) => {
  console.log(`${idx + 1}. [${p.channel}] ${p.name} (ID: ${p.id}) - Rev: ${p.revenue.toLocaleString()} VND, Orders: ${p.orders}, Views: ${p.impressions}`);
});
