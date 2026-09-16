/* IQ Pokyd - src/web/protocol.ts - what the page and the worker say to each other.

   Phase 4.2 of PLAN.md.  3.4 measured a first visit at 15.3 s in Chrome and the
   load is one synchronous call, so running the engine on the main thread is a
   frozen tab for a quarter of a minute.  The engine therefore lives in a Web
   Worker, and this file is the whole vocabulary of that boundary: fourteen
   requests, one reply union, and the two structs that cross it.

   The rule the protocol is built on: it mirrors src/api/pokyd_api.h and adds
   almost nothing.  One request per exported function, same names in the same
   order, same constraints.  Two deliberate compressions -- pokyd_error() is
   folded into a rejected reply, because a message that failed should not need a
   second round trip to say why, and pokyd_phase()/pokyd_progress() share one
   request because neither is meaningful without the other.  pokyd_free() does
   not appear: it is the worker's business and never the page's.

   And one deliberate addition, "dictionaryHash", which is not an engine call at
   all -- it is a read of SLOVNIK.IQP out of the module's own MEMFS.  It is here
   because phase 4.4 has to know *which* dictionary the engine holds before it
   can decide whether a stored SLOVNIK.TMP belongs to it (pokyd_api.h says why at
   pokyd_export_cache), and the page cannot work that out for itself: the
   dictionary is embedded inside pokyd.wasm by tools/build.py, so the only copy
   that is certainly the one in use is the one on the far side of this boundary.

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

/* struct pokyd_settings (src/api/pokyd_api.h), field for field and in the same
   order, so the two can still be diffed by eye: snake_case there because it is
   C, camelCase here because it is TypeScript, and the author's own Czech name
   in a comment on every line that has one.  The two char[101] arrays are
   strings here and CP1250 bytes on the other side of src/web/engine.ts.

   mood and moodPoints are both here and they are not redundant: moodPoints
   (0..90) is the state that drifts, mood (1..5) is recomputed from it after
   every sentence.  Writing mood through setSettings does nothing lasting --
   use setMood, which is what the original's own settings dialog does. */
export interface PokydSettings {
  humanGender: number;                 /* pohlavicloveka: 1 male, 2 female */
  computerGender: number;              /* pohlavipocitace */
  humanName: string;                   /* jmenocloveka; at most 100 CP1250 bytes */
  computerName: string;                /* jmenopocitace */
  character: number;                   /* charakter: 0 machine .. 6 volatile */
  mood: number;                        /* nalada: 1 best .. 5 worst; derived */
  moodPoints: number;                  /* naladabody: 0..90, the state that drifts */

  saveConversation: number;            /* ukladatrozhovor */
  useSounds: number;                   /* pouzivatzvuky */
  useEffects: number;                  /* pouzivatefekty */
  formalCzech: number;                 /* spisovnacestina */
  showLabels: number;                  /* zobrazovatpopisky */

  debugFastExit: number;               /* debug_rychleukoncovani */
  debugSpellingTolerance: number;      /* debug_tolerancepravopisu */
  debugSpellingRecursion: number;      /* debug_pravopisnarekurze */

  emulateKeyboard: number;             /* emulovatklavesnici: 0 none, 1 Czech,
                                          2 Slovak */
  keyboardQwerty: number;              /* klavesniceqwerty */
  standardCursor: number;              /* standardnikurzor */

  cmdReadOnly: number;                 /* prikaz_readonlymod: 1 = write no files */
  cmdNoBackground: number;             /* prikaz_nezobrazovatpozadi */
}

/* ---------------------------------------------------------------- debug info */

/* struct pokyd_debug (src/api/pokyd_api.h), field for field and in the same
   order, on the same terms as PokydSettings above.  It is the ten globals
   CDebugNastaveni::OnInitDialog read, and phase 8.4 is the only thing that asks
   for it.

   A snapshot, and deliberately one: mood and moodPoints are in here rather than
   fetched again through getSettings, so that everything the cheat panel shows
   was true at the same instant -- which is the author's own claim for it
   ("platne v okamziku spusteni tohoto dialogu"). */
export interface PokydDebugInfo {
  allocatedBlocks: number;             /* debug_pocetalokovani */
  maxWords: number;                    /* debug_maxpocetvsechslov */
  answerCount: number;                 /* g_pocetodpovedipocitace */
  baseWords: number;                   /* g_pocetslovvzakladnidatabazi */
  rules: number;                       /* g_pocetiqpodminek */

  lastAnswer: string;                  /* g_odpovedpocitace */
  lastSentence: string;                /* g_predchozivetacloveka */
  subject: string;                     /* debug_poslednipodmetcloveka */
  predicate: string;                   /* debug_posledniprisudekcloveka */
  object: string;                      /* debug_poslednipredmetcloveka */

  mood: number;                        /* nalada 1..5 */
  moodPoints: number;                  /* naladabody 0..90 */
}

/* ---------------------------------------------------------------- load phases */

/* The five captions VLAKNO__NACITEJ_JAK_DIVEJ put in the loading window, plus
   the two states either side of them -- pokyd_api.h's POKYD_PHASE_*, repeated
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
  | { type: "setMoodPoints"; points: number }
  | { type: "debugInfo" }
  | { type: "progress" }
  | { type: "exportCache" }
  | { type: "dictionaryHash" }
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
  setMoodPoints: null;
  debugInfo: PokydDebugInfo;
  progress: PokydProgress;
  /* null is not an error: there is no SLOVNIK.TMP before a cold load has
     finished writing one, and none at all when cmdReadOnly is set. */
  exportCache: Uint8Array | null;
  /* Sixteen hex digits, src/web/cache.ts's fnv1a64 over the bytes of
     SLOVNIK.IQP as the engine's MEMFS holds them.  Available from init onwards
     and constant for the life of the worker. */
  dictionaryHash: string;
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
   Measured at 4.2 and then measured properly at 4.3, which corrected it.

   pokyd_progress() reads g_procentanacitani.  The assignment that would move it
   through POKYD_PHASE_INFLECTING is SLOVNIK.FU:3318, and it sits inside
   `#if IQPOKYDWINMFC == 1` -- so it is not compiled into a BEZ_PROSTREDI build
   at all.  Sampled every 250 ms through a real cold load, the counter reads 0.0
   for the whole of that phase and then 100.0 at the sub-step boundaries, and
   never once a value in between.  It does move during the shorter steps either
   side; it has no gradient at all through the only one long enough to need a
   progress bar.

   The author did not leave that step unreported, though -- he reported it to the
   console instead.  The `#else` branch two lines further down is

       printf("\r%.1Lf%%", poziceslova*100/g_pocetslovvzakladnidatabazi)

   every tenth word, followed by "\rTridim...\n" and "\rZapisuji...\n".
   Emscripten hands those characters to a JS callback as they are written,
   synchronously, from inside the call that has not returned -- so the worker can
   read them, and does, while the load is still running.

   Two corrections from 4.3, both of which changed what got built.

   The fourteen seconds are not that loop.  Unthrottled, a cold load writes
   397,897 segments; the inflection loop accounts for 1,121 of them over 1.0 s,
   and SETRID_SLOVA_V_DATABAZI -- the sort that follows it -- writes 392,699 over
   12.4 s.  The sort has a percentage of its own, SLOVNIK.FU:2322, and it is very
   nearly linear in time.  So the step that needed a bar always had one.

   And these lines are not CP1250.  The two with diacritics go through
   NAPIS_TEXT_V_LATIN_2 (VSTUP.FU:1230), which converts to CP852 first -- they
   arrive as mojibake and src/web/progress.ts matches them as such.  See MARKERS
   there; nothing displays them.

   Hence the shape here: `output` carries the engine's own words, decoded by
   src/web/cp1250.ts, one segment per carriage return, with `phase` and `percent`
   riding along for the steps where the counter is alive.  src/web/worker.ts
   throttles the percentages and only the percentages: the eight lines that are
   not one mark the step boundaries, and a dropped one is a caption lost. */
