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

const KOREN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODUL = join(KOREN, "build", "wasm", "pokyd.mjs");
const SLOVNIK = join(KOREN, "original", "slovnik.iqp");

/* ------------------------------------------------------------- the scoreboard */

let poctu = 0;
let chyby = 0;

function nadpis(text: string): void {
  console.log("\n" + text);
}

function ok(co: string, podminka: boolean, detail = ""): void {
  poctu++;
  if (podminka) {
    console.log("  ok    " + co);
  } else {
    chyby++;
    console.log("  FAIL  " + co + (detail ? "\n        " + detail : ""));
  }
}

function rovno(co: string, mame: unknown, ocekavame: unknown): void {
  ok(co, Object.is(mame, ocekavame),
    "got " + JSON.stringify(mame) + ", expected " + JSON.stringify(ocekavame));
}

function bajty(text: string): Uint8Array {
  const ven = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) ven[i] = text.charCodeAt(i) & 0xff;
  return ven;
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
const VEKTORY: ReadonlyArray<readonly [string, string]> = [
  ["", "cbf29ce484222325"],
  ["a", "af63dc4c8601ec8c"],
  ["b", "af63df4c8601f1a5"],
  ["c", "af63de4c8601eff2"],
  ["foobar", "85944171f73967e8"],
  ["hello world", "779a65e7023cd2e7"],
];

const HASH_SLOVNIKU = "a620640e93e20cf3";

function zkouskyHashe(): void {
  nadpis("fnv1a64");
  for (const [vstup, cekano] of VEKTORY) {
    rovno("FNV-1a 64 of " + JSON.stringify(vstup), fnv1a64(bajty(vstup)), cekano);
  }

  /* Every byte value, so no lane of the hand-split multiply goes unexercised by
     a high bit.  Computed the same way as the vectors above. */
  const vsech256 = new Uint8Array(256);
  for (let i = 0; i < 256; i++) vsech256[i] = i;
  rovno("FNV-1a 64 of all 256 byte values in order",
    fnv1a64(vsech256), "4242dc5249c33625");

  ok("the digest is always sixteen hex digits",
    VEKTORY.every(([v]) => /^[0-9a-f]{16}$/.test(fnv1a64(bajty(v)))));

  const slovnik = new Uint8Array(readFileSync(SLOVNIK));
  rovno("original/slovnik.iqp is still " + slovnik.length + " bytes",
    slovnik.length, 90289);
  rovno("FNV-1a 64 of original/slovnik.iqp, against Python's own arithmetic",
    fnv1a64(slovnik), HASH_SLOVNIKU);

  /* One byte different is a different key -- which is the only property the
     whole scheme rests on. */
  const zmeneny = slovnik.slice();
  zmeneny[Math.floor(zmeneny.length / 2)] ^= 0x01;
  ok("one flipped bit anywhere in the dictionary changes the hash",
    fnv1a64(zmeneny) !== fnv1a64(slovnik),
    "both hashed to " + fnv1a64(slovnik));

  /* A view into a larger buffer must hash as itself.  engine.ts hands over
     whatever MEMFS gives it, and Emscripten's FS.readFile has handed back a
     subarray of a larger allocation before now. */
  const podklad = new Uint8Array(64);
  podklad.set(bajty("hello world"), 16);
  rovno("a subarray hashes as its own bytes, not its buffer's",
    fnv1a64(podklad.subarray(16, 27)), "779a65e7023cd2e7");
}

/* ------------------------------------------------------------------- the key */

function zkouskyKlice(): void {
  nadpis("the cache key");

  rovno("it is format, version and dictionary, in that order",
    pokydCacheKey(HASH_SLOVNIKU, "1"), "pokyd/1/" + HASH_SLOVNIKU);
  rovno("the version defaults to POKYD_CACHE_VERSION",
    pokydCacheKey(HASH_SLOVNIKU), "pokyd/" + POKYD_CACHE_VERSION + "/" + HASH_SLOVNIKU);

  ok("a different dictionary is a different key",
    pokydCacheKey(HASH_SLOVNIKU) !== pokydCacheKey("0000000000000000"));
  ok("a different engine version is a different key -- what the dictionary hash"
    + " cannot see",
    pokydCacheKey(HASH_SLOVNIKU, "1") !== pokydCacheKey(HASH_SLOVNIKU, "2"));
}

/* ----------------------------------------------------------------- the store */

async function zkouskySkladu(): Promise<void> {
  nadpis("the store where there is no IndexedDB");

  rovno("node 24 really has no indexedDB, so this is the case being tested",
    typeof (globalThis as { indexedDB?: unknown }).indexedDB, "undefined");

  const sklad = new PokydCacheStore();
  let zprava = "(it resolved)";
  try {
    await sklad.open();
  } catch (e) {
    zprava = e instanceof Error ? e.message : String(e);
  }
  ok("open() rejects with an Error that says what is missing",
    zprava.indexOf("IndexedDB") >= 0, "it said: " + JSON.stringify(zprava));

  /* And it must keep saying so.  A remembered failed promise would turn one
     unavailable database into a permanently poisoned store. */
  let podruhe = "(it resolved)";
  try {
    await sklad.get("pokyd/1/whatever");
  } catch (e) {
    podruhe = e instanceof Error ? e.message : String(e);
  }
  rovno("and again on the next call, rather than a stale rejected promise",
    podruhe, zprava);

  rovno("the database it would have opened", POKYD_CACHE_DB, "iq-pokyd");
}

/* ------------------------------------------------------------- the sequence */

/* startCached() is orchestration -- six calls in an order pokyd_api.h fixes, a
   lookup, and two try/catch blocks -- and every interesting thing about it is a
   branch that a real run does not take.  Quota exhaustion, a database that will
   not open, prikaz_readonlymod, ignoreStored: taking those through a real engine
   costs a fifteen-second cold load each, and the engine is not what is being
   asked about.

   So it is driven here against a recording client and a store that fails on
   demand.  The real path -- a real cold load, a real IndexedDB, a real 18 MB
   blob and the golden conversation out the other side -- is
   test/web/cache.test.mjs, in Chrome.  Neither of these two is worth much
   without the other. */

interface Hovor { co: string; s?: unknown }

function nahradniKlient(volby: { cache?: Uint8Array | null } = {}) {
  const hovory: Hovor[] = [];
  const klient = {
    init: async () => { hovory.push({ co: "init" }); return null; },
    setSettings: async (s: unknown) => { hovory.push({ co: "setSettings", s }); return null; },
    setMood: async (m: number) => { hovory.push({ co: "setMood", s: m }); return null; },
    dictionaryHash: async () => { hovory.push({ co: "dictionaryHash" }); return HASH_SLOVNIKU; },
    importCache: async (b: Uint8Array, t?: boolean) => {
      hovory.push({ co: "importCache", s: { delka: b.length, transfer: t } });
      return null;
    },
    load: async () => { hovory.push({ co: "load" }); return null; },
    seed: async (n: number) => { hovory.push({ co: "seed", s: n }); return null; },
    exportCache: async () => {
      hovory.push({ co: "exportCache" });
      return volby.cache === undefined ? new Uint8Array(8) : volby.cache;
    },
  };
  return { klient, hovory };
}

function nahradniSklad(volby: { ulozeny?: Uint8Array | null;
                                selzeCteni?: boolean;
                                selzeZapis?: boolean } = {}) {
  const hovory: Hovor[] = [];
  const sklad = {
    get: async (k: string) => {
      hovory.push({ co: "get", s: k });
      if (volby.selzeCteni) throw new Error("the database would not open");
      return volby.ulozeny ?? null;
    },
    put: async (k: string, b: Uint8Array) => {
      hovory.push({ co: "put", s: { k, delka: b.length } });
      if (volby.selzeZapis) throw new Error("QuotaExceededError");
    },
    pruneExcept: async (k: string) => { hovory.push({ co: "pruneExcept", s: k }); return 2; },
  };
  return { sklad, hovory };
}

async function zkouskyPoradi(): Promise<void> {
  const { startCached } = await import("../../src/web/cache.ts");
  /* The two stubs stand in for a PokydClient and a PokydCacheStore; neither is
     structurally assignable, because both real classes have private state. */
  const jako = (x: unknown) => x as never;

  nadpis("startCached: a cold visit");
  {
    const { klient, hovory } = nahradniKlient({ cache: new Uint8Array(1000) });
    const { sklad, hovory: skladHovory } = nahradniSklad();
    const z = await startCached(jako(klient),
      jako({ store: sklad, mood: 3, seed: 20050415 }));

    rovno("the calls, in pokyd_api.h's order",
      hovory.map((h) => h.co).join(" "),
      "init setMood dictionaryHash load seed exportCache");
    ok("the cache was looked for before the load",
      skladHovory[0].co === "get");
    rovno("nothing was found, so it was a miss", z.hit, false);
    rovno("and what came out was written for next time", z.saved, true);
    rovno("under the dictionary's own key", z.key,
      "pokyd/" + POKYD_CACHE_VERSION + "/" + HASH_SLOVNIKU);
    rovno("older keys were pruned", z.pruned, 2);
    rovno("no storage trouble to report", z.error, null);
  }

  nadpis("startCached: a return visit");
  {
    const ulozeny = new Uint8Array(4096);
    const { klient, hovory } = nahradniKlient();
    const { sklad } = nahradniSklad({ ulozeny });
    const z = await startCached(jako(klient), jako({ store: sklad, seed: 1 }));

    rovno("the stored blob is imported before the load, never after",
      hovory.map((h) => h.co).join(" "),
      "init dictionaryHash importCache load seed");
    rovno("it is transferred rather than cloned -- 18 MB not copied",
      JSON.stringify(hovory[2].s), JSON.stringify({ delka: 4096, transfer: true }));
    rovno("a hit", z.hit, true);
    rovno("and nothing is written back", z.saved, false);
    rovno("the size it restored", z.bytes, 4096);
  }

  nadpis("startCached: when the storage will not cooperate");
  {
    const { klient, hovory } = nahradniKlient({ cache: new Uint8Array(64) });
    const { sklad } = nahradniSklad({ selzeCteni: true });
    const z = await startCached(jako(klient), jako({ store: sklad }));
    ok("a database that will not open still lets the engine load",
      hovory.some((h) => h.co === "load"));
    rovno("it is simply a miss", z.hit, false);
    ok("and the failure is reported rather than thrown",
      z.error !== null && z.error.message.indexOf("would not open") >= 0,
      "the report said: " + String(z.error));
  }
  {
    const { klient } = nahradniKlient({ cache: new Uint8Array(64) });
    const { sklad } = nahradniSklad({ selzeZapis: true });
    const z = await startCached(jako(klient), jako({ store: sklad }));
    rovno("a full quota does not fail the visit, it only slows the next one",
      z.saved, false);
    ok("and it says so", z.error !== null
      && z.error.message.indexOf("Quota") >= 0,
      "the report said: " + String(z.error));
  }
  {
    /* prikaz_readonlymod: the engine wrote no SLOVNIK.TMP, so there is nothing
       to keep.  That is not a failure and must not be reported as one. */
    const { klient } = nahradniKlient({ cache: null });
    const { sklad, hovory } = nahradniSklad();
    const z = await startCached(jako(klient), jako({ store: sklad }));
    rovno("an engine that wrote no cache saves nothing", z.saved, false);
    rovno("and that is not an error", z.error, null);
    ok("nothing was written", !hovory.some((h) => h.co === "put"));
  }

  nadpis("startCached: the two switches");
  {
    const { klient } = nahradniKlient({ cache: new Uint8Array(32) });
    const { sklad, hovory } = nahradniSklad({ ulozeny: new Uint8Array(99) });
    const z = await startCached(jako(klient), jako({ store: sklad, ignoreStored: true }));
    ok("ignoreStored does not even look", !hovory.some((h) => h.co === "get"));
    rovno("but it still saves what it made", z.saved, true);
  }
  {
    const { klient } = nahradniKlient({ cache: new Uint8Array(32) });
    const { sklad, hovory } = nahradniSklad();
    const z = await startCached(jako(klient), jako({ store: sklad, doNotSave: true }));
    ok("doNotSave leaves nothing behind", !hovory.some((h) => h.co === "put"));
    rovno("and reports that it did not", z.saved, false);
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
async function zkouskyMotoru(): Promise<void> {
  nadpis("the dictionary the engine is holding");

  const { default: factory } =
    await import(pathToFileURL(MODUL).href) as { default: PokydModuleFactory };
  const motor = await PokydEngine.create(factory);

  const hash = motor.dictionaryHash();
  rovno("PokydEngine.dictionaryHash() reads SLOVNIK.IQP out of MEMFS",
    hash, HASH_SLOVNIKU);
  ok("which is the same file tools/build.py embedded from original/slovnik.iqp",
    hash === fnv1a64(new Uint8Array(readFileSync(SLOVNIK))));
  rovno("asking twice gives the same answer", motor.dictionaryHash(), hash);
  rovno("and it is what the IndexedDB key will be built from",
    pokydCacheKey(hash), "pokyd/" + POKYD_CACHE_VERSION + "/" + HASH_SLOVNIKU);
}

/* ------------------------------------------------------------------- the run */

async function main(): Promise<number> {
  if (process.argv.length > 2) {
    console.error("cache.test: no options");
    console.error("usage: node test/web/cache.test.ts");
    return 2;
  }

  console.log("node    " + process.version);
  console.log("dict    " + SLOVNIK);

  zkouskyHashe();
  zkouskyKlice();
  await zkouskySkladu();
  await zkouskyPoradi();

  if (existsSync(MODUL)) {
    console.log("\nmodule  " + MODUL);
    await zkouskyMotoru();
  } else {
    console.log("\nno " + MODUL + " -- skipping the engine checks");
    console.log("build it with: python3 tools/build.py --wasm");
  }

  console.log(chyby === 0
    ? "\nPASS -- " + poctu + " checks.  The key names the dictionary the engine"
      + " is actually holding."
    : "\nFAIL -- " + chyby + " of " + poctu + " checks did not hold.");
  return chyby === 0 ? 0 : 1;
}

process.exit(await main());
