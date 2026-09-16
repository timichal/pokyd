/* IQ Pokyd - test/web/cache.test.mjs - phase 4.4 of PLAN.md, the gate.

   test/web/cache.test.ts checks the hash, the key and every branch of
   startCached against a recording client and a store that fails on demand -- all
   of it in node, where there is no IndexedDB at all.  This runs the real thing:
   headless Chrome, a real database, an 18 MB blob, and two visits.

   The question is one sentence long.  Does a second visit find what the first
   one left, and does IQ Pokyd then say exactly what it said the slow way?

   Three things are worth watching in the output.

     1. The two load times.  3.4 measured 15.3 s of inflection against 0.11 s
        from a cache, and that ratio is the entire argument for this phase --
        4.2 made the fifteen seconds survivable, and this makes them happen once.
     2. The hash of the blob read back out of the store.  It is compared against
        the hash of build/run/SLOVNIK.TMP, which the *native* engine wrote, so a
        pass says the bytes that came back out of IndexedDB are byte-identical to
        the native cache -- across two toolchains and a structured clone.  A
        matching length would not have said that.
     3. The transcripts.  Both visits reproduce test/golden/rozhovor.txt byte for
        byte.  The warm one is the one that matters: it never inflected anything,
        it was handed 18 MB out of a database and believed it.

   Run it:   node test/web/cache.test.mjs [--head]

   Needs python3 tools/build.py --wasm to have run, and build/run/SLOVNIK.TMP for
   the byte-identity check -- without it the blob is only checked for length, and
   the run says so.  --head shows the browser window.  The profile is a fresh
   temp directory every time (test/browser.mjs), so the first visit really is a
   first visit.  No package.json and no driver.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { KOREN, spustStranku } from "../browser.mjs";
import { fnv1a64, pokydCacheKey, POKYD_CACHE_VERSION } from "../../src/web/cache.ts";

const MODUL = join(KOREN, "build", "wasm", "pokyd.mjs");
const NATIVNI_CACHE = join(KOREN, "build", "run", "SLOVNIK.TMP");
const SLOVNIK = join(KOREN, "original", "slovnik.iqp");

/* A warm load may take no longer than this.  It is a very loose bound -- 3.4
   measured 0.11 s and 4.2 measured 0.2 s -- because the point is that it is not
   fifteen seconds, not that it is any particular fraction of a second on a
   machine running a headless browser under a test. */
const NEJDELSI_TEPLE_NACTENI_MS = 4000;

/* And it has to be decisively faster than the cold one, or the cache bought
   nothing.  The measured ratio is about 100x; this asks for 5. */
const NEJMENSI_ZRYCHLENI = 5;

let poctu = 0;
let chyby = 0;

function nadpis(text) { console.log("\n" + text); }

function ok(co, podminka, detail = "") {
  poctu++;
  if (podminka) console.log("  ok    " + co);
  else {
    chyby++;
    console.log("  FAIL  " + co + (detail ? "\n        " + detail : ""));
  }
}

function rovno(co, mame, ocekavame) {
  ok(co, Object.is(mame, ocekavame),
    "got " + JSON.stringify(mame) + ", expected " + JSON.stringify(ocekavame));
}

function porovnejPrepis(co, bajty, zlate) {
  poctu++;
  const mame = Uint8Array.from(bajty);
  let i = 0;
  while (i < mame.length && i < zlate.length && mame[i] === zlate[i]) i++;
  if (i === mame.length && mame.length === zlate.length) {
    console.log("  ok    " + co + ": " + mame.length + " bytes, identical");
    return;
  }
  chyby++;
  console.log("  FAIL  " + co + ": differs from the golden file");
  console.log("        " + mame.length + " bytes here, " + zlate.length + " expected");
  console.log("        first difference at byte " + i);
  const nase = Buffer.from(mame).toString("latin1").split("\r\n");
  const jejich = Buffer.from(zlate).toString("latin1").split("\r\n");
  const radek = Buffer.from(zlate.subarray(0, i)).toString("latin1").split("\r\n").length;
  for (let r = Math.max(0, radek - 2); r < Math.min(jejich.length, radek + 1); r++) {
    if (nase[r] !== jejich[r]) {
      console.log("        line " + (r + 1) + " golden:  " + JSON.stringify(jejich[r]));
      console.log("        line " + (r + 1) + " browser: " + JSON.stringify(nase[r]));
    }
  }
}

/* What every visit has to be true of, cache or no cache.  If these move, the
   cache is not what went wrong. */
function zkontrolujNavstevu(beh, zlate, vet) {
  porovnejPrepis(beh.druh + " transcript, through IndexedDB and back", beh.prepis, zlate);
  rovno(beh.druh + ": pokyd_sentence_count()", beh.poctvet, vet);
  rovno(beh.druh + ": unfreed blocks", beh.neuvolneno, 0);
  rovno(beh.druh + ": no storage trouble was reported", beh.zprava.error, null);
  /* The three defaults the golden file was recorded under -- NASTAV_STANDARDNE's
     own, so this is a check on the engine and not on the page. */
  rovno(beh.druh + ": charakter is still 3 (prumerny) by default",
    beh.nastaveni.charakter, 3);
  rovno(beh.druh + ": nalada is 3 (normalni) after setMood",
    beh.nastaveni.nalada, 3);
  ok(beh.druh + ": both genders are still 1 by default",
    beh.nastaveni.pohlavicloveka === 1 && beh.nastaveni.pohlavipocitace === 1,
    "human " + beh.nastaveni.pohlavicloveka
    + ", computer " + beh.nastaveni.pohlavipocitace);
}

async function main() {
  let viditelne = false;
  for (const prepinac of process.argv.slice(2)) {
    if (prepinac === "--head") viditelne = true;
    else {
      console.error("cache.test: unknown option \"" + prepinac + "\"");
      console.error("usage: node test/web/cache.test.mjs [--head]");
      return 2;
    }
  }

  if (!existsSync(MODUL)) {
    console.error("cache.test: no " + MODUL
      + "\n            build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const zlate = new Uint8Array(
    readFileSync(join(KOREN, "test", "golden", "rozhovor.txt")));

  /* The key the page must arrive at, computed here from the file on disk.  If
     the browser reports a different one, the engine is not carrying the
     dictionary this checkout holds. */
  const hashNaDisku = fnv1a64(new Uint8Array(readFileSync(SLOVNIK)));
  const klicNaDisku = pokydCacheKey(hashNaDisku);

  /* And what the blob is supposed to be, if there is a native one to ask. */
  let nativniHash = null;
  let nativniDelka = 0;
  if (existsSync(NATIVNI_CACHE)) {
    const nativni = new Uint8Array(readFileSync(NATIVNI_CACHE));
    nativniDelka = nativni.length;
    nativniHash = fnv1a64(nativni);
  }

  const { data, url } = await spustStranku({
    stranka: "test/web/cache.html", viditelne, casovyLimitMs: 240000,
  });
  if (data.chyba) {
    console.error("\nthe page failed:\n" + data.chyba);
    return 1;
  }

  console.log("where   " + data.kde);
  console.log("page    " + url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ""));
  console.log("key     " + klicNaDisku);

  nadpis("the first visit");
  ok("the database started empty, so this was a real first visit",
    data.naZacatku.length === 0,
    "it already held: " + JSON.stringify(data.naZacatku));
  rovno("nothing was found", data.cold.zprava.hit, false);
  rovno("so it inflected the dictionary and saved the result",
    data.cold.zprava.saved, true);
  rovno("under the key derived from the dictionary on disk",
    data.cold.zprava.key, klicNaDisku);
  rovno("and that is the only record now",
    JSON.stringify(data.poStudenem), JSON.stringify([klicNaDisku]));
  console.log("        load " + (data.cold.zprava.loadMs / 1000).toFixed(2)
    + " s, " + data.cold.zprava.bytes + " bytes stored");
  zkontrolujNavstevu(data.cold, zlate, data.vety);

  nadpis("what is in the store");
  rovno("a new connection sees the same one record",
    JSON.stringify(data.klicePriDruhemOtevreni), JSON.stringify([klicNaDisku]));
  ok("the blob came back", data.ulozeny !== null,
    "get() returned null for " + klicNaDisku);
  if (data.ulozeny) {
    if (nativniHash !== null) {
      rovno("it is the same length as the native SLOVNIK.TMP",
        data.ulozeny.delka, nativniDelka);
      rovno("and byte for byte the same file -- fnv1a64 through IndexedDB",
        data.ulozeny.hash, nativniHash);
    } else {
      ok("it is " + data.ulozeny.delka + " bytes", data.ulozeny.delka > 0);
      console.log("        no build/run/SLOVNIK.TMP to compare it against;"
        + " run python3 tools/build.py to make one");
    }
  }
  rovno("the dictionary hash in the key is the one node computes",
    data.hashSlovniku, hashNaDisku);

  nadpis("the misses");
  ok("a cache inflected from a different dictionary is not found",
    data.minulo.jinySlovnik);
  ok("nor one made by a different engine version -- what "
    + "POKYD_CACHE_VERSION=" + JSON.stringify(POKYD_CACHE_VERSION) + " is for",
    data.minulo.jinaVerze);

  nadpis("the return visit");
  rovno("the stored blob was found and imported", data.warm.zprava.hit, true);
  rovno("nothing was written a second time", data.warm.zprava.saved, false);
  rovno("it restored the whole blob", data.warm.zprava.bytes,
    data.ulozeny ? data.ulozeny.delka : -1);
  zkontrolujNavstevu(data.warm, zlate, data.vety);

  /* The measurement the phase exists for. */
  const studene = data.cold.zprava.loadMs;
  const teple = data.warm.zprava.loadMs;
  console.log("        cold " + (studene / 1000).toFixed(2) + " s -> warm "
    + (teple / 1000).toFixed(2) + " s  (" + (studene / teple).toFixed(0) + "x)");
  ok("the warm load took " + teple.toFixed(0) + " ms, which is a page that opens"
    + " rather than one that thinks", teple < NEJDELSI_TEPLE_NACTENI_MS,
    "it took " + teple.toFixed(0) + " ms, more than the "
    + NEJDELSI_TEPLE_NACTENI_MS + " ms this test allows");
  ok("and it is " + (studene / teple).toFixed(0) + "x faster than inflecting"
    + " from scratch", studene / teple >= NEJMENSI_ZRYCHLENI,
    "only " + (studene / teple).toFixed(1) + "x");

  nadpis("housekeeping");
  rovno("a stale key and the live one were both there", data.prorez.pred.length, 2);
  rovno("pruning dropped the stale one", data.prorez.smazano, 1);
  rovno("and left the live one alone",
    JSON.stringify(data.prorez.po), JSON.stringify([klicNaDisku]));
  rovno("which is still the whole blob", data.prorez.zustalo,
    data.ulozeny ? data.ulozeny.delka : -1);

  ok("a record whose blob does not match its recorded length was written",
    data.poskozeny.bylTam);
  rovno("get() refuses it rather than handing it to the engine",
    data.poskozeny.vratil, null);
  ok("and throws it away, so the next visit re-inflects instead of looping",
    data.poskozeny.zbylTam === false);

  rovno("clear() empties the store", data.poVycisteni.length, 0);
  ok("the page was cross-origin isolated, as test/browser.mjs intends",
    data.isolated === true);

  console.log(chyby === 0
    ? "\nPASS -- " + poctu + " checks.  The second visit costs "
      + (teple / 1000).toFixed(2) + " s and says the same things as the first."
    : "\nFAIL -- " + chyby + " of " + poctu + " checks did not hold.");
  return chyby === 0 ? 0 : 1;
}

process.exit(await main());
