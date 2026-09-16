/* IQ Pokyd - src/api/pokyd_api.cpp - the exported surface, implemented.

   Phase 3.1 of PLAN.md.  Everything the engine needs done around it, in one
   place: the globals it assumes exist, the loading order PROSTRED.FU's worker
   thread used, the entry point BEZ_PROSTREDI compiles out, and the pre- and
   post-processing the MFC dialog did on every sentence.  src/driver/pokyd.cpp
   rehearsed all four at phase 1.5 and now calls them from here instead, so there
   is one copy and the phase 1.6 golden transcript tests it natively before
   Emscripten ever sees it.

   What it mirrors, and where the original does it
   -----------------------------------------------
   PRIPRAV_GLOBALY()       !Prostre/mfcDlg.cpp:405-418 (CMfcDlg::OnInitDialog)
   pokyd_load_dictionaries Aplikace/Prostred/PROSTRED.FU:550 (VLAKNO__NACITEJ_JAK_DIVEJ)
   IQ_POKYDE_ODPOVEZ()     Aplikace/Prostred/PROSTRED.FU:212, verbatim
   pokyd_say               !Prostre/mfcDlg.cpp:596-607 (CMfcDlg::OnNovaveta)

   Two of those exist nowhere else in a build without MFC.  PROSTRED.FU is the
   file BEZ_PROSTREDI removes, and it holds both the documented entry point and
   the loader -- so a copy of each has to live somewhere, and this is where.

   Why .cpp and not the .c PLAN.md 3.1 asked for, and why src/api/ and not
   src/engine/: engine.h declares classes, so the translation unit is C++ whatever
   the file is called, and src/engine/ is the byte-exact mirror of original/ that
   tools/transcode.py --check verifies -- new code of ours has no business in it.
   The exported surface is `extern "C"` regardless, which is all the JS boundary
   cares about.

   Written by us, not ported.  English identifiers and ASCII only -- our own
   names are lower case, so that a SHOUTING one is always the engine's.  The two
   exceptions are PRIPRAV_GLOBALY and IQ_POKYDE_ODPOVEZ below, which are the
   author's own functions transplanted out of files BEZ_PROSTREDI removes and
   keep his names for that reason.
*/

#include "pokyd_api.h"
#include "engine.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
  #include <direct.h>
  #define POKYD_CHDIR _chdir
#else
  #include <unistd.h>
  #define POKYD_CHDIR chdir
#endif

/* ---------------------------------------------------------------------- state */

static int is_init = 0;        /* pokyd_init has run */
static int is_loaded = 0;     /* pokyd_load_dictionaries has succeeded */
static int phase = POKYD_PHASE_IDLE;
static char error_text[256] = "";

static void set_error(const char *text) {
  strncpy(error_text, text, sizeof(error_text) - 1);
  error_text[sizeof(error_text) - 1] = 0;
 }

const char *pokyd_error(void) { return error_text; }

int pokyd_phase(void) { return phase; }

double pokyd_progress(void) { return (double)g_procentanacitani; }

unsigned long pokyd_sentence_count(void) { return (unsigned long)g_pocetrecenychvet; }

void pokyd_seed(unsigned long seed) { srand((unsigned)seed); }

void pokyd_free(void *block) { free(block); }

/* --------------------------------------------------------------------- globals */

static void PRIPRAV_GLOBALY(void) {
  /* !Prostre/mfcDlg.cpp:405-418.  The engine assumes these five are allocated
     before anything else runs.  UVOLNI_VESKEROU_DYNAMICKOU_PAMET is the strict
     one: it frees all five unconditionally, and UVOLNI_X(NULL) is a fatal error,
     so this has to be re-run after anything that frees them. */
  g_aktualnivetacloveka=ALOKUJ_RETEZEC(1); g_aktualnivetacloveka[0]=0;
  g_predchozivetacloveka=ALOKUJ_RETEZEC(1); g_predchozivetacloveka[0]=0;

  debug_poslednipodmetcloveka=ALOKUJ_RETEZEC(DELKA_JEDNODUCHEHO_SLOVA);
  strcpy(debug_poslednipodmetcloveka,"-");
  debug_posledniprisudekcloveka=ALOKUJ_RETEZEC(DELKA_JEDNODUCHEHO_SLOVA);
  strcpy(debug_posledniprisudekcloveka,"-");
  debug_poslednipredmetcloveka=ALOKUJ_RETEZEC(DELKA_JEDNODUCHEHO_SLOVA);
  strcpy(debug_poslednipredmetcloveka,"-");
 }

/* ------------------------------------------------------------------ life cycle */

int pokyd_init(const char *datadir) {
  if (is_init) { set_error("pokyd_init: already initialised"); return(-1); }

  if (datadir != NULL && POKYD_CHDIR(datadir) != 0) {
    set_error("pokyd_init: cannot enter the data directory");
    return(-1);
   }

  g_nastaveni.NASTAV_STANDARDNE();       /* mfcDlg.cpp:403 */
  PRIPRAV_GLOBALY();

  phase=POKYD_PHASE_IDLE;
  error_text[0]=0;
  is_init=1;
  return(0);
 }

static int file_exists(const char *name) {
FILE *f=fopen(name,"rb");
  if (f == NULL) return(0);
  fclose(f);
  return(1);
 }

int pokyd_load_dictionaries(void) {
  /* PROSTRED.FU:550, VLAKNO__NACITEJ_JAK_DIVEJ, minus the window: the progress
     bar, the five SetWindowText calls, the cancel check between every step, the
     click sounds and the CTI_ME.HTM integrity check.  The order of what remains
     is the original's and it matters -- see the base dictionary note in the
     cache-miss branch.  The five `phase` assignments stand where those five
     SetWindowText calls did. */

DWORD i;

  if (is_init == 0) { set_error("pokyd_load_dictionaries: call pokyd_init first"); return(-1); }
  if (is_loaded) { set_error("pokyd_load_dictionaries: already loaded"); return(-1); }

  /* The engine reports a missing data file through NAHLAS_CHYBU, which is a
     MessageBox and then raise(SIGABRT) -- no use to a caller and no use at all in
     a worker.  Checking first turns the two cases that actually happen into a
     return value.  These two opens are before ALOKUJ_VSECHNY_PRVKY_G_VETACLOVEKA
     and so before any of the loading proper. */
  if (file_exists(JMENO_ZAKLADNIHO_SLOVNIKU) == 0) {
    set_error("no " JMENO_ZAKLADNIHO_SLOVNIKU " in the data directory");
    return(-1);
   }
  if (file_exists(JMENO_SOUBORU_S_INTELIGENCI) == 0) {
    set_error("no " JMENO_SOUBORU_S_INTELIGENCI " in the data directory");
    return(-1);
   }

  phase=POKYD_PHASE_BASE_DICTIONARY;
  ALOKUJ_VSECHNY_PRVKY_G_VETACLOVEKA();
  PRECTI_DATABAZI_SLOV_ZE_ZAKLADNIHO_SLOVNIKU();

  /* Hazard 10, and the one place this port had to patch the engine to run at all.
     PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU read its padding from
     g_zakladnislovnik (SLOVNIK.FU:1103,1106), which the call above closes at
     :1069 -- a typo that worked only because the C runtime handed the freed FILE
     slot straight back to the next fopen.  Emscripten's does not, and getc on the
     dangling pointer trapped; PATCHES.md 2 points both reads at g_uplnyslovnik,
     which is the file the bytes are actually in.  The two calls no longer have to
     be adjacent, and they still are. */
  phase=POKYD_PHASE_VOCABULARY;
  if (PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU() == 1) {
    /* No usable SLOVNIK.TMP, so the 11,207 base words have to be inflected into
       every form -- the "Sklonuji slovnik..." progress bar, about five seconds
       and 402,252 forms against a MAX_POCET_VSECH_SLOV of 500,000.

       NACTI_A_ROZSKLONUJ_ZAKLADNI_SLOVNIK is not a plain loader here.  Under
       IQPOKYDWINMFC != 1 it is the author's own DOS test harness: it re-reads the
       base dictionary itself (SLOVNIK.FU:3248), and once it has written the cache
       it frees the entire dictionary again, checks that every allocated block came
       back, and waits for a keypress (SLOVNIK.FU:3344-3357).

       That tail is why this is not a plain call.  Leaving our own load in place
       would leak 11,207 strings past it and turn its block check into a fatal
       NAHLAS_CHYBU, so we hand it a clean slate, let it run as the program it is,
       and then load again from the cache it just wrote.  Both
       UVOLNI_VESKEROU_DYNAMICKOU_PAMET calls -- ours here and the one in its tail
       -- free the five PRIPRAV_GLOBALY strings, hence the two rebuilds. */
    phase=POKYD_PHASE_INFLECTING;
    UVOLNI_VESKEROU_DYNAMICKOU_PAMET();
    PRIPRAV_GLOBALY();

    NACTI_A_ROZSKLONUJ_ZAKLADNI_SLOVNIK();

    PRIPRAV_GLOBALY();
    phase=POKYD_PHASE_BASE_DICTIONARY;
    ALOKUJ_VSECHNY_PRVKY_G_VETACLOVEKA();
    PRECTI_DATABAZI_SLOV_ZE_ZAKLADNIHO_SLOVNIKU();
    phase=POKYD_PHASE_VOCABULARY;
    if (PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU() == 1) {
      /* Cold path ran and the cache still will not read back, which means the
         write failed -- a full or read-only data directory.  Before PATCHES.md 2
         this was also where hazard 10 would have surfaced, quietly, as a checksum
         mismatch; it does not any more, and under Emscripten it never got the
         chance, because the dangling read trapped instead.  Not recoverable here
         and it must not be silent. */
      set_error(JMENO_UPLNEHO_SLOVNIKU " cannot be read back after inflecting the dictionary");
      phase=POKYD_PHASE_IDLE;
      return(-1);
     }
   }

  phase=POKYD_PHASE_INTELLIGENCE;
  PRECTI_INTELIGENCI_ZE_SOUBORU();
  g_odpovedipocitace=(char **)ALOKUJ_PAMET(g_pocetiqpodminek*sizeof(*g_odpovedipocitace));
  g_idodpovedipocitace=(WORD *)ALOKUJ_PAMET(g_pocetiqpodminek*sizeof(g_idodpovedipocitace[0]));
  for (i=0; i < g_pocetiqpodminek; i++) {
    g_odpovedipocitace[i]=ALOKUJ_RETEZEC(MAX_DELKA_ODPOVEDI_POCITACE+1);
   }

  phase=POKYD_PHASE_EXTERNAL;
  PRECTI_PROFIL_ZE_SOUBORU();   /* PROFIL.IQP, what it remembers about you.  Read
                                   if it is there, never written: see PLAN 7.5. */

  phase=POKYD_PHASE_DONE;
  is_loaded=1;
  return(0);
 }

unsigned long pokyd_shutdown(void) {
  if (is_init == 0) return(0);

  UVOLNI_VESKEROU_DYNAMICKOU_PAMET();
  is_init=0; is_loaded=0;
  phase=POKYD_PHASE_IDLE;

  /* Not politeness: the block counter is the only leak detector this code has,
     and phase 3 runs it in a wasm heap that has to be sized. */
  return((unsigned long)debug_pocetalokovani);
 }

/* ----------------------------------------------------------------- conversation */

static void IQ_POKYDE_ODPOVEZ(char *vetacloveka) {
  /* PROSTRED.FU:212, verbatim, minus the 25 commented-out lines at its head.  The
     documented entry point of the whole engine lives in the one file
     BEZ_PROSTREDI removes, so a build without MFC has to carry its own copy.

     The answer comes back in the global g_odpovedpocitace -- and stays there if
     nothing matched: VYBER_JEDNU_ODPOVED_Z_ODPOVEDI_PODLE_HISTORIE returns at
     once when g_pocetodpovedipocitace is 0 (INTELIG.FU:89, where the author's own
     "!" marks it as a known hole), so IQ Pokyd repeats its last answer rather
     than saying nothing.  That is the original's behaviour; we keep it. */
  g_pocetodpovedipocitace=0;
  g_pocetrecenychvet++;
  POROZUMEJ_VETE_NAPSANE_CLOVEKEM(vetacloveka);
  ZPRACUJ_VETU();
  VYBER_JEDNU_ODPOVED_Z_ODPOVEDI_PODLE_HISTORIE();
  g_smyslposlednivetypocitace=ZJISTI_SMYSL_VETY_POCITACE(g_odpovedpocitace);
 }

const char *pokyd_say(const char *sentence_cp1250) {
  /* !Prostre/mfcDlg.cpp:596-607, CMfcDlg::OnNovaveta.  The pre- and
     post-processing around IQ_POKYDE_ODPOVEZ is not optional: the engine wants
     lowercase, phonemically normalized text with "ses"/"bych" expanded into two
     words, and hands back an answer that still has to be put back together.
     Skipping any of it changes the answers.

     Note that UPRAV_VETU_PRO_IQPOKYD frees what it is given and returns a new
     pointer (SKLONOV.FU:173), so g_aktualnivetacloveka must be reassigned and
     must come from the engine's own allocator. */

  if (is_loaded == 0) { set_error("pokyd_say: nothing is loaded"); return(NULL); }
  if (sentence_cp1250 == NULL) return(g_odpovedpocitace);

  g_aktualnivetacloveka=(char *)REALOKUJ_PAMET(g_aktualnivetacloveka,strlen(sentence_cp1250)+1);
  strcpy(g_aktualnivetacloveka,sentence_cp1250);

  PREVED_NA_MALA_PISMENA(g_aktualnivetacloveka);
  UPRAV_DLOUHE_SLOVO_PRO_IQPOKYD(g_aktualnivetacloveka);
  g_aktualnivetacloveka=UPRAV_VETU_PRO_IQPOKYD(g_aktualnivetacloveka);
  IQ_POKYDE_ODPOVEZ(g_aktualnivetacloveka);
  ODUPRAV_VETU_PRO_IQPOKYD();

  strcpy(g_aktualnivetacloveka,sentence_cp1250);   /* the buffer is >= strlen(sentence)+1 */

  g_predchozivetacloveka=(char *)REALOKUJ_PAMET(g_predchozivetacloveka,strlen(sentence_cp1250)+1);
  strcpy(g_predchozivetacloveka,sentence_cp1250);

  return(g_odpovedpocitace);
 }

/* --------------------------------------------------------------------- settings */

void pokyd_get_settings(pokyd_settings *out) {
  if (out == NULL) return;
  memset(out,0,sizeof(*out));

  out->human_gender=g_nastaveni.pohlavicloveka;
  out->computer_gender=g_nastaveni.pohlavipocitace;
  strcpy(out->human_name,g_nastaveni.jmenocloveka);
  strcpy(out->computer_name,g_nastaveni.jmenopocitace);
  out->character=g_nastaveni.charakter;
  out->mood=g_nastaveni.nalada;
  out->mood_points=g_nastaveni.naladabody;

  out->save_conversation=g_nastaveni.ukladatrozhovor;
  out->use_sounds=g_nastaveni.pouzivatzvuky;
  out->use_effects=g_nastaveni.pouzivatefekty;
  out->formal_czech=g_nastaveni.spisovnacestina;
  out->show_labels=g_nastaveni.zobrazovatpopisky;

  out->debug_fast_exit=g_nastaveni.debug_rychleukoncovani;
  out->debug_spelling_tolerance=g_nastaveni.debug_tolerancepravopisu;
  out->debug_spelling_recursion=g_nastaveni.debug_pravopisnarekurze;

  out->emulate_keyboard=g_nastaveni.emulovatklavesnici;
  out->keyboard_qwerty=g_nastaveni.klavesniceqwerty;
  out->standard_cursor=g_nastaveni.standardnikurzor;

  out->cmd_read_only=g_nastaveni.prikaz_readonlymod;
  out->cmd_no_background=g_nastaveni.prikaz_nezobrazovatpozadi;
 }

void pokyd_set_settings(const pokyd_settings *in) {
  /* Nastaveni::ZKOPIRUJ_SEM (NASTAVEN.PR:44-69), field for field, with the two
     names truncated rather than trusted: they are char[101] on both sides and the
     engine strcpy()s them, so a caller who forgot the terminator would smash
     whatever follows g_nastaveni. */
  if (in == NULL) return;

  g_nastaveni.pohlavicloveka=in->human_gender;
  g_nastaveni.pohlavipocitace=in->computer_gender;
  strncpy(g_nastaveni.jmenocloveka,in->human_name,sizeof(g_nastaveni.jmenocloveka)-1);
  g_nastaveni.jmenocloveka[sizeof(g_nastaveni.jmenocloveka)-1]=0;
  strncpy(g_nastaveni.jmenopocitace,in->computer_name,sizeof(g_nastaveni.jmenopocitace)-1);
  g_nastaveni.jmenopocitace[sizeof(g_nastaveni.jmenopocitace)-1]=0;
  g_nastaveni.charakter=in->character;
  g_nastaveni.nalada=in->mood;
  g_nastaveni.naladabody=in->mood_points;

  g_nastaveni.ukladatrozhovor=in->save_conversation;
  g_nastaveni.pouzivatzvuky=in->use_sounds;
  g_nastaveni.pouzivatefekty=in->use_effects;
  g_nastaveni.spisovnacestina=in->formal_czech;
  g_nastaveni.zobrazovatpopisky=in->show_labels;

  g_nastaveni.debug_rychleukoncovani=in->debug_fast_exit;
  g_nastaveni.debug_tolerancepravopisu=in->debug_spelling_tolerance;
  g_nastaveni.debug_pravopisnarekurze=in->debug_spelling_recursion;

  g_nastaveni.emulovatklavesnici=in->emulate_keyboard;
  g_nastaveni.klavesniceqwerty=in->keyboard_qwerty;
  g_nastaveni.standardnikurzor=in->standard_cursor;

  g_nastaveni.prikaz_readonlymod=in->cmd_read_only;
  g_nastaveni.prikaz_nezobrazovatpozadi=in->cmd_no_background;
 }

void pokyd_set_mood(unsigned char mood) {
  /* !Prostre/Nastaveni.cpp:167 -- the two lines the original's settings dialog
     runs when the user moves the mood slider. */
  if (mood < 1 || mood > 5) return;
  g_nastaveni.nalada=(BYTE)mood;
  g_nastaveni.SPOCITEJ_NALADABODY_Z_NALADY();
 }

void pokyd_set_mood_points(unsigned char points) {
  /* !Prostre/debugnastaveni.cpp:220-224, which is pokyd_set_mood the other way
     round: naladabody is the state that drifts and nalada is recomputed from it.
     His own two refusals -- "must be a whole positive number" and "must be
     0 - 90" -- are the dialog's, so what is left here is the bound itself. */
  if (points > 90) return;
  g_nastaveni.naladabody=(BYTE)points;
  g_nastaveni.SPOCITEJ_NALADU_PODLE_NALADABODY();
 }

/* ------------------------------------------------------------------- debug info */

/* strncpy with the NUL guaranteed.  Every field of pokyd_debug is a fixed array
   and every source is either the engine's own bounded buffer or something a
   visitor typed, so truncation is the only sane failure. */
static void copy_field(char *out,size_t size,const char *in) {
  if (in == NULL) { out[0]=0; return; }
  strncpy(out,in,size-1);
  out[size-1]=0;
 }

/* !Prostre/debugnastaveni.cpp:105-118: the three sentence parts are stored in
   the engine's phoneme spelling and have to be read back out of it.  His own
   scratch buffer is ALOKUJ_RETEZEC(200), and the size matters -- ODUPRAV_SLOVO_
   PRO_IQPOKYD expands as it goes ('*' becomes "ch") and writes back in place. */
static void copy_word(char *out,size_t size,const char *in) {
char scratch[200];
  copy_field(scratch,sizeof(scratch),in);
  ODUPRAV_SLOVO_PRO_IQPOKYD(scratch);
  copy_field(out,size,scratch);
 }

void pokyd_debug_info(pokyd_debug *out) {
  if (out == NULL) return;
  memset(out,0,sizeof(*out));

  out->allocated_blocks=(unsigned int)debug_pocetalokovani;
  out->max_words=(unsigned int)debug_maxpocetvsechslov;
  out->answer_count=(unsigned int)g_pocetodpovedipocitace;
  out->base_words=(unsigned int)g_pocetslovvzakladnidatabazi;
  out->rules=(unsigned int)g_pocetiqpodminek;

  copy_field(out->last_answer,sizeof(out->last_answer),g_odpovedpocitace);
  copy_field(out->last_sentence,sizeof(out->last_sentence),g_predchozivetacloveka);
  copy_word(out->subject,sizeof(out->subject),debug_poslednipodmetcloveka);
  copy_word(out->predicate,sizeof(out->predicate),debug_posledniprisudekcloveka);
  copy_word(out->object,sizeof(out->object),debug_poslednipredmetcloveka);

  out->mood=g_nastaveni.nalada;
  out->mood_points=g_nastaveni.naladabody;
 }

/* The one number src/web/engine.ts cannot derive and must agree with: it reads
   this struct field by field out of the wasm heap, so a member that grows or a
   pad byte that appears here has to fail the build rather than the page. */
#if defined(__cplusplus) && __cplusplus >= 201103L
static_assert(sizeof(pokyd_debug) == 1328,
  "struct pokyd_debug changed size -- update POKYD_DEBUG_SIZE in src/web/engine.ts");
#endif

/* ------------------------------------------------------------------------ cache */

/* Plain malloc/fopen, deliberately, and not the engine's allocator: everything
   ALOKUJ_PAMET hands out is counted in debug_pocetalokovani, and a blob we hand to
   JS has no business in the engine's own leak count. */

unsigned char *pokyd_export_cache(unsigned long *length) {
FILE *f;
long size;
unsigned char *block;

  if (length != NULL) *length=0;

  if ((f=fopen(JMENO_UPLNEHO_SLOVNIKU,"rb")) == NULL) {
    set_error("there is no " JMENO_UPLNEHO_SLOVNIKU " to export");
    return(NULL);
   }
  if (fseek(f,0,SEEK_END) != 0 || (size=ftell(f)) < 0 || fseek(f,0,SEEK_SET) != 0) {
    fclose(f);
    set_error("cannot measure " JMENO_UPLNEHO_SLOVNIKU);
    return(NULL);
   }

  block=(unsigned char *)malloc((size_t)size);
  if (block == NULL) {
    fclose(f);
    set_error("out of memory exporting " JMENO_UPLNEHO_SLOVNIKU);
    return(NULL);
   }
  if (fread(block,1,(size_t)size,f) != (size_t)size) {
    free(block); fclose(f);
    set_error("short read on " JMENO_UPLNEHO_SLOVNIKU);
    return(NULL);
   }
  fclose(f);

  if (length != NULL) *length=(unsigned long)size;
  return(block);
 }

int pokyd_import_cache(const unsigned char *data, unsigned long length) {
FILE *f;

  /* Before loading, not during: the load is what reads SLOVNIK.TMP, so the file
     has to exist by then.  This was hazard 10's requirement too, until PATCHES.md
     2 made the cache read use its own FILE *. */
  if (is_loaded) {
    set_error("pokyd_import_cache: too late, the dictionaries are already loaded");
    return(-1);
   }
  if (data == NULL || length == 0) {
    set_error("pokyd_import_cache: nothing to import");
    return(-1);
   }

  if ((f=fopen(JMENO_UPLNEHO_SLOVNIKU,"wb")) == NULL) {
    set_error("cannot write " JMENO_UPLNEHO_SLOVNIKU);
    return(-1);
   }
  if (fwrite(data,1,(size_t)length,f) != (size_t)length) {
    fclose(f);
    remove(JMENO_UPLNEHO_SLOVNIKU);   /* a half-written cache is worse than none:
                                         the engine would checksum it, reject it,
                                         and re-inflect, which is the slow path
                                         wearing the fast path's name */
    set_error("short write on " JMENO_UPLNEHO_SLOVNIKU);
    return(-1);
   }
  if (fclose(f) != 0) {
    remove(JMENO_UPLNEHO_SLOVNIKU);
    set_error("cannot close " JMENO_UPLNEHO_SLOVNIKU);
    return(-1);
   }
  return(0);
 }
