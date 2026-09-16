/* IQ Pokyd - src/web/progress.ts - turning the engine's console into a loading bar.

   Phase 4.3 of PLAN.md.  4.2 established where the signal comes from -- the
   engine's own printf, relayed by src/web/worker.ts as `output` events, because
   pokyd_progress() has no gradient in a BEZ_PROSTREDI build -- and left the parse
   and the weighting to here.  Measuring that stream first moved 4.3's ground
   twice, so both findings are written down before the code.

   THE LONG STEP IS NOT THE ONE THE PLAN NAMED.  PLAN.md and pokyd_api.h have
   both been calling it "the fourteen-second inflection loop".  It is not.
   Sampled unthrottled across a real cold load -- 397,897 segments, 14.1 s in
   node -- the inflection loop (SLOVNIK.FU:3296-3327) runs for 1.0 s.  What takes
   twelve and a half seconds is SETRID_SLOVA_V_DATABAZI, the sort that follows it,
   and the sort prints a percentage of its own: SLOVNIK.FU:2322,
   printf("\r%.1Lf%% "), 392,699 of them over one load.  It rises 0.0 -> 100.0
   within a point and a half of a straight line in time, and of those 392,699
   readings 82 step backwards, never by more than 0.1.  So the step that needed a
   progress bar had one all along, on the channel nobody had read yet.  Measured,
   step by step:

       base dictionary  PRECTI_DATABAZI_SLOV_ZE_ZAKLADNIHO_SLOVNIKU    20 ms   0.1%
       inflecting       ROZSKLONUJ_PODLE_SPRAVNEHO_VZORU, 11,207 x   1221 ms   8.7%
       sorting          SETRID_SLOVA_V_DATABAZI                     12457 ms  88.2%
       writing          ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU       241 ms   1.7%
       vocabulary       the re-read, then the 18 MB SLOVNIK.TMP       174 ms   1.2%
       intelligence     PRECTI_INTELIGENCI_ZE_SOUBORU                   6 ms   0.0%

   A warm load is the three of those that are left: 20 ms, 172 ms and 3 ms,
   182 ms in all, which is a bar nobody will see.

   THE CAPTIONS ARE CP852, NOT CP1250.  "Sklonuji..." reaches JavaScript as
   "Sklo\u013auji...", and that is not a fault in phase 4.1's codec.  The engine
   prints them through NAPIS_TEXT_V_LATIN_2 (VSTUP.FU:1230), which runs
   PREVED_Z_WINDOWS_1250_NA_LATIN_2 over the string first -- hazard 6's "Latin 2"
   is CP852, the DOS codepage, and it is what the author's console build wrote for
   a DOS console.  Our decoder is CP1250 and has to stay CP1250, so those bytes
   arrive as deterministic mojibake.  This file therefore *recognises* the markers
   and never shows them: what it shows is the author's own loading-window text
   from PROSTRED.FU and SLOVNIK.FU, which is CP1250 and which is what somebody
   sitting in front of IQ Pokyd in 2005 actually read.  See MARKERS below.

   No DOM here and no worker: this is the model, node can test all of it, and
   src/web/loading.ts is the view that draws it.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code,
   so every Czech letter below is a \u escape with the diacritics stripped from
   the same words beside it.
*/

import {
  POKYD_PHASE_BASE_DICTIONARY,
  POKYD_PHASE_VOCABULARY,
  POKYD_PHASE_INFLECTING,
  POKYD_PHASE_INTELLIGENCE,
  POKYD_PHASE_EXTERNAL,
  POKYD_PHASE_DONE,
} from "./protocol.ts";
import type { PokydProgress } from "./protocol.ts";

/* ------------------------------------------------------------------- steps */

/* The load as somebody watching it can see it happen.  This is pokyd_api.h's
   POKYD_PHASE_* with its third member split into the three sub-steps the author
   himself distinguished -- g_praveprovadenaakce 2, 3 and 4, the assignments at
   SLOVNIK.FU:3260, :3329 and :3340 that `#if IQPOKYDWINMFC == 1` compiles out of
   this build.  His own console printfs, in the #else branch two lines below each
   one, are how we get them back.

   The numbers are in the order a load visits them, cold or warm, and nothing here
   ever moves backwards through them: a cold load is 1,2,3,4,5,6,7,8 and a warm
   load is 1,5,6,7,8.  That is what makes the overall percentage monotonic without
   anything having to remember what it last said. */
export const POKYD_STEP_IDLE = 0;             /* not loading, or not yet */
export const POKYD_STEP_BASE_DICTIONARY = 1;  /* SLOVNIK.IQP, 11,207 words */
export const POKYD_STEP_INFLECTING = 2;       /* g_praveprovadenaakce 2 */
export const POKYD_STEP_SORTING = 3;          /* g_praveprovadenaakce 3 */
export const POKYD_STEP_WRITING = 4;          /* g_praveprovadenaakce 4 */
export const POKYD_STEP_VOCABULARY = 5;       /* SLOVNIK.TMP, 18 MB */
export const POKYD_STEP_INTELLIGENCE = 6;     /* IQPOKYD.IQP */
export const POKYD_STEP_EXTERNAL = 7;         /* PROFIL.IQP */
export const POKYD_STEP_DONE = 8;

/* The author's own words for each of them, in CP1250 as he wrote them.

   The four that belong to a phase are the SetWindowText calls in
   VLAKNO__NACITEJ_JAK_DIVEJ (PROSTRED.FU:568, :576, :586, :599); the three
   sub-steps are the ones inside NACTI_A_ROZSKLONUJ_ZAKLADNI_SLOVNIK
   (SLOVNIK.FU:3261, :3331, :3342).  POKYD_STEP_IDLE gets the caption
   IDD_NACITANI ships with, which is both the dialog's CAPTION and the initial
   text of IDC_TEXT (IQPokyd.rc:124 and :130) -- what the window said before the
   first step had begun.  POKYD_STEP_DONE repeats it only as a fallback: a
   finished tracker reports the caption of the step that just ended, because the
   author's window did not announce that it was done, it closed.

   Indexed by step, so POKYD_STEP_CAPTIONS[state.step] is the line to show. */
export const POKYD_STEP_CAPTIONS: readonly string[] = [
  "Spou\u0161t\u00edm IQ Pokyd...",                        /* Spoustim IQ Pokyd... */
  "Na\u010d\u00edt\u00e1m z\u00e1kladn\u00ed slovn\u00edk...", /* Nacitam zakladni slovnik... */
  "Sklo\u0148uji slovn\u00edk...",                         /* Sklonuji slovnik... */
  "T\u0159\u00edd\u00edm slovn\u00ed z\u00e1sobu...",       /* Tridim slovni zasobu... */
  "Zapisuji slovn\u00edk...",                              /* Zapisuji slovnik... */
  "Na\u010d\u00edt\u00e1m slovn\u00ed z\u00e1sobu...",      /* Nacitam slovni zasobu... */
  "Na\u010d\u00edt\u00e1m inteligenci...",                  /* Nacitam inteligenci... */
  "Na\u010d\u00edt\u00e1m extern\u00ed data...",            /* Nacitam externi data... */
  "Spou\u0161t\u00edm IQ Pokyd...",                        /* Spoustim IQ Pokyd... */
];

/* The title the cold path put on the window, and only the cold path:
   PROSTRED.FU:579 sets it on the branch that has to inflect, which is the one
   visit in the life of a browser profile that takes fifteen seconds.  A page that
   wants to explain the wait has the author's own explanation right here.

   Vytvarim slovni zasobu, prosim cekejte... */
export const POKYD_COLD_NOTICE =
  "Vytv\u00e1\u0159\u00edm slovn\u00ed z\u00e1sobu, pros\u00edm \u010dekejte...";

/* ----------------------------------------------------------------- MARKERS */

/* The four console lines that say a step has changed, exactly as they arrive
   once src/web/cp1250.ts has decoded them -- which is to say, as CP852 read as
   CP1250.  Each is given here as the bytes the engine writes, the Czech the
   author wrote, and the string this file compares against; the three were checked
   against each other with Python's cp852 codec and against a real cold load.

     SLOVNIK.FU:3263  NAPIS_TEXT_V_LATIN_2("\rSklonuji...\n")
                      53 6b 6c 6f e5 75 6a 69 2e 2e 2e   Sklonuji...
     SLOVNIK.FU:3332  NAPIS_TEXT_V_LATIN_2("\rTridim...\n")
                      54 fd a1 64 a1 6d 2e 2e 2e         Tridim...
     SLOVNIK.FU:3343  printf("\rZapisuji...\n")          ASCII, no conversion
     SLOVNIK.FU:3349  printf("\rHotovo. Prevedeno %lu slov.\n...")

   The last is a prefix and not a whole line, because it carries the word count.
   It is the end of the cold path proper: everything after it -- the block check,
   "Stiskni cokoliv", the getch() that returns at once in a browser -- is the
   author's DOS harness winding down, and pokyd_api.cpp then reloads from the
   cache it has just written.  pokyd_load_dictionaries says why that tail runs.

   Compared with ===, not with a regular expression over whatever ASCII survived
   the conversion, because these are constants: a change to one of them is a
   change to the engine, and it should fail a test rather than degrade quietly. */
const MARK_INFLECTING = "Sklo\u013auji...";
const MARK_SORTING = "T\u00fd\u02c7d\u02c7m...";
const MARK_WRITING = "Zapisuji...";
const MARK_COLD_PATH_DONE = "Hotovo. Prevedeno ";

/* "47.3%", " 12% ", "100% " -- the whole of what a progress segment looks like,
   from any of the six printfs that emit one.  Which step it belongs to is never
   decided here: the step is known already, and this only reads the number. */
const PERCENT = /^\s*(\d+(?:\.\d+)?)%\s*$/;

/* ----------------------------------------------------------------- weights */

/* What each step is worth as a fraction of the load it belongs to, from the
   measurements in the header.  Indexed by step; each table sums to 1.

   These are ours and they are not the author's.  VLAKNO__PROCENTA_PROGRESU
   (PROSTRED.FU:515-523) gave inflecting 0-50% and sorting 50-100%, an even split
   -- and against the engine as it actually runs that is a bar which reaches half
   way in one second and then spends twelve and a half crossing the other half.
   The one thing 4.3 exists to produce is an honest sense of how much is left, so
   the split here is the measured one.  It is the only place in this file that
   departs from what the author drew, and it is deliberate.

   COLD folds the base-dictionary re-read that follows the write into
   POKYD_STEP_VOCABULARY: the two happen back to back, they are 6 ms and 172 ms,
   and the alternative is a step that appears twice in one load.  The sort is
   rounded down to 0.86 from its measured 0.882 so that POKYD_STEP_INTELLIGENCE
   is worth something in both tables -- otherwise a cold load reaches 100% a
   fifth of a second before it has finished, which is the one lie a progress bar
   must not tell. */
const COLD_WEIGHTS: readonly number[] =
  [0, 0.01, 0.09, 0.86, 0.02, 0.01, 0.01, 0, 0];
const WARM_WEIGHTS: readonly number[] =
  [0, 0.10, 0, 0, 0, 0.88, 0.02, 0, 0];

/* ------------------------------------------------------------------- state */

/** Everything a loading screen needs, recomputed on every output event. */
export interface PokydLoadingState {
  /** POKYD_STEP_*.  Never decreases over one load. */
  step: number;
  /** POKYD_STEP_CAPTIONS[step], for a view that would rather not index it --
   *  except on POKYD_STEP_DONE, where it is the caption of the step that just
   *  ended.  The author's window did not put a word up when it finished, it
   *  closed; so neither does this, and a page that leaves the bar on the screen
   *  for a frame does not see it revert to "Spoustim IQ Pokyd...". */
  caption: string;
  /** 0..100 within this step, or null where the step publishes no number --
   *  which is exactly POKYD_STEP_WRITING, the 0.24 s the engine spends inside
   *  ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU without printing anything.  A view
   *  should read null as "no gradient here" rather than as zero. */
  stepPercent: number | null;
  /** 0..100 over the whole load, weighted by the tables above, and monotonic. */
  percent: number;
  /** Whether the dictionary is being inflected from scratch: true once the cold
   *  path has announced itself, false once a warm one has, null until either.
   *  A page can put POKYD_COLD_NOTICE on the screen when it turns true. */
  cold: boolean | null;
  /** load() has returned and the percentage has been taken to 100. */
  done: boolean;
}

export interface PokydLoadingTrackerOptions {
  /** Called after every event that changed the state.  A view is one of these;
   *  it can also be left off and `state` read from an animation frame. */
  onChange?: (state: PokydLoadingState) => void;
}

/* What the tracker attaches to: PokydClient, or anything else that hands over
   the engine's console.  Structural on purpose -- src/web/client.ts imports
   nothing from here, and this imports nothing from there. */
export interface PokydOutputSource {
  onOutput: ((text: string, progress: PokydProgress) => void) | null;
}

/** The state machine.  Feed it `output` events in the order they arrive, call
 *  finish() when load() returns, and read `state` whenever you like.
 *
 *  It is deliberately tolerant: an event it does not recognise moves nothing,
 *  and an engine that stopped printing altogether would leave the bar standing
 *  rather than break the page. */
export class PokydLoadingTracker {
  private step = POKYD_STEP_IDLE;
  private stepPercent: number | null = null;
  private overall = 0;
  private coldPath: boolean | null = null;
  private coldPathOver = false;
  private finished = false;
  private lastCaption = POKYD_STEP_CAPTIONS[POKYD_STEP_IDLE];

  /** Swappable, so a page can attach a loading screen and drop it again. */
  onChange: ((state: PokydLoadingState) => void) | null;

  constructor(options: PokydLoadingTrackerOptions = {}) {
    this.onChange = options.onChange ?? null;
  }

  get state(): PokydLoadingState {
    return {
      step: this.step,
      caption: this.step === POKYD_STEP_DONE
        ? this.lastCaption
        : POKYD_STEP_CAPTIONS[this.step] ?? "",
      stepPercent: this.stepPercent,
      percent: this.overall,
      cold: this.coldPath,
      done: this.finished,
    };
  }

  /** Point a client's console at this tracker, and return the call that undoes
   *  it.  Whatever was listening before is kept and still called, so a page that
   *  wants both a loading screen and a debug log does not have to choose. */
  attach(source: PokydOutputSource): () => void {
    const previous = source.onOutput;
    source.onOutput = (text: string, progress: PokydProgress): void => {
      this.output(text, progress);
      if (previous) previous(text, progress);
    };
    return () => { source.onOutput = previous; };
  }

  /** One `output` event from the worker: the engine's line, and the phase and
   *  percent counters as they stood at the moment it was read. */
  output(text: string, progress: PokydProgress): void {
    if (this.finished) return;
    const before = this.fingerprint();

    if (text === MARK_INFLECTING) {
      this.coldPath = true;
      this.enter(POKYD_STEP_INFLECTING);
    } else if (text === MARK_SORTING) {
      this.coldPath = true;
      this.enter(POKYD_STEP_SORTING);
    } else if (text === MARK_WRITING) {
      this.coldPath = true;
      this.enter(POKYD_STEP_WRITING);
    } else if (text.startsWith(MARK_COLD_PATH_DONE)) {
      this.coldPathOver = true;
      this.enter(POKYD_STEP_VOCABULARY);
    } else {
      this.follow(text, progress);
    }

    /* follow() can finish the load, and finish() has published its own state. */
    if (this.finished) return;
    if (this.fingerprint() !== before) this.emit();
  }

  /** load() has returned.  Takes the bar to 100 whatever the engine's last word
   *  was -- and it will have stopped short of one: C stdio hands Emscripten its
   *  buffer 1 KB at a time, so the tail of every load is still sitting in that
   *  buffer when the call returns and is never written at all.  A warm load's
   *  intelligence bar gets as far as 52%. */
  finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.step = POKYD_STEP_DONE;
    this.stepPercent = 100;
    this.overall = 100;
    this.emit();
  }

  /** Back to the beginning, for a tracker that is going to watch a second load
   *  -- a second worker after a failure, or a test. */
  reset(): void {
    this.step = POKYD_STEP_IDLE;
    this.stepPercent = null;
    this.overall = 0;
    this.coldPath = null;
    this.coldPathOver = false;
    this.finished = false;
    this.lastCaption = POKYD_STEP_CAPTIONS[POKYD_STEP_IDLE];
    this.emit();
  }

  /* ------------------------------------------------------------- internals */

  /* Everything that is not a marker.  The step comes from pokyd_phase(), except
     while the cold path is running, where the markers are in charge: the phase
     sits at POKYD_PHASE_INFLECTING for the whole of it and would drag the step
     back to the base dictionary every time the engine printed a percentage. */
  private follow(text: string, progress: PokydProgress): void {
    /* pokyd_load_dictionaries sets POKYD_PHASE_DONE on the line before it
       returns, so an event carrying it is an event from after the load.  One
       always does: src/web/worker.ts flushes whatever the throttle was holding
       in the `finally` of the request, by which time the call has returned.
       Without this the bar would reach 100 with the cold notice still on it and
       wait for a finish() the caller had every right to be slow about. */
    if (progress.phase === POKYD_PHASE_DONE) {
      this.finish();
      return;
    }

    if (this.coldPath !== true || this.coldPathOver) {
      /* A cold load prints nothing at all during POKYD_PHASE_VOCABULARY -- that
         read fails on the missing SLOVNIK.TMP before it reaches its own progress
         bar -- so output arriving under that phase can only be a warm load
         reading the 18 MB back.  If this ever guesses wrong, the marker above
         corrects it a few milliseconds later, and enter() will not let the bar
         fall back in the meantime. */
      if (progress.phase === POKYD_PHASE_VOCABULARY && this.coldPath === null) {
        this.coldPath = false;
        this.recompute();
      }
      this.enter(stepForPhase(progress.phase));
    }

    const m = PERCENT.exec(text);
    if (m !== null) this.setStepPercent(parseFloat(m[1]));
  }

  private enter(step: number): void {
    if (step <= this.step) return;      /* the steps only ever go forwards */
    this.step = step;
    this.stepPercent = null;
    if (step !== POKYD_STEP_DONE) {
      this.lastCaption = POKYD_STEP_CAPTIONS[step] ?? this.lastCaption;
    }
    this.recompute();
  }

  private setStepPercent(percent: number): void {
    if (!Number.isFinite(percent)) return;
    const value = percent < 0 ? 0 : percent > 100 ? 100 : percent;
    /* The sort's own bar steps back by 0.1 eighty-odd times in 392,699
       readings, which is long double rounding and not progress being lost. */
    if (this.stepPercent !== null && value < this.stepPercent) return;
    this.stepPercent = value;
    this.recompute();
  }

  private recompute(): void {
    const weights = this.coldPath === false ? WARM_WEIGHTS : COLD_WEIGHTS;
    let sum = 0;
    for (let s = POKYD_STEP_BASE_DICTIONARY; s < this.step; s++) sum += weights[s];
    sum += (weights[this.step] ?? 0) * (this.stepPercent ?? 0) / 100;

    const value = sum * 100;
    /* Monotonic, and this is the one place it is enforced.  Two things would
       otherwise walk the bar backwards: learning halfway through that a load is
       warm after the weights had assumed it cold, and the second base-dictionary
       read of a cold load starting its own bar again at zero. */
    if (value > this.overall) this.overall = value > 100 ? 100 : value;
  }

  /* Cheap "did anything move", so onChange is not called 200 times with the same
     state when the engine repeats a percentage it has already reported. */
  private fingerprint(): string {
    return this.step + ":" + String(this.stepPercent) + ":" + this.overall
      + ":" + String(this.coldPath);
  }

  private emit(): void {
    const fn = this.onChange;
    if (fn) fn(this.state);
  }
}

/* pokyd_phase() to the step it means.  POKYD_PHASE_INFLECTING maps to the base
   dictionary rather than to inflecting, and that is not a slip: the first thing
   NACTI_A_ROZSKLONUJ_ZAKLADNI_SLOVNIK does under IQPOKYDWINMFC != 1 is read the
   base dictionary again (SLOVNIK.FU:3250), and the caller has already moved the
   phase on by then.  The three real sub-steps arrive as markers instead.  This is
   also what labels the twenty milliseconds after "Hotovo." -- the tail of the DOS
   harness freeing its memory -- as the re-read that does in fact come next. */
function stepForPhase(phase: number): number {
  switch (phase) {
    case POKYD_PHASE_BASE_DICTIONARY: return POKYD_STEP_BASE_DICTIONARY;
    case POKYD_PHASE_INFLECTING:      return POKYD_STEP_BASE_DICTIONARY;
    case POKYD_PHASE_VOCABULARY:      return POKYD_STEP_VOCABULARY;
    case POKYD_PHASE_INTELLIGENCE:    return POKYD_STEP_INTELLIGENCE;
    case POKYD_PHASE_EXTERNAL:        return POKYD_STEP_EXTERNAL;
    case POKYD_PHASE_DONE:            return POKYD_STEP_DONE;
    default:                          return POKYD_STEP_IDLE;
  }
}

/* ---------------------------------------------------------------- the text */

/** A percentage the way IQ Pokyd wrote one: with a decimal comma, because Czech
 *  uses one.
 *
 *  VLAKNO__PROCENTA_PROGRESU (PROSTRED.FU:526-530) formats with "%.1f%%" while
 *  the dictionary is being made and "%.0f%%" for everything else, then walks back
 *  three characters and replaces the point with a comma if it finds one there.
 *  This does the same thing forwards. */
export function formatPercent(percent: number, decimals = 1): string {
  const safe = Number.isFinite(percent) ? percent : 0;
  const clamped = safe < 0 ? 0 : safe > 100 ? 100 : safe;
  return clamped.toFixed(decimals).replace(".", ",") + "%";
}

/** How many decimals the author's loading window showed for a step: one while
 *  the dictionary is being inflected or sorted, none otherwise.  PROSTRED.FU:526,
 *  the same switch that chose between a 50 ms and a 100 ms refresh for them. */
export function percentDecimals(step: number): number {
  return step === POKYD_STEP_INFLECTING || step === POKYD_STEP_SORTING ? 1 : 0;
}
