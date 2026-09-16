/* IQ Pokyd - vite.config.ts - phase 5.1 of PLAN.md.

   The Vite root is the repository root, so that the page can import
   src/web/*.ts at the same specifiers node and test/browser.mjs already use --
   the modules phases 4.1 to 4.4 built are consumed unchanged, not copied into
   an app directory.  There is no public/ directory; the only static files the
   exhibit needs are the two the compiler produces, and the plugin below is how
   they get in.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const ROOT = dirname(fileURLToPath(import.meta.url));

/* python3 tools/build.py --wasm writes both of these, and build/ is generated
   and gitignored -- so they are not in the source tree and must not be copied
   into it.  They travel together and must stay in one directory: the Emscripten
   glue finds the binary with `new URL('pokyd.wasm', import.meta.url)`
   (build/wasm/pokyd.mjs:344), and it is loaded by a runtime URL that Vite is
   told to leave alone (`@vite-ignore` in src/web/worker.ts), so nothing else
   would rewrite that pair for us. */
const ENGINE_DIR = join(ROOT, "build", "wasm");
const ENGINE_FILES = ["pokyd.mjs", "pokyd.wasm"];

/** Where the pair is served from, under the deploy's base URL.  src/app/main.ts
 *  is the other half of this constant. */
export const ENGINE_URL_DIR = "pokyd";

const CONTENT_TYPE: Record<string, string> = {
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
};

/* In dev: serve them, ahead of Vite's own middleware, so the Emscripten glue is
   handed over as the bytes emcc wrote rather than transformed as a module.
   In a build: emit them as assets under their own names, which keeps them out
   of Rollup's hands for the same reason and keeps the pair together.

   Two plugins and not one, because emitFile() does not exist in serve mode and
   a buildStart that calls it warns on every dev server start. */
function pokydEngine(): Plugin[] {
  const read = (name: string): Buffer => {
    const path = join(ENGINE_DIR, name);
    if (!existsSync(path)) {
      throw new Error("IQ Pokyd: " + path + " is missing.\n"
        + "  The engine is compiled, not checked in: run\n"
        + "      python3 tools/build.py --wasm");
    }
    return readFileSync(path);
  };

  return [{
    name: "pokyd-engine-serve",
    apply: "serve",

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? "").split("?")[0];
        const name = ENGINE_FILES.find(
          (f) => path === "/" + ENGINE_URL_DIR + "/" + f);
        if (name === undefined) return next();
        const body = read(name);
        res.setHeader("Content-Type",
          CONTENT_TYPE[name.slice(name.lastIndexOf("."))]);
        res.setHeader("Cache-Control", "no-cache");
        res.end(body);
      });
    },
  }, {
    name: "pokyd-engine-build",
    apply: "build",

    buildStart() {
      for (const name of ENGINE_FILES) {
        this.emitFile({
          type: "asset",
          fileName: ENGINE_URL_DIR + "/" + name,
          source: read(name),
        });
      }
    },
  }];
}

export default defineConfig({
  root: ROOT,
  /* Relative, so the exhibit runs from a subdirectory as happily as from the
     root of a domain -- phase 5.3 does not yet know which it will be. */
  base: "./",
  publicDir: false,
  plugins: [pokydEngine()],
  /* src/web/worker.ts is started with { type: "module" } and imports the
     Emscripten glue dynamically; an IIFE worker could do neither. */
  worker: { format: "es" },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    /* 450 KB of engine is not going to become a data: URI. */
    assetsInlineLimit: 0,
  },
});
