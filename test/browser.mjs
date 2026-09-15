/* IQ Pokyd - test/browser.mjs - run a page in the browser it is going to ship in.

   Extracted at phase 4.2 from test/wasm/bench.mjs, which grew it at 3.4 and is
   now one of its two callers.  It serves the repository read-only over loopback,
   launches headless Chrome or Edge at a page in it, and waits for that page to
   POST its results back to /vysledek.  No driver, no puppeteer, no npm install
   -- there is still no package.json in this repo and neither 3.4 nor 4.2 needed
   one.

   The one thing it does that a plain static server does not: it strips the types
   out of any .ts it serves, with node's own stripTypeScriptTypes, and hands it
   over as JavaScript.  That is what lets a browser import src/web/*.ts directly,
   unbundled, at the same specifiers node uses -- so the module the browser runs
   is the file on disk and not a build of it.  Phase 5.1 brings Vite and takes
   this over; until then it is thirty lines and no dependencies.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize, sep } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { stripTypeScriptTypes } from "node:module";

export const KOREN = join(dirname(fileURLToPath(import.meta.url)), "..");

/* stripTypeScriptTypes is experimental and says so once per process.  We are
   using it for exactly one thing, deliberately, so the notice is noise in the
   middle of a test report -- but only that notice. */
process.removeAllListeners("warning");
process.on("warning", (varovani) => {
  if (varovani.name !== "ExperimentalWarning") console.warn(varovani);
});

export const PROHLIZECE = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

export function najdiProhlizec() {
  const exe = PROHLIZECE.find((p) => existsSync(p));
  if (!exe) {
    throw new Error("no Chrome or Edge found -- looked in:\n  "
      + PROHLIZECE.join("\n  "));
  }
  return exe;
}

const TYPY = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".txt": "application/octet-stream",
  ".in": "application/octet-stream",
};

function telo(cesta, url) {
  const syrove = readFileSync(cesta);
  if (extname(cesta) !== ".ts") return syrove;
  /* mode "strip" replaces the types with spaces rather than rewriting anything,
     so line and column numbers survive and a stack trace from the browser still
     points at the .ts on disk.  It refuses enums, namespaces and parameter
     properties; src/web/ uses none of them, and a refusal here is a loud 500
     rather than a mystery. */
  return stripTypeScriptTypes(syrove.toString("utf8"), {
    mode: "strip", sourceUrl: url,
  });
}

/* Serves the repo read-only and takes the page's results back on POST
   /vysledek.  The two Cross-Origin-* headers are not decoration: they are what
   makes the page crossOriginIsolated, which is what lets it call
   performance.measureUserAgentSpecificMemory() -- the only per-tab memory
   figure a browser will give out, and what 3.4 measured with. */
function server(hotovo, chybne) {
  return createServer((req, res) => {
    const hlavicky = {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Cache-Control": "no-store",
    };

    if (req.method === "POST" && req.url === "/vysledek") {
      const kusy = [];
      req.on("data", (k) => kusy.push(k));
      req.on("end", () => {
        res.writeHead(204, hlavicky).end();
        try { hotovo(JSON.parse(Buffer.concat(kusy).toString("utf8"))); }
        catch (e) { chybne(e); }
      });
      return;
    }

    const url = decodeURIComponent(req.url.split("?")[0]);
    const cesta = normalize(join(KOREN, url));
    if (!cesta.startsWith(KOREN + sep) || !existsSync(cesta) || !statSync(cesta).isFile()) {
      res.writeHead(404, hlavicky).end("no");
      return;
    }
    let obsah;
    try {
      obsah = telo(cesta, url);
    } catch (e) {
      res.writeHead(500, { ...hlavicky, "Content-Type": "text/plain" })
        .end("cannot serve " + url + ": " + e.message);
      return;
    }
    res.writeHead(200, {
      ...hlavicky,
      "Content-Type": TYPY[extname(cesta)] || "application/octet-stream",
    });
    res.end(obsah);
  });
}

/* Launch `stranka` (a repo-relative path) with `dotaz` (a query object) and
   resolve to whatever it POSTs to /vysledek.  `tichy` suppresses the two lines
   naming the browser and the URL, which a test that prints its own header does
   not want twice. */
export async function spustStranku({ stranka, dotaz = {}, viditelne = false,
                                     casovyLimitMs = 180000, tichy = false } = {}) {
  const exe = najdiProhlizec();

  let hotovo, chybne;
  const vysledek = new Promise((a, b) => { hotovo = a; chybne = b; });
  const srv = server(hotovo, chybne);
  await new Promise((a) => srv.listen(0, "127.0.0.1", a));
  const port = srv.address().port;

  const parametry = new URLSearchParams(dotaz).toString();
  const url = "http://127.0.0.1:" + port + "/" + stranka.replace(/^\/+/, "")
    + (parametry ? "?" + parametry : "");

  const profil = mkdtempSync(join(tmpdir(), "pokyd-browser-"));
  const prepinace = [
    viditelne ? "--new-window" : "--headless=new",
    "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--user-data-dir=" + profil, url,
  ];
  if (!tichy) {
    console.log("browser " + exe);
    console.log("url     " + url);
  }
  const proces = spawn(exe, prepinace, { stdio: "ignore" });

  const cekani = new Promise((_, b) => setTimeout(
    () => b(new Error("the browser did not report back within "
      + (casovyLimitMs / 1000) + " s")), casovyLimitMs));
  try {
    return { data: await Promise.race([vysledek, cekani]), exe, url };
  } finally {
    proces.kill();
    srv.close();
    try { rmSync(profil, { recursive: true, force: true }); }
    catch { /* it is a temp dir */ }
  }
}
