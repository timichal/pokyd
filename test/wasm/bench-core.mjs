/* IQ Pokyd - test/wasm/bench-core.mjs - one measured run of the wasm engine.

   Phase 3.4 of PLAN.md.  This is the part that has to be identical in node and
   in a browser, so it is a module of its own with no fs, no process and no DOM
   in it: the caller hands in the module factory, the sentences and the golden
   transcript, and gets back times and sizes.  test/wasm/bench.mjs is the node
   front end, test/wasm/bench.html the browser one.

   It drives the engine exactly the way test/wasm/smoke.mjs does -- same order,
   same settings, same seed -- because a benchmark that loads differently from
   the test is measuring a different program.  It also diffs the transcript on
   every run, so a number here is never reported for a run that answered wrong.

   What the numbers mean
   ---------------------
   nacitani_ms   a bracket around pokyd_load_dictionaries() and nothing else.
                 tools/bench-native.py brackets the same call through the
                 driver's --time, which is what makes the two comparable.
   pamet.*       HEAPU8.length at each checkpoint: the size of the wasm linear
                 memory, which only ever grows, so the last figure is also the
                 peak.  This is the engine's own heap and stack -- it is NOT the
                 whole cost of the tab.  MEMFS keeps file contents in JS typed
                 arrays outside the linear memory, so the 17 MB SLOVNIK.TMP the
                 cold path writes is somewhere else again, and the front ends
                 report what their host can see of it (process RSS in node, the
                 JS heap in a browser).

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

/* The settings the golden conversation was recorded with -- test/golden/README.md,
   and pinned here for the same reason the driver pins them on the command line. */
export const SEMENO = 20050415;
const CHARAKTER = 3;            /* prumerny */
const NALADA = 3;               /* normalni */
const POHLAVI_CLOVEKA = 1;      /* muz -- NASTAVEN.PR:26 */
const POHLAVI_POCITACE = 1;

/* struct pokyd_settings (src/api/pokyd_api.h) in declaration order.  Every member
   is a char or an array of char, so the layout is a running sum with no padding;
   smoke.mjs checks it against what NASTAV_STANDARDNE wrote, and does that on
   every run, so this copy does not repeat the check. */
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

/* HEAPU8 is replaced every time the memory grows, and the load grows it several
   times over, so it is read off the module at every use and never cached. */

function uloz_bajty(M, bajty) {
  const p = M._malloc(bajty.length + 1);
  if (p === 0) throw new Error("out of wasm memory");
  M.HEAPU8.set(bajty, p);
  M.HEAPU8[p + bajty.length] = 0;
  return p;
}

function nacti_retezec(M, p) {
  if (p === 0) return null;
  const halda = M.HEAPU8;
  let konec = p;
  while (halda[konec] !== 0) konec++;
  return halda.slice(p, konec);      /* a copy: the next call overwrites it */
}

function chyba(M) {
  const b = nacti_retezec(M, M._pokyd_error());
  return b === null ? "(null)" : String.fromCharCode(...b);
}

function stejne(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/* -------------------------------------------------------------- one full run */

/* vety      an array of Uint8Array, CP1250, one sentence each
   zlate     the golden transcript as a Uint8Array, or null to skip the diff
   cache     a Uint8Array to import before loading (a warm run), or null (cold)
   vyvez     export the cache afterwards -- the cold run does, to feed the warm one
*/
export async function zmer(PokydModule, { vety, zlate = null, cache = null,
                                          vyvez = false, hluk = false,
                                          sonda = null } = {}) {
  const pamet = {};
  const cas = (typeof performance !== "undefined" ? () => performance.now()
                                                  : () => Date.now());

  /* The engine talks to the console on its own account -- the inflection
     progress bar (SLOVNIK.FU:3322) and vstup.fu:801-809 on every sentence.  That
     is 2.6 MB of traffic per run on top of a timed load, so it is discarded
     unless --noise asks for it.  3.3 measured the difference at under 1%. */
  const t_modul = cas();
  const M = await PokydModule(hluk ? {} : { print: () => {}, printErr: () => {} });
  const cas_modulu = cas() - t_modul;
  pamet.po_startu = M.HEAPU8.length;

  const adresar = uloz_bajty(M, new TextEncoder().encode("/pokyd"));
  if (M._pokyd_init(adresar) !== 0) throw new Error("pokyd_init: " + chyba(M));
  M._free(adresar);

  const n = M._malloc(VELIKOST_NASTAVENI);
  M._pokyd_get_settings(n);
  M.HEAPU8[n + POSUN.pohlavicloveka] = POHLAVI_CLOVEKA;
  M.HEAPU8[n + POSUN.pohlavipocitace] = POHLAVI_POCITACE;
  M.HEAPU8[n + POSUN.charakter] = CHARAKTER;
  M._pokyd_set_settings(n);
  M._pokyd_set_mood(NALADA);
  M._free(n);
  pamet.po_init = M.HEAPU8.length;

  /* Before loading, never during -- pokyd_api.h says why the import is a step of
     its own rather than an argument to the load.  Two copies of the blob exist
     for the length of this block: the caller's and the one in the wasm heap. */
  let cas_importu = 0;
  if (cache) {
    const t = cas();
    const p = M._malloc(cache.length);
    if (p === 0) throw new Error("out of wasm memory installing the cache");
    M.HEAPU8.set(cache, p);
    if (M._pokyd_import_cache(p, cache.length) !== 0)
      throw new Error("pokyd_import_cache: " + chyba(M));
    M._free(p);
    cas_importu = cas() - t;
    pamet.po_importu = M.HEAPU8.length;
  }

  const t0 = cas();
  if (M._pokyd_load_dictionaries() !== 0)
    throw new Error("pokyd_load_dictionaries: " + chyba(M));
  const nacitani_ms = cas() - t0;
  if (M._pokyd_phase() !== 6 /* POKYD_FAZE_HOTOVO */)
    throw new Error("loaded, but pokyd_phase() says " + M._pokyd_phase());
  pamet.po_nacteni = M.HEAPU8.length;

  /* Whatever the host can see of its own memory, asked for here and not after
     the run: this is the moment the dictionary is loaded and nothing has been
     torn down, which is the peak the plan is asking about.  It may await -- a
     browser's measureUserAgentSpecificMemory() waits for a collection -- and
     that is harmless, the load is already timed and nothing runs meanwhile. */
  const mereni_hosta = sonda ? await sonda(M) : null;

  /* After loading, not before: the cold path reseeds from the clock on its way
     out (SLOVNIK.FU:1732). */
  M._pokyd_seed(SEMENO);

  const kusy = [];
  const t1 = cas();
  for (const veta of vety) {
    const p = uloz_bajty(M, veta);
    const odpoved = nacti_retezec(M, M._pokyd_say(p));
    M._free(p);
    if (odpoved === null) throw new Error("pokyd_say returned NULL");
    kusy.push([0x3e, 0x20], veta, [0x0d, 0x0a], [0x3c, 0x20], odpoved, [0x0d, 0x0a]);
  }
  const odpovedi_ms = cas() - t1;
  pamet.po_rozhovoru = M.HEAPU8.length;

  let prepis = [];
  for (const kus of kusy) prepis.push(...kus);
  prepis = Uint8Array.from(prepis);

  /* What MEMFS is holding: the two data files and, after a cold load, the 17 MB
     SLOVNIK.TMP.  MEMFS keeps file contents in JS arrays, not in the linear
     memory above, which is exactly why it is worth reporting separately. */
  let memfs = 0;
  for (const jmeno of ["SLOVNIK.IQP", "IQPOKYD.IQP", "SLOVNIK.TMP"]) {
    try { memfs += M.FS.stat("/pokyd/" + jmeno).size; } catch { /* not there */ }
  }

  let vyvezena = null;
  let cas_exportu = 0;
  if (vyvez) {
    const t = cas();
    const delka = M._malloc(4);
    const blok = M._pokyd_export_cache(delka);
    if (blok !== 0) {
      const h = M.HEAPU8;
      const kolik = h[delka] | (h[delka + 1] << 8) | (h[delka + 2] << 16)
        | (h[delka + 3] * 0x1000000);
      pamet.po_exportu = M.HEAPU8.length;    /* read before the copy is freed */
      vyvezena = M.HEAPU8.slice(blok, blok + kolik);
      M._pokyd_free(blok);
    }
    M._free(delka);
    cas_exportu = cas() - t;
  }

  const poctvet = M._pokyd_sentence_count();
  const neuvolneno = M._pokyd_shutdown();
  pamet.po_ukonceni = M.HEAPU8.length;

  return {
    nacitani_ms, odpovedi_ms, cas_modulu, cas_importu, cas_exportu,
    pamet, memfs, neuvolneno, poctvet, host: mereni_hosta,
    prepis_sedi: zlate === null ? null : stejne(prepis, zlate),
    prepis, cache: vyvezena,
  };
}
