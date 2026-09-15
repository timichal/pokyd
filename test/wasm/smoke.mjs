/* IQ Pokyd - test/wasm/smoke.mjs - phase 3.3 of PLAN.md, the gate.

   Drives build/wasm/pokyd.mjs through the same 23 sentences the native driver
   was driven through at phase 1.6 and diffs the answers against
   test/golden/rozhovor.txt byte for byte.  If they differ, the wasm build's
   engine differs from the native one -- hazard 1 (char signedness) and hazard 4
   (overflow, aliasing, -O level) are the two that can do it, and the golden file
   is not the thing to re-record.  See test/golden/README.md.

   Two runs, not one, because they exercise different code:

     cold   an empty MEMFS, so ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU inflects
            11,207 words into 402,252 forms and writes an 18 MB SLOVNIK.TMP
     warm   a second module instance that gets that blob back through
            pokyd_import_cache before loading -- hazard 10's adjacency, and the
            only way the plan's "time the second run" is even possible here,
            since MEMFS does not survive an instance

   The blob the cold run exports is also compared against the native
   build/run/SLOVNIK.TMP when there is one: it is 18 MB the golden transcript
   barely touches, and phase 4.4 is going to keep it in IndexedDB.

   Nothing here decodes anything.  rozhovor.in is CP1250 bytes on disk, the API
   takes CP1250 bytes, and the transcript is written back out as the bytes the
   engine returned, so no codec sits between the golden file and the answer.
   That is phase 4.1's job and this test deliberately predates it.

   Usage:
       node test/wasm/smoke.mjs [-v] [--noise] [--no-warm] [--module FILE]

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const KOREN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/* The settings the golden conversation was recorded with -- test/golden/README.md.
   They are NASTAV_STANDARDNE's own defaults, and pinned here for the same reason
   the driver pins them on the command line: so the test does not move if a
   default ever does. */
const SEMENO = 20050415;
const CHARAKTER = 3;            /* prumerny */
const NALADA = 3;               /* normalni */
const POHLAVI_CLOVEKA = 1;      /* muz -- NASTAVEN.PR:26 */
const POHLAVI_POCITACE = 1;

/* struct pokyd_settings (src/api/pokyd_api.h), field by field in declaration
   order.  Every member is a char or an array of char, so the layout is a running
   sum with no padding anywhere and no alignment to reason about -- but it is
   still a C layout being read from JS, so the offsets are checked against what
   the engine actually writes into the struct before anything trusts them. */
const POLE_NASTAVENI = [
  ["pohlavicloveka", 1], ["pohlavipocitace", 1],
  ["jmenocloveka", 101], ["jmenopocitace", 101],
  ["charakter", 1], ["nalada", 1], ["naladabody", 1],
  ["ukladatrozhovor", 1], ["pouzivatzvuky", 1], ["pouzivatefekty", 1],
  ["spisovnacestina", 1], ["zobrazovatpopisky", 1],
  ["debug_rychleukoncovani", 1], ["debug_tolerancepravopisu", 1],
  ["debug_pravopisnarekurze", 1],
  ["emulovatklavesnici", 1], ["klavesniceqwerty", 1], ["standardnikurzor", 1],
  ["prikaz_readonlymod", 1], ["prikaz_nezobrazovatpozadi", 1],
];
const POSUN = {};
let VELIKOST_NASTAVENI = 0;
for (const [jmeno, sirka] of POLE_NASTAVENI) {
  POSUN[jmeno] = VELIKOST_NASTAVENI;
  VELIKOST_NASTAVENI += sirka;
}

/* ------------------------------------------------------------------ the heap */

/* HEAPU8 is replaced every time the memory grows, and loading the dictionary
   grows it several times over, so it is read off the module at every use and
   never cached in a local. */

function uloz_retezec(M, bajty) {
  /* CP1250 bytes in, NUL-terminated copy in the wasm heap out. */
  const p = M._malloc(bajty.length + 1);
  if (p === 0) throw new Error("out of wasm memory");
  M.HEAPU8.set(bajty, p);
  M.HEAPU8[p + bajty.length] = 0;
  return p;
}

function nacti_retezec(M, p) {
  /* The engine's own buffer -- copied out, because the next pokyd_say overwrites
     it and because the heap underneath it can move. */
  if (p === 0) return null;
  const halda = M.HEAPU8;
  let konec = p;
  while (halda[konec] !== 0) konec++;
  return Buffer.from(halda.subarray(p, konec));
}

function chyba(M) {
  const b = nacti_retezec(M, M._pokyd_error());
  return b === null ? "(null)" : b.toString("latin1");
}

/* --------------------------------------------------------------------- a run */

async function jeden_rozhovor(PokydModule, vety, { cache, verbose, hluk, popis }) {
  /* The engine talks to the console on its own account and always has: the
     inflection progress bar (SLOVNIK.FU:3322), and vstup.fu:801-809, which
     prints every base form it recognises on every sentence.  Native runs send
     that to stdout and the driver keeps the transcript in a separate file;
     here it would be 2.6 MB of node console traffic on top of a timed load, so
     it is discarded unless --noise asks for it.  The engine still makes every
     call -- nothing about what it computes changes. */
  const M = await PokydModule(hluk ? {} : { print: () => {}, printErr: () => {} });

  const adresar = uloz_retezec(M, Buffer.from("/pokyd", "latin1"));
  if (M._pokyd_init(adresar) !== 0) throw new Error("pokyd_init: " + chyba(M));
  M._free(adresar);

  /* Settings first, and through the engine's own accessors: read what
     NASTAV_STANDARDNE left, change the ones the golden run changed, write it
     back.  pokyd_set_mood separately, because nalada is derived from naladabody
     and writing it through the struct alone is undone after the next sentence
     (INTELIG.FU:1047). */
  const n = M._malloc(VELIKOST_NASTAVENI);
  M._pokyd_get_settings(n);
  zkontroluj_rozlozeni(M, n, popis);
  M.HEAPU8[n + POSUN.pohlavicloveka] = POHLAVI_CLOVEKA;
  M.HEAPU8[n + POSUN.pohlavipocitace] = POHLAVI_POCITACE;
  M.HEAPU8[n + POSUN.charakter] = CHARAKTER;
  M._pokyd_set_settings(n);
  M._pokyd_set_mood(NALADA);

  /* Before loading, never during -- hazard 10, and pokyd_api.h says why the
     import is a step of its own rather than an argument to the load. */
  if (cache) {
    const p = M._malloc(cache.length);
    if (p === 0) throw new Error("out of wasm memory installing the cache");
    M.HEAPU8.set(cache, p);
    if (M._pokyd_import_cache(p, cache.length) !== 0)
      throw new Error("pokyd_import_cache: " + chyba(M));
    M._free(p);
  }

  const t0 = performance.now();
  if (M._pokyd_load_dictionaries() !== 0)
    throw new Error("pokyd_load_dictionaries: " + chyba(M));
  const cas_nacitani = performance.now() - t0;
  if (M._pokyd_phase() !== 6 /* POKYD_FAZE_HOTOVO */)
    throw new Error("loaded, but pokyd_phase() says " + M._pokyd_phase());

  /* After loading, not before: the cold path reseeds from the clock on its way
     out (SLOVNIK.FU:1732). */
  M._pokyd_seed(SEMENO);

  const kusy = [];
  const t1 = performance.now();
  for (const veta of vety) {
    const p = uloz_retezec(M, veta);
    const odpoved = nacti_retezec(M, M._pokyd_say(p));
    M._free(p);
    if (odpoved === null) throw new Error("pokyd_say returned NULL");
    kusy.push(Buffer.from("> ", "latin1"), veta, Buffer.from("\r\n", "latin1"));
    kusy.push(Buffer.from("< ", "latin1"), odpoved, Buffer.from("\r\n", "latin1"));
    if (verbose) {
      process.stdout.write("  > " + veta.toString("latin1") + "\n");
      process.stdout.write("  < " + odpoved.toString("latin1") + "\n");
    }
  }
  const cas_odpovedi = performance.now() - t1;

  const poctvet = M._pokyd_sentence_count();

  /* Export before shutdown: SLOVNIK.TMP lives in this instance's MEMFS and goes
     away with it. */
  let vyvezena = null;
  const delka = M._malloc(4);
  const blok = M._pokyd_export_cache(delka);
  if (blok !== 0) {
    /* The length comes back through an unsigned long *, which is 32 bits little
       endian on wasm32.  Read off HEAPU8 rather than HEAPU32 so the module needs
       only the one view exported. */
    const h = M.HEAPU8;
    const kolik = h[delka] | (h[delka + 1] << 8) | (h[delka + 2] << 16)
      | (h[delka + 3] * 0x1000000);
    vyvezena = Buffer.from(M.HEAPU8.subarray(blok, blok + kolik));
    M._pokyd_free(blok);
  }
  M._free(delka);
  M._free(n);

  const neuvolneno = M._pokyd_shutdown();

  return {
    prepis: Buffer.concat(kusy),
    cas_nacitani, cas_odpovedi, neuvolneno, poctvet, cache: vyvezena,
  };
}

function zkontroluj_rozlozeni(M, n, popis) {
  /* The one thing that could silently corrupt every setting at once: an offset
     table that has drifted from the header.  NASTAV_STANDARDNE has just run, so
     the defaults it wrote (NASTAVEN.PR:25-43) are known, and reading them back
     through these offsets is a real check of the layout. */
  const h = M.HEAPU8;
  const ocekavano = {
    pohlavicloveka: 1, pohlavipocitace: 1, charakter: 3, nalada: 3,
    ukladatrozhovor: 1, pouzivatzvuky: 1, pouzivatefekty: 0,
    spisovnacestina: 0, zobrazovatpopisky: 1,
    debug_rychleukoncovani: 0, debug_tolerancepravopisu: 1,
    debug_pravopisnarekurze: 11, emulovatklavesnici: 0, klavesniceqwerty: 1,
    standardnikurzor: 0,
  };
  for (const [jmeno, hodnota] of Object.entries(ocekavano)) {
    if (h[n + POSUN[jmeno]] !== hodnota)
      throw new Error(popis + ": struct pokyd_settings does not match pokyd_api.h -- "
        + jmeno + " reads " + h[n + POSUN[jmeno]]
        + ", NASTAV_STANDARDNE wrote " + hodnota);
  }
  if (h[n + POSUN.jmenocloveka] !== 0 || h[n + POSUN.jmenopocitace] !== 0)
    throw new Error(popis + ": the name fields are not where pokyd_api.h says they are");
}

/* ------------------------------------------------------------------- the diff */

function porovnej(co, mame, ocekavame) {
  if (mame.equals(ocekavame)) {
    console.log("  ok    " + co + ": " + mame.length + " bytes, identical");
    return 0;
  }
  console.log("  FAIL  " + co + ": differs from the golden file");
  console.log("        " + mame.length + " bytes here, " + ocekavame.length + " expected");

  let i = 0;
  while (i < mame.length && i < ocekavame.length && mame[i] === ocekavame[i]) i++;
  const radek = ocekavame.subarray(0, i).toString("latin1").split("\r\n").length;
  console.log("        first difference at byte " + i + ", line " + radek);

  const nase = mame.toString("latin1").split("\r\n");
  const jejich = ocekavame.toString("latin1").split("\r\n");
  for (let r = Math.max(0, radek - 2); r < Math.min(jejich.length, radek + 2); r++) {
    if (nase[r] !== jejich[r]) {
      console.log("        line " + (r + 1) + " golden: " + JSON.stringify(jejich[r]));
      console.log("        line " + (r + 1) + " wasm:   " + JSON.stringify(nase[r]));
    }
  }
  return 1;
}

function zkontroluj_zbytek(kdy, beh, kolikvet) {
  let chyby = 0;
  if (beh.poctvet !== kolikvet) {
    console.log("  FAIL  " + kdy + ": pokyd_sentence_count() is " + beh.poctvet
      + ", expected " + kolikvet);
    chyby++;
  }
  if (beh.neuvolneno !== 0) {
    console.log("  FAIL  " + kdy + ": " + beh.neuvolneno + " memory blocks were not freed");
    chyby++;
  } else {
    console.log("  ok    " + kdy + ": teardown clean, 0 unfreed blocks");
  }
  return chyby;
}

/* --------------------------------------------------------------------- driver */

async function main() {
  let verbose = false, warm = true, hluk = false;
  let modul = join(KOREN, "build", "wasm", "pokyd.mjs");
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "-v" || argv[i] === "--verbose") verbose = true;
    else if (argv[i] === "--no-warm") warm = false;
    else if (argv[i] === "--noise") hluk = true;
    else if (argv[i] === "--module" && i + 1 < argv.length) modul = argv[++i];
    else {
      console.error('smoke: unknown option "' + argv[i] + '"');
      console.error("usage: node test/wasm/smoke.mjs [-v] [--noise] [--no-warm]"
        + " [--module FILE]");
      return 2;
    }
  }

  if (!existsSync(modul)) {
    console.error("smoke: no " + modul
      + "\n       build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const zlate = readFileSync(join(KOREN, "test", "golden", "rozhovor.txt"));
  const vstup = readFileSync(join(KOREN, "test", "golden", "rozhovor.in"));
  /* Exactly what the driver's loop does: strip the CR, drop empty lines
     (mfcDlg.cpp:556), keep every other byte as it lies. */
  const vety = vstup.toString("latin1").split("\n")
    .map((r) => Buffer.from(r.replace(/\r+$/, ""), "latin1"))
    .filter((b) => b.length > 0);

  console.log("node    " + process.version);
  console.log("module  " + modul);
  console.log("input   " + vety.length + " sentences");

  const { default: PokydModule } = await import(pathToFileURL(modul).href);

  let chyby = 0;

  console.log("\ncold (empty MEMFS, the dictionary gets inflected):");
  const studeny = await jeden_rozhovor(PokydModule, vety,
    { cache: null, verbose, hluk, popis: "cold" });
  console.log("  load  " + (studeny.cas_nacitani / 1000).toFixed(2) + " s, "
    + vety.length + " answers in " + studeny.cas_odpovedi.toFixed(0) + " ms");
  writeFileSync(join(KOREN, "build", "wasm", "rozhovor-cold.txt"), studeny.prepis);
  chyby += porovnej("cold transcript", studeny.prepis, zlate);
  chyby += zkontroluj_zbytek("cold", studeny, vety.length);

  if (studeny.cache === null) {
    console.log("  FAIL  the cold run exported no cache -- no SLOVNIK.TMP was written");
    chyby++;
  } else {
    console.log("  ok    cache exported: " + studeny.cache.length + " bytes");
    const nativni = join(KOREN, "build", "run", "SLOVNIK.TMP");
    if (existsSync(nativni)) {
      chyby += porovnej("SLOVNIK.TMP vs the native one", studeny.cache,
        readFileSync(nativni));
    } else {
      console.log("  --    no build/run/SLOVNIK.TMP to compare it against"
        + " (run the native build first)");
    }
  }

  if (warm && studeny.cache !== null) {
    console.log("\nwarm (a second instance, the cache imported before loading):");
    const teply = await jeden_rozhovor(PokydModule, vety,
      { cache: studeny.cache, verbose, hluk, popis: "warm" });
    console.log("  load  " + (teply.cas_nacitani / 1000).toFixed(2) + " s, "
      + vety.length + " answers in " + teply.cas_odpovedi.toFixed(0) + " ms");
    writeFileSync(join(KOREN, "build", "wasm", "rozhovor-warm.txt"), teply.prepis);
    chyby += porovnej("warm transcript", teply.prepis, zlate);
    chyby += zkontroluj_zbytek("warm", teply, vety.length);
  }

  console.log(chyby === 0
    ? "\nPASS -- the wasm build answers exactly what the native one answered."
    : "\nFAIL -- " + chyby + " check(s) did not hold.");
  return chyby === 0 ? 0 : 1;
}

process.exit(await main());
