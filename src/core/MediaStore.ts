const DB_NAME = 'projmapper-media';
const STORE = 'media';

export interface MediaRecord {
  id: string;
  name: string;
  type: string;
  blob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function db(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = openDB();
  return dbPromise;
}

export const MediaStore = {
  async save(id: string, name: string, type: string, blob: Blob): Promise<void> {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ id, name, type, blob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(id: string): Promise<MediaRecord | undefined> {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result as MediaRecord | undefined);
      req.onerror = () => reject(req.error);
    });
  },

  async has(id: string): Promise<boolean> {
    return !!(await this.get(id));
  },

  async keys(): Promise<string[]> {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  },

  async remove(id: string): Promise<void> {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};
