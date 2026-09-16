/* IQ Pokyd - src/api/pokyd_api.h - the surface everything outside the engine talks to.

   Phase 3.1 of PLAN.md.  The engine is 11,000 lines of 2005 C++ with some forty
   globals and no entry point of its own -- IQ_POKYDE_ODPOVEZ lives in
   Prostred/PROSTRED.FU, which BEZ_PROSTREDI compiles out, and the loading
   sequence lives in an MFC worker thread in the same file.  This header is the
   whole of what a caller may use instead: sixteen functions and one struct.
   Nothing here exposes a C++ type, so the Emscripten side can bind it with
   EXPORTED_FUNCTIONS and the phase 4.2 worker never sees a class layout.

   Encoding.  Every char * that crosses this boundary is CP1250, in both
   directions, and has to stay CP1250: the engine switches on single bytes
   (`case 'c':` with a hacek), indexes a 28-letter alphabet, and checksums its own
   data files.  Phase 4.1's codec is the only place bytes become text.

   Order of operations, and it is not advisory:

       pokyd_init(datadir)          once, before anything else
       pokyd_import_cache(...)      optional, and only here -- see the note on it
       pokyd_load_dictionaries()    ~4.5 s cold, ~0.4 s warm
       pokyd_seed(n)                after loading, never before -- see below
       pokyd_say(...)               as often as you like
       pokyd_export_cache(...)      any time after loading
       pokyd_shutdown()

   One of those constraints comes from the engine and is documented again at the
   call that enforces it in pokyd_api.cpp: seeding has to come last because
   ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU reseeds from the clock on its way out
   (SLOVNIK.FU:1732).  Importing a cache is a step of its own for a plainer reason
   -- it writes SLOVNIK.TMP, and the file has to be there before the load looks for
   it.  Until phase 3.3 it was also hazard 10's requirement that nothing open a file
   between the base-dictionary read and the cache read; PATCHES.md 2 removed that,
   and the shape of the API is unchanged by it.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code.
*/

#ifndef POKYD_API_H
#define POKYD_API_H

#ifdef __cplusplus
extern "C" {
#endif

/* ------------------------------------------------------------------ settings */

/* A flat mirror of class Nastaveni (src/shim/tridy.h, verbatim from
   !Prostre/IQPokyd.h).  Flat because the class has member functions and a caller
   on the far side of a wasm boundary should not be reading a C++ layout; the
   fields are the author's, one for one and in his order, so the two can still be
   diffed by eye.

   mood and mood_points are both here on purpose and they are not redundant.
   mood_points (0..90) is the state that actually drifts -- every matched rule
   nudges it (INTELIG.FU:1046) -- and mood (1..5) is recomputed from it after
   every sentence (INTELIG.FU:1047).  So reading both is right, but writing mood
   alone does nothing: use pokyd_set_mood, which is what the original's own
   settings dialog does (!Prostre/Nastaveni.cpp:167).

   The names are ours and English, like everything outside src/engine/; the
   author's own name for each field is the comment beside it, so the struct and
   class Nastaveni can still be read against each other line by line. */
typedef struct pokyd_settings {
  unsigned char human_gender;          /* pohlavicloveka: 1 male, 2 female */
  unsigned char computer_gender;       /* pohlavipocitace */
  char human_name[101];                /* jmenocloveka */
  char computer_name[101];             /* jmenopocitace */
  unsigned char character;             /* charakter: 0 machine, 1 naive, 2 calm,
                                          3 average, 4 suspicious, 5 moody,
                                          6 volatile */
  unsigned char mood;                  /* nalada: 1 excellent .. 5 awful; derived,
                                          and in practice read-only -- see above */
  unsigned char mood_points;           /* naladabody: 0..90, the state that drifts */

  unsigned char save_conversation;     /* ukladatrozhovor: 0 no, 1 yes */
  unsigned char use_sounds;            /* pouzivatzvuky */
  unsigned char use_effects;           /* pouzivatefekty */
  unsigned char formal_czech;          /* spisovnacestina */
  unsigned char show_labels;           /* zobrazovatpopisky */

  unsigned char debug_fast_exit;             /* debug_rychleukoncovani */
  unsigned char debug_spelling_tolerance;    /* debug_tolerancepravopisu */
  unsigned char debug_spelling_recursion;    /* debug_pravopisnarekurze */

  unsigned char emulate_keyboard;      /* emulovatklavesnici: 0 none, 1 Czech,
                                          2 Slovak */
  unsigned char keyboard_qwerty;       /* klavesniceqwerty */
  unsigned char standard_cursor;       /* standardnikurzor */

  unsigned char cmd_read_only;         /* prikaz_readonlymod: 1 = write no files at
                                          all: no SLOVNIK.TMP (SLOVNIK.FU:1557),
                                          no PROFIL.IQP (:1841) */
  unsigned char cmd_no_background;     /* prikaz_nezobrazovatpozadi */
 } pokyd_settings;

/* --------------------------------------------------------------- loading state */

/* What pokyd_phase() reports.  These are the five captions
   VLAKNO__NACITEJ_JAK_DIVEJ put in the loading window (PROSTRED.FU:550-605), in
   the order it put them there, so a UI can say what the original said.

   The author subdivided the third one further -- g_praveprovadenaakce 2/3/4, with
   g_procentanacitani remapped to 0-50%, 50-100% and then a fresh bar for the
   write (PROSTRED.FU:515-523).  Those three assignments sit inside
   `#if IQPOKYDWINMFC == 1` (SLOVNIK.FU:3260, :3329, :3340) and so are not
   compiled into a BEZ_PROSTREDI build.

   Phase 4.2 measured what that actually leaves, and it is worse than this
   comment used to predict.  There is no 0..100 three times over: sampled a few
   hundred times across a real cold load, g_procentanacitani takes the values 0
   and 100 during POKYD_PHASE_INFLECTING and nothing in between.  The assignment
   that would give the inflection loop a gradient is SLOVNIK.FU:3318, behind the
   same guard.  What the author put in the #else branch instead is a printf of
   the percentage, so the progress signal in this build is the engine's console
   output and not this counter -- see PROGRESS in src/web/protocol.ts.

   Phase 4.3 then measured the phase itself, and the note below about "the 4.5 s
   one" understates where the time goes.  Of the 14 s a cold load takes here,
   POKYD_PHASE_INFLECTING is 13.7 of them, and they divide as 1.0 s inflecting
   (ROZSKLONUJ_PODLE_SPRAVNEHO_VZORU, 11,207 words), 12.4 s sorting
   (SETRID_SLOVA_V_DATABAZI) and 0.24 s writing the 18 MB cache.  The sort is the
   long step, and it prints a percentage of its own at SLOVNIK.FU:2322. */
#define POKYD_PHASE_IDLE            0   /* not loading */
#define POKYD_PHASE_BASE_DICTIONARY 1   /* "Nacitam zakladni slovnik..." SLOVNIK.IQP */
#define POKYD_PHASE_VOCABULARY      2   /* "Nacitam slovni zasobu..."    SLOVNIK.TMP */
#define POKYD_PHASE_INFLECTING      3   /* "Vytvarim slovni zasobu..."   the 4.5 s one */
#define POKYD_PHASE_INTELLIGENCE    4   /* "Nacitam inteligenci..."      IQPOKYD.IQP */
#define POKYD_PHASE_EXTERNAL        5   /* "Nacitam externi data..."     PROFIL.IQP */
#define POKYD_PHASE_DONE            6   /* loaded */

/* ----------------------------------------------------------------- life cycle */

/* Allocate the globals the engine assumes exist, apply NASTAV_STANDARDNE, and
   enter `datadir`.  The directory is not a nicety: OTEVRI_SOUBOR opens every data
   file by bare name in the current directory (SLOVNIK.FU:195, the IQPOKYDWINMFC
   != 1 branch), and it has to be writable, because the 17 MB SLOVNIK.TMP is
   written next to them.  NULL means "stay where you are".

   Returns 0, or -1 if the directory cannot be entered.  Calling it twice is an
   error and returns -1: the engine's globals are not re-entrant. */
int pokyd_init(const char *datadir);

/* The loading sequence, which is VLAKNO__NACITEJ_JAK_DIVEJ minus the window.
   Returns 0 on success, -1 on failure (pokyd_error() says what).  About 4.5 s and
   37 MB the first time -- 11,207 base words into 402,252 forms -- and 0.4 s on any
   run that finds a usable SLOVNIK.TMP next to the dictionary. */
int pokyd_load_dictionaries(void);

/* Free everything and return the number of blocks the engine did not account for,
   which should be 0.  That counter is the only leak detector this code has, and
   phase 3 runs it in a heap that has to be sized, so it is worth reading.

   Only after a pokyd_load_dictionaries() that succeeded.  Found at phase 4.2,
   which was the first caller to try it any other way: UVOLNI_VESKEROU_DYNAMICKOU_
   PAMET walks g_vetacloveka calling Typ_slova::VYMAZ_OBSAH (INTELIG.FT:54), which
   frees some twenty pointers unconditionally, and UVOLNI_X(NULL) is a fatal error
   by design (SKLONOV.FU:1348).  Those pointers are allocated while the base
   dictionary is read, so on an engine that only ever ran pokyd_init they are all
   NULL.  Measured in wasm, where it comes out as an Emscripten abort; the path
   is NAHLAS_CHYBU(..., _UKONCIT_), which raise()s SIGABRT (DEBUG.FU:119), so
   nothing about it is toolchain-specific.

   Left as it is rather than guarded, because a load that never happened has
   nothing to tear down: drop the module, or terminate the worker.  src/web/
   engine.ts refuses the call for the same reason, with the reference. */
unsigned long pokyd_shutdown(void);

/* What went wrong, in English, ASCII, valid until the next failing call.  Never
   NULL; empty when nothing has failed. */
const char *pokyd_error(void);

/* ---------------------------------------------------------------- conversation */

/* One sentence in, one answer out, both CP1250.  This is CMfcDlg::OnNovaveta
   (!Prostre/mfcDlg.cpp:596-607) wrapped around IQ_POKYDE_ODPOVEZ
   (PROSTRED.FU:212): the pre-processing is not optional, the engine wants
   lowercase, phonemically normalized text with "ses"/"bych" split in two.

   The returned pointer is the engine's own g_odpovedpocitace and is overwritten by
   the next call -- copy it if you need to keep it.  It is never NULL, and after
   the first sentence it is never empty: when nothing matches,
   VYBER_JEDNU_ODPOVED_Z_ODPOVEDI_PODLE_HISTORIE returns at once (INTELIG.FU:89,
   where the author's own "!" marks the hole) and IQ Pokyd repeats its previous
   answer rather than saying nothing.  That is the original's behaviour and it is
   kept.

   Returns NULL if it is called before pokyd_load_dictionaries succeeded.  A NULL
   sentence is a no-op that hands back the current answer unchanged. */
const char *pokyd_say(const char *sentence_cp1250);

/* g_pocetrecenychvet -- how many sentences have been said to it.  Rules test it,
   so it is conversation state, not a statistic. */
unsigned long pokyd_sentence_count(void);

/* ----------------------------------------------------------------- randomness */

/* srand(), and it belongs after pokyd_load_dictionaries(), not before:
   ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU reseeds from the clock on its way out
   (SLOVNIK.FU:1732), so a seed set before a cold start does not survive it.

   rand() is what picks between equally unheard answers (INTELIG.FU:74, :111) and
   what nudges the mood (:532), so the conversation is a function of this number --
   and, since src/shim/nahoda.h, of nothing else.  Same seed, same conversation, on
   any toolchain.  That is what test/golden/ is for and what 3.3 checks. */
void pokyd_seed(unsigned long seed);

/* ------------------------------------------------------------------- settings */

void pokyd_get_settings(pokyd_settings *out);

/* Copies every field verbatim, mood_points included.  If you are changing the mood
   rather than restoring a saved one, call pokyd_set_mood instead, or the change
   will be undone after the next sentence. */
void pokyd_set_settings(const pokyd_settings *in);

/* mood 1..5, and recompute mood_points from it -- Nastaveni.cpp:167.  Values
   outside 1..5 are ignored. */
void pokyd_set_mood(unsigned char mood);

/* -------------------------------------------------------------------- progress */

/* g_procentanacitani, 0..100, and which step it belongs to.  Both are only
   meaningful while pokyd_load_dictionaries() is running -- and that call is
   synchronous, so something other than the calling thread has to do the reading.
   Whose problem that is, is phase 4.3's; this is the surface it will read. */
double pokyd_progress(void);
int pokyd_phase(void);

/* ----------------------------------------------------------------------- cache */

/* SLOVNIK.TMP, the inflected dictionary, moved in and out as bytes so that phase
   4.4 can keep it in IndexedDB and skip the 4.5 s cold start.

   Export returns a malloc'd copy and writes its length through `length`; free it
   with pokyd_free.  NULL means there is no cache file -- which is normal before a
   cold load has finished writing one, and after any run with cmd_read_only set.

   Import writes the blob to SLOVNIK.TMP.  It must be called after pokyd_init and
   *before* pokyd_load_dictionaries -- not during, and not as an argument to it.
   It used to matter a great deal more than that.  PLAN.md hazard 10: the cache
   read took its padding length from a FILE * the base-dictionary read had already
   closed, and worked only while the C runtime handed the same slot straight back,
   so nothing could open a file between those two calls.  Emscripten's allocator
   does not hand it back and the read trapped; PATCHES.md 2 is the two-identifier
   fix, and the ordering is now ordinary rather than load-bearing.

   Nothing in SLOVNIK.TMP identifies which dictionary it was inflected from.  The
   engine checksums it and rejects a corrupt one (_SPATNY_UPLNY_SLOVNIK_, after
   which it silently re-inflects), but it cannot tell a *wrong* one from a right
   one -- so the caller owns that check.  tools/build.py drops the file whenever
   SLOVNIK.IQP changes underneath it, and on the web src/web/cache.ts keys the
   stored blob by a hash of the dictionary it read back out of MEMFS -- plus a
   version string for the half a dictionary hash cannot see, which is that this
   blob is what the *engine* made of that dictionary.  See POKYD_CACHE_VERSION
   there. */
unsigned char *pokyd_export_cache(unsigned long *length);
int pokyd_import_cache(const unsigned char *data, unsigned long length);
void pokyd_free(void *block);

#ifdef __cplusplus
}
#endif

#endif
