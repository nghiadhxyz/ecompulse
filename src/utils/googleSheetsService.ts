/**
 * EcomPulse Link-Based Google Sheets & Task Assignment Service
 * 
 * ZERO OAuth requirement - 100% Privacy-Preserving
 * - 1-Click Auto-Generate & Open Google Sheet (No URL input needed)
 * - Auto-fetch & import live task assignments directly from shared Google Sheet links (CSV export)
 * - 1-Click Clipboard table copy (Ctrl+V into Google Sheets)
 * - Auto-Push to Google Sheets via Google Apps Script Webhook
 * - Excel / CSV export ready for Google Sheets import
 */

import * as XLSX from 'xlsx';
import { ActionCard, RoadmapActionItem, GoogleSheetsSyncConfig, GoogleUserProfile } from '../types';

const STORAGE_KEY_CONFIG = 'ecompulse_sheets_link_config';
const STORAGE_KEY_USER = 'ecompulse_local_user';

// ==========================================
// 1. 1-CLICK AUTO-GENERATE GOOGLE SHEET
// ==========================================

/**
 * 1-Click Auto-Generates Google Sheet without requiring user to type any URL
 * - Copies formatted task table to Clipboard
 * - Saves active linked Google Sheet config
 * - Opens https://sheets.new in a new tab
 */
export function autoGenerateAndOpenGoogleSheet(
  tasks: RoadmapActionItem[],
  cards: ActionCard[] = [],
  storeName = 'Shop TMĐT'
): GoogleSheetsSyncConfig {
  // 1. Auto-download formatted Excel file ready for Google Sheets / Excel
  try {
    downloadRoadmapExcelFile(tasks, cards, storeName);
  } catch (e) {
    console.error('Error auto downloading excel file:', e);
  }

  // 2. Auto-copy formatted roadmap to clipboard for instant Ctrl+V
  try {
    const tsv = generateRoadmapTsvData(tasks);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(tsv);
    }
  } catch (_) {}

  // 3. Create and save active linked sheet session
  const sheetTitle = `Bảng Phân Công EcomPulse - ${storeName}`;
  const config: GoogleSheetsSyncConfig = {
    spreadsheetId: `auto_sheet_${Date.now()}`,
    spreadsheetUrl: 'https://sheets.new',
    spreadsheetTitle: sheetTitle,
    lastSyncedAt:
      new Date().toLocaleDateString('vi-VN') +
      ' ' +
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    autoSync: true,
  };
  saveSheetsConfig(config);

  // 4. Open Google Sheets in new tab
  if (typeof window !== 'undefined') {
    window.open('https://sheets.new', '_blank');
  }

  return config;
}

// ==========================================
// 2. LINK-BASED GOOGLE SHEET HELPERS
// ==========================================

/**
 * Extracts Google Spreadsheet ID from any standard Google Sheets URL or raw ID
 */
export function extractSpreadsheetId(urlOrId: string): string | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  const clean = urlOrId.trim();

  // Pattern: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/...
  const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }

  // If it's a raw spreadsheet ID (usually 20-60 alphanumeric characters)
  if (/^[a-zA-Z0-9-_]{20,60}$/.test(clean)) {
    return clean;
  }

  // Webhook or script URL
  if (clean.includes('script.google.com/macros/s/')) {
    return 'apps_script_webhook';
  }

  // Generic fallback if valid URL
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return 'custom_link';
  }

  return null;
}

/**
 * Builds full Google Sheets URL from ID or returns valid URL
 */
export function formatSpreadsheetUrl(urlOrId: string): string {
  const clean = urlOrId.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  const id = extractSpreadsheetId(clean);
  if (id && id !== 'custom_link' && id !== 'apps_script_webhook') {
    return `https://docs.google.com/spreadsheets/d/${id}/edit`;
  }
  return clean;
}

/**
 * Save linked Google Sheet URL and configuration locally
 */
export function saveSheetsConfig(config: GoogleSheetsSyncConfig | null): void {
  try {
    if (config) {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    } else {
      localStorage.removeItem(STORAGE_KEY_CONFIG);
    }
  } catch (_) {}
}

/**
 * Get active saved Google Sheet configuration
 */
export function getSavedSheetsConfig(): GoogleSheetsSyncConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_) {}
  return null;
}

/**
 * Clear saved Google Sheet link
 */
export function clearSheetsConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_CONFIG);
  } catch (_) {}
}

/**
 * Connect a Google Sheet by URL or ID
 */
export function linkGoogleSheetByUrl(
  urlOrId: string,
  customTitle?: string
): GoogleSheetsSyncConfig {
  const sheetUrl = formatSpreadsheetUrl(urlOrId);
  const sheetId = extractSpreadsheetId(urlOrId) || 'sheet_' + Date.now();
  const title = customTitle || 'Bảng Phân Công Công Việc EcomPulse';

  const config: GoogleSheetsSyncConfig = {
    spreadsheetId: sheetId,
    spreadsheetUrl: sheetUrl,
    spreadsheetTitle: title,
    lastSyncedAt:
      new Date().toLocaleDateString('vi-VN') +
      ' ' +
      new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    autoSync: true,
  };

  saveSheetsConfig(config);
  return config;
}

// ==========================================
// 3. LIVE FETCH & PARSE TASKS FROM SHEET LINK
// ==========================================

/**
 * Fetches and parses live tasks from a Google Sheet link (CSV export)
 */
export async function fetchTasksFromGoogleSheet(
  urlOrId: string
): Promise<{ success: boolean; tasks: RoadmapActionItem[]; message: string }> {
  const sheetId = extractSpreadsheetId(urlOrId);
  if (!sheetId || sheetId === 'custom_link') {
    return { success: false, tasks: [], message: 'Không tìm thấy ID hợp lệ từ đường link Google Sheet.' };
  }

  // Extract GID if present in URL
  let gidParam = '';
  const gidMatch = urlOrId.match(/[#&?]gid=([0-9]+)/);
  if (gidMatch && gidMatch[1]) {
    gidParam = `&gid=${gidMatch[1]}`;
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;

  try {
    const res = await fetch(csvUrl);
    if (!res.ok) {
      if (res.status === 404 || res.status === 403 || res.status === 401) {
        throw new Error(
          'Google Sheet chưa được bật quyền xem công khai. Vui lòng vào Google Sheet -> Bấm "Chia sẻ" -> Chọn "Bất kỳ ai có đường liên kết" (Người xem) rồi thử lại!'
        );
      }
      throw new Error(`Không thể kết nối tải dữ liệu từ Google Sheet (Mã phản hồi: ${res.status}).`);
    }

    const csvText = await res.text();
    if (!csvText || csvText.trim().length === 0 || csvText.includes('<!DOCTYPE html>')) {
      throw new Error(
        'Google Sheet chưa được bật quyền công khai "Bất kỳ ai có liên kết". Vui lòng mở Google Sheet -> Bấm nút "Chia sẻ" ở góc phải -> Chọn "Bất kỳ ai có đường liên kết"!'
      );
    }

    // Parse CSV using XLSX
    const workbook = XLSX.read(csvText, { type: 'string' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!rows || rows.length < 2) {
      return { success: false, tasks: [], message: 'Trang tính Google Sheet trống hoặc không có đủ dòng dữ liệu.' };
    }

    // Find header row
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(6, rows.length); i++) {
      const rowStr = (rows[i] || []).join(' ').toLowerCase();
      if (
        rowStr.includes('hành động') ||
        rowStr.includes('công việc') ||
        rowStr.includes('task') ||
        rowStr.includes('action') ||
        rowStr.includes('đầu việc') ||
        rowStr.includes('stt')
      ) {
        headerRowIndex = i;
        break;
      }
    }

    const header = (rows[headerRowIndex] || []).map((h: any) => String(h || '').trim().toLowerCase());

    // Find column indexes
    const actionIdx = header.findIndex(
      (h) =>
        h.includes('hành động') ||
        h.includes('công việc') ||
        h.includes('action') ||
        h.includes('nhiệm vụ') ||
        h.includes('đầu việc') ||
        h.includes('task') ||
        h.includes('tiêu đề')
    );
    const timeframeIdx = header.findIndex(
      (h) => h.includes('giai đoạn') || h.includes('timeframe') || h.includes('thời gian') || h.includes('tuần')
    );
    const priorityIdx = header.findIndex(
      (h) => h.includes('ưu tiên') || h.includes('priority') || h.includes('mức độ')
    );
    const assigneeIdx = header.findIndex(
      (h) =>
        h.includes('phụ trách') ||
        h.includes('người') ||
        h.includes('phòng ban') ||
        h.includes('assignee') ||
        h.includes('department') ||
        h.includes('nhân viên')
    );
    const kpiIdx = header.findIndex(
      (h) => h.includes('kpi') || h.includes('mục tiêu') || h.includes('impact') || h.includes('kết quả')
    );
    const deadlineIdx = header.findIndex(
      (h) => h.includes('hạn') || h.includes('deadline') || h.includes('ngày hoàn thành')
    );
    const statusIdx = header.findIndex(
      (h) => h.includes('trạng thái') || h.includes('status') || h.includes('tiến độ')
    );

    const actualActionIdx = actionIdx !== -1 ? actionIdx : header.length > 4 ? 4 : 1;

    const parsedTasks: RoadmapActionItem[] = [];

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const actionText = String(row[actualActionIdx] || row[1] || row[0] || '').trim();
      if (!actionText || actionText.length < 3) continue;

      const priorityRaw = priorityIdx !== -1 ? String(row[priorityIdx] || '') : '';
      let category: 'high' | 'medium' | 'long' = 'high';
      if (
        priorityRaw.includes('P1') ||
        priorityRaw.includes('Trung') ||
        priorityRaw.includes('Vàng') ||
        priorityRaw.includes('Medium')
      ) {
        category = 'medium';
      } else if (
        priorityRaw.includes('P2') ||
        priorityRaw.includes('Dài') ||
        priorityRaw.includes('Xanh') ||
        priorityRaw.includes('Long')
      ) {
        category = 'long';
      }

      const statusRaw = statusIdx !== -1 ? String(row[statusIdx] || '').toLowerCase() : '';
      let status: 'pending' | 'in_progress' | 'completed' = 'pending';
      if (
        statusRaw.includes('hoàn thành') ||
        statusRaw.includes('done') ||
        statusRaw.includes('complete') ||
        statusRaw.includes('xong') ||
        statusRaw.includes('✅')
      ) {
        status = 'completed';
      } else if (
        statusRaw.includes('đang') ||
        statusRaw.includes('progress') ||
        statusRaw.includes('doing') ||
        statusRaw.includes('🔄')
      ) {
        status = 'in_progress';
      }

      parsedTasks.push({
        id: `sheet_task_${i}_${Date.now()}`,
        action: actionText,
        category,
        categoryLabel:
          category === 'high'
            ? 'Khẩn cấp (0-2 tuần)'
            : category === 'medium'
            ? 'Trung hạn (2-6 tuần)'
            : 'Dài hạn (1-3 tháng)',
        categoryBadge: category === 'high' ? 'P0' : category === 'medium' ? 'P1' : 'P2',
        timeframe:
          timeframeIdx !== -1 && row[timeframeIdx]
            ? String(row[timeframeIdx])
            : category === 'high'
            ? '0 - 2 Tuần'
            : category === 'medium'
            ? '2 - 6 Tuần'
            : '1 - 3 Tháng',
        assignee: assigneeIdx !== -1 && row[assigneeIdx] ? String(row[assigneeIdx]) : 'Đội Ngũ Vận Hành',
        targetKpi: kpiIdx !== -1 && row[kpiIdx] ? String(row[kpiIdx]) : 'Tối ưu hiệu quả doanh thu',
        deadline: deadlineIdx !== -1 && row[deadlineIdx] ? String(row[deadlineIdx]) : '',
        status,
        isCustom: true,
      });
    }

    if (parsedTasks.length === 0) {
      return { success: false, tasks: [], message: 'Không tìm thấy dòng công việc hợp lệ trong trang tính.' };
    }

    return {
      success: true,
      tasks: parsedTasks,
      message: `Đã đọc và cập nhật thành công ${parsedTasks.length} đầu việc từ Google Sheet vào hệ thống!`,
    };
  } catch (err: any) {
    return {
      success: false,
      tasks: [],
      message: err.message || 'Lỗi khi đọc dữ liệu từ Google Sheet.',
    };
  }
}

// ==========================================
// 4. PUSH TO GOOGLE APPS SCRIPT WEBHOOK
// ==========================================

export async function pushTasksToAppsScriptWebhook(
  webhookUrl: string,
  tasks: RoadmapActionItem[],
  cards: ActionCard[],
  storeName = 'Shop TMĐT'
): Promise<{ success: boolean; message: string }> {
  try {
    const payload = {
      action: 'sync_tasks',
      storeName,
      syncedAt: new Date().toISOString(),
      tasks: tasks.map((t, idx) => ({
        stt: idx + 1,
        timeframe: t.timeframe,
        priority: t.category === 'high' ? 'P0' : t.category === 'medium' ? 'P1' : 'P2',
        assignee: t.assignee || 'Đội Ngũ Vận Hành',
        action: t.action,
        targetKpi: t.targetKpi,
        deadline: t.deadline || '',
        status: t.status === 'completed' ? 'Hoàn thành' : t.status === 'in_progress' ? 'Đang làm' : 'Chờ xử lý',
      })),
      cards: cards.map((c) => ({
        id: c.id,
        urgency: c.urgency,
        title: c.title,
        estimatedImpact: c.estimatedImpact,
        assignee: c.assignee || '',
      })),
    };

    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      mode: 'no-cors',
    });

    return {
      success: true,
      message: 'Đã gửi lệnh cập nhật thành công tới Google Apps Script Webhook!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Không thể kết nối tới Google Apps Script Webhook.',
    };
  }
}

export const APPS_SCRIPT_TEMPLATE = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Phân Công EcomPulse") || ss.insertSheet("Phân Công EcomPulse");
    sheet.clear();
    
    // Header
    var header = ["STT", "Giai Đoạn", "Mức Ưu Tiên", "Phụ Trách", "Hành Động Chiến Lược", "Mục Tiêu KPI", "Hạn Chót", "Trạng Thái"];
    sheet.appendRow(header);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#10b981").setFontColor("#ffffff");
    
    // Tasks
    if (data.tasks && data.tasks.length > 0) {
      data.tasks.forEach(function(t) {
        sheet.appendRow([t.stt, t.timeframe, t.priority, t.assignee, t.action, t.targetKpi, t.deadline, t.status]);
      });
    }
    
    sheet.autoResizeColumns(1, header.length);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

// ==========================================
// 5. 1-CLICK CLIPBOARD DATA GENERATOR (Ctrl+V)
// ==========================================

export function generateRoadmapTsvData(tasks: RoadmapActionItem[]): string {
  const headers = [
    'STT',
    'Giai Đoạn',
    'Mức Độ Ưu Tiên',
    'Phòng Ban / Phụ Trách',
    'Hành Động Chiến Lược',
    'Mục Tiêu KPI Kỳ Vọng',
    'Hạn Chót (Deadline)',
    'Trạng Thái',
    'Ghi Chú Chi Tiết',
  ];

  const rows = tasks.map((t, idx) => {
    const priority =
      t.category === 'high' ? '🔴 Khẩn Cấp (P0)' : t.category === 'medium' ? '🟡 Trung Hạn (P1)' : '🟢 Dài Hạn (P2)';
    const status =
      t.status === 'completed'
        ? '✅ Đã Hoàn Thành'
        : t.status === 'in_progress'
        ? '🔄 Đang Thực Hiện'
        : '⏳ Chờ Xử Lý';
    const timeframe =
      t.timeframe || (t.category === 'high' ? '0 - 2 Tuần' : t.category === 'medium' ? '2 - 6 Tuần' : '1 - 3 Tháng');

    return [
      idx + 1,
      timeframe,
      priority,
      t.assignee || t.department || 'Đội Ngũ Vận Hành',
      t.action,
      t.targetKpi || t.targetGoal || 'Tối ưu dòng tiền',
      t.deadline || 'Chưa đặt',
      status,
      (t.details || []).join('; ') || t.notes || '',
    ];
  });

  return [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
}

export function generateActionCardsTsvData(cards: ActionCard[]): string {
  const headers = [
    'Mã Thẻ',
    'Mức Độ Khẩn Cấp',
    'Tên Đầu Việc Chiến Lược',
    'Mô Tả & Nguyên Nhân',
    'Ước Tính Doanh Thu Cứu Vãn',
    'Checklist Chi Tiết Cần Làm',
    'Người Phụ Trách',
  ];

  const rows = cards.map((c) => {
    const urgency =
      c.urgency === 'red' ? '🔴 KHẨN CẤP' : c.urgency === 'yellow' ? '🟡 QUAN TRỌNG' : '🟢 TỐI ƯU HÓA';
    const todosText = c.todos.map((t, idx) => `[${t.done ? 'x' : ' '}] ${idx + 1}. ${t.text}`).join('\n');

    return [
      c.id,
      urgency,
      c.title,
      c.description.replace(/\n/g, ' '),
      c.estimatedImpact,
      `"${todosText}"`,
      c.assignee || 'Trưởng Phòng Vận Hành',
    ];
  });

  return [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
}

// ==========================================
// 6. EXCEL EXPORT FOR GOOGLE SHEETS IMPORT
// ==========================================

export function downloadRoadmapExcelFile(
  tasks: RoadmapActionItem[],
  cards: ActionCard[],
  storeName = 'Shop'
): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Roadmap Tasks
  const roadmapData = [
    ['BẢNG PHÂN CÔNG LỘ TRÌNH HÀNH ĐỘNG DOANH NGHIỆP - ' + storeName.toUpperCase()],
    ['Ngày xuất: ' + new Date().toLocaleDateString('vi-VN')],
    [],
    [
      'STT',
      'Giai Đoạn',
      'Mức Ưu Tiên',
      'Phòng Ban / Phụ Trách',
      'Hành Động Chiến Lược',
      'Mục Tiêu KPI',
      'Hạn Chót',
      'Trạng Thái',
      'Chi Tiết',
    ],
    ...tasks.map((t, idx) => [
      idx + 1,
      t.timeframe ||
        (t.category === 'high' ? '0 - 2 Tuần' : t.category === 'medium' ? '2 - 6 Tuần' : '1 - 3 Tháng'),
      t.category === 'high' ? 'P0 (Khẩn Cấp)' : t.category === 'medium' ? 'P1 (Trung Hạn)' : 'P2 (Dài Hạn)',
      t.assignee || t.department || 'Đội Ngũ Vận Hành',
      t.action,
      t.targetKpi || t.targetGoal || 'Tối ưu dòng tiền',
      t.deadline || 'Chưa đặt',
      t.status === 'completed' ? 'Đã hoàn thành' : t.status === 'in_progress' ? 'Đang thực hiện' : 'Chờ xử lý',
      (t.details || []).join('; ') || t.notes || '',
    ]),
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(roadmapData);
  XLSX.utils.book_append_sheet(wb, ws1, 'Lo_Trinh_Hanh_Dong');

  // Sheet 2: Action Cards
  const cardsData = [
    ['DANH SÁCH THẺ HÀNH ĐỘNG ƯU TIÊN & CHECKLIST - ' + storeName.toUpperCase()],
    ['Ngày xuất: ' + new Date().toLocaleDateString('vi-VN')],
    [],
    ['Mã Thẻ', 'Mức Khẩn Cấp', 'Tên Đầu Việc', 'Mô Tả & Dẫn Chứng', 'Ước Tính Doanh Thu Cứu Vãn', 'Người Phụ Trách'],
    ...cards.map((c) => [
      c.id,
      c.urgency === 'red' ? 'ĐỎ (Khẩn Cấp)' : c.urgency === 'yellow' ? 'VÀNG (Quan Trọng)' : 'XANH (Tối Ưu)',
      c.title,
      c.description,
      c.estimatedImpact,
      c.assignee || 'Trưởng Phòng Vận Hành',
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(cardsData);
  XLSX.utils.book_append_sheet(wb, ws2, 'The_Hanh_Dong');

  XLSX.writeFile(wb, `EcomPulse_PhanCong_GoogleSheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ==========================================
// 7. LOCAL ON-PREMISE USER SESSION HELPERS
// ==========================================

export function getSavedGoogleUser(): GoogleUserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (_) {}

  const defaultUser: GoogleUserProfile = {
    id: 'local_onpremise_user',
    email: 'seller@local.workspace',
    name: 'Nhà Bán Hàng On-Premise',
    picture: '',
    loginMethod: 'demo',
  };
  return defaultUser;
}

export function saveGoogleUser(user: GoogleUserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } catch (_) {}
}

export function clearGoogleSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_CONFIG);
  } catch (_) {}
}

export function loginAsDemoUser(
  email = 'seller.onpremise@local.workspace',
  name = 'Nhà Bán Hàng EcomPulse'
): GoogleUserProfile {
  const demoUser: GoogleUserProfile = {
    id: 'user_onprem_' + Date.now(),
    email,
    name,
    picture: '',
    loginMethod: 'demo',
  };
  saveGoogleUser(demoUser);
  return demoUser;
}
