// Google Sheets & Drive API Integration for EcomPulse Action Center & Roadmap
import { ActionCard, RoadmapActionItem, ParsedStoreData, GoogleSheetsSyncConfig, GoogleUserProfile } from '../types';

declare global {
  interface Window {
    google?: any;
  }
}

const SCOPES = 'openid email profile https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file';
const STORAGE_KEY_TOKEN = 'ecompulse_google_access_token';
const STORAGE_KEY_CONFIG = 'ecompulse_sheets_config';
const STORAGE_KEY_USER = 'ecompulse_google_user';

// Fetch OAuth Client ID from server or local override
export async function getGoogleClientId(): Promise<string> {
  try {
    const localClientId = localStorage.getItem('ecompulse_custom_client_id');
    if (localClientId && localClientId.trim().length > 10) {
      return localClientId.trim();
    }
    const res = await fetch('/api/auth/google/client-id');
    const data = await res.json();
    return data.clientId || '';
  } catch (err) {
    console.error('Error fetching Google Client ID:', err);
    return '';
  }
}

export function saveCustomClientId(clientId: string) {
  try {
    if (clientId && clientId.trim()) {
      localStorage.setItem('ecompulse_custom_client_id', clientId.trim());
    } else {
      localStorage.removeItem('ecompulse_custom_client_id');
    }
  } catch (e) {}
}

export function getCustomClientId(): string {
  try {
    return localStorage.getItem('ecompulse_custom_client_id') || '';
  } catch (e) {
    return '';
  }
}

// Request Access Token using Google Identity Services (GSI)
export function requestGoogleAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      reject(
        new Error(
          'Google Identity Services (GSI) chưa được tải hoàn tất. Vui lòng tải lại trang sau vài giây!'
        )
      );
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            saveAccessToken(response.access_token);
            resolve(response.access_token);
          } else {
            reject(new Error('Không nhận được Access Token từ Google.'));
          }
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

// Fetch user profile from Google UserInfo endpoint
export async function fetchGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Lỗi tải thông tin Google User (${res.status})`);
    }

    const data = await res.json();
    const user: GoogleUserProfile = {
      sub: data.sub,
      id: data.sub,
      email: data.email,
      name: data.name || data.email.split('@')[0],
      picture: data.picture,
      verified_email: data.email_verified,
      loginMethod: 'google',
      loggedInAt: new Date().toISOString(),
    };

    saveGoogleUser(user);
    return user;
  } catch (err) {
    console.error('Error fetching Google User Profile:', err);
    // Fallback minimal profile
    const fallbackUser: GoogleUserProfile = {
      email: 'user@google.com',
      name: 'Google User',
      loginMethod: 'google',
      loggedInAt: new Date().toISOString(),
    };
    saveGoogleUser(fallbackUser);
    return fallbackUser;
  }
}

// Full Login with Google flow
export async function loginWithGoogle(customClientId?: string): Promise<{ token: string; user: GoogleUserProfile }> {
  let clientId = customClientId || (await getGoogleClientId());
  if (!clientId || !clientId.trim()) {
    throw new Error('Chưa cấu hình Google Client ID. Vui lòng nhập Client ID của bạn hoặc sử dụng chế độ Demo.');
  }

  const token = await requestGoogleAccessToken(clientId);
  const user = await fetchGoogleUserProfile(token);
  return { token, user };
}

// Demo Login for rapid testing
export function loginAsDemoUser(email = 'seller.demo@ecompulse.vn', name = 'EcomPulse Store Manager'): GoogleUserProfile {
  const demoUser: GoogleUserProfile = {
    id: 'demo-user-12345',
    email,
    name,
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    verified_email: true,
    loginMethod: 'demo',
    loggedInAt: new Date().toISOString(),
  };
  saveGoogleUser(demoUser);
  return demoUser;
}

// Save & Retrieve Access Token
export function saveAccessToken(token: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
  } catch (e) {}
}

export function getSavedAccessToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY_TOKEN);
  } catch (e) {
    return null;
  }
}

export function saveGoogleUser(user: GoogleUserProfile) {
  try {
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } catch (e) {}
}

export function getSavedGoogleUser(): GoogleUserProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearGoogleSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_CONFIG);
    localStorage.removeItem(STORAGE_KEY_USER);
  } catch (e) {}
}

// Save & Retrieve Google Sheets Configuration
export function saveSheetsConfig(config: GoogleSheetsSyncConfig) {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (e) {}
}

export function getSavedSheetsConfig(): GoogleSheetsSyncConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}


// Format numbers for Google Sheets
const formatVNDText = (num: number = 0) =>
  new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' ₫';

/**
 * Creates a formatted Google Spreadsheet with Action Plan, Business Roadmap & Store Summary
 */
export async function createActionPlanSpreadsheet(
  token: string,
  storeData: ParsedStoreData,
  actionCards?: ActionCard[],
  roadmapItems?: RoadmapActionItem[]
): Promise<GoogleSheetsSyncConfig> {
  const currentDateStr = new Date().toLocaleDateString('vi-VN');
  const storeName = storeData.fileName.replace(/\.(xlsx|xls|csv)$/i, '');
  const title = `EcomPulse - Kế Hoạch & Lộ Trình Hành Động [${storeName}] - ${currentDateStr}`;

  // 1. Create Spreadsheet with 3 Sheets
  const createResp = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
        locale: 'vi_VN',
      },
      sheets: [
        {
          properties: {
            sheetId: 0,
            title: '🚀 Lộ Trình Hành Động Doanh Nghiệp',
            gridProperties: {
              frozenRowCount: 1,
              rowCount: 100,
              columnCount: 11,
            },
          },
        },
        {
          properties: {
            sheetId: 1,
            title: '🎯 Trung Tâm Hành Động Ưu Tiên',
            gridProperties: {
              frozenRowCount: 1,
              rowCount: 100,
              columnCount: 10,
            },
          },
        },
        {
          properties: {
            sheetId: 2,
            title: '📊 Tóm Tắt & Chỉ Số Shop',
            gridProperties: {
              frozenRowCount: 1,
              rowCount: 50,
              columnCount: 6,
            },
          },
        },
      ],
    }),
  });

  if (!createResp.ok) {
    const errJson = await createResp.json();
    throw new Error(errJson.error?.message || 'Không thể tạo Google Spreadsheet.');
  }

  const sheetData = await createResp.json();
  const spreadsheetId = sheetData.spreadsheetId;
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Populate Data into all sheets
  await populateAllSheetsData(token, spreadsheetId, storeData, actionCards, roadmapItems);

  // 3. Format and Style the Spreadsheet
  await formatSpreadsheet(token, spreadsheetId);

  const config: GoogleSheetsSyncConfig = {
    spreadsheetId,
    spreadsheetUrl,
    spreadsheetTitle: title,
    lastSyncedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    autoSync: true,
  };

  saveSheetsConfig(config);
  return config;
}

/**
 * Builds the rows for all data categories and syncs them to Google Sheets
 */
export async function populateAllSheetsData(
  token: string,
  spreadsheetId: string,
  storeData: ParsedStoreData,
  actionCards?: ActionCard[],
  roadmapItems?: RoadmapActionItem[]
) {
  // --- SHEET 1: 🚀 Lộ Trình Hành Động Doanh Nghiệp (Roadmap) ---
  if (roadmapItems && roadmapItems.length > 0) {
    const roadmapHeaders = [
      'STT',
      'Khung Thời Gian',
      'Cấp Độ Ưu Tiên',
      'Bộ Phận Phụ Trách',
      'Người Phụ Trách (Assignee)',
      'Hạn Chót (Deadline)',
      'Hành Động / Giải Pháp Đề Xuất',
      'Chỉ Số KPI Theo Dõi',
      'Hiện Trạng Thực Tế (Baseline)',
      'Mục Tiêu Đạt Được (Target)',
      'Các Bước Thực Hiện Chi Tiết',
      'Trạng Thái',
      'Cập Nhật Gần Nhất',
    ];

    const roadmapRows = roadmapItems.map((item, idx) => {
      const priorityLabel =
        item.category === 'high'
          ? '🔴 Ưu Tiên Cao (0-2 Tuần)'
          : item.category === 'medium'
          ? '🟡 Ưu Tiên Trung Bình (2-6 Tuần)'
          : '🟢 Ưu Tiên Dài Hạn (1-3 Tháng)';

      const statusLabel =
        item.status === 'completed'
          ? '✅ ĐÃ HOÀN THÀNH'
          : item.status === 'in_progress'
          ? '⏳ ĐANG THỰC HIỆN'
          : '📋 CẦN LÀM';

      const detailsText = (item.details || []).map((d, i) => `${i + 1}. ${d}`).join('\n');

      return [
        `RM-${String(idx + 1).padStart(2, '0')}`,
        item.timeframe,
        priorityLabel,
        item.department || 'Ban Quản Lý & Vận Hành',
        item.assignee || 'Chưa phân công',
        item.deadline || 'Trong tuần này',
        item.action,
        item.targetKpi,
        item.currentBaseline || 'Chưa ghi nhận',
        item.targetGoal || 'Theo mục tiêu quý',
        detailsText,
        statusLabel,
        item.updatedAt || new Date().toLocaleString('vi-VN'),
      ];
    });

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'🚀 Lộ Trình Hành Động Doanh Nghiệp'!A1:M${roadmapRows.length + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: "'🚀 Lộ Trình Hành Động Doanh Nghiệp'!A1:M" + (roadmapRows.length + 1),
          values: [roadmapHeaders, ...roadmapRows],
        }),
      }
    );
  }

  // --- SHEET 2: 🎯 Trung Tâm Hành Động Ưu Tiên (Action Center) ---
  if (actionCards && actionCards.length > 0) {
    const actionHeaders = [
      'Mã ID',
      'Mức Độ Ưu Tiên',
      'Mục Tiêu / Tiêu Đề',
      'Tác Động Doanh Thu Ước Tính',
      'Việc Cần Làm (To-Do Checklist)',
      'Trạng Thái',
      'Người Phụ Trách (Assignee)',
      'Ghi Chú Tiến Độ',
      'Cập Nhật Gần Nhất',
    ];

    const actionRows: any[][] = [];

    actionCards.forEach((card, idx) => {
      const priorityLabel =
        card.urgency === 'red'
          ? '🔴 Khẩn Cấp (Cứu Doanh Thu)'
          : card.urgency === 'yellow'
          ? '🟡 Cơ Hội (Tăng Trưởng)'
          : '🟢 Tiềm Năng (Tăng AOV)';

      const totalTodos = card.todos.length;
      const doneTodos = card.todos.filter((t) => t.done).length;
      const cardStatus =
        totalTodos === 0
          ? 'Chưa Bắt Đầu'
          : doneTodos === totalTodos
          ? '✅ ĐÃ HOÀN THÀNH'
          : doneTodos > 0
          ? `⏳ Đang thực hiện (${doneTodos}/${totalTodos})`
          : '📋 Chưa thực hiện';

      actionRows.push([
        `ACT-${String(idx + 1).padStart(2, '0')}`,
        priorityLabel,
        `[TỔNG QUAN] ${card.title}`,
        card.estimatedImpact,
        `${card.description} (Gồm ${totalTodos} đầu việc chi tiết bên dưới)`,
        cardStatus,
        card.assignee || 'Toàn bộ Team Bán Hàng',
        card.notes || 'Cần ưu tiên xử lý trong tuần này',
        card.updatedAt || new Date().toLocaleString('vi-VN'),
      ]);

      card.todos.forEach((todo, tIdx) => {
        const todoStatus = todo.done ? '✅ ĐÃ XONG' : '⏳ CHƯA XONG';
        actionRows.push([
          `ACT-${String(idx + 1).padStart(2, '0')}.${tIdx + 1}`,
          priorityLabel,
          `  ↳ ${card.title}`,
          card.estimatedImpact,
          `[${todo.done ? 'X' : ' '}] ${todo.text}`,
          todoStatus,
          todo.assignee || card.assignee || 'Chưa phân công',
          todo.done ? 'Đã hoàn tất kiểm tra' : 'Đang xử lý',
          todo.completedAt || new Date().toLocaleString('vi-VN'),
        ]);
      });
    });

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'🎯 Trung Tâm Hành Động Ưu Tiên'!A1:I${actionRows.length + 1}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: "'🎯 Trung Tâm Hành Động Ưu Tiên'!A1:I" + (actionRows.length + 1),
          values: [actionHeaders, ...actionRows],
        }),
      }
    );
  }

  // --- SHEET 3: 📊 Tóm Tắt & Chỉ Số Shop ---
  const kpiHeaders = ['Chỉ Số Hiệu Suất Shop', 'Giá Trị Thực Tế', 'Mô Tả & Ghi Chú Đánh Giá'];
  const kpis = storeData.kpis;
  const funnel = storeData.funnel;

  const kpiRows = [
    ['Doanh Thu Thực Nhận (Paid Revenue)', formatVNDText(kpis.paidRevenue), `${kpis.paidOrders} đơn hàng thanh toán thành công`],
    ['Doanh Thu Đặt Hàng (Placed Revenue)', formatVNDText(kpis.placedRevenue), `${kpis.placedOrders} đơn đặt ban đầu`],
    ['Giá Trị Trung Bình Đơn (AOV)', formatVNDText(kpis.aov), 'Mức chi tiêu bình quân/đơn thực nhận'],
    ['Tỷ Lệ Hoàn Tất Đơn (Conversion)', `${kpis.conversionRate.toFixed(1)}%`, 'Tỷ lệ đơn thanh toán thành công trên tổng đơn đặt'],
    ['Rò Rỉ Dòng Tiền (Leakage Amount)', formatVNDText(funnel.totalLeakageVND), `Thất thoát ${(100 - funnel.placedToPaidRate).toFixed(1)}% do huỷ/không nhận hàng`],
    ['Hiệu Quả Quảng Cáo (Blended ROAS)', `${(kpis.blendedRoas || 8.5).toFixed(1)}x`, `Chi phí ads ước tính ~${formatVNDText(kpis.adSpend || (kpis.paidRevenue / 8.5))}`],
    ['Sản Phẩm Chủ Lực (Class A Share)', `${(storeData.abcSummary.classAShare || 80).toFixed(1)}%`, 'Tỷ trọng đóng góp doanh thu nhóm sản phẩm ngôi sao'],
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'📊 Tóm Tắt & Chỉ Số Shop'!A1:C${kpiRows.length + 1}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: "'📊 Tóm Tắt & Chỉ Số Shop'!A1:C" + (kpiRows.length + 1),
        values: [kpiHeaders, ...kpiRows],
      }),
    }
  );
}

// Backward compatibility helper
export async function populateActionCardsData(
  token: string,
  spreadsheetId: string,
  actionCards: ActionCard[],
  storeData: ParsedStoreData,
  roadmapItems?: RoadmapActionItem[]
) {
  return populateAllSheetsData(token, spreadsheetId, storeData, actionCards, roadmapItems);
}

/**
 * Applies professional formatting, header colors, borders, and column widths
 */
async function formatSpreadsheet(token: string, spreadsheetId: string) {
  try {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          // 1. Header style for Sheet 0 (Indigo / Violet)
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 11,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.18, green: 0.15, blue: 0.38 },
                  textFormat: {
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    fontSize: 11,
                    bold: true,
                  },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  wrapStrategy: 'WRAP',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
            },
          },
          // 2. Header style for Sheet 1 (Navy Blue)
          {
            repeatCell: {
              range: {
                sheetId: 1,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 9,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.12, green: 0.18, blue: 0.35 },
                  textFormat: {
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    fontSize: 11,
                    bold: true,
                  },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                  wrapStrategy: 'WRAP',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
            },
          },
          // 3. Header style for Sheet 2 (Emerald Green)
          {
            repeatCell: {
              range: {
                sheetId: 2,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: 3,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.05, green: 0.35, blue: 0.25 },
                  textFormat: {
                    foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                    fontSize: 11,
                    bold: true,
                  },
                  horizontalAlignment: 'CENTER',
                  verticalAlignment: 'MIDDLE',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
            },
          },
          // 4. Auto-resize or set comfortable column widths on Sheet 0
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
              properties: { pixelSize: 80 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
              properties: { pixelSize: 180 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
              properties: { pixelSize: 200 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 },
              properties: { pixelSize: 180 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 4, endIndex: 5 },
              properties: { pixelSize: 340 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 5, endIndex: 6 },
              properties: { pixelSize: 220 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 6, endIndex: 7 },
              properties: { pixelSize: 220 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 },
              properties: { pixelSize: 220 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 8, endIndex: 9 },
              properties: { pixelSize: 340 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 9, endIndex: 10 },
              properties: { pixelSize: 160 },
              fields: 'pixelSize',
            },
          },
          {
            updateDimensionProperties: {
              range: { sheetId: 0, dimension: 'COLUMNS', startIndex: 10, endIndex: 11 },
              properties: { pixelSize: 180 },
              fields: 'pixelSize',
            },
          },
        ],
      }),
    });
  } catch (err) {
    console.warn('Formatting spreadsheet warning:', err);
  }
}

