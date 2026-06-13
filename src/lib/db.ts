import {
  type Branch,
  type Coach,
  type Course,
  type CourseDraft,
  type Student,
  type SyncRecord,
  type User,
} from '../types';
import { generateId } from './utils';

const DB_NAME = 'blue_whale_swim';
const DB_VERSION = 1;

interface DBStores {
  branches: Branch;
  users: User;
  coaches: Coach;
  students: Student;
  courses: Course;
  drafts: CourseDraft & { savedAt: string };
  syncRecords: SyncRecord;
  currentUser: { userId: string };
}

type StoreName = keyof DBStores;

class Database {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('branches')) {
          db.createObjectStore('branches', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('users')) {
          db.createObjectStore('users', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('coaches')) {
          db.createObjectStore('coaches', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('students')) {
          db.createObjectStore('students', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('courses')) {
          const store = db.createObjectStore('courses', { keyPath: 'id' });
          store.createIndex('by_date', 'date');
          store.createIndex('by_branch', 'branchId');
          store.createIndex('by_coach', 'coachId');
        }
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('syncRecords')) {
          db.createObjectStore('syncRecords', { keyPath: 'timestamp' });
        }
        if (!db.objectStoreNames.contains('currentUser')) {
          db.createObjectStore('currentUser', { keyPath: 'userId' });
        }
      };
    });

    return this.initPromise;
  }

  private async getStore<T extends StoreName>(
    storeName: T,
    mode: IDBTransactionMode = 'readonly'
  ): Promise<IDBObjectStore> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  async getAll<T extends StoreName>(storeName: T): Promise<DBStores[T][]> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as DBStores[T][]);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T extends StoreName>(
    storeName: T,
    key: string
  ): Promise<DBStores[T] | undefined> {
    const store = await this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result as DBStores[T] | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  async put<T extends StoreName>(storeName: T, value: DBStores[T]): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async delete<T extends StoreName>(storeName: T, key: string): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear<T extends StoreName>(storeName: T): Promise<void> {
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveDraft(draft: CourseDraft): Promise<void> {
    const draftsStore = await this.getStore('drafts', 'readwrite');
    const draftWithMeta = {
      ...draft,
      id: draft.id || generateId(),
      savedAt: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
      const request = draftsStore.put(draftWithMeta);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDrafts(): Promise<(CourseDraft & { savedAt: string })[]> {
    return this.getAll('drafts');
  }

  async deleteDraft(id: string): Promise<void> {
    return this.delete('drafts', id);
  }

  async clearDrafts(): Promise<void> {
    return this.clear('drafts');
  }

  async addSyncRecord(record: Omit<SyncRecord, 'timestamp' | 'synced'>): Promise<void> {
    const store = await this.getStore('syncRecords', 'readwrite');
    const fullRecord: SyncRecord = {
      ...record,
      timestamp: new Date().toISOString(),
      synced: false,
    };
    return new Promise((resolve, reject) => {
      const request = store.put(fullRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingSyncRecords(): Promise<SyncRecord[]> {
    const all = await this.getAll('syncRecords');
    return all.filter((r) => !r.synced);
  }

  async markSyncRecordSynced(timestamp: string): Promise<void> {
    const record = await this.get('syncRecords', timestamp);
    if (record) {
      (record as SyncRecord).synced = true;
      await this.put('syncRecords', record as DBStores['syncRecords']);
    }
  }
}

export const db = new Database();
