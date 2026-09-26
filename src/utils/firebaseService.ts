/**
 * Firebase Service Adapter -> On-Premise Local First Storage
 * 
 * IMPORTANT: To guarantee 100% On-Premise Data Isolation (Dữ liệu không rời máy trạm/trình duyệt),
 * all operations have been redirected to the client-side LocalDatabaseService (IndexedDB + LocalStorage).
 * No customer financial, order, or task data is uploaded to remote Firestore.
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

import {
  saveDatasetToLocal,
  loadUserSavedDatasetsFromLocal,
  deleteUserDatasetFromLocal,
  saveRoadmapTasksToLocal,
  loadUserRoadmapTasksFromLocal,
  saveChatMessageToLocal,
  loadUserChatHistoryFromLocal,
  syncUserProfileToLocal,
} from './localDatabaseService';

// 1. User Profile Operations (Local-First)
export async function syncUserProfileToFirebase(userId: string, profile: { email: string; displayName?: string; photoURL?: string }) {
  return syncUserProfileToLocal(userId, profile);
}

// 2. Save Dataset Report to Local-First Storage
export async function saveDatasetToFirestore(userId: string, report: Omit<SavedReportDoc, 'userId' | 'savedAt'>): Promise<string | null> {
  try {
    const id = await saveDatasetToLocal(userId, report);
    return id;
  } catch {
    return null;
  }
}

// 3. Load Saved Reports from Local-First Storage
export async function loadUserSavedDatasets(userId: string): Promise<SavedReportDoc[]> {
  return loadUserSavedDatasetsFromLocal(userId);
}

// 4. Roadmap Task Management in Local-First Storage
export async function saveRoadmapTasksToFirestore(userId: string, tasks: Array<Omit<RoadmapTaskDoc, 'userId' | 'createdAt'>>) {
  return saveRoadmapTasksToLocal(userId, tasks);
}

export async function loadUserRoadmapTasks(userId: string): Promise<RoadmapTaskDoc[]> {
  return loadUserRoadmapTasksFromLocal(userId);
}

// 5. Chat History in Local-First Storage
export async function saveChatMessageToFirestore(userId: string, message: { role: 'user' | 'assistant'; content: string }) {
  return saveChatMessageToLocal(userId, message);
}

export async function loadUserChatHistory(userId: string): Promise<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>> {
  return loadUserChatHistoryFromLocal(userId);
}
