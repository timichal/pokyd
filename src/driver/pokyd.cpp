/* IQ Pokyd - src/driver/pokyd.cpp - the console driver.

   Phase 1.5 of PLAN.md, and the first time any of this code actually ran.
   Loads the dictionaries, reads sentences from stdin, prints what IQ Pokyd
   answers.  It is a dev tool, not part of the museum piece: the engine below it
   is the original, everything in this file is ours.

   Since phase 3.1 it no longer drives the engine itself.  It used to carry its
   own copies of PRIPRAV_GLOBALY, the loading sequence, IQ_POKYDE_ODPOVEZ and
   CMfcDlg::OnNovaveta -- written as the rehearsal for the exported surface --
   and all four have moved into src/api/pokyd_api.cpp, which is that surface.
   So this file is now a caller of pokyd_api.h and nothing more, which is what
   makes test/golden/ a test of the API: the wasm build at 3.3 runs the same code
   underneath a different front end.

   Two things it still reaches past the API for, both of them console-only:
   PREVED_Z_LATIN_2_NA_WINDOWS_1250 and PREVED_Z_WINDOWS_1250_NA_LATIN_2, the
   engine's own CP852 converters.  Nothing on the web needs a DOS codepage, so
   they stay out of pokyd_api.h and this file includes engine.h for them.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

#include "pokyd_api.h"
#include "engine.h"       /* only for the two CP852 converters -- see above */

#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
  #include <io.h>
  #define POKYD_ISATTY _isatty
  #define POKYD_FILENO _fileno
#else
  #include <unistd.h>
  #define POKYD_ISATTY isatty
  #define POKYD_FILENO fileno
#endif

/* ------------------------------------------------------------------ options */

static const char *o_data = ".";        /* directory holding the data files */
static const char *o_prepis = NULL;     /* clean transcript, CP1250 */
static unsigned o_seed = 0;
static int o_seed_zadan = 0;
static int o_cp1250 = 0;                /* console encoding: CP852 unless set */
static int o_stav = 0;                  /* print mood/character after each line */
static int o_cas = 0;                   /* report load and answer timings */
static const char *o_vyvez = NULL;      /* write SLOVNIK.TMP's bytes here after loading */
static const char *o_dovez = NULL;      /* install this as SLOVNIK.TMP before loading */

static int o_charakter = -1, o_nalada = -1;
static int o_pohlavicloveka = -1, o_pohlavipocitace = -1;

static FILE *f_prepis = NULL;

static void NAPOVEDA(const char *jmeno) {
  printf(
    "IQ Pokyd 0.15 -- console driver (phase 1.5)\n"
    "\n"
    "usage: %s [options] < sentences\n"
    "\n"
    "  --data DIR        directory with SLOVNIK.IQP and IQPOKYD.IQP; the engine\n"
    "                    opens its files by bare name, so we chdir there.  It has\n"
    "                    to be writable: SLOVNIK.TMP, the inflected-dictionary\n"
    "                    cache, is written next to them.  Default: .\n"
    "  --transcript F    write a clean CP1250 transcript to F (see below)\n"
    "  --seed N          seed rand() with N instead of time(NULL)\n"
    "  --cp1250          read and write CP1250 on the console instead of CP852\n"
    "  --state           print mood and character after every answer\n"
    "  --time            report load and answer timings on stderr\n"
    "  --export-cache F  after loading, write the SLOVNIK.TMP bytes to F\n"
    "  --import-cache F  before loading, install F as SLOVNIK.TMP\n"
    "\n"
    "  --character 0..6  stroj, naivni, klidny, prumerny, neduverivy, naladovy, vybusny\n"
    "  --mood 1..5       vyborna, dobra, normalni, spatna, hrozna\n"
    "  --human m|f       the human's gender\n"
    "  --computer m|f    IQ Pokyd's gender\n"
    "\n"
    "Encodings.  The engine speaks CP1250 throughout.  Its own console output goes\n"
    "through NAPIS_TEXT_V_LATIN_2, which converts to CP852 -- the DOS codepage a\n"
    "Czech Windows console still uses -- so by default we answer in CP852 too and\n"
    "everything on stdout is in one encoding.  --cp1250 turns that off, for pipes\n"
    "and for terminals set to CP1250.  A --transcript file is always CP1250,\n"
    "whatever the console is doing.\n"
    "\n"
    "Paths.  --data is entered before anything else is opened, because the engine\n"
    "reads its files by bare name in the current directory, so a relative path\n"
    "given to --transcript, --export-cache or --import-cache is relative to it.\n"
    "\n"
    "Noise.  vstup.fu:801-809 prints every base form it recognises, on every\n"
    "sentence, unguarded -- a debug leftover the author commented out in the block\n"
    "just below but not in this one.  It is the original's behaviour and PATCHES.md\n"
    "explains why we are not deleting it, so stdout is noisy and --transcript is\n"
    "how you get a diffable conversation out of this program.\n"
    "\n"
    "The cache.  --export-cache and --import-cache are pokyd_export_cache and\n"
    "pokyd_import_cache on the command line, and exist so that the blob phase 4.4\n"
    "will keep in IndexedDB can be moved around and diffed here first.  Importing\n"
    "one turns a 4.5 s cold start into a 0.4 s warm one; importing the wrong one\n"
    "is silently the wrong vocabulary, because nothing in the file says which\n"
    "dictionary it was inflected from.\n",
    jmeno);
 }

/* ------------------------------------------------------------------- console */

static char *NACTI_RADEK(FILE *f) {
  /* plain malloc, deliberately: everything the engine allocates is counted in
     debug_pocetalokovani and the driver's own buffers have no business being in
     that number.  Returns NULL at EOF.  Strips CR and LF, keeps the rest. */
size_t delka=0,misto=256;
char *radek=(char *)malloc(misto);
int znak;

  if (radek == NULL) return(NULL);

  while ((znak=getc(f)) != EOF && znak != '\n') {
    if (delka+1 >= misto) {
      char *vetsi=(char *)realloc(radek,misto*=2);
      if (vetsi == NULL) { free(radek); return(NULL); }
      radek=vetsi;
     }
    radek[delka++]=(char)znak;
   }

  if (znak == EOF && delka == 0) { free(radek); return(NULL); }

  while (delka > 0 && radek[delka-1] == '\r') delka--;
  radek[delka]=0;
  return(radek);
 }

static void NAPIS_NA_KONZOLI(const char *predpona,const char *text_cp1250) {
  /* The console gets CP852 by default -- the same bytes the engine's own
     printf()s produce, via the engine's own converter -- so that stdout is not
     a mixture of two codepages.  PREVED_Z_WINDOWS_1250_NA_LATIN_2 rewrites in
     place and only touches bytes with the high bit set, so it needs a copy and
     the length never changes. */
char *kopie=(char *)malloc(strlen(text_cp1250)+1);

  if (kopie == NULL) return;
  strcpy(kopie,text_cp1250);
  if (o_cp1250 == 0) PREVED_Z_WINDOWS_1250_NA_LATIN_2(kopie);

  printf("%s%s\n",predpona,kopie);
  fflush(stdout);
  free(kopie);
 }

static void ZAPIS_DO_PREPISU(const char *predpona,const char *text_cp1250) {
  /* Opened "wb" and ending the lines by hand: a transcript is CP1250 with CRLF
     whatever platform wrote it, so that the phase 1.6 golden file and the phase
     3.3 wasm run can be compared byte for byte. */
  if (f_prepis == NULL) return;
  fprintf(f_prepis,"%s%s\r\n",predpona,text_cp1250);
  fflush(f_prepis);
 }

/* --------------------------------------------------------------------- cache */

/* pokyd_export_cache and pokyd_import_cache on the command line.  Nothing else
   in this repository calls either yet -- the web build is where they earn their
   keep, at phase 4.4 -- so they are wired up here to be exercised rather than
   merely compiled.  Plain malloc and fopen on this side of the boundary: the
   blob is ours, not the engine's, and pokyd_free is what frees the other one. */

static int VYVEZ_CACHE(const char *jmeno) {
unsigned char *blok;
unsigned long delka=0;
FILE *f;
size_t zapsano;

  if ((blok=pokyd_export_cache(&delka)) == NULL) {
    fprintf(stderr,"pokyd: %s\n",pokyd_error());
    return(1);
   }
  if ((f=fopen(jmeno,"wb")) == NULL) {
    pokyd_free(blok);
    fprintf(stderr,"pokyd: cannot write \"%s\"\n",jmeno);
    return(1);
   }
  zapsano=fwrite(blok,1,(size_t)delka,f);
  fclose(f);
  pokyd_free(blok);

  if (zapsano != (size_t)delka) {
    fprintf(stderr,"pokyd: short write on \"%s\"\n",jmeno);
    return(1);
   }
  fprintf(stderr,"pokyd: exported %lu cache bytes to \"%s\"\n",delka,jmeno);
  return(0);
 }

static int DOVEZ_CACHE(const char *jmeno) {
FILE *f;
long velikost;
unsigned char *blok;
int vysledek;

  if ((f=fopen(jmeno,"rb")) == NULL) {
    fprintf(stderr,"pokyd: cannot read \"%s\"\n",jmeno);
    return(1);
   }
  if (fseek(f,0,SEEK_END) != 0 || (velikost=ftell(f)) <= 0 || fseek(f,0,SEEK_SET) != 0) {
    fclose(f);
    fprintf(stderr,"pokyd: cannot measure \"%s\"\n",jmeno);
    return(1);
   }
  if ((blok=(unsigned char *)malloc((size_t)velikost)) == NULL) {
    fclose(f);
    fprintf(stderr,"pokyd: out of memory reading \"%s\"\n",jmeno);
    return(1);
   }
  if (fread(blok,1,(size_t)velikost,f) != (size_t)velikost) {
    free(blok); fclose(f);
    fprintf(stderr,"pokyd: short read on \"%s\"\n",jmeno);
    return(1);
   }
  fclose(f);

  vysledek=pokyd_import_cache(blok,(unsigned long)velikost);
  free(blok);

  if (vysledek != 0) {
    fprintf(stderr,"pokyd: %s\n",pokyd_error());
    return(1);
   }
  fprintf(stderr,"pokyd: imported %ld cache bytes from \"%s\"\n",velikost,jmeno);
  return(0);
 }

/* ---------------------------------------------------------------------- main */

static int POHLAVI(const char *co,const char *prepinac) {
  if (strcmp(co,"m") == 0 || strcmp(co,"muz") == 0) return(1);
  if (strcmp(co,"f") == 0 || strcmp(co,"z") == 0 || strcmp(co,"zena") == 0) return(0);
  fprintf(stderr,"pokyd: %s takes m or f, not \"%s\"\n",prepinac,co);
  exit(2);
  return(0);
 }

int main(int argc,char **argv) {
int i,interaktivni;
char *radek=NULL;
const char *odpoved;
unsigned long neuvolneno;
pokyd_settings nastaveni;
double t_start,cas_nacitani=0.0,cas_odpovedi=0.0;
unsigned long pocet_odpovedi=0;

  for (i=1; i < argc; i++) {
    if (strcmp(argv[i],"--help") == 0 || strcmp(argv[i],"-h") == 0) {
      NAPOVEDA(argv[0]); return(0);
     }
    else if (strcmp(argv[i],"--data") == 0 && i+1 < argc) o_data=argv[++i];
    else if (strcmp(argv[i],"--transcript") == 0 && i+1 < argc) o_prepis=argv[++i];
    else if (strcmp(argv[i],"--seed") == 0 && i+1 < argc) {
      o_seed=(unsigned)strtoul(argv[++i],NULL,10); o_seed_zadan=1;
     }
    else if (strcmp(argv[i],"--cp1250") == 0) o_cp1250=1;
    else if (strcmp(argv[i],"--state") == 0) o_stav=1;
    else if (strcmp(argv[i],"--time") == 0) o_cas=1;
    else if (strcmp(argv[i],"--export-cache") == 0 && i+1 < argc) o_vyvez=argv[++i];
    else if (strcmp(argv[i],"--import-cache") == 0 && i+1 < argc) o_dovez=argv[++i];
    else if (strcmp(argv[i],"--character") == 0 && i+1 < argc) o_charakter=atoi(argv[++i]);
    else if (strcmp(argv[i],"--mood") == 0 && i+1 < argc) o_nalada=atoi(argv[++i]);
    else if (strcmp(argv[i],"--human") == 0 && i+1 < argc)
     o_pohlavicloveka=POHLAVI(argv[++i],"--human");
    else if (strcmp(argv[i],"--computer") == 0 && i+1 < argc)
     o_pohlavipocitace=POHLAVI(argv[++i],"--computer");
    else {
      fprintf(stderr,"pokyd: unknown option \"%s\" (try --help)\n",argv[i]);
      return(2);
     }
   }

  if (o_charakter != -1 && (o_charakter < 0 || o_charakter > 6)) {
    fprintf(stderr,"pokyd: --character is 0..6\n"); return(2);
   }
  if (o_nalada != -1 && (o_nalada < 1 || o_nalada > 5)) {
    fprintf(stderr,"pokyd: --mood is 1..5\n"); return(2);
   }

  /* pokyd_init chdirs into the data directory, because the engine opens its
     files by bare name in the current one, and applies NASTAV_STANDARDNE. */
  if (pokyd_init(o_data) != 0) {
    fprintf(stderr,"pokyd: %s (\"%s\")\n",pokyd_error(),o_data); return(1);
   }

  pokyd_get_settings(&nastaveni);
  if (o_pohlavicloveka != -1) nastaveni.pohlavicloveka=(unsigned char)o_pohlavicloveka;
  if (o_pohlavipocitace != -1) nastaveni.pohlavipocitace=(unsigned char)o_pohlavipocitace;
  if (o_charakter != -1) nastaveni.charakter=(unsigned char)o_charakter;
  pokyd_set_settings(&nastaveni);
  /* after set_settings, not inside it: naladabody is what drifts and nalada is
     derived from it, so a mood has to be set through the engine's own
     SPOCITEJ_NALADABODY_Z_NALADY.  See pokyd_api.h. */
  if (o_nalada != -1) pokyd_set_mood((unsigned char)o_nalada);

  /* Before loading, never during: the load is what reads SLOVNIK.TMP.  It was
     hazard 10's adjacency that made this its own step; PATCHES.md 2 settled that,
     and the order is still the API's.  See pokyd_api.h. */
  if (o_dovez != NULL && DOVEZ_CACHE(o_dovez) != 0) return(1);

  /* clock() is a millisecond on this runtime and the load is seconds, so it is
     the right size of instrument here; the answers below are near its floor and
     --time says so.  No windows.h for a QueryPerformanceCounter: src/shim/win32.h
     keeps the engine free of it and the driver has no better claim. */
  t_start=(double)clock();
  if (pokyd_load_dictionaries() != 0) {
    fprintf(stderr,
      "pokyd: %s\n"
      "       tools/build.py lays out build/run/ with both data files; point --data at it.\n",
      pokyd_error());
    return(1);
   }

  cas_nacitani=((double)clock()-t_start)*1000.0/CLOCKS_PER_SEC;
  if (o_cas) fprintf(stderr,"pokyd: load %.0f ms\n",cas_nacitani);

  if (o_vyvez != NULL && VYVEZ_CACHE(o_vyvez) != 0) return(1);

  /* Seed last, not first: ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU reseeds from
     the clock on its way out (SLOVNIK.FU:1732, after a fixed seed obfuscates
     the cache), so a --seed set before loading only survives on runs that found
     a cache.  rand() is what picks between equally unheard answers -- and since
     1.6 it is ours, not the C runtime's (src/shim/nahoda.h), so the same seed
     gives the same conversation on any toolchain.  That is what makes the
     test/golden/ transcript worth diffing at 3.3. */
  pokyd_seed(o_seed_zadan ? o_seed : (unsigned long)time(NULL));

  if (o_prepis != NULL && (f_prepis=fopen(o_prepis,"wb")) == NULL) {
    fprintf(stderr,"pokyd: cannot write \"%s\"\n",o_prepis); return(1);
   }

  interaktivni=POKYD_ISATTY(POKYD_FILENO(stdin));

  while (1) {
    if (interaktivni) { printf("\n> "); fflush(stdout); }
    else printf("\n");

    radek=NACTI_RADEK(stdin);
    if (radek == NULL) break;
    if (radek[0] == 0) { free(radek); continue; }   /* mfcDlg.cpp:556 */

    /* Convert first, echo second.  Everything past this point -- the echo, the
       transcript, the engine -- is CP1250, and the console conversion happens
       only in NAPIS_NA_KONZOLI on the way back out. */
    if (o_cp1250 == 0) PREVED_Z_LATIN_2_NA_WINDOWS_1250(radek);

    if (interaktivni == 0) NAPIS_NA_KONZOLI("> ",radek);
    ZAPIS_DO_PREPISU("> ",radek);

    t_start=(double)clock();
    odpoved=pokyd_say(radek);
    cas_odpovedi+=((double)clock()-t_start)*1000.0/CLOCKS_PER_SEC;
    pocet_odpovedi++;
    NAPIS_NA_KONZOLI("< ",odpoved);
    ZAPIS_DO_PREPISU("< ",odpoved);

    if (o_stav) {
      pokyd_get_settings(&nastaveni);
      printf("  [character %u, mood %u (%u points), sentence %lu]\n",
             (unsigned)nastaveni.charakter,(unsigned)nastaveni.nalada,
             (unsigned)nastaveni.naladabody,pokyd_sentence_count());
      fflush(stdout);
     }

    free(radek);
   }

  if (o_cas) fprintf(stderr,"pokyd: %lu answers %.0f ms (clock(), 1 ms resolution)\n",
                    pocet_odpovedi,cas_odpovedi);

  if (f_prepis != NULL) fclose(f_prepis);

  /* Not politeness: the block counter is the only leak detector this code has,
     and phase 3 runs it in a wasm heap that has to be sized. */
  neuvolneno=pokyd_shutdown();
  if (neuvolneno != 0) {
    fprintf(stderr,"pokyd: %lu memory blocks were not freed\n",neuvolneno);
   }

  return(0);
 }
