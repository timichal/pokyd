/* IQ Pokyd - test/run.mjs - every test in this repository, in order.

   Added at phase 5.1 with the package.json, because `npm test` ought to mean
   something. It is a list and a loop: each entry is a node program that prints
   its own checks and exits non-zero if one did not hold, and this runs them one
   after another and says which ones failed.

   In order, and not in parallel, deliberately. Half of these launch a headless
   Chrome and inflect 402,252 word forms in it; two of them race a real
   IndexedDB. Running them at once would make the timings meaningless and the
   failures unreproducible, and the whole set takes a few minutes either way.

   Run it:   node test/run.mjs [--quick] [pattern ...]

   --quick keeps only the tests that do not start a browser. A pattern keeps the
   tests whose name contains it. Needs python3 tools/build.py --wasm to have run
   -- everything except the codec loads the engine -- and npm install for
   test/app/chat.test.mjs, which builds the app with Vite first.

   Written by us, not ported. English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* phase, what it runs, and whether it needs a browser. The order is the order
   of PLAN.md: the codec, then the engine, then the boundary, then the page. */
const TESTS = [
  { phase: "3.3", file: "test/wasm/smoke.mjs", browser: false },
  { phase: "4.1", file: "test/web/cp1250.test.ts", browser: false },
  { phase: "4.2", file: "test/web/engine.test.ts", browser: false },
  { phase: "4.2", file: "test/web/worker.test.mjs", browser: true },
  { phase: "4.3", file: "test/web/progress.test.ts", browser: false },
  { phase: "4.3", file: "test/web/progress.test.mjs", browser: true },
  { phase: "4.4", file: "test/web/cache.test.ts", browser: false },
  { phase: "4.4", file: "test/web/cache.test.mjs", browser: true },
  { phase: "5.2", file: "test/app/chat.test.mjs", browser: true },
  { phase: "6.1", file: "test/app/resources.test.ts", browser: false },
  { phase: "6.2", file: "test/app/assets.test.ts", browser: false },
  { phase: "6.3", file: "test/app/caption.test.ts", browser: false },
  { phase: "6.4", file: "test/app/greeting.test.ts", browser: false },
  { phase: "7.1", file: "test/app/settings.test.ts", browser: false },
  { phase: "7.3", file: "test/app/config.test.ts", browser: false },
  { phase: "8.2", file: "test/app/help.test.ts", browser: false },
  { phase: "8.4", file: "test/app/debug.test.ts", browser: false },
];

const args = process.argv.slice(2);
const quick = args.includes("--quick");
const patterns = args.filter((a) => !a.startsWith("--"));

const chosen = TESTS.filter((t) => {
  if (quick && t.browser) return false;
  if (patterns.length === 0) return true;
  return patterns.some((p) => t.file.includes(p));
});

if (chosen.length === 0) {
  console.error("nothing to run; the tests are:\n  "
    + TESTS.map((t) => t.file).join("\n  "));
  process.exit(1);
}

console.log("IQ Pokyd - " + chosen.length + " of " + TESTS.length + " tests\n");

const results = [];
for (const test of chosen) {
  const label = test.phase + "  " + test.file;
  console.log("=".repeat(72));
  console.log(label + (test.browser ? "   (launches a browser)" : ""));
  console.log("=".repeat(72));

  const t0 = Date.now();
  const run = spawnSync(process.execPath, [test.file],
    { cwd: ROOT, stdio: "inherit" });
  const seconds = (Date.now() - t0) / 1000;

  results.push({ label, ok: run.status === 0, seconds, status: run.status });
  console.log("");
}

console.log("=".repeat(72));
let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log((r.ok ? "  pass  " : "  FAIL  ") + r.label
    + "   " + r.seconds.toFixed(1) + " s"
    + (r.ok ? "" : " (exit " + r.status + ")"));
}
console.log(failed === 0
  ? "\nall " + results.length + " passed."
  : "\n" + failed + " of " + results.length + " failed.");
process.exit(failed === 0 ? 0 : 1);
