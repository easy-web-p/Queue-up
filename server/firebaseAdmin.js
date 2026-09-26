import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read applet config for projectId and firestoreDatabaseId
const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
let projectConfig = { projectId: 'queueup-65e82' };

if (fs.existsSync(configPath)) {
  try {
    projectConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    console.warn('[FirebaseAdmin] Failed to parse config, using fallback projectId:', err);
  }
}

const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const hasServiceAccountFile = serviceAccountPath && fs.existsSync(serviceAccountPath);
const isCloudRun = Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB || process.env.GAE_ENV);
const useLiveAdmin = hasServiceAccountFile || isCloudRun;

let adminApp = null;
let adminDb = null;
let adminAuth = null;
let adminMessaging = null;

if (useLiveAdmin) {
  try {
    if (!getApps().length) {
      if (hasServiceAccountFile) {
        const sa = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        adminApp = initializeApp({
          credential: cert(sa),
          projectId: projectConfig.projectId
        });
        console.log('[FirebaseAdmin] Initialized with Service Account Credentials.');
      } else {
        // Cloud Run automatically populates Application Default Credentials (ADC)
        adminApp = initializeApp({
          projectId: projectConfig.projectId
        });
        console.log(`[FirebaseAdmin] Initialized with Cloud Run ADC for ${projectConfig.projectId}`);
      }
    } else {
      adminApp = getApps()[0];
    }

    const databaseId = projectConfig.firestoreDatabaseId && projectConfig.firestoreDatabaseId !== '(default)'
      ? projectConfig.firestoreDatabaseId
      : undefined;

    adminDb = databaseId ? getFirestore(adminApp, databaseId) : getFirestore(adminApp);
    adminAuth = getAuth(adminApp);
    adminMessaging = getMessaging(adminApp);
  } catch (err) {
    console.warn('[FirebaseAdmin] Failed to initialize live Firebase Admin, falling back to local store:', err.message);
  }
}

// -------------------------------------------------------------
// Local Development In-Memory / File-Persisted Fallback Store
// -------------------------------------------------------------
if (!adminDb) {
  console.log('[FirebaseAdmin] Local development mode active: using persistent file-backed Firestore store.');

  const localDbFile = path.resolve(__dirname, '../.local_db.json');
  let memoryStore = {};

  const loadFromDisk = () => {
    if (fs.existsSync(localDbFile)) {
      try {
        memoryStore = JSON.parse(fs.readFileSync(localDbFile, 'utf8'));
      } catch {
        memoryStore = {};
      }
    }
  };

  const saveToDisk = () => {
    try {
      fs.writeFileSync(localDbFile, JSON.stringify(memoryStore, null, 2), 'utf8');
    } catch (e) {
      console.warn('[FirebaseAdmin] Warning: could not write local DB to disk:', e.message);
    }
  };

  loadFromDisk();

  function applyFields(target, source) {
    const updated = { ...target };
    for (const [key, val] of Object.entries(source)) {
      if (val && typeof val === 'object' && val.constructor?.name === 'NumericIncrementTransform') {
        const delta = val.operand ?? val._operand ?? 1;
        updated[key] = (Number(updated[key]) || 0) + Number(delta);
      } else {
        updated[key] = val;
      }
    }
    return updated;
  }

  class MockDocRef {
    constructor(collectionPath, id) {
      this.collectionPath = collectionPath;
      this.id = id;
    }

    get fullKey() {
      return `${this.collectionPath}/${this.id}`;
    }

    async get() {
      loadFromDisk();
      let data = memoryStore[this.fullKey];

      // Auto-provision default store if reading stores collection
      if (!data && this.collectionPath === 'stores') {
        data = {
          id: this.id,
          name: 'QueueUp Express Kitchen',
          isOpen: true,
          currentQueueCount: 0,
          contactChannels: { line: '@queueup', tel: '081-234-5678' }
        };
        memoryStore[this.fullKey] = data;
        saveToDisk();
      }

      return {
        exists: !!data,
        id: this.id,
        data: () => (data ? { ...data } : undefined)
      };
    }

    async set(newData, options = {}) {
      loadFromDisk();
      const existing = memoryStore[this.fullKey] || {};
      if (options.merge) {
        memoryStore[this.fullKey] = applyFields(existing, newData);
      } else {
        memoryStore[this.fullKey] = applyFields({}, newData);
      }
      saveToDisk();
    }

    async update(fields) {
      loadFromDisk();
      const existing = memoryStore[this.fullKey];
      if (!existing) {
        throw new Error(`NOT_FOUND: Document ${this.fullKey} does not exist to update.`);
      }
      memoryStore[this.fullKey] = applyFields(existing, fields);
      saveToDisk();
    }

    async delete() {
      loadFromDisk();
      delete memoryStore[this.fullKey];
      saveToDisk();
    }

    collection(subCollectionName) {
      return new MockCollection(`${this.fullKey}/${subCollectionName}`);
    }
  }

  class MockQuery {
    constructor(collectionName, filters = [], limitCount = null, orderByField = null, orderDirection = 'asc') {
      this.collectionName = collectionName;
      this.filters = filters;
      this.limitCount = limitCount;
      this.orderByField = orderByField;
      this.orderDirection = orderDirection;
    }

    where(field, op, val) {
      return new MockQuery(this.collectionName, [...this.filters, { field, op, val }], this.limitCount, this.orderByField, this.orderDirection);
    }

    orderBy(field, direction = 'asc') {
      return new MockQuery(this.collectionName, this.filters, this.limitCount, field, direction);
    }

    limit(n) {
      return new MockQuery(this.collectionName, this.filters, n, this.orderByField, this.orderDirection);
    }

    async get() {
      loadFromDisk();
      const prefix = `${this.collectionName}/`;
      let docs = Object.keys(memoryStore)
        .filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
        .map((k) => {
          const docId = k.slice(prefix.length);
          const data = memoryStore[k];
          return {
            id: docId,
            ref: new MockDocRef(this.collectionName, docId),
            exists: true,
            data: () => ({ ...data })
          };
        });

      // Apply filters
      for (const filter of this.filters) {
        docs = docs.filter(d => {
          const val = d.data()[filter.field];
          if (filter.op === '==') return val === filter.val;
          if (filter.op === '!=') return val !== filter.val;
          if (filter.op === '>') return val > filter.val;
          if (filter.op === '>=') return val >= filter.val;
          if (filter.op === '<') return val < filter.val;
          if (filter.op === '<=') return val <= filter.val;
          if (filter.op === 'in') return Array.isArray(filter.val) && filter.val.includes(val);
          return true;
        });
      }

      if (this.orderByField) {
        docs.sort((a, b) => {
          const valA = a.data()[this.orderByField];
          const valB = b.data()[this.orderByField];
          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          const cmp = valA > valB ? 1 : -1;
          return this.orderDirection === 'desc' ? -cmp : cmp;
        });
      }

      if (this.limitCount !== null) {
        docs = docs.slice(0, this.limitCount);
      }

      return {
        docs,
        empty: docs.length === 0,
        size: docs.length,
        forEach: (fn) => docs.forEach(fn)
      };
    }
  }

  class MockCollection {
    constructor(name) {
      this.name = name;
    }

    doc(id) {
      const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      return new MockDocRef(this.name, docId);
    }

    where(field, op, val) {
      return new MockQuery(this.name, [{ field, op, val }]);
    }

    orderBy(field, direction = 'asc') {
      return new MockQuery(this.name).orderBy(field, direction);
    }

    limit(n) {
      return new MockQuery(this.name, [], n);
    }

    async add(data) {
      const docRef = this.doc();
      await docRef.set(data);
      return docRef;
    }

    async get() {
      return new MockQuery(this.name).get();
    }
  }

  let localTransactionLock = Promise.resolve();

  adminDb = {
    collection: (name) => new MockCollection(name),
    batch: () => {
      const operations = [];
      return {
        set: (ref, data, opts) => operations.push(() => ref.set(data, opts)),
        update: (ref, fields) => operations.push(() => ref.update(fields)),
        delete: (ref) => operations.push(async () => {
          loadFromDisk();
          delete memoryStore[ref.fullKey];
          saveToDisk();
        }),
        commit: async () => {
          for (const op of operations) {
            await op();
          }
        }
      };
    },
    runTransaction: async (updateFunction) => {
      // Serialize transactions in local mock to emulate Firestore atomic isolation
      const execute = async () => {
        loadFromDisk();
        const transaction = {
          get: async (ref) => ref.get(),
          set: async (ref, data, opts) => ref.set(data, opts),
          update: async (ref, fields) => ref.update(fields)
        };
        const result = await updateFunction(transaction);
        saveToDisk();
        return result;
      };

      const nextPromise = localTransactionLock.then(execute, execute);
      localTransactionLock = nextPromise.catch(() => {});
      return nextPromise;
    }
  };

  adminAuth = {
    verifyIdToken: async (token) => {
      // Decode JWT payload for local simulation
      try {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          return {
            uid: payload.user_id || payload.sub || 'local-user',
            email: payload.email || 'customer@queueup.app',
            name: payload.name || 'คุณลูกค้า',
            role: payload.role || 'customer'
          };
        }
      } catch {
        // ignore parse error
      }
      return {
        uid: 'local-user',
        email: 'customer@queueup.app',
        name: 'คุณลูกค้า',
        role: 'customer'
      };
    }
  };

  if (!adminMessaging) {
    adminMessaging = {
      send: async (msg) => {
        console.log('[FirebaseAdmin Mock Messaging] Sent message:', msg.token ? msg.token.slice(0, 10) + '...' : msg);
        return 'projects/' + projectConfig.projectId + '/messages/mock-' + Date.now();
      },
      sendEachForMulticast: async (msg) => {
        console.log(`[FirebaseAdmin Mock Messaging] Multicast to ${msg.tokens?.length || 0} devices.`);
        return {
          successCount: msg.tokens?.length || 0,
          failureCount: 0,
          responses: (msg.tokens || []).map(() => ({ success: true, messageId: 'mock-' + Date.now() }))
        };
      }
    };
  }
}

export { adminDb, adminAuth, adminApp, adminMessaging };
