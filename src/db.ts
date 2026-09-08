/**
 * IndexedDB persistence.
 *
 * Stores the whole `State` object under a single key. IndexedDB rather than
 * localStorage because the payload is structured and writes happen off the
 * critical path; the service worker no longer reads it.
 *
 * Development uses a separate database, reset once per dev-server run, so
 * testing can never touch real data.
 *
 * `DB_VERSION` is bumped only to DISCARD stored records rather than migrate
 * them. `hydrate` in state.ts handles every shape worth carrying forward, so a
 * bump here is a deliberate decision to start over: the versionchange
 * transaction clears the store, `readState` then returns undefined, and the
 * bootstrap seeds a fresh roadmap at the current schema.
 */

/** Development gets its own database so testing can never touch real data. */
export const DB_NAME = import.meta.env.DEV ? "northstar-dev" : "northstar";
export const DB_VERSION = 2;
export const STORE_NAME = "kv";
export const STATE_KEY = "state";
const RUN_KEY = "dev-run";

let handle: Promise<IDBDatabase> | null = null;

function openRaw(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
        return;
      }
      // The store already exists, so this device holds records written under an
      // earlier DB_VERSION. Discard them; see the note above.
      request.transaction?.objectStore(STORE_NAME).clear();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexedDB.open failed"));
    request.onblocked = () => reject(new Error("indexedDB.open blocked"));
  });
}

/**
 * Start each dev-server run from an empty store. The run id is constant across
 * reloads and HMR within one run, so only an actual server restart wipes.
 * A cleared store makes `readState` return undefined, which the bootstrap
 * already handles by seeding and persisting a fresh roadmap.
 */
function reconcileDevRun(db: IDBDatabase): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const existing = store.get(RUN_KEY);
    existing.onsuccess = () => {
      if (existing.result !== __DEV_RUN__) {
        store.clear();
        store.put(__DEV_RUN__, RUN_KEY);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("dev run reset aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("dev run reset failed"));
  });
}

function openDb(): Promise<IDBDatabase> {
  handle ??= (async () => {
    const db = await openRaw();
    if (import.meta.env.DEV) await reconcileDevRun(db);
    return db;
  })();
  return handle;
}

export async function readState(): Promise<unknown> {
  const db = await openDb();
  return new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("read failed"));
  });
}

export async function writeState(value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("write aborted"));
    tx.onerror = () => reject(tx.error ?? new Error("write failed"));
  });
}
