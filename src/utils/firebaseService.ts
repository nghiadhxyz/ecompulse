import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, orderBy, limit, deleteDoc, updateDoc } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import configJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: configJson.apiKey,
  authDomain: configJson.authDomain,
  projectId: configJson.projectId,
  storageBucket: configJson.storageBucket,
  messagingSenderId: configJson.messagingSenderId,
  appId: configJson.appId,
  measurementId: configJson.measurementId,
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app, configJson.firestoreDatabaseId || undefined);
export const auth = getAuth(app);

// Helper to ensure Firebase Auth session
async function ensureAuth() {
  try {
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
  } catch (e) {
    // Silent catch
  }
}

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

// 1. User Profile Operations
export async function syncUserProfileToFirebase(userId: string, profile: { email: string; displayName?: string; photoURL?: string }) {
  try {
    await ensureAuth();
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      ...profile,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (err) {
    return false;
  }
}

// 2. Save Full Dataset Report to Firestore
export async function saveDatasetToFirestore(userId: string, report: Omit<SavedReportDoc, 'userId' | 'savedAt'>): Promise<string | null> {
  try {
    await ensureAuth();
    const colRef = collection(db, 'users', userId, 'datasets');
    const docRef = await addDoc(colRef, {
      ...report,
      userId,
      savedAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (err) {
    // Save to local storage as seamless fallback
    try {
      const localKey = `ecompulse_dataset_${userId}`;
      localStorage.setItem(localKey, JSON.stringify({ ...report, userId, savedAt: new Date().toISOString() }));
    } catch (_) {}
    return null;
  }
}

// 3. Load Saved Reports for User
export async function loadUserSavedDatasets(userId: string): Promise<SavedReportDoc[]> {
  try {
    await ensureAuth();
    const colRef = collection(db, 'users', userId, 'datasets');
    const q = query(colRef, orderBy('savedAt', 'desc'), limit(20));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as SavedReportDoc));
  } catch (err) {
    return [];
  }
}

// 4. Roadmap Task Management in Firestore
export async function saveRoadmapTasksToFirestore(userId: string, tasks: Array<Omit<RoadmapTaskDoc, 'userId' | 'createdAt'>>) {
  try {
    await ensureAuth();
    const colRef = collection(db, 'users', userId, 'tasks');
    for (const task of tasks) {
      await addDoc(colRef, {
        ...task,
        userId,
        createdAt: new Date().toISOString(),
      });
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function loadUserRoadmapTasks(userId: string): Promise<RoadmapTaskDoc[]> {
  try {
    await ensureAuth();
    const colRef = collection(db, 'users', userId, 'tasks');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data(),
    } as RoadmapTaskDoc));
  } catch (err) {
    return [];
  }
}

// 5. Chat History in Firestore
export async function saveChatMessageToFirestore(userId: string, message: { role: 'user' | 'assistant'; content: string }) {
  try {
    await ensureAuth();
    const colRef = collection(db, 'users', userId, 'chatHistory');
    await addDoc(colRef, {
      ...message,
      userId,
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    return false;
  }
}

export async function loadUserChatHistory(userId: string): Promise<Array<{ id: string; role: 'user' | 'assistant'; content: string; timestamp: string }>> {
  try {
    await ensureAuth();
    const colRef = collection(db, 'users', userId, 'chatHistory');
    const q = query(colRef, orderBy('timestamp', 'asc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
    } as any));
  } catch (err) {
    return [];
  }
}
