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

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { ROOT, runPage } from "../browser.mjs";
import { fnv1a64, pokydCacheKey, POKYD_CACHE_VERSION } from "../../src/web/cache.ts";

const MODULE_PATH = join(ROOT, "build", "wasm", "pokyd.mjs");
const NATIVE_CACHE = join(ROOT, "build", "run", "SLOVNIK.TMP");
const DICT_PATH = join(ROOT, "original", "slovnik.iqp");

/* A warm load may take no longer than this.  It is a very loose bound -- 3.4
   measured 0.11 s and 4.2 measured 0.2 s -- because the point is that it is not
   fifteen seconds, not that it is any particular fraction of a second on a
   machine running a headless browser under a test. */
const MAX_WARM_LOAD_MS = 4000;

/* And it has to be decisively faster than the cold one, or the cache bought
   nothing.  The measured ratio is about 100x; this asks for 5. */
const MIN_SPEEDUP = 5;

let checks = 0;
let failures = 0;

function heading(text) { console.log("\n" + text); }

function ok(label, cond, detail = "") {
  checks++;
  if (cond) console.log("  ok    " + label);
  else {
    failures++;
    console.log("  FAIL  " + label + (detail ? "\n        " + detail : ""));
  }
}

function eq(label, got, expected) {
  ok(label, Object.is(got, expected),
    "got " + JSON.stringify(got) + ", expected " + JSON.stringify(expected));
}

function compareTranscript(label, bytes, golden) {
  checks++;
  const got = Uint8Array.from(bytes);
  let i = 0;
  while (i < got.length && i < golden.length && got[i] === golden[i]) i++;
  if (i === got.length && got.length === golden.length) {
    console.log("  ok    " + label + ": " + got.length + " bytes, identical");
    return;
  }
  failures++;
  console.log("  FAIL  " + label + ": differs from the golden file");
  console.log("        " + got.length + " bytes here, " + golden.length + " expected");
  console.log("        first difference at byte " + i);
  const ours = Buffer.from(got).toString("latin1").split("\r\n");
  const theirs = Buffer.from(golden).toString("latin1").split("\r\n");
  const line = Buffer.from(golden.subarray(0, i)).toString("latin1").split("\r\n").length;
  for (let r = Math.max(0, line - 2); r < Math.min(theirs.length, line + 1); r++) {
    if (ours[r] !== theirs[r]) {
      console.log("        line " + (r + 1) + " golden:  " + JSON.stringify(theirs[r]));
      console.log("        line " + (r + 1) + " browser: " + JSON.stringify(ours[r]));
    }
  }
}

/* What every visit has to be true of, cache or no cache.  If these move, the
   cache is not what went wrong. */
function checkVisit(run, golden, count) {
  compareTranscript(run.kind + " transcript, through IndexedDB and back", run.transcript, golden);
  eq(run.kind + ": pokyd_sentence_count()", run.sentence_count, count);
  eq(run.kind + ": unfreed blocks", run.unfreed, 0);
  eq(run.kind + ": no storage trouble was reported", run.report.error, null);
  /* The three defaults the golden file was recorded under -- NASTAV_STANDARDNE's
     own, so this is a check on the engine and not on the page. */
  eq(run.kind + ": character is still 3 (prumerny) by default",
    run.settings.character, 3);
  eq(run.kind + ": mood is 3 (normalni) after setMood",
    run.settings.mood, 3);
  ok(run.kind + ": both genders are still 1 by default",
    run.settings.humanGender === 1 && run.settings.computerGender === 1,
    "human " + run.settings.humanGender
    + ", computer " + run.settings.computerGender);
}

async function main() {
  let visible = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--head") visible = true;
    else {
      console.error("cache.test: unknown option \"" + arg + "\"");
      console.error("usage: node test/web/cache.test.mjs [--head]");
      return 2;
    }
  }

  if (!existsSync(MODULE_PATH)) {
    console.error("cache.test: no " + MODULE_PATH
      + "\n            build it with: python3 tools/build.py --wasm");
    return 1;
  }

  const golden = new Uint8Array(
    readFileSync(join(ROOT, "test", "golden", "rozhovor.txt")));

  /* The key the page must arrive at, computed here from the file on disk.  If
     the browser reports a different one, the engine is not carrying the
     dictionary this checkout holds. */
  const hashOnDisk = fnv1a64(new Uint8Array(readFileSync(DICT_PATH)));
  const keyOnDisk = pokydCacheKey(hashOnDisk);

  /* And what the blob is supposed to be, if there is a native one to ask. */
  let nativeHash = null;
  let nativeLength = 0;
  if (existsSync(NATIVE_CACHE)) {
    const native = new Uint8Array(readFileSync(NATIVE_CACHE));
    nativeLength = native.length;
    nativeHash = fnv1a64(native);
  }

  const { data, url } = await runPage({
    page: "test/web/cache.html", visible, timeoutMs: 240000,
  });
  if (data.error) {
    console.error("\nthe page failed:\n" + data.error);
    return 1;
  }

  console.log("where   " + data.where);
  console.log("page    " + url.replace(/^http:\/\/127\.0\.0\.1:\d+/, ""));
  console.log("key     " + keyOnDisk);

  heading("the first visit");
  ok("the database started empty, so this was a real first visit",
    data.atStart.length === 0,
    "it already held: " + JSON.stringify(data.atStart));
  eq("nothing was found", data.cold.report.hit, false);
  eq("so it inflected the dictionary and saved the result",
    data.cold.report.saved, true);
  eq("under the key derived from the dictionary on disk",
    data.cold.report.key, keyOnDisk);
  eq("and that is the only record now",
    JSON.stringify(data.afterCold), JSON.stringify([keyOnDisk]));
  console.log("        load " + (data.cold.report.loadMs / 1000).toFixed(2)
    + " s, " + data.cold.report.bytes + " bytes stored");
  checkVisit(data.cold, golden, data.sentences);

  heading("what is in the store");
  eq("a new connection sees the same one record",
    JSON.stringify(data.keysOnReopen), JSON.stringify([keyOnDisk]));
  ok("the blob came back", data.stored !== null,
    "get() returned null for " + keyOnDisk);
  if (data.stored) {
    if (nativeHash !== null) {
      eq("it is the same length as the native SLOVNIK.TMP",
        data.stored.length, nativeLength);
      eq("and byte for byte the same file -- fnv1a64 through IndexedDB",
        data.stored.hash, nativeHash);
    } else {
      ok("it is " + data.stored.length + " bytes", data.stored.length > 0);
      console.log("        no build/run/SLOVNIK.TMP to compare it against;"
        + " run python3 tools/build.py to make one");
    }
  }
  eq("the dictionary hash in the key is the one node computes",
    data.dictHash, hashOnDisk);

  heading("the misses");
  ok("a cache inflected from a different dictionary is not found",
    data.misses.otherDictionary);
  ok("nor one made by a different engine version -- what "
    + "POKYD_CACHE_VERSION=" + JSON.stringify(POKYD_CACHE_VERSION) + " is for",
    data.misses.otherVersion);

  heading("the return visit");
  eq("the stored blob was found and imported", data.warm.report.hit, true);
  eq("nothing was written a second time", data.warm.report.saved, false);
  eq("it restored the whole blob", data.warm.report.bytes,
    data.stored ? data.stored.length : -1);
  checkVisit(data.warm, golden, data.sentences);

  /* The measurement the phase exists for. */
  const coldMs = data.cold.report.loadMs;
  const warmMs = data.warm.report.loadMs;
  console.log("        cold " + (coldMs / 1000).toFixed(2) + " s -> warm "
    + (warmMs / 1000).toFixed(2) + " s  (" + (coldMs / warmMs).toFixed(0) + "x)");
  ok("the warm load took " + warmMs.toFixed(0) + " ms, which is a page that opens"
    + " rather than one that thinks", warmMs < MAX_WARM_LOAD_MS,
    "it took " + warmMs.toFixed(0) + " ms, more than the "
    + MAX_WARM_LOAD_MS + " ms this test allows");
  ok("and it is " + (coldMs / warmMs).toFixed(0) + "x faster than inflecting"
    + " from scratch", coldMs / warmMs >= MIN_SPEEDUP,
    "only " + (coldMs / warmMs).toFixed(1) + "x");

  heading("housekeeping");
  eq("a stale key and the live one were both there", data.pruning.before.length, 2);
  eq("pruning dropped the stale one", data.pruning.deleted, 1);
  eq("and left the live one alone",
    JSON.stringify(data.pruning.after), JSON.stringify([keyOnDisk]));
  eq("which is still the whole blob", data.pruning.kept,
    data.stored ? data.stored.length : -1);

  ok("a record whose blob does not match its recorded length was written",
    data.damaged.wasThere);
  eq("get() refuses it rather than handing it to the engine",
    data.damaged.returned, null);
  ok("and throws it away, so the next visit re-inflects instead of looping",
    data.damaged.stillThere === false);

  eq("clear() empties the store", data.afterClear.length, 0);
  ok("the page was cross-origin isolated, as test/browser.mjs intends",
    data.isolated === true);

  console.log(failures === 0
    ? "\nPASS -- " + checks + " checks.  The second visit costs "
      + (warmMs / 1000).toFixed(2) + " s and says the same things as the first."
    : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
  return failures === 0 ? 0 : 1;
}

process.exit(await main());
