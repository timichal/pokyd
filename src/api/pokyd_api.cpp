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

   Written by us, not ported.  ASCII only.
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

static int stav_init = 0;        /* pokyd_init has run */
static int stav_nacteno = 0;     /* pokyd_load_dictionaries has succeeded */
static int faze = POKYD_FAZE_NECINNY;
static char chyba[256] = "";

static void NAHLAS(const char *text) {
  strncpy(chyba, text, sizeof(chyba) - 1);
  chyba[sizeof(chyba) - 1] = 0;
 }

const char *pokyd_error(void) { return chyba; }

int pokyd_phase(void) { return faze; }

double pokyd_progress(void) { return (double)g_procentanacitani; }

unsigned long pokyd_sentence_count(void) { return (unsigned long)g_pocetrecenychvet; }

void pokyd_seed(unsigned long semeno) { srand((unsigned)semeno); }

void pokyd_free(void *blok) { free(blok); }

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

int pokyd_init(const char *adresar) {
  if (stav_init) { NAHLAS("pokyd_init: already initialised"); return(-1); }

  if (adresar != NULL && POKYD_CHDIR(adresar) != 0) {
    NAHLAS("pokyd_init: cannot enter the data directory");
    return(-1);
   }

  g_nastaveni.NASTAV_STANDARDNE();       /* mfcDlg.cpp:403 */
  PRIPRAV_GLOBALY();

  faze=POKYD_FAZE_NECINNY;
  chyba[0]=0;
  stav_init=1;
  return(0);
 }

static int JE_TAM(const char *jmeno) {
FILE *f=fopen(jmeno,"rb");
  if (f == NULL) return(0);
  fclose(f);
  return(1);
 }

int pokyd_load_dictionaries(void) {
  /* PROSTRED.FU:550, VLAKNO__NACITEJ_JAK_DIVEJ, minus the window: the progress
     bar, the five SetWindowText calls, the cancel check between every step, the
     click sounds and the CTI_ME.HTM integrity check.  The order of what remains
     is the original's and it matters -- see the base dictionary note in the
     cache-miss branch, and hazard 10 on the two reads that must stay adjacent.
     The five `faze` assignments stand where those five SetWindowText calls did. */

DWORD pozice;

  if (stav_init == 0) { NAHLAS("pokyd_load_dictionaries: call pokyd_init first"); return(-1); }
  if (stav_nacteno) { NAHLAS("pokyd_load_dictionaries: already loaded"); return(-1); }

  /* The engine reports a missing data file through NAHLAS_CHYBU, which is a
     MessageBox and then raise(SIGABRT) -- no use to a caller and no use at all in
     a worker.  Checking first turns the two cases that actually happen into a
     return value.  These two opens are before ALOKUJ_VSECHNY_PRVKY_G_VETACLOVEKA
     and so nowhere near hazard 10's pair. */
  if (JE_TAM(JMENO_ZAKLADNIHO_SLOVNIKU) == 0) {
    NAHLAS("no " JMENO_ZAKLADNIHO_SLOVNIKU " in the data directory");
    return(-1);
   }
  if (JE_TAM(JMENO_SOUBORU_S_INTELIGENCI) == 0) {
    NAHLAS("no " JMENO_SOUBORU_S_INTELIGENCI " in the data directory");
    return(-1);
   }

  faze=POKYD_FAZE_ZAKLADNI;
  ALOKUJ_VSECHNY_PRVKY_G_VETACLOVEKA();
  PRECTI_DATABAZI_SLOV_ZE_ZAKLADNIHO_SLOVNIKU();

  /* Hazard 10.  PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU reads its padding from
     g_zakladnislovnik (SLOVNIK.FU:1102-1105), which the call above closed at
     :1070 -- a one-identifier typo that works only because the C runtime hands
     the freed FILE slot straight back to the next fopen.  Nothing may open a file
     between these two lines.  Nothing does; keep it that way. */
  faze=POKYD_FAZE_SLOVNI_ZASOBA;
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
    faze=POKYD_FAZE_SKLONOVANI;
    UVOLNI_VESKEROU_DYNAMICKOU_PAMET();
    PRIPRAV_GLOBALY();

    NACTI_A_ROZSKLONUJ_ZAKLADNI_SLOVNIK();

    PRIPRAV_GLOBALY();
    faze=POKYD_FAZE_ZAKLADNI;
    ALOKUJ_VSECHNY_PRVKY_G_VETACLOVEKA();
    PRECTI_DATABAZI_SLOV_ZE_ZAKLADNIHO_SLOVNIKU();
    faze=POKYD_FAZE_SLOVNI_ZASOBA;
    if (PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU() == 1) {
      /* Cold path ran and the cache still will not read back.  On this toolchain
         that means the write failed (a full or read-only data directory); under
         Emscripten it is also what hazard 10 looks like if musl ever stops
         handing the same FILE block back.  Either way it is not recoverable
         here and it must not be silent. */
      NAHLAS(JMENO_UPLNEHO_SLOVNIKU " cannot be read back after inflecting the dictionary");
      faze=POKYD_FAZE_NECINNY;
      return(-1);
     }
   }

  faze=POKYD_FAZE_INTELIGENCE;
  PRECTI_INTELIGENCI_ZE_SOUBORU();
  g_odpovedipocitace=(char **)ALOKUJ_PAMET(g_pocetiqpodminek*sizeof(*g_odpovedipocitace));
  g_idodpovedipocitace=(WORD *)ALOKUJ_PAMET(g_pocetiqpodminek*sizeof(g_idodpovedipocitace[0]));
  for (pozice=0; pozice < g_pocetiqpodminek; pozice++) {
    g_odpovedipocitace[pozice]=ALOKUJ_RETEZEC(MAX_DELKA_ODPOVEDI_POCITACE+1);
   }

  faze=POKYD_FAZE_EXTERNI;
  PRECTI_PROFIL_ZE_SOUBORU();   /* PROFIL.IQP, what it remembers about you.  Read
                                   if it is there, never written: see PLAN 7.5. */

  faze=POKYD_FAZE_HOTOVO;
  stav_nacteno=1;
  return(0);
 }

unsigned long pokyd_shutdown(void) {
  if (stav_init == 0) return(0);

  UVOLNI_VESKEROU_DYNAMICKOU_PAMET();
  stav_init=0; stav_nacteno=0;
  faze=POKYD_FAZE_NECINNY;

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

const char *pokyd_say(const char *veta_cp1250) {
  /* !Prostre/mfcDlg.cpp:596-607, CMfcDlg::OnNovaveta.  The pre- and
     post-processing around IQ_POKYDE_ODPOVEZ is not optional: the engine wants
     lowercase, phonemically normalized text with "ses"/"bych" expanded into two
     words, and hands back an answer that still has to be put back together.
     Skipping any of it changes the answers.

     Note that UPRAV_VETU_PRO_IQPOKYD frees what it is given and returns a new
     pointer (SKLONOV.FU:173), so g_aktualnivetacloveka must be reassigned and
     must come from the engine's own allocator. */

  if (stav_nacteno == 0) { NAHLAS("pokyd_say: nothing is loaded"); return(NULL); }
  if (veta_cp1250 == NULL) return(g_odpovedpocitace);

  g_aktualnivetacloveka=(char *)REALOKUJ_PAMET(g_aktualnivetacloveka,strlen(veta_cp1250)+1);
  strcpy(g_aktualnivetacloveka,veta_cp1250);

  PREVED_NA_MALA_PISMENA(g_aktualnivetacloveka);
  UPRAV_DLOUHE_SLOVO_PRO_IQPOKYD(g_aktualnivetacloveka);
  g_aktualnivetacloveka=UPRAV_VETU_PRO_IQPOKYD(g_aktualnivetacloveka);
  IQ_POKYDE_ODPOVEZ(g_aktualnivetacloveka);
  ODUPRAV_VETU_PRO_IQPOKYD();

  strcpy(g_aktualnivetacloveka,veta_cp1250);   /* the buffer is >= strlen(veta)+1 */

  g_predchozivetacloveka=(char *)REALOKUJ_PAMET(g_predchozivetacloveka,strlen(veta_cp1250)+1);
  strcpy(g_predchozivetacloveka,veta_cp1250);

  return(g_odpovedpocitace);
 }

/* --------------------------------------------------------------------- settings */

void pokyd_get_settings(pokyd_settings *ven) {
  if (ven == NULL) return;
  memset(ven,0,sizeof(*ven));

  ven->pohlavicloveka=g_nastaveni.pohlavicloveka;
  ven->pohlavipocitace=g_nastaveni.pohlavipocitace;
  strcpy(ven->jmenocloveka,g_nastaveni.jmenocloveka);
  strcpy(ven->jmenopocitace,g_nastaveni.jmenopocitace);
  ven->charakter=g_nastaveni.charakter;
  ven->nalada=g_nastaveni.nalada;
  ven->naladabody=g_nastaveni.naladabody;

  ven->ukladatrozhovor=g_nastaveni.ukladatrozhovor;
  ven->pouzivatzvuky=g_nastaveni.pouzivatzvuky;
  ven->pouzivatefekty=g_nastaveni.pouzivatefekty;
  ven->spisovnacestina=g_nastaveni.spisovnacestina;
  ven->zobrazovatpopisky=g_nastaveni.zobrazovatpopisky;

  ven->debug_rychleukoncovani=g_nastaveni.debug_rychleukoncovani;
  ven->debug_tolerancepravopisu=g_nastaveni.debug_tolerancepravopisu;
  ven->debug_pravopisnarekurze=g_nastaveni.debug_pravopisnarekurze;

  ven->emulovatklavesnici=g_nastaveni.emulovatklavesnici;
  ven->klavesniceqwerty=g_nastaveni.klavesniceqwerty;
  ven->standardnikurzor=g_nastaveni.standardnikurzor;

  ven->prikaz_readonlymod=g_nastaveni.prikaz_readonlymod;
  ven->prikaz_nezobrazovatpozadi=g_nastaveni.prikaz_nezobrazovatpozadi;
 }

void pokyd_set_settings(const pokyd_settings *sem) {
  /* Nastaveni::ZKOPIRUJ_SEM (NASTAVEN.PR:44-69), field for field, with the two
     names truncated rather than trusted: they are char[101] on both sides and the
     engine strcpy()s them, so a caller who forgot the terminator would smash
     whatever follows g_nastaveni. */
  if (sem == NULL) return;

  g_nastaveni.pohlavicloveka=sem->pohlavicloveka;
  g_nastaveni.pohlavipocitace=sem->pohlavipocitace;
  strncpy(g_nastaveni.jmenocloveka,sem->jmenocloveka,sizeof(g_nastaveni.jmenocloveka)-1);
  g_nastaveni.jmenocloveka[sizeof(g_nastaveni.jmenocloveka)-1]=0;
  strncpy(g_nastaveni.jmenopocitace,sem->jmenopocitace,sizeof(g_nastaveni.jmenopocitace)-1);
  g_nastaveni.jmenopocitace[sizeof(g_nastaveni.jmenopocitace)-1]=0;
  g_nastaveni.charakter=sem->charakter;
  g_nastaveni.nalada=sem->nalada;
  g_nastaveni.naladabody=sem->naladabody;

  g_nastaveni.ukladatrozhovor=sem->ukladatrozhovor;
  g_nastaveni.pouzivatzvuky=sem->pouzivatzvuky;
  g_nastaveni.pouzivatefekty=sem->pouzivatefekty;
  g_nastaveni.spisovnacestina=sem->spisovnacestina;
  g_nastaveni.zobrazovatpopisky=sem->zobrazovatpopisky;

  g_nastaveni.debug_rychleukoncovani=sem->debug_rychleukoncovani;
  g_nastaveni.debug_tolerancepravopisu=sem->debug_tolerancepravopisu;
  g_nastaveni.debug_pravopisnarekurze=sem->debug_pravopisnarekurze;

  g_nastaveni.emulovatklavesnici=sem->emulovatklavesnici;
  g_nastaveni.klavesniceqwerty=sem->klavesniceqwerty;
  g_nastaveni.standardnikurzor=sem->standardnikurzor;

  g_nastaveni.prikaz_readonlymod=sem->prikaz_readonlymod;
  g_nastaveni.prikaz_nezobrazovatpozadi=sem->prikaz_nezobrazovatpozadi;
 }

void pokyd_set_mood(unsigned char nalada) {
  /* !Prostre/Nastaveni.cpp:167 -- the two lines the original's settings dialog
     runs when the user moves the mood slider. */
  if (nalada < 1 || nalada > 5) return;
  g_nastaveni.nalada=(BYTE)nalada;
  g_nastaveni.SPOCITEJ_NALADABODY_Z_NALADY();
 }

/* ------------------------------------------------------------------------ cache */

/* Plain malloc/fopen, deliberately, and not the engine's allocator: everything
   ALOKUJ_PAMET hands out is counted in debug_pocetalokovani, and a blob we hand to
   JS has no business in the engine's own leak count. */

unsigned char *pokyd_export_cache(unsigned long *delka) {
FILE *f;
long velikost;
unsigned char *blok;

  if (delka != NULL) *delka=0;

  if ((f=fopen(JMENO_UPLNEHO_SLOVNIKU,"rb")) == NULL) {
    NAHLAS("there is no " JMENO_UPLNEHO_SLOVNIKU " to export");
    return(NULL);
   }
  if (fseek(f,0,SEEK_END) != 0 || (velikost=ftell(f)) < 0 || fseek(f,0,SEEK_SET) != 0) {
    fclose(f);
    NAHLAS("cannot measure " JMENO_UPLNEHO_SLOVNIKU);
    return(NULL);
   }

  blok=(unsigned char *)malloc((size_t)velikost);
  if (blok == NULL) {
    fclose(f);
    NAHLAS("out of memory exporting " JMENO_UPLNEHO_SLOVNIKU);
    return(NULL);
   }
  if (fread(blok,1,(size_t)velikost,f) != (size_t)velikost) {
    free(blok); fclose(f);
    NAHLAS("short read on " JMENO_UPLNEHO_SLOVNIKU);
    return(NULL);
   }
  fclose(f);

  if (delka != NULL) *delka=(unsigned long)velikost;
  return(blok);
 }

int pokyd_import_cache(const unsigned char *data, unsigned long delka) {
FILE *f;

  /* Before loading, not during: hazard 10 again.  Writing the file here leaves
     the base-dictionary read and the cache read adjacent, which is the whole
     reason this is a separate call. */
  if (stav_nacteno) {
    NAHLAS("pokyd_import_cache: too late, the dictionaries are already loaded");
    return(-1);
   }
  if (data == NULL || delka == 0) {
    NAHLAS("pokyd_import_cache: nothing to import");
    return(-1);
   }

  if ((f=fopen(JMENO_UPLNEHO_SLOVNIKU,"wb")) == NULL) {
    NAHLAS("cannot write " JMENO_UPLNEHO_SLOVNIKU);
    return(-1);
   }
  if (fwrite(data,1,(size_t)delka,f) != (size_t)delka) {
    fclose(f);
    remove(JMENO_UPLNEHO_SLOVNIKU);   /* a half-written cache is worse than none:
                                         the engine would checksum it, reject it,
                                         and re-inflect, which is the slow path
                                         wearing the fast path's name */
    NAHLAS("short write on " JMENO_UPLNEHO_SLOVNIKU);
    return(-1);
   }
  if (fclose(f) != 0) {
    remove(JMENO_UPLNEHO_SLOVNIKU);
    NAHLAS("cannot close " JMENO_UPLNEHO_SLOVNIKU);
    return(-1);
   }
  return(0);
 }
