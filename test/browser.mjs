/* IQ Pokyd - test/browser.mjs - run a page in the browser it is going to ship in.

   Extracted at phase 4.2 from test/wasm/bench.mjs, which grew it at 3.4 and is
   now one of its two callers.  It serves the repository read-only over loopback,
   launches headless Chrome or Edge at a page in it, and waits for that page to
   POST its results back to /result.  No driver, no puppeteer and nothing out of
   node_modules: it predates the package.json phase 5.1 brought and does not use
   it, so every browser test in here runs on a plain node.

   The one thing it does that a plain static server does not: it strips the types
   out of any .ts it serves, with node's own stripTypeScriptTypes, and hands it
   over as JavaScript.  That is what lets a browser import src/web/*.ts directly,
   unbundled, at the same specifiers node uses -- so the module the browser runs
   is the file on disk and not a build of it.  Phase 5.1 brought Vite, and it did
   not take this over: Vite serves the exhibit, this serves the tests, and
   test/app/chat.test.mjs uses both -- it builds with one and serves dist/ with
   the other.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize, sep } from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { stripTypeScriptTypes } from "node:module";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* stripTypeScriptTypes is experimental and says so once per process.  We are
   using it for exactly one thing, deliberately, so the notice is noise in the
   middle of a test report -- but only that notice. */
process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (warning.name !== "ExperimentalWarning") console.warn(warning);
});

export const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

export function findBrowser() {
  const exe = BROWSERS.find((p) => existsSync(p));
  if (!exe) {
    throw new Error("no Chrome or Edge found -- looked in:\n  "
      + BROWSERS.join("\n  "));
  }
  return exe;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".ts": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".txt": "application/octet-stream",
  ".in": "application/octet-stream",
};

function body(path, url) {
  const raw = readFileSync(path);
  if (extname(path) !== ".ts") return raw;
  /* mode "strip" replaces the types with spaces rather than rewriting anything,
     so line and column numbers survive and a stack trace from the browser still
     points at the .ts on disk.  It refuses enums, namespaces and parameter
     properties; src/web/ uses none of them, and a refusal here is a loud 500
     rather than a mystery. */
  return stripTypeScriptTypes(raw.toString("utf8"), {
    mode: "strip", sourceUrl: url,
  });
}

/* Serves the repo read-only and takes the page's results back on POST
   /result.  The two Cross-Origin-* headers are not decoration: they are what
   makes the page crossOriginIsolated, which is what lets it call
   performance.measureUserAgentSpecificMemory() -- the only per-tab memory
   figure a browser will give out, and what 3.4 measured with. */
function server(resolve, reject) {
  return createServer((req, res) => {
    const headers = {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Cache-Control": "no-store",
    };

    if (req.method === "POST" && req.url === "/result") {
      const chunks = [];
      req.on("data", (k) => chunks.push(k));
      req.on("end", () => {
        res.writeHead(204, headers).end();
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch (e) { reject(e); }
      });
      return;
    }

    const url = decodeURIComponent(req.url.split("?")[0]);
    const path = normalize(join(ROOT, url));
    if (!path.startsWith(ROOT + sep) || !existsSync(path) || !statSync(path).isFile()) {
      res.writeHead(404, headers).end("no");
      return;
    }
    let content;
    try {
      content = body(path, url);
    } catch (e) {
      res.writeHead(500, { ...headers, "Content-Type": "text/plain" })
        .end("cannot serve " + url + ": " + e.message);
      return;
    }
    res.writeHead(200, {
      ...headers,
      "Content-Type": TYPES[extname(path)] || "application/octet-stream",
    });
    res.end(content);
  });
}

/* Launch `page` (a repo-relative path) with `query` (a query object) and
   resolve to whatever it POSTs to /result.  `quiet` suppresses the two lines
   naming the browser and the URL, which a test that prints its own header does
   not want twice. */
export async function runPage({ page, query = {}, visible = false,
                                     timeoutMs = 180000, quiet = false } = {}) {
  const exe = findBrowser();

  let resolve, reject;
  const result = new Promise((a, b) => { resolve = a; reject = b; });
  const srv = server(resolve, reject);
  await new Promise((a) => srv.listen(0, "127.0.0.1", a));
  const port = srv.address().port;

  const params = new URLSearchParams(query).toString();
  const url = "http://127.0.0.1:" + port + "/" + page.replace(/^\/+/, "")
    + (params ? "?" + params : "");

  const profileDir = mkdtempSync(join(tmpdir(), "pokyd-browser-"));
  const flags = [
    visible ? "--new-window" : "--headless=new",
    "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--user-data-dir=" + profileDir, url,
  ];
  if (!quiet) {
    console.log("browser " + exe);
    console.log("url     " + url);
  }
  const child = spawn(exe, flags, { stdio: "ignore" });

  const timeout = new Promise((_, b) => setTimeout(
    () => b(new Error("the browser did not report back within "
      + (timeoutMs / 1000) + " s")), timeoutMs));
  try {
    return { data: await Promise.race([result, timeout]), exe, url };
  } finally {
    child.kill();
    srv.close();
    try { rmSync(profileDir, { recursive: true, force: true }); }
    catch { /* it is a temp dir */ }
  }
}
