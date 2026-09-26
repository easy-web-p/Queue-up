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

const isProduction = process.env.NODE_ENV === 'production';
const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const hasServiceAccountFile = Boolean(serviceAccountPath) && fs.existsSync(serviceAccountPath);
const isCloudRun = Boolean(process.env.K_SERVICE || process.env.CLOUD_RUN_JOB || process.env.GAE_ENV);

// Serverless platforms have no writable path to drop a key file on, so the
// service account arrives as an environment variable instead. Accepts raw JSON
// or base64, since dashboards differ on whether they preserve newlines.
function readServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!raw || !raw.trim()) return null;

  const text = raw.trim().startsWith('{')
    ? raw.trim()
    : Buffer.from(raw.trim(), 'base64').toString('utf8');

  try {
    const parsed = JSON.parse(text);
    if (!parsed.project_id || !parsed.private_key || !parsed.client_email) {
      throw new Error('missing project_id, private_key or client_email');
    }
    // Dashboards that store the value as a single line turn newlines into \n.
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (err) {
    throw new Error(
      `[FirebaseAdmin] FIREBASE_SERVICE_ACCOUNT is set but could not be parsed: ${err.message}`
    );
  }
}

const serviceAccountFromEnv = readServiceAccountFromEnv();

// Vercel and similar platforms set no ADC of their own, so a deployment there
// without a service account has no path to Firestore at all.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const useLiveAdmin = Boolean(serviceAccountFromEnv) || hasServiceAccountFile || isCloudRun;

let adminApp = null;
let adminDb = null;
let adminAuth = null;
let adminMessaging = null;

if (useLiveAdmin) {
  try {
    if (!getApps().length) {
      if (serviceAccountFromEnv) {
        adminApp = initializeApp({
          credential: cert(serviceAccountFromEnv),
          projectId: serviceAccountFromEnv.project_id || projectConfig.projectId
        });
        console.log('[FirebaseAdmin] Initialized from FIREBASE_SERVICE_ACCOUNT.');
      } else if (hasServiceAccountFile) {
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
    if (isProduction) {
      throw new Error(
        `[FirebaseAdmin] Failed to initialize Firebase Admin in production: ${err.message}. ` +
        'Refusing to start on the local file-backed store — orders and payments would be lost.'
      );
    }
    console.warn('[FirebaseAdmin] Failed to initialize live Firebase Admin, falling back to local store:', err.message);
  }
}

// A production deployment that reaches this point has no credentials at all
// (no GOOGLE_APPLICATION_CREDENTIALS and no Cloud Run ADC). Silently degrading
// to .local_db.json would accept orders and payments onto ephemeral disk.
if (!adminDb && (isProduction || isServerless)) {
  throw new Error(
    '[FirebaseAdmin] No Firebase Admin credentials available. Set ' +
    'FIREBASE_SERVICE_ACCOUNT to the service account JSON (or base64 of it), ' +
    'or GOOGLE_APPLICATION_CREDENTIALS to a key file, or run on a platform ' +
    'that provides Application Default Credentials. Refusing to start on the ' +
    'local file-backed store — orders and payments would be lost.'
  );
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

  // Local stand-in for the Auth service. Custom claims are persisted in the
  // same file-backed store so a development session (and the test suites) can
  // read back what the claims endpoints wrote.
  const localClaims = () => {
    memoryStore.__auth_claims = memoryStore.__auth_claims || {};
    return memoryStore.__auth_claims;
  };

  adminAuth = {
    setCustomUserClaims: async (uid, claims) => {
      localClaims()[uid] = { ...(claims || {}) };
      saveToDisk();
    },
    getUser: async (uid) => ({
      uid,
      email: `${uid}@queueup.local`,
      emailVerified: true,
      customClaims: localClaims()[uid] || {}
    }),
    getUserByEmail: async (email) => {
      const uid = Object.keys(localClaims()).find(
        (key) => localClaims()[key]?.email === email
      ) || `local-${Buffer.from(email).toString('hex').slice(0, 12)}`;
      return { uid, email, emailVerified: true, customClaims: localClaims()[uid] || {} };
    },
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
