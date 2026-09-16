/* IQ Pokyd - src/web/cache.ts - keeping the inflected dictionary between visits.

   Phase 4.4 of PLAN.md, and 3.4 is why it is not an optimization.  A first visit
   spends 15 s inflecting 11,207 base words into 402,252 forms; a visit that finds
   the result already made spends 0.11 s reading it.  4.2 moved that quarter-minute
   off the main thread so the tab stays alive through it, which is a different
   problem from not spending it twice.  This file is the second half: the 18 MB
   SLOVNIK.TMP goes into IndexedDB when it is made and comes back out on every
   visit after.

   The whole of it is policy, which is why it is here and not in src/web/client.ts
   -- that file talks to the worker and decides nothing.  Three decisions live in
   this one.

   1.  What the blob is keyed by, because nothing inside it says.  pokyd_api.h
       spells the hazard out at pokyd_export_cache: the engine checksums
       SLOVNIK.TMP and rejects a corrupt one, but it cannot tell a *wrong* one
       from a right one -- feed it a cache inflected from a different dictionary
       and it will load it, believe it, and answer out of it.  So the caller owns
       that check, and the key is a hash of the dictionary the engine actually
       holds, read back out of MEMFS rather than assumed.  See POKYD_CACHE_VERSION
       for the half of the identity a dictionary hash cannot cover.

   2.  That a storage failure is never a load failure.  Private windows, a full
       origin quota, a browser that refuses the database outright -- every one of
       them ends with IQ Pokyd loading the slow way and saying exactly the same
       things.  Nothing in here throws into the caller's load; failures come back
       in the report, as a field, for a page that wants to mention it.

   3.  That one blob is kept, not a collection.  18 MB is a lot to leave behind
       for a dictionary nobody will ask for again, so a successful save prunes
       every other key -- see pruneExcept.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import type { PokydClient, PokydStartOptions } from "./client.ts";

/* ----------------------------------------------------------------- the hash */

/* FNV-1a, 64 bits, over the bytes of SLOVNIK.IQP.

   Not SHA-256, and the reason is not speed -- 90 KB either way is nothing.  It is
   that crypto.subtle exists only in a secure context, so a build served over
   plain HTTP off somebody's LAN would lose its cache and never say why, and that
   this is not an adversarial problem: the question is whether two dictionary
   files are the same file, and the only files that will ever be asked about are
   the ones this project ships.  A 64-bit hash answers that.  It is also
   synchronous and identical in node and in the browser, which is what lets
   test/web/cache.test.ts check it against the file on disk without a browser.

   The multiply is exact.  The prime 0x100000001b3 is 2^40 + 0x1b3, so the 64-bit
   product splits into a shift of the low 24 bits and two products that both stay
   under 2^42 -- inside what a double represents exactly, so no step of this
   rounds.  Checked against Python's own computation on the empty string, "a",
   "hello world" and original/slovnik.iqp. */
export function fnv1a64(bytes: Uint8Array): string {
  let hi = 0xcbf29ce4;
  let lo = 0x84222325;
  for (let i = 0; i < bytes.length; i++) {
    lo = (lo ^ bytes[i]) >>> 0;
    /* h *= 2^40 + 0x1b3, modulo 2^64. */
    const product = lo * 0x1b3;                       /* < 2^41, exact */
    const newLo = product >>> 0;                     /* ToUint32 is mod 2^32 */
    const carry = Math.floor(product / 0x100000000);
    /* hi*0x1b3 < 2^41 and (lo & 0xffffff)*0x100 < 2^32, so the sum is exact. */
    hi = (hi * 0x1b3 + carry + (lo & 0xffffff) * 0x100) >>> 0;
    lo = newLo;
  }
  return hi.toString(16).padStart(8, "0") + lo.toString(16).padStart(8, "0");
}

/* ------------------------------------------------------------------ the key */

/* The half of the blob's identity that a dictionary hash cannot see.

   SLOVNIK.TMP is not a copy of SLOVNIK.IQP, it is what the engine made out of it:
   402,252 inflected forms produced by SKLONOV.FU, obfuscated and checksummed by
   SLOVNIK.FU:1855-1861, with rand() padding from src/shim/nahoda.h in it.  Change
   the inflection, the compiler flags or the shim and the same dictionary yields a
   different -- and by then wrong -- blob, which the engine would accept, because
   it checksums well.  A dictionary hash says nothing about any of that.

   So bump this string whenever anything that changes the bytes of SLOVNIK.TMP
   changes.  A page that deploys can do better than remembering to: pass its own
   build id as `version` to startCached, and every deploy re-inflects once.

   It also covers the record format below, which is why it is one string and not
   two. */
export const POKYD_CACHE_VERSION = "1";

export const POKYD_CACHE_DB = "iq-pokyd";
export const POKYD_CACHE_STORE = "slovnik";

/** The IndexedDB key a blob is stored under: format and engine version, then the
 *  hash of the dictionary it was inflected from. */
export function pokydCacheKey(dictionaryHash: string,
                              version: string = POKYD_CACHE_VERSION): string {
  return "pokyd/" + version + "/" + dictionaryHash;
}

/* --------------------------------------------------------------- the record */

/** One stored cache.  `length` is kept beside the blob on purpose: a record that
 *  comes back the wrong length is a corrupt one, and cheaper to notice here than
 *  eighteen megabytes later inside the engine. */
export interface PokydCacheRecord {
  key: string;
  blob: Uint8Array;
  length: number;
  /** Date.now() at the moment it was written.  Nothing uses it yet; it is one
   *  number, and a cache with no date on it is hard to reason about later. */
  savedAt: number;
}

/* ---------------------------------------------------------------- the store */

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("IndexedDB request failed"));
  });
}

export interface PokydCacheStoreOptions {
  dbName?: string;
  storeName?: string;
}

/** The IndexedDB object store, with nothing in it but this project's blob.
 *
 *  Every method rejects rather than swallowing, so a caller that wants to know
 *  can.  startCached below is the caller that does not want to know: it turns
 *  each of these into a line in its report and carries on loading. */
export class PokydCacheStore {
  private readonly dbName: string;
  private readonly storeName: string;
  private db: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase> | null = null;

  constructor(options: PokydCacheStoreOptions = {}) {
    this.dbName = options.dbName ?? POKYD_CACHE_DB;
    this.storeName = options.storeName ?? POKYD_CACHE_STORE;
  }

  /** Open the database, creating the object store on first use.  Concurrent
   *  callers share one open request rather than racing two upgrades. */
  open(): Promise<IDBDatabase> {
    if (this.db !== null) return Promise.resolve(this.db);
    if (this.opening !== null) return this.opening;

    const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    if (!idb) {
      return Promise.reject(new Error(
        "IndexedDB is not available here, so the inflected dictionary cannot be"
        + " kept between visits"));
    }

    const opened = new Promise<IDBDatabase>((resolve, reject) => {
      const r = idb.open(this.dbName, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(this.storeName)) {
          r.result.createObjectStore(this.storeName, { keyPath: "key" });
        }
      };
      /* A second tab holding the old version open blocks the upgrade forever;
         without this the promise never settles and the load never starts. */
      r.onblocked = () => reject(new Error(
        "another IQ Pokyd tab is holding " + this.dbName + " open"));
      r.onsuccess = () => {
        const db = r.result;
        /* Another tab wants an upgrade: let go rather than block it. */
        db.onversionchange = () => { this.close(); };
        this.db = db;
        resolve(db);
      };
      r.onerror = () => reject(r.error ?? new Error("cannot open " + this.dbName));
    });
    /* A failed open must not be remembered as the answer to the next one. */
    this.opening = opened.catch((e: unknown) => {
      this.opening = null;
      throw e;
    });
    return this.opening;
  }

  /** The blob stored under `key`, or null if there is none.  A record whose blob
   *  does not match its recorded length is treated as absent and deleted: it can
   *  only have got there by being damaged, and re-inflecting is 15 s while an
   *  engine loading a bad cache is wrong for the whole session. */
  async get(key: string): Promise<Uint8Array | null> {
    const db = await this.open();
    const t = db.transaction(this.storeName, "readonly");
    const record = await request<PokydCacheRecord | undefined>(
      t.objectStore(this.storeName).get(key));
    if (record === undefined) return null;
    if (!(record.blob instanceof Uint8Array)
        || record.blob.length !== record.length
        || record.length === 0) {
      await this.delete(key);
      return null;
    }
    return record.blob;
  }

  /** Write the blob under `key`.  The value is structured-cloned by IndexedDB as
   *  the request is made, so the caller's view may be transferred away as soon as
   *  this resolves -- which is what startCached does with it. */
  async put(key: string, blob: Uint8Array): Promise<void> {
    if (blob.length === 0) throw new Error("put: the blob is empty");
    const db = await this.open();
    const record: PokydCacheRecord = {
      key, blob, length: blob.length, savedAt: Date.now(),
    };
    const t = db.transaction(this.storeName, "readwrite");
    const done = new Promise<void>((resolve, reject) => {
      t.oncomplete = () => resolve();
      /* QuotaExceededError arrives here rather than on the request, and 18 MB
         over an origin's quota is the ordinary way this fails. */
      t.onerror = () => reject(t.error ?? new Error("cannot write " + key));
      t.onabort = () => reject(t.error ?? new Error("the write of " + key
        + " was aborted -- most likely the storage quota"));
    });
    t.objectStore(this.storeName).put(record);
    await done;
  }

  async delete(key: string): Promise<void> {
    const db = await this.open();
    const t = db.transaction(this.storeName, "readwrite");
    await request(t.objectStore(this.storeName).delete(key));
  }

  /** Every key currently stored.  Small: there should be one. */
  async keys(): Promise<string[]> {
    const db = await this.open();
    const t = db.transaction(this.storeName, "readonly");
    const all = await request<IDBValidKey[]>(
      t.objectStore(this.storeName).getAllKeys());
    return all.map(String);
  }

  /** Drop every blob but this one, and say how many went.  A redeploy or a new
   *  dictionary changes the key, and without this each one would leave its 18 MB
   *  behind for a question nobody is going to ask again. */
  async pruneExcept(key: string): Promise<number> {
    const stored = await this.keys();
    let deleted = 0;
    for (const k of stored) {
      if (k === key) continue;
      await this.delete(k);
      deleted++;
    }
    return deleted;
  }

  async clear(): Promise<void> {
    const db = await this.open();
    const t = db.transaction(this.storeName, "readwrite");
    await request(t.objectStore(this.storeName).clear());
  }

  close(): void {
    if (this.db !== null) this.db.close();
    this.db = null;
    this.opening = null;
  }
}

/* ------------------------------------------------------------ the sequence */

/* PokydStartOptions minus the two fields this function supplies itself.  Left
   in, `cache` would be a blob a caller could hand over and watch be ignored --
   startCached takes its cache from the store, and from nowhere else. */
export interface PokydCachedStartOptions
  extends Omit<PokydStartOptions, "cache" | "transferCache"> {
  /** Where to keep it.  Defaults to a store on the shared database, which is
   *  almost certainly right; a test wants its own. */
  store?: PokydCacheStore;
  /** Overrides POKYD_CACHE_VERSION.  A deploy id belongs here -- see the note on
   *  that constant for what a dictionary hash cannot see. */
  version?: string;
  /** Skip the lookup and inflect from scratch.  The result is still saved, so
   *  this is "rebuild the cache", not "do not use one". */
  ignoreStored?: boolean;
  /** Load, but do not write what came out.  For a visitor who should leave no
   *  18 MB behind. */
  doNotSave?: boolean;
}

/** What happened, for a page that wants to say so.  `error` is the only place a
 *  storage failure appears: the load itself is unaffected by one. */
export interface PokydCacheReport {
  /** The IndexedDB key this visit used, dictionary hash and all. */
  key: string;
  /** A stored cache was found and handed to the engine -- so the load was warm. */
  hit: boolean;
  /** A freshly inflected cache was written for next time. */
  saved: boolean;
  /** The size of the blob that was read or written; 0 if neither happened. */
  bytes: number;
  /** Older keys dropped by the save. */
  pruned: number;
  /** How long pokyd_load_dictionaries() took, in milliseconds. */
  loadMs: number;
  /** IndexedDB refused to do something.  The engine loaded anyway. */
  error: Error | null;
}

/* The whole visit, in the order pokyd_api.h requires and with the cache in the
   one place it fits: after init, because the dictionary hash is read out of the
   module's own MEMFS, and before load, because the engine looks for SLOVNIK.TMP
   as it starts and never again.

   It is PokydClient.start() with three steps inserted, rather than a second way
   of doing the same thing -- the settings, the mood and the seed happen where
   that method puts them, and for the reasons written down there.

   On the memory 3.4 measured: the blob exists three times over on a warm start
   -- IndexedDB's deserialized copy, the copy inside the wasm heap, and the MEMFS
   file the engine writes it to -- and none of those three can be skipped from
   here.  What this does avoid is a fourth: importCache is handed the blob to
   transfer rather than to clone, which is why nothing below touches it again. */
export async function startCached(
  client: PokydClient,
  options: PokydCachedStartOptions = {},
): Promise<PokydCacheReport> {
  const store = options.store ?? new PokydCacheStore();

  await client.init();
  if (options.settings !== undefined) await client.setSettings(options.settings);
  if (options.mood !== undefined) await client.setMood(options.mood);

  const key = pokydCacheKey(await client.dictionaryHash(), options.version);

  const report: PokydCacheReport = {
    key, hit: false, saved: false, bytes: 0, pruned: 0, loadMs: 0, error: null,
  };

  /* Read.  Anything that goes wrong here costs 15 s and nothing else. */
  if (options.ignoreStored !== true) {
    try {
      const stored = await store.get(key);
      if (stored !== null) {
        const size = stored.length;
        /* Only once the engine has taken it: an import that threw leaves no
           SLOVNIK.TMP behind, the load below goes the cold way, and `bytes`
           must not be reporting a blob nothing ever used. */
        await client.importCache(stored, true);
        report.bytes = size;
        report.hit = true;
      }
    } catch (e) {
      report.error = toError(e);
    }
  }

  const t0 = Date.now();
  await client.load();
  report.loadMs = Date.now() - t0;

  if (options.seed !== undefined) await client.seed(options.seed);

  /* Write, if this visit is the one that made it.  A hit has nothing new to
     say, and cmdReadOnly means the engine wrote no SLOVNIK.TMP at all,
     which is why exportCache may legitimately hand back null. */
  if (!report.hit && options.doNotSave !== true) {
    try {
      const fresh = await client.exportCache();
      if (fresh !== null) {
        report.bytes = fresh.length;
        await store.put(key, fresh);
        report.saved = true;
        report.pruned = await store.pruneExcept(key);
      }
    } catch (e) {
      /* Out of quota, most likely.  Next visit is slow; this one is not wrong. */
      report.error = toError(e);
    }
  }

  return report;
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}
