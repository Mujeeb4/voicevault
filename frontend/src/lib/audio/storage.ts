/**
 * IndexedDB storage for recording drafts
 */
const DB_NAME = 'voicevault-recordings';
const LEGACY_STORE_NAME = 'recordings';
const DRAFT_STORE_NAME = 'recordingDrafts';
const KEY_STORE_NAME = 'draftKeys';
const DB_VERSION = 2;
let hasRequestedPersistentStorage = false;

export interface StoredRecording {
  userId: string;
  questionId: string;
  questionNumber: number;
  blob: Blob;
  duration: number;
  timestamp: string;
}

interface EncryptedStoredRecording {
  schemaVersion?: number;
  id: string;
  userId: string;
  questionId: string;
  questionNumber: number;
  encryptedAudio: ArrayBuffer;
  iv: ArrayBuffer;
  mimeType: string;
  duration: number;
  timestamp: string;
  audioSha256Hex?: string;
}

type LegacyStoredRecording = Omit<StoredRecording, 'userId'>;

interface DraftKeyRecord {
  userId: string;
  key: CryptoKey;
  createdAt: string;
}

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        req.result.createObjectStore(LEGACY_STORE_NAME, { keyPath: 'questionId' });
      }
      if (!req.result.objectStoreNames.contains(DRAFT_STORE_NAME)) {
        const draftStore = req.result.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'id' });
        draftStore.createIndex('userId', 'userId', { unique: false });
      }
      if (!req.result.objectStoreNames.contains(KEY_STORE_NAME)) {
        req.result.createObjectStore(KEY_STORE_NAME, { keyPath: 'userId' });
      }
    };
  });
}

function draftId(userId: string, questionId: string): string {
  return `${userId}:${questionId}`;
}

function getCrypto(): Crypto {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('Secure browser storage is not available in this browser');
  }
  return crypto;
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  return bufferToHex(await getCrypto().subtle.digest('SHA-256', buffer));
}

function authenticatedMetadata(recording: Omit<EncryptedStoredRecording, 'encryptedAudio' | 'iv'>): ArrayBuffer {
  const encoded = new TextEncoder().encode(JSON.stringify({
    schemaVersion: recording.schemaVersion ?? 2,
    id: recording.id,
    userId: recording.userId,
    questionId: recording.questionId,
    questionNumber: recording.questionNumber,
    mimeType: recording.mimeType,
    duration: recording.duration,
    timestamp: recording.timestamp,
    audioSha256Hex: recording.audioSha256Hex ?? '',
  }));
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
}

async function requestPersistentStorage(): Promise<void> {
  if (hasRequestedPersistentStorage || typeof navigator === 'undefined' || !navigator.storage?.persist) {
    return;
  }

  hasRequestedPersistentStorage = true;
  try {
    await navigator.storage.persist();
  } catch {
    // Best effort only; encrypted IndexedDB drafts still work without persistent storage.
  }
}

async function getStoredKey(db: IDBDatabase, userId: string): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readonly');
    const req = tx.objectStore(KEY_STORE_NAME).get(userId);
    tx.oncomplete = () => resolve((req.result as DraftKeyRecord | undefined)?.key ?? null);
    tx.onerror = () => reject(tx.error);
  });
}

async function saveStoredKey(db: IDBDatabase, userId: string, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KEY_STORE_NAME, 'readwrite');
    tx.objectStore(KEY_STORE_NAME).put({
      userId,
      key,
      createdAt: new Date().toISOString(),
    } satisfies DraftKeyRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getOrCreateDraftKey(db: IDBDatabase, userId: string): Promise<CryptoKey> {
  const storedKey = await getStoredKey(db, userId);
  if (storedKey) return storedKey;

  const key = await getCrypto().subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  await saveStoredKey(db, userId, key);
  return key;
}

async function encryptRecording(db: IDBDatabase, rec: StoredRecording): Promise<EncryptedStoredRecording> {
  const browserCrypto = getCrypto();
  const key = await getOrCreateDraftKey(db, rec.userId);
  const audioBuffer = await rec.blob.arrayBuffer();
  const mimeType = rec.blob.type || 'audio/webm';
  const recordingWithoutAudio = {
    schemaVersion: 2,
    id: draftId(rec.userId, rec.questionId),
    userId: rec.userId,
    questionId: rec.questionId,
    questionNumber: rec.questionNumber,
    mimeType,
    duration: rec.duration,
    timestamp: rec.timestamp,
    audioSha256Hex: await sha256Hex(audioBuffer),
  };
  const iv = browserCrypto.getRandomValues(new Uint8Array(12));
  const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const encryptedAudio = await browserCrypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBuffer,
      additionalData: authenticatedMetadata(recordingWithoutAudio),
      tagLength: 128,
    },
    key,
    audioBuffer
  );

  return {
    ...recordingWithoutAudio,
    encryptedAudio,
    iv: ivBuffer,
  };
}

async function decryptRecording(db: IDBDatabase, encrypted: EncryptedStoredRecording): Promise<StoredRecording> {
  const key = await getOrCreateDraftKey(db, encrypted.userId);
  const algorithm = encrypted.schemaVersion === 2 && encrypted.audioSha256Hex
    ? {
        name: 'AES-GCM',
        iv: encrypted.iv,
        additionalData: authenticatedMetadata({
          schemaVersion: encrypted.schemaVersion,
          id: encrypted.id,
          userId: encrypted.userId,
          questionId: encrypted.questionId,
          questionNumber: encrypted.questionNumber,
          mimeType: encrypted.mimeType,
          duration: encrypted.duration,
          timestamp: encrypted.timestamp,
          audioSha256Hex: encrypted.audioSha256Hex,
        }),
        tagLength: 128,
      }
    : { name: 'AES-GCM', iv: encrypted.iv };
  const audioBuffer = await getCrypto().subtle.decrypt(
    algorithm,
    key,
    encrypted.encryptedAudio
  );

  if (encrypted.audioSha256Hex && await sha256Hex(audioBuffer) !== encrypted.audioSha256Hex) {
    throw new Error('Stored recording failed integrity validation');
  }

  return {
    userId: encrypted.userId,
    questionId: encrypted.questionId,
    questionNumber: encrypted.questionNumber,
    blob: new Blob([audioBuffer], { type: encrypted.mimeType }),
    duration: encrypted.duration,
    timestamp: encrypted.timestamp,
  };
}

export async function saveRecording(rec: StoredRecording): Promise<void> {
  await requestPersistentStorage();
  const db = await getDB();
  const stored = await encryptRecording(db, rec);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
    tx.objectStore(DRAFT_STORE_NAME).put(stored);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getRecording(userId: string, questionId: string): Promise<StoredRecording | null> {
  const db = await getDB();
  const encrypted = await new Promise<EncryptedStoredRecording | null>((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
    const req = tx.objectStore(DRAFT_STORE_NAME).get(draftId(userId, questionId));
    tx.oncomplete = () => resolve(req.result ?? null);
    tx.onerror = () => reject(tx.error);
  });

  return encrypted ? decryptRecording(db, encrypted) : null;
}

async function getLegacyRecordings(db: IDBDatabase): Promise<LegacyStoredRecording[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEGACY_STORE_NAME, 'readonly');
    const req = tx.objectStore(LEGACY_STORE_NAME).getAll();
    tx.oncomplete = () => resolve(req.result ?? []);
    tx.onerror = () => reject(tx.error);
  });
}

async function clearLegacyRecordings(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LEGACY_STORE_NAME, 'readwrite');
    tx.objectStore(LEGACY_STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function migrateLegacyRecordings(userId: string, db: IDBDatabase): Promise<void> {
  const legacyRecordings = await getLegacyRecordings(db);
  if (legacyRecordings.length === 0) return;

  await Promise.all(
    legacyRecordings.map((recording) => saveRecording({ ...recording, userId }))
  );
  await clearLegacyRecordings(db);
}

export async function getAllRecordings(userId: string): Promise<StoredRecording[]> {
  const db = await getDB();
  const encryptedRecordings = await new Promise<EncryptedStoredRecording[]>((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
    const req = tx.objectStore(DRAFT_STORE_NAME).index('userId').getAll(userId);
    tx.oncomplete = () => resolve(req.result ?? []);
    tx.onerror = () => reject(tx.error);
  });

  if (encryptedRecordings.length === 0) {
    await migrateLegacyRecordings(userId, db);
    const migratedRecordings = await new Promise<EncryptedStoredRecording[]>((resolve, reject) => {
      const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
      const req = tx.objectStore(DRAFT_STORE_NAME).index('userId').getAll(userId);
      tx.oncomplete = () => resolve(req.result ?? []);
      tx.onerror = () => reject(tx.error);
    });
    const decryptedMigratedRecordings = await Promise.all(
      migratedRecordings.map((recording) => decryptRecording(db, recording))
    );
    return decryptedMigratedRecordings.sort((a, b) => a.questionNumber - b.questionNumber);
  }

  const recordings = await Promise.all(encryptedRecordings.map((recording) => decryptRecording(db, recording)));
  return recordings.sort((a, b) => a.questionNumber - b.questionNumber);
}

export async function deleteRecording(userId: string, questionId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
    tx.objectStore(DRAFT_STORE_NAME).delete(draftId(userId, questionId));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllRecordings(userId: string): Promise<void> {
  const db = await getDB();
  const encryptedRecordings = await new Promise<EncryptedStoredRecording[]>((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE_NAME, 'readonly');
    const req = tx.objectStore(DRAFT_STORE_NAME).index('userId').getAll(userId);
    tx.oncomplete = () => resolve(req.result ?? []);
    tx.onerror = () => reject(tx.error);
  });

  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(DRAFT_STORE_NAME);
    encryptedRecordings.forEach((recording) => store.delete(recording.id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
