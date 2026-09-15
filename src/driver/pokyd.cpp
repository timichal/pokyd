/* IQ Pokyd - src/driver/pokyd.cpp - the console driver.

   Phase 1.5 of PLAN.md, and the first time any of this code actually runs.
   Loads the dictionaries, reads sentences from stdin, prints what IQ Pokyd
   answers.  It is a dev tool, not part of the museum piece: the engine below it
   is the original, everything in this file is ours.

   It is also the rehearsal for phase 3.1.  The sequence in NACTI_SLOVNIKY() and
   IQ_POKYDE_ODPOVEZ() below is exactly the surface pokyd_api.c will have to
   export, so it is written to mirror the original's own call order rather than
   to be convenient.

   What it mirrors, and where the original does it
   -----------------------------------------------
   PRIPRAV_GLOBALY()      !Prostre/mfcDlg.cpp:403-418 (CMfcDlg::OnInitDialog)
   NACTI_SLOVNIKY()       Aplikace/Prostred/PROSTRED.FU:550 (VLAKNO__NACITEJ_JAK_DIVEJ)
   IQ_POKYDE_ODPOVEZ()    Aplikace/Prostred/PROSTRED.FU:212, verbatim
   ODPOVEZ_NA_VETU()      !Prostre/mfcDlg.cpp:596-607 (CMfcDlg::OnNovaveta)

   The three things that made this step awkward, all documented at their call
   sites below: IQ_POKYDE_ODPOVEZ does not exist in a BEZ_PROSTREDI build,
   NACTI_A_ROZSKLONUJ_ZAKLADNI_SLOVNIK frees the whole dictionary again when it
   is done, and the engine prints to stdout on every sentence whether we want it
   to or not.

   Written by us, not ported.  ASCII only, like the rest of the non-engine code.
*/

#include "engine.h"

#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef _WIN32
  #include <direct.h>
  #include <io.h>
  #define POKYD_CHDIR  _chdir
  #define POKYD_ISATTY _isatty
  #define POKYD_FILENO _fileno
#else
  #include <unistd.h>
  #define POKYD_CHDIR  chdir
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
    "Noise.  vstup.fu:801-809 prints every base form it recognises, on every\n"
    "sentence, unguarded -- a debug leftover the author commented out in the block\n"
    "just below but not in this one.  It is the original's behaviour and PATCHES.md\n"
    "explains why we are not deleting it, so stdout is noisy and --transcript is\n"
    "how you get a diffable conversation out of this program.\n",
    jmeno);
 }

/* ---------------------------------------------------------------- the engine */

static void PRIPRAV_GLOBALY(void) {
  /* !Prostre/mfcDlg.cpp:405-418.  The engine assumes these five are allocated
     before anything else runs.  UVOLNI_VESKEROU_DYNAMICKOU_PAMET is the strict
     one: it frees all five unconditionally, and UVOLNI_X(NULL) is a fatal
     error, so this has to be re-run after anything that frees them. */
  g_aktualnivetacloveka=ALOKUJ_RETEZEC(1); g_aktualnivetacloveka[0]=0;
  g_predchozivetacloveka=ALOKUJ_RETEZEC(1); g_predchozivetacloveka[0]=0;

  debug_poslednipodmetcloveka=ALOKUJ_RETEZEC(DELKA_JEDNODUCHEHO_SLOVA);
  strcpy(debug_poslednipodmetcloveka,"-");
  debug_posledniprisudekcloveka=ALOKUJ_RETEZEC(DELKA_JEDNODUCHEHO_SLOVA);
  strcpy(debug_posledniprisudekcloveka,"-");
  debug_poslednipredmetcloveka=ALOKUJ_RETEZEC(DELKA_JEDNODUCHEHO_SLOVA);
  strcpy(debug_poslednipredmetcloveka,"-");
 }

static void NACTI_SLOVNIKY(void) {
  /* Prostred/PROSTRED.FU:550, VLAKNO__NACITEJ_JAK_DIVEJ, minus the window: the
     progress bar, the five SetWindowText calls, the cancel check between every
     step, the click sounds and the CTI_ME.HTM integrity check.  The order of
     what remains is the original's and it matters -- see the base dictionary
     note in the cache-miss branch.

     PROSTRED.FU is compiled out by BEZ_PROSTREDI, so this is also the loader
     phase 3.1 has to export as pokyd_load_dictionaries. */

DWORD pozice;

  ALOKUJ_VSECHNY_PRVKY_G_VETACLOVEKA();
  PRECTI_DATABAZI_SLOV_ZE_ZAKLADNIHO_SLOVNIKU();

  if (PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU() == 1) {
    /* No usable SLOVNIK.TMP, so the 11,207 base words have to be inflected into
       every form -- the "Sklonuji slovnik..." progress bar, about five seconds
       and 402,252 forms against a MAX_POCET_VSECH_SLOV of 500,000.

       NACTI_A_ROZSKLONUJ_ZAKLADNI_SLOVNIK is not a plain loader here.  Under
       IQPOKYDWINMFC != 1 it is the author's own DOS test harness: it re-reads
       the base dictionary itself (SLOVNIK.FU:3248), and once it has written the
       cache it frees the entire dictionary again, checks that every allocated
       block came back, and waits for a keypress (SLOVNIK.FU:3344-3357).

       That tail is why this is not a plain call.  Leaving our own load in place
       would leak 11,207 strings past it and turn its block check into a fatal
       NAHLAS_CHYBU, so we hand it a clean slate, let it run as the program it
       is, and then load again from the cache it just wrote.  Both
       UVOLNI_VESKEROU_DYNAMICKOU_PAMET calls -- ours here and the one in its
       tail -- free the five PRIPRAV_GLOBALY strings, hence the two rebuilds. */
    UVOLNI_VESKEROU_DYNAMICKOU_PAMET();
    PRIPRAV_GLOBALY();

    NACTI_A_ROZSKLONUJ_ZAKLADNI_SLOVNIK();

    PRIPRAV_GLOBALY();
    ALOKUJ_VSECHNY_PRVKY_G_VETACLOVEKA();
    PRECTI_DATABAZI_SLOV_ZE_ZAKLADNIHO_SLOVNIKU();
    if (PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU() == 1) {
      fprintf(stderr,
        "\npokyd: the dictionary was inflected but %s still cannot be read back.\n",
        JMENO_UPLNEHO_SLOVNIKU);
      exit(1);
     }
   }

  PRECTI_INTELIGENCI_ZE_SOUBORU();
  g_odpovedipocitace=(char **)ALOKUJ_PAMET(g_pocetiqpodminek*sizeof(*g_odpovedipocitace));
  g_idodpovedipocitace=(WORD *)ALOKUJ_PAMET(g_pocetiqpodminek*sizeof(g_idodpovedipocitace[0]));
  for (pozice=0; pozice < g_pocetiqpodminek; pozice++) {
    g_odpovedipocitace[pozice]=ALOKUJ_RETEZEC(MAX_DELKA_ODPOVEDI_POCITACE+1);
   }

  PRECTI_PROFIL_ZE_SOUBORU();   /* PROFIL.IQP, what it remembers about you.  Read
                                   if it is there, never written: see PLAN 7.5. */
 }

static void IQ_POKYDE_ODPOVEZ(char *vetacloveka) {
  /* Prostred/PROSTRED.FU:212, verbatim, minus the 25 commented-out lines at its
     head.  The documented entry point of the whole engine lives in the one file
     BEZ_PROSTREDI removes, so a build without MFC has to carry its own copy.
     This is the function phase 3.1 exports as pokyd_say.

     The answer comes back in the global g_odpovedpocitace -- and stays there if
     nothing matched: VYBER_JEDNU_ODPOVED_Z_ODPOVEDI_PODLE_HISTORIE returns at
     once when g_pocetodpovedipocitace is 0 (INTELIG.FU:89, where the author's
     own "!" marks it as a known hole), so IQ Pokyd repeats its last answer
     rather than saying nothing.  That is the original's behaviour; we keep it. */
  g_pocetodpovedipocitace=0;
  g_pocetrecenychvet++;
  POROZUMEJ_VETE_NAPSANE_CLOVEKEM(vetacloveka);
  ZPRACUJ_VETU();
  VYBER_JEDNU_ODPOVED_Z_ODPOVEDI_PODLE_HISTORIE();
  g_smyslposlednivetypocitace=ZJISTI_SMYSL_VETY_POCITACE(g_odpovedpocitace);
 }

static void ODPOVEZ_NA_VETU(char *veta) {
  /* !Prostre/mfcDlg.cpp:596-607, CMfcDlg::OnNovaveta.  The pre- and
     post-processing around IQ_POKYDE_ODPOVEZ is not optional: the engine wants
     lowercase, phonemically normalized text with "ses"/"bych" expanded into two
     words, and hands back an answer that still has to be put back together.
     Skipping any of it changes the answers.

     Note that UPRAV_VETU_PRO_IQPOKYD frees what it is given and returns a new
     pointer (SKLONOV.FU:173), so g_aktualnivetacloveka must be reassigned and
     must come from the engine's own allocator. */

  g_aktualnivetacloveka=(char *)REALOKUJ_PAMET(g_aktualnivetacloveka,strlen(veta)+1);
  strcpy(g_aktualnivetacloveka,veta);

  PREVED_NA_MALA_PISMENA(g_aktualnivetacloveka);
  UPRAV_DLOUHE_SLOVO_PRO_IQPOKYD(g_aktualnivetacloveka);
  g_aktualnivetacloveka=UPRAV_VETU_PRO_IQPOKYD(g_aktualnivetacloveka);
  IQ_POKYDE_ODPOVEZ(g_aktualnivetacloveka);
  ODUPRAV_VETU_PRO_IQPOKYD();

  strcpy(g_aktualnivetacloveka,veta);    /* the buffer is >= strlen(veta)+1 */

  g_predchozivetacloveka=(char *)REALOKUJ_PAMET(g_predchozivetacloveka,strlen(veta)+1);
  strcpy(g_predchozivetacloveka,veta);
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

/* ---------------------------------------------------------------------- main */

static int POHLAVI(const char *co,const char *prepinac) {
  if (strcmp(co,"m") == 0 || strcmp(co,"muz") == 0) return(1);
  if (strcmp(co,"f") == 0 || strcmp(co,"z") == 0 || strcmp(co,"zena") == 0) return(0);
  fprintf(stderr,"pokyd: %s takes m or f, not \"%s\"\n",prepinac,co);
  exit(2);
  return(0);
 }

static int JE_TAM(const char *jmeno) {
FILE *f=fopen(jmeno,"rb");
  if (f == NULL) return(0);
  fclose(f);
  return(1);
 }

int main(int argc,char **argv) {
int i,interaktivni;
char *radek=NULL;

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

  /* The engine opens its files by bare name in the current directory
     (OTEVRI_SOUBOR, SLOVNIK.FU:195, the IQPOKYDWINMFC != 1 branch), so the
     working directory is the data directory. */
  if (POKYD_CHDIR(o_data) != 0) {
    fprintf(stderr,"pokyd: cannot enter \"%s\"\n",o_data); return(1);
   }
  if (JE_TAM(JMENO_ZAKLADNIHO_SLOVNIKU) == 0 || JE_TAM(JMENO_SOUBORU_S_INTELIGENCI) == 0) {
    fprintf(stderr,
      "pokyd: \"%s\" holds no %s / %s.\n"
      "       tools/build.py lays out build/run/ with both; point --data at it.\n",
      o_data,JMENO_ZAKLADNIHO_SLOVNIKU,JMENO_SOUBORU_S_INTELIGENCI);
    return(1);
   }

  g_nastaveni.NASTAV_STANDARDNE();       /* mfcDlg.cpp:403 */
  if (o_pohlavicloveka != -1) g_nastaveni.pohlavicloveka=(BYTE)o_pohlavicloveka;
  if (o_pohlavipocitace != -1) g_nastaveni.pohlavipocitace=(BYTE)o_pohlavipocitace;
  if (o_charakter != -1) g_nastaveni.charakter=(BYTE)o_charakter;
  if (o_nalada != -1) {
    g_nastaveni.nalada=(BYTE)o_nalada;
    g_nastaveni.SPOCITEJ_NALADABODY_Z_NALADY();   /* naladabody is what drifts */
   }

  PRIPRAV_GLOBALY();
  NACTI_SLOVNIKY();

  /* Seed last, not first: ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU reseeds from
     the clock on its way out (SLOVNIK.FU:1732, after a fixed seed obfuscates
     the cache), so a --seed set before loading only survives on runs that found
     a cache.  rand() is what picks between equally unheard answers. */
  srand(o_seed_zadan ? o_seed : (unsigned)time(NULL));

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

    ODPOVEZ_NA_VETU(radek);

    NAPIS_NA_KONZOLI("< ",g_odpovedpocitace);
    ZAPIS_DO_PREPISU("< ",g_odpovedpocitace);

    if (o_stav) {
      printf("  [character %u, mood %u (%u points), sentence %lu]\n",
             (unsigned)g_nastaveni.charakter,(unsigned)g_nastaveni.nalada,
             (unsigned)g_nastaveni.naladabody,(unsigned long)g_pocetrecenychvet);
      fflush(stdout);
     }

    free(radek);
   }

  if (f_prepis != NULL) fclose(f_prepis);

  /* Not politeness: the block counter is the only leak detector this code has,
     and phase 3 runs it in a wasm heap that has to be sized. */
  UVOLNI_VESKEROU_DYNAMICKOU_PAMET();
  if (debug_pocetalokovani != 0) {
    fprintf(stderr,"pokyd: %lu memory blocks were not freed\n",
            (unsigned long)debug_pocetalokovani);
   }

  return(0);
 }
