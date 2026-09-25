/**
 * EcomPulse On-Premise Local Database Service
 * 
 * 100% Local-First & Client-Side Isolated Storage
 * - Uses IndexedDB with automatic LocalStorage fallback
 * - Customer store data NEVER leaves the local device/browser
 * - Zero data sent to developer cloud or remote database
 */

export interface SavedReportDoc {
  id?: string;
  userId: string;
  fileName: string;
  platform: string;
  kpis: any;
  executiveSummary?: string;
  actionCards?: any[];
  savedAt: string;
}

export interface RoadmapTaskDoc {
  id?: string;
  userId: string;
  title: string;
  timeframe: string;
  category: string;
  priority: string;
  assignee: string;
  deadline: string;
  status: 'pending' | 'in_progress' | 'completed';
  expectedImpact: string;
  createdAt: string;
}

const DB_NAME = 'EcomPulse_OnPremise_DB';
const DB_VERSION = 1;
const STORES = {
  DATASETS: 'datasets',
  TASKS: 'tasks',
  CHATS: 'chats',
  PROFILES: 'profiles',
  SETTINGS: 'settings',
};

// Open or initialize IndexedDB instance
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORES.DATASETS)) {
        const datasetStore = db.createObjectStore(STORES.DATASETS, { keyPath: 'id' });
        datasetStore.createIndex('userId', 'userId', { unique: false });
        datasetStore.createIndex('savedAt', 'savedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.TASKS)) {
        const taskStore = db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
        taskStore.createIndex('userId', 'userId', { unique: false });
        taskStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.CHATS)) {
        const chatStore = db.createObjectStore(STORES.CHATS, { keyPath: 'id' });
        chatStore.createIndex('userId', 'userId', { unique: false });
        chatStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.PROFILES)) {
        db.createObjectStore(STORES.PROFILES, { keyPath: 'userId' });
      }
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// 1. DATASET REPORTS STORAGE (LOCAL-FIRST)
// ==========================================

export async function saveDatasetToLocal(
  userId: string,
  report: Omit<SavedReportDoc, 'userId' | 'savedAt'>
): Promise<string> {
  const id = report.id || `dataset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: SavedReportDoc = {
    ...report,
    id,
    userId,
    savedAt: new Date().toISOString(),
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.DATASETS, 'readwrite');
      const store = tx.objectStore(STORES.DATASETS);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Fallback to LocalStorage
    try {
      const localKey = `ecompulse_dataset_${userId}_${id}`;
      localStorage.setItem(localKey, JSON.stringify(record));
      
      // Update index list in LocalStorage
      const indexKey = `ecompulse_dataset_index_${userId}`;
      const existing = JSON.parse(localStorage.getItem(indexKey) || '[]');
      if (!existing.includes(id)) {
        existing.unshift(id);
        localStorage.setItem(indexKey, JSON.stringify(existing.slice(0, 30)));
      }
    } catch (_) {}
  }

  return id;
}

export async function loadUserSavedDatasetsFromLocal(userId: string): Promise<SavedReportDoc[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.DATASETS, 'readonly');
      const store = tx.objectStore(STORES.DATASETS);
      const index = store.index('userId');
      const req = index.getAll(userId);

      req.onsuccess = () => {
        const results: SavedReportDoc[] = (req.result || []).sort(
          (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
        );
        resolve(results);
      };
      req.onerror = () => resolve(loadDatasetsFromLocalStorage(userId));
    });
  } catch {
    return loadDatasetsFromLocalStorage(userId);
  }
}

function loadDatasetsFromLocalStorage(userId: string): SavedReportDoc[] {
  try {
    const indexKey = `ecompulse_dataset_index_${userId}`;
    const ids: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');
    const results: SavedReportDoc[] = [];
    for (const id of ids) {
      const raw = localStorage.getItem(`ecompulse_dataset_${userId}_${id}`);
      if (raw) {
        results.push(JSON.parse(raw));
      }
    }
    return results;
  } catch {
    return [];
  }
}

export async function deleteUserDatasetFromLocal(userId: string, id: string): Promise<boolean> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.DATASETS, 'readwrite');
      const store = tx.objectStore(STORES.DATASETS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (_) {}

  try {
    localStorage.removeItem(`ecompulse_dataset_${userId}_${id}`);
    const indexKey = `ecompulse_dataset_index_${userId}`;
    const ids: string[] = JSON.parse(localStorage.getItem(indexKey) || '[]');
    const updated = ids.filter((i) => i !== id);
    localStorage.setItem(indexKey, JSON.stringify(updated));
  } catch (_) {}

  return true;
}

// ==========================================
// 2. ROADMAP TASKS STORAGE (LOCAL-FIRST)
// ==========================================

export async function saveRoadmapTasksToLocal(
  userId: string,
  tasks: Array<Omit<RoadmapTaskDoc, 'userId' | 'createdAt'>>
): Promise<boolean> {
  const timestamp = new Date().toISOString();
  const records: RoadmapTaskDoc[] = tasks.map((t) => ({
    ...t,
    id: t.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    createdAt: timestamp,
  }));

  try {
    const db = await openDatabase();
    const tx = db.transaction(STORES.TASKS, 'readwrite');
    const store = tx.objectStore(STORES.TASKS);
    for (const rec of records) {
      store.put(rec);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch (err) {
    try {
      const key = `ecompulse_roadmap_tasks_${userId}`;
      const existing: RoadmapTaskDoc[] = JSON.parse(localStorage.getItem(key) || '[]');
      const combined = [...records, ...existing];
      localStorage.setItem(key, JSON.stringify(combined));
      return true;
    } catch (_) {
      return false;
    }
  }
}

export async function loadUserRoadmapTasksFromLocal(userId: string): Promise<RoadmapTaskDoc[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.TASKS, 'readonly');
      const store = tx.objectStore(STORES.TASKS);
      const index = store.index('userId');
      const req = index.getAll(userId);

      req.onsuccess = () => {
        const results: RoadmapTaskDoc[] = (req.result || []).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        resolve(results);
      };
      req.onerror = () => resolve(loadTasksFromLocalStorage(userId));
    });
  } catch {
    return loadTasksFromLocalStorage(userId);
  }
}

function loadTasksFromLocalStorage(userId: string): RoadmapTaskDoc[] {
  try {
    const key = `ecompulse_roadmap_tasks_${userId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

// ==========================================
// 3. AI CHAT HISTORY STORAGE (LOCAL-FIRST)
// ==========================================

export interface LocalChatMessage {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export async function saveChatMessageToLocal(
  userId: string,
  message: { role: 'user' | 'assistant'; content: string }
): Promise<boolean> {
  const id = `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const record: LocalChatMessage = {
    ...message,
    id,
    userId,
    timestamp: new Date().toISOString(),
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.CHATS, 'readwrite');
      const store = tx.objectStore(STORES.CHATS);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    return true;
  } catch {
    try {
      const key = `ecompulse_chat_history_${userId}`;
      const existing: LocalChatMessage[] = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push(record);
      localStorage.setItem(key, JSON.stringify(existing.slice(-100)));
      return true;
    } catch {
      return false;
    }
  }
}

export async function loadUserChatHistoryFromLocal(userId: string): Promise<LocalChatMessage[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.CHATS, 'readonly');
      const store = tx.objectStore(STORES.CHATS);
      const index = store.index('userId');
      const req = index.getAll(userId);

      req.onsuccess = () => {
        const results: LocalChatMessage[] = (req.result || []).sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        resolve(results.slice(-50));
      };
      req.onerror = () => resolve(loadChatsFromLocalStorage(userId));
    });
  } catch {
    return loadChatsFromLocalStorage(userId);
  }
}

function loadChatsFromLocalStorage(userId: string): LocalChatMessage[] {
  try {
    const key = `ecompulse_chat_history_${userId}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch {
    return [];
  }
}

// ==========================================
// 4. USER PROFILE & SETTINGS (LOCAL-FIRST)
// ==========================================

export async function syncUserProfileToLocal(
  userId: string,
  profile: { email: string; displayName?: string; photoURL?: string }
): Promise<boolean> {
  const record = {
    userId,
    ...profile,
    updatedAt: new Date().toISOString(),
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.PROFILES, 'readwrite');
      const store = tx.objectStore(STORES.PROFILES);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (_) {}

  try {
    localStorage.setItem(`ecompulse_profile_${userId}`, JSON.stringify(record));
  } catch (_) {}

  return true;
}

// ==========================================
// 5. ON-PREMISE DATA EXPORT, IMPORT & WIPE
// ==========================================

export interface OnPremiseBackupBundle {
  version: string;
  exportedAt: string;
  userId: string;
  datasets: SavedReportDoc[];
  tasks: RoadmapTaskDoc[];
  chats: LocalChatMessage[];
  system: {
    storageType: string;
    isolationLevel: string;
  };
}

/**
 * Export all client-side data for the user as a JSON backup file
 */
export async function exportOnPremiseBackup(userId: string): Promise<Blob> {
  const datasets = await loadUserSavedDatasetsFromLocal(userId);
  const tasks = await loadUserRoadmapTasksFromLocal(userId);
  const chats = await loadUserChatHistoryFromLocal(userId);

  const bundle: OnPremiseBackupBundle = {
    version: '2.0-onpremise',
    exportedAt: new Date().toISOString(),
    userId,
    datasets,
    tasks,
    chats,
    system: {
      storageType: 'Local IndexedDB & LocalStorage',
      isolationLevel: '100% Client-Side Isolated (Zero-Knowledge)',
    },
  };

  const jsonStr = JSON.stringify(bundle, null, 2);
  return new Blob([jsonStr], { type: 'application/json' });
}

/**
 * Import and restore an On-Premise backup JSON file
 */
export async function importOnPremiseBackup(
  userId: string,
  jsonString: string
): Promise<{ success: boolean; message: string; count: number }> {
  try {
    const bundle: OnPremiseBackupBundle = JSON.parse(jsonString);
    if (!bundle.datasets && !bundle.tasks && !bundle.chats) {
      return { success: false, message: 'File sao lưu không đúng định dạng EcomPulse.', count: 0 };
    }

    let count = 0;

    // Restore datasets
    if (Array.isArray(bundle.datasets)) {
      for (const d of bundle.datasets) {
        await saveDatasetToLocal(userId, d);
        count++;
      }
    }

    // Restore tasks
    if (Array.isArray(bundle.tasks)) {
      await saveRoadmapTasksToLocal(userId, bundle.tasks);
      count += bundle.tasks.length;
    }

    // Restore chats
    if (Array.isArray(bundle.chats)) {
      for (const c of bundle.chats) {
        await saveChatMessageToLocal(userId, { role: c.role, content: c.content });
        count++;
      }
    }

    return {
      success: true,
      message: `Đã phục hồi thành công ${count} mục dữ liệu vào máy trạm của bạn.`,
      count,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Lỗi khi đọc file sao lưu.',
      count: 0,
    };
  }
}

/**
 * Completely wipe all local EcomPulse data from this browser (Zero-Trace)
 */
export async function wipeAllLocalData(): Promise<boolean> {
  try {
    // Delete IndexedDB
    if (typeof window !== 'undefined' && window.indexedDB) {
      window.indexedDB.deleteDatabase(DB_NAME);
      // Seller/Analyst workspace (order-level data and cost settings)
      window.indexedDB.deleteDatabase('EcomPulse_Workspace_DB');
    }
  } catch (_) {}

  try {
    // Clear all EcomPulse related items from LocalStorage
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith('ecompulse_') ||
          key.startsWith('google_user_') ||
          key.startsWith('custom_gemini_api_key'))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    return true;
  } catch {
    return false;
  }
}
