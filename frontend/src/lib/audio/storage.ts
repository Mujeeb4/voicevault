/**
 * IndexedDB storage for recording drafts
 */
const DB_NAME = 'voicevault-recordings';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

export interface StoredRecording {
  questionId: string;
  questionNumber: number;
  blob: Blob;
  duration: number;
  timestamp: string;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'questionId' });
    };
  });
}

export async function saveRecording(rec: StoredRecording): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getRecording(questionId: string): Promise<StoredRecording | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(questionId);
    tx.oncomplete = () => resolve(req.result ?? null);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllRecordings(): Promise<StoredRecording[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    tx.oncomplete = () => resolve(req.result ?? []);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteRecording(questionId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(questionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllRecordings(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
