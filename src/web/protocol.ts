/* IQ Pokyd - src/web/protocol.ts - what the page and the worker say to each other.

   Phase 4.2 of PLAN.md.  3.4 measured a first visit at 15.3 s in Chrome and the
   load is one synchronous call, so running the engine on the main thread is a
   frozen tab for a quarter of a minute.  The engine therefore lives in a Web
   Worker, and this file is the whole vocabulary of that boundary: twelve
   requests, one reply union, and the struct that crosses it.

   The rule the protocol is built on: it mirrors src/api/pokyd_api.h and adds
   nothing.  One request per exported function, same names in the same order,
   same constraints.  Two deliberate compressions -- pokyd_error() is folded into
   a rejected reply, because a message that failed should not need a second round
   trip to say why, and pokyd_phase()/pokyd_progress() share one request because
   neither is meaningful without the other.  pokyd_free() does not appear: it is
   the worker's business and never the page's.

   Nothing above this line knows about the ordering rules in pokyd_api.h -- init
   before load, import before load, seed after load.  src/web/engine.ts enforces
   them on the worker side, whatever order the messages arrive in, and
   PokydClient.start() is the one call that gets them right by construction.

   Strings, not bytes.  Everything that crosses this boundary as text is an
   ordinary JavaScript string; src/web/cp1250.ts turns it into the engine's bytes
   on the far side and back again.  The one exception is the cache blob, which is
   18 MB of the engine's own binary format and has no business being text.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

/* ------------------------------------------------------------------ settings */

/* struct pokyd_settings (src/api/pokyd_api.h), field for field and in the
   author's own names, so the two can be diffed by eye.  The two char[101] arrays
   are strings here and CP1250 bytes on the other side of src/web/engine.ts.

   nalada and naladabody are both here and they are not redundant: naladabody
   (0..90) is the state that drifts, nalada (1..5) is recomputed from it after
   every sentence.  Writing nalada through setSettings does nothing lasting --
   use setMood, which is what the original's own settings dialog does. */
export interface PokydSettings {
  pohlavicloveka: number;              /* 0...muz, 1...zena */
  pohlavipocitace: number;
  jmenocloveka: string;                /* at most 100 CP1250 bytes */
  jmenopocitace: string;
  charakter: number;                   /* 0 stroj .. 6 vybusny */
  nalada: number;                      /* 1 vyborna .. 5 hrozna; derived */
  naladabody: number;                  /* 0..90, the state that drifts */

  ukladatrozhovor: number;
  pouzivatzvuky: number;
  pouzivatefekty: number;
  spisovnacestina: number;
  zobrazovatpopisky: number;

  debug_rychleukoncovani: number;
  debug_tolerancepravopisu: number;
  debug_pravopisnarekurze: number;

  emulovatklavesnici: number;          /* 0 none, 1 ceska, 2 slovenska */
  klavesniceqwerty: number;
  standardnikurzor: number;

  prikaz_readonlymod: number;          /* 1 = write no files at all */
  prikaz_nezobrazovatpozadi: number;
}

/* ---------------------------------------------------------------- load phases */

/* The five captions VLAKNO__NACITEJ_JAK_DIVEJ put in the loading window, plus
   the two states either side of them -- pokyd_api.h's POKYD_FAZE_*, repeated
   here because a page cannot include a C header.

   Worth knowing before phase 4.3 draws anything: in a BEZ_PROSTREDI build the
   percentage belonging to POKYD_PHASE_INFLECTING is never written at all.  See
   PROGRESS at the foot of this file. */
export const POKYD_PHASE_IDLE = 0;
export const POKYD_PHASE_BASE_DICTIONARY = 1;   /* "Nacitam zakladni slovnik..." */
export const POKYD_PHASE_VOCABULARY = 2;        /* "Nacitam slovni zasobu..."    */
export const POKYD_PHASE_INFLECTING = 3;        /* "Vytvarim slovni zasobu..."   */
export const POKYD_PHASE_INTELLIGENCE = 4;      /* "Nacitam inteligenci..."      */
export const POKYD_PHASE_EXTERNAL = 5;          /* "Nacitam externi data..."     */
export const POKYD_PHASE_DONE = 6;

/* ------------------------------------------------------------------- requests */

/* One per exported function of pokyd_api.h, in the header's own order. */
export type PokydRequest =
  | { type: "init"; moduleUrl: string; dataDir: string }
  | { type: "importCache"; blob: Uint8Array }
  | { type: "load" }
  | { type: "seed"; value: number }
  | { type: "say"; text: string }
  | { type: "sentenceCount" }
  | { type: "getSettings" }
  | { type: "setSettings"; settings: PokydSettings }
  | { type: "setMood"; mood: number }
  | { type: "progress" }
  | { type: "exportCache" }
  | { type: "shutdown" };

export type PokydRequestType = PokydRequest["type"];

/* Narrow a request type to its own member of the union, so a dispatcher that
   switches on `type` gets that member's payload fields with it. */
export type PokydRequestOf<K extends PokydRequestType> =
  Extract<PokydRequest, { type: K }>;

/* g_praveprovadenaakce and g_procentanacitani as the API reports them.  What
   they are worth during the long step is the subject of PROGRESS below. */
export interface PokydProgress {
  phase: number;
  percent: number;
}

/* What each request resolves to.  `null` where the C function returns void: a
   request always gets a reply, because a promise that never settles is how a
   protocol bug turns into a hung page. */
export interface PokydResultMap {
  init: null;
  importCache: null;
  load: null;
  seed: null;
  say: string;
  sentenceCount: number;
  getSettings: PokydSettings;
  setSettings: null;
  setMood: null;
  progress: PokydProgress;
  /* null is not an error: there is no SLOVNIK.TMP before a cold load has
     finished writing one, and none at all under prikaz_readonlymod. */
  exportCache: Uint8Array | null;
  /* pokyd_shutdown's count of blocks the engine did not account for.  It should
     be 0, and it is the only leak detector this code has. */
  shutdown: number;
}

export type PokydResultOf<K extends PokydRequestType> = PokydResultMap[K];

/* --------------------------------------------------------------- the envelope */

/* Page -> worker.  The id is the page's; the worker only ever echoes it. */
export interface PokydCall {
  id: number;
  request: PokydRequest;
}

/* Worker -> page.  "ok" and "error" answer a call; "output" is unsolicited and
   can arrive at any time, including in the middle of a load that has not
   returned yet -- which is the whole reason it exists. */
export type PokydReply =
  | { kind: "ok"; id: number; result: unknown }
  | { kind: "error"; id: number; message: string }
  | { kind: "output"; text: string; phase: number; percent: number };

/* ------------------------------------------------------------------- PROGRESS */

/* Why "output" carries the loading progress and pokyd_progress() does not.
   Measured at 4.2, and it decides what phase 4.3 can build.

   pokyd_progress() reads g_procentanacitani.  The assignment that would move it
   through the fourteen-second inflection loop is SLOVNIK.FU:3318, and it sits
   inside `#if IQPOKYDWINMFC == 1` -- so it is not compiled into a BEZ_PROSTREDI
   build at all.  Sampled every 250 ms through a real cold load, the counter
   reads 0.0 for the whole of POKYD_PHASE_INFLECTING and then 100.0 at the
   sub-step boundaries, and never once a value in between.  It does move during
   the shorter steps either side; it has no gradient at all through the only one
   long enough to need a progress bar.

   The author did not leave that step unreported, though -- he reported it to the
   console instead.  The `#else` branch two lines further down is

       printf("\r%.1Lf%%", poziceslova*100/g_pocetslovvzakladnidatabazi)

   every tenth word, followed by "\rTridim...\n" and "\rZapisuji...\n", all in
   CP1250.  Emscripten hands those characters to a JS callback as they are
   written, synchronously, from inside the call that has not returned -- so the
   worker can read them, and does, while the load is still running.  2.7 million
   characters over a cold load, which measured as no slower than discarding them.

   Hence the shape here: `output` carries the engine's own words, decoded by
   src/web/cp1250.ts, one segment per carriage return, with `phase` and `percent`
   riding along for the steps where the counter is alive.  Parsing "47.3%" out of
   the text is phase 4.3's job, and it is a regular expression rather than a
   research project. */
