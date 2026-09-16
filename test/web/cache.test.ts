/* IQ Pokyd - test/web/cache.test.ts - phase 4.4 of PLAN.md, the half node can see.

   src/web/cache.ts is two things bolted together: a hash that decides which
   stored blob belongs to which dictionary, and an IndexedDB store that keeps it.
   Node has the first and not the second -- there is no indexedDB in node 24 --
   so this file takes the hash, the key and the engine's side of it, and
   test/web/cache.test.mjs takes the store in a real browser.

   What is worth checking here, in order of how much it would cost to be wrong:

     1. fnv1a64 computes FNV-1a.  Not "a hash", *that* hash: the whole point of
        the key is that two runs of this code agree about a file, so the function
        is checked against published vectors and against Python's own arithmetic
        over original/slovnik.iqp.  The multiply is hand-split into 32-bit lanes
        (the prime is 2^40 + 0x1b3) and a lane that carried wrong would still
        produce a stable-looking hash, which is exactly the bug that would not
        show up anywhere else.
     2. The engine hashes the dictionary it is actually holding.  PokydEngine
        .dictionaryHash() reads SLOVNIK.IQP back out of MEMFS, and it has to
        agree with the file tools/build.py embedded -- if it ever did not, the
        cache key would be keyed to something that is not the dictionary.
     3. The key is stable and separates what it should: a different dictionary
        or a different engine version is a different key.
     4. The store fails honestly where there is no IndexedDB, rather than
        throwing something unrecognisable from inside a promise.

   Run it:   node test/web/cache.test.ts

   Needs python3 tools/build.py --wasm to have run, for check 2 -- and only for
   that one; everything else is arithmetic.  No package.json, no dependencies.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import {
  fnv1a64,
  pokydCacheKey,
  PokydCacheStore,
  POKYD_CACHE_DB,
  POKYD_CACHE_VERSION,
} from "../../src/web/cache.ts";
import { PokydEngine } from "../../src/web/engine.ts";
import type { PokydModuleFactory } from "../../src/web/engine.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODULE_PATH = join(ROOT, "build", "wasm", "pokyd.mjs");
const DICT_PATH = join(ROOT, "original", "slovnik.iqp");

/* ------------------------------------------------------------- the scoreboard */

let checks = 0;
let failures = 0;

function heading(text: string): void {
  console.log("\n" + text);
}

function ok(what: string, cond: boolean, detail = ""): void {
  checks++;
  if (cond) {
    console.log("  ok    " + what);
  } else {
    failures++;
    console.log("  FAIL  " + what + (detail ? "\n        " + detail : ""));
  }
}

function eq(what: string, got: unknown, expected: unknown): void {
  ok(what, Object.is(got, expected),
    "got " + JSON.stringify(got) + ", expected " + JSON.stringify(expected));
}

function bytesOf(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

/* ------------------------------------------------------------------ the hash */

/* The published FNV-1a 64 vectors, plus original/slovnik.iqp, whose hash was
   computed independently with Python's arbitrary-precision integers:

       h = 0xcbf29ce484222325
       for b in open("original/slovnik.iqp", "rb").read():
           h ^= b; h = (h * 0x100000001b3) & 0xFFFFFFFFFFFFFFFF

   That is the check that matters.  A 90 KB file is 90,289 multiplies, so a lane
   that carries wrong once in a while cannot survive it -- and every other check
   in this file and the browser's would still pass if it did, because they all
   ask the same broken function. */
const VECTORS: ReadonlyArray<readonly [string, string]> = [
  ["", "cbf29ce484222325"],
  ["a", "af63dc4c8601ec8c"],
  ["b", "af63df4c8601f1a5"],
  ["c", "af63de4c8601eff2"],
  ["foobar", "85944171f73967e8"],
  ["hello world", "779a65e7023cd2e7"],
];

const DICT_HASH = "a620640e93e20cf3";

function hashTests(): void {
  heading("fnv1a64");
  for (const [input, expected] of VECTORS) {
    eq("FNV-1a 64 of " + JSON.stringify(input), fnv1a64(bytesOf(input)), expected);
  }

  /* Every byte value, so no lane of the hand-split multiply goes unexercised by
     a high bit.  Computed the same way as the vectors above. */
  const allBytes = new Uint8Array(256);
  for (let i = 0; i < 256; i++) allBytes[i] = i;
  eq("FNV-1a 64 of all 256 byte values in order",
    fnv1a64(allBytes), "4242dc5249c33625");

  ok("the digest is always sixteen hex digits",
    VECTORS.every(([v]) => /^[0-9a-f]{16}$/.test(fnv1a64(bytesOf(v)))));

  const dict = new Uint8Array(readFileSync(DICT_PATH));
  eq("original/slovnik.iqp is still " + dict.length + " bytes",
    dict.length, 90289);
  eq("FNV-1a 64 of original/slovnik.iqp, against Python's own arithmetic",
    fnv1a64(dict), DICT_HASH);

  /* One byte different is a different key -- which is the only property the
     whole scheme rests on. */
  const flipped = dict.slice();
  flipped[Math.floor(flipped.length / 2)] ^= 0x01;
  ok("one flipped bit anywhere in the dictionary changes the hash",
    fnv1a64(flipped) !== fnv1a64(dict),
    "both hashed to " + fnv1a64(dict));

  /* A view into a larger buffer must hash as itself.  engine.ts hands over
     whatever MEMFS gives it, and Emscripten's FS.readFile has handed back a
     subarray of a larger allocation before now. */
  const backing = new Uint8Array(64);
  backing.set(bytesOf("hello world"), 16);
  eq("a subarray hashes as its own bytes, not its buffer's",
    fnv1a64(backing.subarray(16, 27)), "779a65e7023cd2e7");
}

/* ------------------------------------------------------------------- the key */

function keyTests(): void {
  heading("the cache key");

  eq("it is format, version and dictionary, in that order",
    pokydCacheKey(DICT_HASH, "1"), "pokyd/1/" + DICT_HASH);
  eq("the version defaults to POKYD_CACHE_VERSION",
    pokydCacheKey(DICT_HASH), "pokyd/" + POKYD_CACHE_VERSION + "/" + DICT_HASH);

  ok("a different dictionary is a different key",
    pokydCacheKey(DICT_HASH) !== pokydCacheKey("0000000000000000"));
  ok("a different engine version is a different key -- what the dictionary hash"
    + " cannot see",
    pokydCacheKey(DICT_HASH, "1") !== pokydCacheKey(DICT_HASH, "2"));
}

/* ----------------------------------------------------------------- the store */

async function storeTests(): Promise<void> {
  heading("the store where there is no IndexedDB");

  eq("node 24 really has no indexedDB, so this is the case being tested",
    typeof (globalThis as { indexedDB?: unknown }).indexedDB, "undefined");

  const store = new PokydCacheStore();
  let message = "(it resolved)";
  try {
    await store.open();
  } catch (e) {
    message = e instanceof Error ? e.message : String(e);
  }
  ok("open() rejects with an Error that says what is missing",
    message.indexOf("IndexedDB") >= 0, "it said: " + JSON.stringify(message));

  /* And it must keep saying so.  A remembered failed promise would turn one
     unavailable database into a permanently poisoned store. */
  let again = "(it resolved)";
  try {
    await store.get("pokyd/1/whatever");
  } catch (e) {
    again = e instanceof Error ? e.message : String(e);
  }
  eq("and again on the next call, rather than a stale rejected promise",
    again, message);

  eq("the database it would have opened", POKYD_CACHE_DB, "iq-pokyd");
}

/* ------------------------------------------------------------- the sequence */

/* startCached() is orchestration -- six calls in an order pokyd_api.h fixes, a
   lookup, and two try/catch blocks -- and every interesting thing about it is a
   branch that a real run does not take.  Quota exhaustion, a database that will
   not open, cmdReadOnly, ignoreStored: taking those through a real engine
   costs a fifteen-second cold load each, and the engine is not what is being
   asked about.

   So it is driven here against a recording client and a store that fails on
   demand.  The real path -- a real cold load, a real IndexedDB, a real 18 MB
   blob and the golden conversation out the other side -- is
   test/web/cache.test.mjs, in Chrome.  Neither of these two is worth much
   without the other. */

interface Call { what: string; s?: unknown }

function fakeClient(options: { cache?: Uint8Array | null } = {}) {
  const calls: Call[] = [];
  const client = {
    init: async () => { calls.push({ what: "init" }); return null; },
    setSettings: async (s: unknown) => { calls.push({ what: "setSettings", s }); return null; },
    setMood: async (m: number) => { calls.push({ what: "setMood", s: m }); return null; },
    dictionaryHash: async () => { calls.push({ what: "dictionaryHash" }); return DICT_HASH; },
    importCache: async (b: Uint8Array, t?: boolean) => {
      calls.push({ what: "importCache", s: { length: b.length, transfer: t } });
      return null;
    },
    load: async () => { calls.push({ what: "load" }); return null; },
    seed: async (n: number) => { calls.push({ what: "seed", s: n }); return null; },
    exportCache: async () => {
      calls.push({ what: "exportCache" });
      return options.cache === undefined ? new Uint8Array(8) : options.cache;
    },
  };
  return { client, calls };
}

function fakeStore(options: { stored?: Uint8Array | null;
                                failRead?: boolean;
                                failWrite?: boolean } = {}) {
  const calls: Call[] = [];
  const store = {
    get: async (k: string) => {
      calls.push({ what: "get", s: k });
      if (options.failRead) throw new Error("the database would not open");
      return options.stored ?? null;
    },
    put: async (k: string, b: Uint8Array) => {
      calls.push({ what: "put", s: { k, length: b.length } });
      if (options.failWrite) throw new Error("QuotaExceededError");
    },
    pruneExcept: async (k: string) => { calls.push({ what: "pruneExcept", s: k }); return 2; },
  };
  return { store, calls };
}

async function sequenceTests(): Promise<void> {
  const { startCached } = await import("../../src/web/cache.ts");
  /* The two stubs stand in for a PokydClient and a PokydCacheStore; neither is
     structurally assignable, because both real classes have private state. */
  const castTo = (x: unknown) => x as never;

  heading("startCached: a cold visit");
  {
    const { client, calls } = fakeClient({ cache: new Uint8Array(1000) });
    const { store, calls: storeCalls } = fakeStore();
    const report = await startCached(castTo(client),
      castTo({ store: store, mood: 3, seed: 20050415 }));

    eq("the calls, in pokyd_api.h's order",
      calls.map((h) => h.what).join(" "),
      "init setMood dictionaryHash load seed exportCache");
    ok("the cache was looked for before the load",
      storeCalls[0].what === "get");
    eq("nothing was found, so it was a miss", report.hit, false);
    eq("and what came out was written for next time", report.saved, true);
    eq("under the dictionary's own key", report.key,
      "pokyd/" + POKYD_CACHE_VERSION + "/" + DICT_HASH);
    eq("older keys were pruned", report.pruned, 2);
    eq("no storage trouble to report", report.error, null);
  }

  heading("startCached: a return visit");
  {
    const stored = new Uint8Array(4096);
    const { client, calls } = fakeClient();
    const { store } = fakeStore({ stored });
    const report = await startCached(castTo(client), castTo({ store: store, seed: 1 }));

    eq("the stored blob is imported before the load, never after",
      calls.map((h) => h.what).join(" "),
      "init dictionaryHash importCache load seed");
    eq("it is transferred rather than cloned -- 18 MB not copied",
      JSON.stringify(calls[2].s), JSON.stringify({ length: 4096, transfer: true }));
    eq("a hit", report.hit, true);
    eq("and nothing is written back", report.saved, false);
    eq("the size it restored", report.bytes, 4096);
  }

  heading("startCached: when the storage will not cooperate");
  {
    const { client, calls } = fakeClient({ cache: new Uint8Array(64) });
    const { store } = fakeStore({ failRead: true });
    const report = await startCached(castTo(client), castTo({ store: store }));
    ok("a database that will not open still lets the engine load",
      calls.some((h) => h.what === "load"));
    eq("it is simply a miss", report.hit, false);
    ok("and the failure is reported rather than thrown",
      report.error !== null && report.error.message.indexOf("would not open") >= 0,
      "the report said: " + String(report.error));
  }
  {
    const { client } = fakeClient({ cache: new Uint8Array(64) });
    const { store } = fakeStore({ failWrite: true });
    const report = await startCached(castTo(client), castTo({ store: store }));
    eq("a full quota does not fail the visit, it only slows the next one",
      report.saved, false);
    ok("and it says so", report.error !== null
      && report.error.message.indexOf("Quota") >= 0,
      "the report said: " + String(report.error));
  }
  {
    /* cmdReadOnly: the engine wrote no SLOVNIK.TMP, so there is nothing
       to keep.  That is not a failure and must not be reported as one. */
    const { client } = fakeClient({ cache: null });
    const { store, calls } = fakeStore();
    const report = await startCached(castTo(client), castTo({ store: store }));
    eq("an engine that wrote no cache saves nothing", report.saved, false);
    eq("and that is not an error", report.error, null);
    ok("nothing was written", !calls.some((h) => h.what === "put"));
  }

  heading("startCached: the two switches");
  {
    const { client } = fakeClient({ cache: new Uint8Array(32) });
    const { store, calls } = fakeStore({ stored: new Uint8Array(99) });
    const report = await startCached(castTo(client), castTo({ store: store, ignoreStored: true }));
    ok("ignoreStored does not even look", !calls.some((h) => h.what === "get"));
    eq("but it still saves what it made", report.saved, true);
  }
  {
    const { client } = fakeClient({ cache: new Uint8Array(32) });
    const { store, calls } = fakeStore();
    const report = await startCached(castTo(client), castTo({ store: store, doNotSave: true }));
    ok("doNotSave leaves nothing behind", !calls.some((h) => h.what === "put"));
    eq("and reports that it did not", report.saved, false);
  }
}

/* ---------------------------------------------------------------- the engine */

/* The check that ties the key to reality: the dictionary the wasm module is
   carrying is the dictionary on disk.  It is one call and no load -- MEMFS is
   populated before the factory resolves, so this costs a module instantiation
   and nothing else.

   Note what is *not* done here: no pokyd_load_dictionaries, and therefore no
   pokyd_shutdown either, which would abort the module outright (engine.ts says
   why at shutdown()).  The instance is dropped instead. */
async function engineTests(): Promise<void> {
  heading("the dictionary the engine is holding");

  const { default: factory } =
    await import(pathToFileURL(MODULE_PATH).href) as { default: PokydModuleFactory };
  const engine = await PokydEngine.create(factory);

  const hash = engine.dictionaryHash();
  eq("PokydEngine.dictionaryHash() reads SLOVNIK.IQP out of MEMFS",
    hash, DICT_HASH);
  ok("which is the same file tools/build.py embedded from original/slovnik.iqp",
    hash === fnv1a64(new Uint8Array(readFileSync(DICT_PATH))));
  eq("asking twice gives the same answer", engine.dictionaryHash(), hash);
  eq("and it is what the IndexedDB key will be built from",
    pokydCacheKey(hash), "pokyd/" + POKYD_CACHE_VERSION + "/" + DICT_HASH);
}

/* ------------------------------------------------------------------- the run */

async function main(): Promise<number> {
  if (process.argv.length > 2) {
    console.error("cache.test: no options");
    console.error("usage: node test/web/cache.test.ts");
    return 2;
  }

  console.log("node    " + process.version);
  console.log("dict    " + DICT_PATH);

  hashTests();
  keyTests();
  await storeTests();
  await sequenceTests();

  if (existsSync(MODULE_PATH)) {
    console.log("\nmodule  " + MODULE_PATH);
    await engineTests();
  } else {
    console.log("\nno " + MODULE_PATH + " -- skipping the engine checks");
    console.log("build it with: python3 tools/build.py --wasm");
  }

  console.log(failures === 0
    ? "\nPASS -- " + checks + " checks.  The key names the dictionary the engine"
      + " is actually holding."
    : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
  return failures === 0 ? 0 : 1;
}

process.exit(await main());
