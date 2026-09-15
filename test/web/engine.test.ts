/* IQ Pokyd - test/web/engine.test.ts - phase 4.2 of PLAN.md, the string boundary.

   test/wasm/smoke.mjs already proves the wasm engine answers what the native one
   answers, and it does it in bytes on purpose: it predates the codec, so nothing
   sits between the golden file and the engine.  This asks the next question.
   src/web/engine.ts puts phase 4.1's codec on both ends -- a JavaScript string
   goes in, a JavaScript string comes out -- and the question is whether the
   conversation survives that.

   It does if, and only if, re-encoding the answers reproduces
   test/golden/rozhovor.txt byte for byte.  1,116 bytes of Czech with thirty
   accented letters in it, so a codec that lost or bent one of them could not.

   What else is checked here, roughly in order of how much it would hurt to be
   wrong:

     1. the transcript, cold and warm, through decode -> say -> encode
     2. the ordering rules pokyd_api.h states and does not enforce: seeding
        before a load, importing a cache after one, saying anything before one.
        All three are silent failures in C and exceptions here.
     3. the 220-byte settings struct, read and written from JavaScript,
        including a Czech name that has to survive as CP1250 in a char[101]
     4. that the engine's console output reaches JS *during* the synchronous
        load -- the finding phase 4.3 is built on, and the reason
        src/web/protocol.ts says what it says about g_procentanacitani
     5. a clean teardown: zero unfreed blocks, both runs

   There is no Worker here.  This file drives PokydEngine directly, because that
   class is deliberately transport-free and node has no Web Worker; the protocol,
   the worker and the client are tested in a real browser by
   test/web/worker.test.mjs.

   Run it:   node test/web/engine.test.ts [--no-cold] [-v]

   Needs python3 tools/build.py --wasm to have run.  --no-cold skips the
   fourteen-second cold load and warms up from build/run/SLOVNIK.TMP instead,
   which is a faster way of running everything except the cold path.

   No package.json, no dependencies: node 24 strips the types itself.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code,
   so every Czech letter in here is a \u escape.
*/

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { decodeCp1250, encodeCp1250 } from "../../src/web/cp1250.ts";
import { PokydEngine, POKYD_SETTINGS_SIZE } from "../../src/web/engine.ts";
import type { PokydModuleFactory } from "../../src/web/engine.ts";
import { POKYD_PHASE_DONE, POKYD_PHASE_INFLECTING } from "../../src/web/protocol.ts";
import type { PokydSettings } from "../../src/web/protocol.ts";

const KOREN = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MODUL = join(KOREN, "build", "wasm", "pokyd.mjs");

/* The settings the golden conversation was recorded with -- test/golden/README.md.
   They are NASTAV_STANDARDNE's own defaults, pinned here for the same reason the
   driver pins them on the command line: so the test does not move if a default
   does. */
const SEMENO = 20050415;
const CHARAKTER = 3;            /* prumerny */
const NALADA = 3;               /* normalni */
const POHLAVI_CLOVEKA = 1;      /* muz -- NASTAVEN.PR:26 */
const POHLAVI_POCITACE = 1;

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

function hodi(co: string, cinnost: () => void, castZpravy: string): void {
  poctu++;
  try {
    cinnost();
    chyby++;
    console.log("  FAIL  " + co + "\n        it did not throw");
  } catch (e) {
    const zprava = e instanceof Error ? e.message : String(e);
    if (zprava.indexOf(castZpravy) >= 0) {
      console.log("  ok    " + co);
    } else {
      chyby++;
      console.log("  FAIL  " + co + "\n        threw " + JSON.stringify(zprava)
        + ", expected it to mention " + JSON.stringify(castZpravy));
    }
  }
}

/* ----------------------------------------------------------------- the diff */

function porovnejBajty(co: string, mame: Uint8Array, ocekavame: Uint8Array): void {
  poctu++;
  if (mame.length === ocekavame.length) {
    let i = 0;
    while (i < mame.length && mame[i] === ocekavame[i]) i++;
    if (i === mame.length) {
      console.log("  ok    " + co + ": " + mame.length + " bytes, identical");
      return;
    }
  }
  chyby++;
  let i = 0;
  while (i < mame.length && i < ocekavame.length && mame[i] === ocekavame[i]) i++;
  const radek = decodeCp1250(ocekavame.subarray(0, i)).split("\r\n").length;
  console.log("  FAIL  " + co + ": differs from the golden file");
  console.log("        " + mame.length + " bytes here, " + ocekavame.length + " expected");
  console.log("        first difference at byte " + i + ", line " + radek);
  const nase = decodeCp1250(mame).split("\r\n");
  const jejich = decodeCp1250(ocekavame).split("\r\n");
  for (let r = Math.max(0, radek - 2); r < Math.min(jejich.length, radek + 1); r++) {
    if (nase[r] !== jejich[r]) {
      console.log("        line " + (r + 1) + " golden: " + JSON.stringify(jejich[r]));
      console.log("        line " + (r + 1) + " engine: " + JSON.stringify(nase[r]));
    }
  }
}

/* --------------------------------------------------------------------- a run */

interface Vystup {
  segmenty: string[];
  behemNacitani: number;
  procentaBehemSklonovani: number[];
  fazeBehemNacitani: Set<number>;
}

interface Beh {
  prepis: Uint8Array;
  vystup: Vystup;
  neuvolneno: number;
  poctvet: number;
  cache: Uint8Array | null;
  nacitani_ms: number;
}

async function jedenRozhovor(factory: PokydModuleFactory, vety: string[],
                             volby: { cache: Uint8Array | null; vyvez: boolean;
                                      verbose: boolean }): Promise<Beh> {
  const vystup: Vystup = {
    segmenty: [], behemNacitani: 0, procentaBehemSklonovani: [],
    fazeBehemNacitani: new Set<number>(),
  };
  let nacita = false;

  const motor = await PokydEngine.create(factory, {
    onOutput: (text: string) => {
      vystup.segmenty.push(text);
      if (!nacita) return;
      vystup.behemNacitani++;
      /* Read from inside the blocked call: this is exactly what the worker does
         and the only moment the counters mean anything. */
      const stav = motor.progress();
      vystup.fazeBehemNacitani.add(stav.phase);
      if (stav.phase === POKYD_PHASE_INFLECTING) {
        vystup.procentaBehemSklonovani.push(stav.percent);
      }
    },
  });

  if (volby.cache !== null) motor.importCache(volby.cache);

  const nastaveni = motor.getSettings();
  nastaveni.pohlavicloveka = POHLAVI_CLOVEKA;
  nastaveni.pohlavipocitace = POHLAVI_POCITACE;
  nastaveni.charakter = CHARAKTER;
  motor.setSettings(nastaveni);
  motor.setMood(NALADA);

  nacita = true;
  const t0 = performance.now();
  motor.load();
  const nacitani_ms = performance.now() - t0;
  nacita = false;

  motor.seed(SEMENO);

  let prepis = "";
  for (const veta of vety) {
    const odpoved = motor.say(veta);
    prepis += "> " + veta + "\r\n< " + odpoved + "\r\n";
    if (volby.verbose) console.log("    > " + veta + "\n    < " + odpoved);
  }

  const poctvet = motor.sentenceCount();
  const cache = volby.vyvez ? motor.exportCache() : null;
  const neuvolneno = motor.shutdown();

  return {
    prepis: encodeCp1250(prepis), vystup, neuvolneno, poctvet, cache,
    nacitani_ms,
  };
}

/* -------------------------------------------------------------------- driver */

async function main(): Promise<number> {
  let studenyBeh = true;
  let verbose = false;
  for (const prepinac of process.argv.slice(2)) {
    if (prepinac === "--no-cold") studenyBeh = false;
    else if (prepinac === "-v" || prepinac === "--verbose") verbose = true;
    else {
      console.error("engine.test: unknown option \"" + prepinac + "\"");
      console.error("usage: node test/web/engine.test.ts [--no-cold] [-v]");
      return 2;
    }
  }

  if (!existsSync(MODUL)) {
    console.error("engine.test: no " + MODUL
      + "\n             build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const zlate = new Uint8Array(readFileSync(join(KOREN, "test", "golden", "rozhovor.txt")));
  /* Exactly what the driver's loop does: strip the CR, drop empty lines
     (mfcDlg.cpp:556).  Decoded here, because above src/web/engine.ts everything
     is a string -- which is the thing being tested. */
  const vety = decodeCp1250(readFileSync(join(KOREN, "test", "golden", "rozhovor.in")))
    .split("\n").map((r) => r.replace(/\r+$/, "")).filter((r) => r.length > 0);

  const { default: factory } =
    await import(pathToFileURL(MODUL).href) as { default: PokydModuleFactory };

  console.log("node    " + process.version);
  console.log("module  " + MODUL);
  console.log("input   " + vety.length + " sentences, decoded from CP1250");

  const nativniCache = join(KOREN, "build", "run", "SLOVNIK.TMP");
  let blob: Uint8Array | null = null;

  if (studenyBeh) {
    nadpis("cold (an empty MEMFS, so the dictionary gets inflected)");
    const beh = await jedenRozhovor(factory, vety,
      { cache: null, vyvez: true, verbose });
    console.log("  load  " + (beh.nacitani_ms / 1000).toFixed(2) + " s");
    porovnejBajty("cold transcript, re-encoded", beh.prepis, zlate);
    rovno("cold: pokyd_sentence_count()", beh.poctvet, vety.length);
    rovno("cold: unfreed blocks", beh.neuvolneno, 0);

    /* 4. The finding phase 4.3 is built on.  Emscripten calls the stdout hook
       synchronously from inside pokyd_load_dictionaries(), so text arrives while
       the call has not returned -- and the counter that ought to accompany it
       does not move, because SLOVNIK.FU:3318 is behind IQPOKYDWINMFC == 1. */
    ok("the engine's console output arrives during the load, not after it",
      beh.vystup.behemNacitani > 100,
      beh.vystup.behemNacitani + " segments arrived while load() was running");
    ok("at least one of them is a percentage the loading bar could use",
      beh.vystup.segmenty.some((s) => /^\d+\.\d%\s*$/.test(s)),
      "no segment looked like \"47.3%\"");
    ok("it reports POKYD_PHASE_INFLECTING while it is inflecting",
      beh.vystup.fazeBehemNacitani.has(POKYD_PHASE_INFLECTING),
      "phases seen: " + [...beh.vystup.fazeBehemNacitani].join(", "));
    /* The claim is not "it never changes" -- the sub-step boundaries slam it to
       100 and back to 0 -- but "it never takes a value in between", which is
       what a progress bar would need.  SLOVNIK.FU:3318, the one assignment that
       would give it a gradient, is behind IQPOKYDWINMFC == 1. */
    const videna = [...new Set(beh.vystup.procentaBehemSklonovani)].sort((a, b) => a - b);
    ok("pokyd_progress() has no gradient through it -- see PROGRESS in protocol.ts",
      videna.length > 0 && videna.every((p) => p === 0 || p === 100),
      videna.length === 0
        ? "no sample was taken during POKYD_PHASE_INFLECTING"
        : "the counter took intermediate values: " + videna.slice(0, 8).join(", ")
            + " -- if SLOVNIK.FU:3318 is now compiled in, src/web/protocol.ts and"
            + " phase 4.3 both want updating");

    poctu++;
    if (beh.cache === null) {
      chyby++;
      console.log("  FAIL  the cold run exported no cache -- no SLOVNIK.TMP was written");
    } else {
      console.log("  ok    cache exported: " + beh.cache.length + " bytes");
      blob = beh.cache;
      if (existsSync(nativniCache)) {
        porovnejBajty("SLOVNIK.TMP vs the native one", blob,
          new Uint8Array(readFileSync(nativniCache)));
      }
    }
  } else if (existsSync(nativniCache)) {
    blob = new Uint8Array(readFileSync(nativniCache));
    console.log("\n--no-cold: warming up from build/run/SLOVNIK.TMP ("
      + blob.length + " bytes)");
  } else {
    console.error("engine.test: --no-cold needs build/run/SLOVNIK.TMP"
      + "\n             make one with: python3 tools/build.py");
    return 1;
  }

  if (blob !== null) {
    nadpis("warm (the cache imported before the load)");
    const beh = await jedenRozhovor(factory, vety,
      { cache: blob, vyvez: false, verbose });
    console.log("  load  " + (beh.nacitani_ms / 1000).toFixed(2) + " s");
    porovnejBajty("warm transcript, re-encoded", beh.prepis, zlate);
    rovno("warm: pokyd_sentence_count()", beh.poctvet, vety.length);
    rovno("warm: unfreed blocks", beh.neuvolneno, 0);
  }

  /* --------------------------------------------------------- the small ones */

  /* Everything below runs on an engine that is never loaded, so it costs a
     module instantiation and nothing else. */
  nadpis("the ordering rules pokyd_api.h states and does not enforce");
  {
    const motor = await PokydEngine.create(factory);
    rovno("a fresh engine is not loaded", motor.isLoaded, false);
    rovno("pokyd_phase() is POKYD_FAZE_NECINNY", motor.progress().phase, 0);
    hodi("say() before load() throws", () => motor.say("ahoj"), "not loaded");
    hodi("seed() before load() throws", () => motor.seed(1), "SLOVNIK.FU:1732");
    hodi("importCache() rejects an empty blob",
      () => motor.importCache(new Uint8Array(0)), "empty");
    hodi("setMood() rejects a mood outside 1..5", () => motor.setMood(6), "1..5");
    /* Found here, and it is the reason pokyd_api.h now says so: tearing down an
       engine that never loaded aborts the wasm module, because
       Typ_slova::VYMAZ_OBSAH frees twenty pointers that the base-dictionary read
       would have allocated and UVOLNI_X(NULL) is fatal by design. */
    hodi("shutdown() before a load throws rather than aborting the module",
      () => motor.shutdown(), "SKLONOV.FU:1348");
  }

  nadpis("the settings struct, from JavaScript");
  {
    const motor = await PokydEngine.create(factory);
    rovno("sizeof(struct pokyd_settings)", POKYD_SETTINGS_SIZE, 220);

    const vychozi = motor.getSettings();
    rovno("NASTAV_STANDARDNE: charakter", vychozi.charakter, 3);
    rovno("NASTAV_STANDARDNE: nalada", vychozi.nalada, 3);
    rovno("NASTAV_STANDARDNE: debug_pravopisnarekurze",
      vychozi.debug_pravopisnarekurze, 11);
    rovno("NASTAV_STANDARDNE: the names start out empty", vychozi.jmenocloveka, "");
    rovno("every field of struct pokyd_settings is present",
      Object.keys(vychozi).length, 20);

    /* "Michal" and "Pokyd" would prove nothing.  These are the letters CP1250
       has and ASCII does not, inside a char[101] the engine will read back. */
    const jmeno = "Zlatkovsk\u00fd \u010cen\u011bk";        /* Zlatkovsky Cenek */
    const pocitac = "IQ Pokyd \u2013 p\u0159\u00edtel";     /* en dash, r-caron */
    const nove: PokydSettings = { ...vychozi, jmenocloveka: jmeno,
      jmenopocitace: pocitac, pohlavicloveka: 1, spisovnacestina: 1 };
    motor.setSettings(nove);
    const zpet = motor.getSettings();
    rovno("a Czech name survives the round trip", zpet.jmenocloveka, jmeno);
    rovno("so does an en dash, which CP1250 has", zpet.jmenopocitace, pocitac);
    rovno("and so does a plain flag", zpet.spisovnacestina, 1);

    /* char[101] is a hundred bytes and a terminator, and CP1250 is one byte per
       character, so the two counts agree and truncation is exact. */
    const dlouhe = "\u017e".repeat(150);
    motor.setSettings({ ...zpet, jmenocloveka: dlouhe });
    rovno("a name longer than char[101] is truncated to 100 characters",
      motor.getSettings().jmenocloveka.length, 100);

    motor.setMood(5);
    const mrzuty = motor.getSettings();
    rovno("setMood(5) sets nalada", mrzuty.nalada, 5);
    ok("setMood(5) moves naladabody with it, which is the field that drifts",
      mrzuty.naladabody !== vychozi.naladabody,
      "naladabody is still " + mrzuty.naladabody);
  }

  nadpis("the phase constants agree with pokyd_api.h");
  {
    rovno("POKYD_FAZE_SKLONOVANI", POKYD_PHASE_INFLECTING, 3);
    rovno("POKYD_FAZE_HOTOVO", POKYD_PHASE_DONE, 6);
  }

  console.log(chyby === 0
    ? "\nPASS -- " + poctu + " checks.  The engine answers the same through a"
      + " string boundary as it does through a byte one."
    : "\nFAIL -- " + chyby + " of " + poctu + " checks did not hold.");
  return chyby === 0 ? 0 : 1;
}

process.exit(await main());
