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

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code; our own functions are lower case, so a SHOUTING name
   is always the engine's.
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
static const char *o_transcript = NULL;     /* clean transcript, CP1250 */
static unsigned o_seed = 0;
static int o_seed_given = 0;
static int o_cp1250 = 0;                /* console encoding: CP852 unless set */
static int o_state = 0;                  /* print mood/character after each line */
static int o_time = 0;                   /* report load and answer timings */
static const char *o_export = NULL;      /* write SLOVNIK.TMP's bytes here after loading */
static const char *o_import = NULL;      /* install this as SLOVNIK.TMP before loading */

static int o_character = -1, o_mood = -1;
static int o_human = -1, o_computer = -1;

static FILE *f_transcript = NULL;

static void usage(const char *name) {
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
    "  --character 0..6  machine, naive, calm, average, suspicious, moody,\n"
    "                    volatile -- the engine's own stroj, naivni, klidny,\n"
    "                    prumerny, neduverivy, naladovy, vybusny\n"
    "  --mood 1..5       excellent, good, normal, bad, awful\n"
    "                    (vyborna, dobra, normalni, spatna, hrozna)\n"
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
    name);
 }

/* ------------------------------------------------------------------- console */

static char *read_line(FILE *f) {
  /* plain malloc, deliberately: everything the engine allocates is counted in
     debug_pocetalokovani and the driver's own buffers have no business being in
     that number.  Returns NULL at EOF.  Strips CR and LF, keeps the rest. */
size_t len=0,cap=256;
char *line=(char *)malloc(cap);
int c;

  if (line == NULL) return(NULL);

  while ((c=getc(f)) != EOF && c != '\n') {
    if (len+1 >= cap) {
      char *bigger=(char *)realloc(line,cap*=2);
      if (bigger == NULL) { free(line); return(NULL); }
      line=bigger;
     }
    line[len++]=(char)c;
   }

  if (c == EOF && len == 0) { free(line); return(NULL); }

  while (len > 0 && line[len-1] == '\r') len--;
  line[len]=0;
  return(line);
 }

static void write_console(const char *prefix,const char *text_cp1250) {
  /* The console gets CP852 by default -- the same bytes the engine's own
     printf()s produce, via the engine's own converter -- so that stdout is not
     a mixture of two codepages.  PREVED_Z_WINDOWS_1250_NA_LATIN_2 rewrites in
     place and only touches bytes with the high bit set, so it needs a copy and
     the length never changes. */
char *copy=(char *)malloc(strlen(text_cp1250)+1);

  if (copy == NULL) return;
  strcpy(copy,text_cp1250);
  if (o_cp1250 == 0) PREVED_Z_WINDOWS_1250_NA_LATIN_2(copy);

  printf("%s%s\n",prefix,copy);
  fflush(stdout);
  free(copy);
 }

static void write_transcript(const char *prefix,const char *text_cp1250) {
  /* Opened "wb" and ending the lines by hand: a transcript is CP1250 with CRLF
     whatever platform wrote it, so that the phase 1.6 golden file and the phase
     3.3 wasm run can be compared byte for byte. */
  if (f_transcript == NULL) return;
  fprintf(f_transcript,"%s%s\r\n",prefix,text_cp1250);
  fflush(f_transcript);
 }

/* --------------------------------------------------------------------- cache */

/* pokyd_export_cache and pokyd_import_cache on the command line.  Nothing else
   in this repository calls either yet -- the web build is where they earn their
   keep, at phase 4.4 -- so they are wired up here to be exercised rather than
   merely compiled.  Plain malloc and fopen on this side of the boundary: the
   blob is ours, not the engine's, and pokyd_free is what frees the other one. */

static int export_cache(const char *name) {
unsigned char *block;
unsigned long len=0;
FILE *f;
size_t written;

  if ((block=pokyd_export_cache(&len)) == NULL) {
    fprintf(stderr,"pokyd: %s\n",pokyd_error());
    return(1);
   }
  if ((f=fopen(name,"wb")) == NULL) {
    pokyd_free(block);
    fprintf(stderr,"pokyd: cannot write \"%s\"\n",name);
    return(1);
   }
  written=fwrite(block,1,(size_t)len,f);
  fclose(f);
  pokyd_free(block);

  if (written != (size_t)len) {
    fprintf(stderr,"pokyd: short write on \"%s\"\n",name);
    return(1);
   }
  fprintf(stderr,"pokyd: exported %lu cache bytes to \"%s\"\n",len,name);
  return(0);
 }

static int import_cache(const char *name) {
FILE *f;
long size;
unsigned char *block;
int rc;

  if ((f=fopen(name,"rb")) == NULL) {
    fprintf(stderr,"pokyd: cannot read \"%s\"\n",name);
    return(1);
   }
  if (fseek(f,0,SEEK_END) != 0 || (size=ftell(f)) <= 0 || fseek(f,0,SEEK_SET) != 0) {
    fclose(f);
    fprintf(stderr,"pokyd: cannot measure \"%s\"\n",name);
    return(1);
   }
  if ((block=(unsigned char *)malloc((size_t)size)) == NULL) {
    fclose(f);
    fprintf(stderr,"pokyd: out of memory reading \"%s\"\n",name);
    return(1);
   }
  if (fread(block,1,(size_t)size,f) != (size_t)size) {
    free(block); fclose(f);
    fprintf(stderr,"pokyd: short read on \"%s\"\n",name);
    return(1);
   }
  fclose(f);

  rc=pokyd_import_cache(block,(unsigned long)size);
  free(block);

  if (rc != 0) {
    fprintf(stderr,"pokyd: %s\n",pokyd_error());
    return(1);
   }
  fprintf(stderr,"pokyd: imported %ld cache bytes from \"%s\"\n",size,name);
  return(0);
 }

/* ---------------------------------------------------------------------- main */

static int parse_gender(const char *text,const char *option) {
  if (strcmp(text,"m") == 0 || strcmp(text,"muz") == 0) return(1);
  if (strcmp(text,"f") == 0 || strcmp(text,"z") == 0 || strcmp(text,"zena") == 0) return(0);
  fprintf(stderr,"pokyd: %s takes m or f, not \"%s\"\n",option,text);
  exit(2);
  return(0);
 }

int main(int argc,char **argv) {
int i,interactive;
char *line=NULL;
const char *answer;
unsigned long unfreed;
pokyd_settings settings;
double t_start,load_ms=0.0,answer_ms=0.0;
unsigned long answers=0;

  for (i=1; i < argc; i++) {
    if (strcmp(argv[i],"--help") == 0 || strcmp(argv[i],"-h") == 0) {
      usage(argv[0]); return(0);
     }
    else if (strcmp(argv[i],"--data") == 0 && i+1 < argc) o_data=argv[++i];
    else if (strcmp(argv[i],"--transcript") == 0 && i+1 < argc) o_transcript=argv[++i];
    else if (strcmp(argv[i],"--seed") == 0 && i+1 < argc) {
      o_seed=(unsigned)strtoul(argv[++i],NULL,10); o_seed_given=1;
     }
    else if (strcmp(argv[i],"--cp1250") == 0) o_cp1250=1;
    else if (strcmp(argv[i],"--state") == 0) o_state=1;
    else if (strcmp(argv[i],"--time") == 0) o_time=1;
    else if (strcmp(argv[i],"--export-cache") == 0 && i+1 < argc) o_export=argv[++i];
    else if (strcmp(argv[i],"--import-cache") == 0 && i+1 < argc) o_import=argv[++i];
    else if (strcmp(argv[i],"--character") == 0 && i+1 < argc) o_character=atoi(argv[++i]);
    else if (strcmp(argv[i],"--mood") == 0 && i+1 < argc) o_mood=atoi(argv[++i]);
    else if (strcmp(argv[i],"--human") == 0 && i+1 < argc)
     o_human=parse_gender(argv[++i],"--human");
    else if (strcmp(argv[i],"--computer") == 0 && i+1 < argc)
     o_computer=parse_gender(argv[++i],"--computer");
    else {
      fprintf(stderr,"pokyd: unknown option \"%s\" (try --help)\n",argv[i]);
      return(2);
     }
   }

  if (o_character != -1 && (o_character < 0 || o_character > 6)) {
    fprintf(stderr,"pokyd: --character is 0..6\n"); return(2);
   }
  if (o_mood != -1 && (o_mood < 1 || o_mood > 5)) {
    fprintf(stderr,"pokyd: --mood is 1..5\n"); return(2);
   }

  /* pokyd_init chdirs into the data directory, because the engine opens its
     files by bare name in the current one, and applies NASTAV_STANDARDNE. */
  if (pokyd_init(o_data) != 0) {
    fprintf(stderr,"pokyd: %s (\"%s\")\n",pokyd_error(),o_data); return(1);
   }

  pokyd_get_settings(&settings);
  if (o_human != -1) settings.human_gender=(unsigned char)o_human;
  if (o_computer != -1) settings.computer_gender=(unsigned char)o_computer;
  if (o_character != -1) settings.character=(unsigned char)o_character;
  pokyd_set_settings(&settings);
  /* after set_settings, not inside it: mood_points is what drifts and mood is
     derived from it, so a mood has to be set through the engine's own
     SPOCITEJ_NALADABODY_Z_NALADY.  See pokyd_api.h. */
  if (o_mood != -1) pokyd_set_mood((unsigned char)o_mood);

  /* Before loading, never during: the load is what reads SLOVNIK.TMP.  It was
     hazard 10's adjacency that made this its own step; PATCHES.md 2 settled that,
     and the order is still the API's.  See pokyd_api.h. */
  if (o_import != NULL && import_cache(o_import) != 0) return(1);

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

  load_ms=((double)clock()-t_start)*1000.0/CLOCKS_PER_SEC;
  if (o_time) fprintf(stderr,"pokyd: load %.0f ms\n",load_ms);

  if (o_export != NULL && export_cache(o_export) != 0) return(1);

  /* Seed last, not first: ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU reseeds from
     the clock on its way out (SLOVNIK.FU:1732, after a fixed seed obfuscates
     the cache), so a --seed set before loading only survives on runs that found
     a cache.  rand() is what picks between equally unheard answers -- and since
     1.6 it is ours, not the C runtime's (src/shim/nahoda.h), so the same seed
     gives the same conversation on any toolchain.  That is what makes the
     test/golden/ transcript worth diffing at 3.3. */
  pokyd_seed(o_seed_given ? o_seed : (unsigned long)time(NULL));

  if (o_transcript != NULL && (f_transcript=fopen(o_transcript,"wb")) == NULL) {
    fprintf(stderr,"pokyd: cannot write \"%s\"\n",o_transcript); return(1);
   }

  interactive=POKYD_ISATTY(POKYD_FILENO(stdin));

  while (1) {
    if (interactive) { printf("\n> "); fflush(stdout); }
    else printf("\n");

    line=read_line(stdin);
    if (line == NULL) break;
    if (line[0] == 0) { free(line); continue; }   /* mfcDlg.cpp:556 */

    /* Convert first, echo second.  Everything past this point -- the echo, the
       transcript, the engine -- is CP1250, and the console conversion happens
       only in write_console on the way back out. */
    if (o_cp1250 == 0) PREVED_Z_LATIN_2_NA_WINDOWS_1250(line);

    if (interactive == 0) write_console("> ",line);
    write_transcript("> ",line);

    t_start=(double)clock();
    answer=pokyd_say(line);
    answer_ms+=((double)clock()-t_start)*1000.0/CLOCKS_PER_SEC;
    answers++;
    write_console("< ",answer);
    write_transcript("< ",answer);

    if (o_state) {
      pokyd_get_settings(&settings);
      printf("  [character %u, mood %u (%u points), sentence %lu]\n",
             (unsigned)settings.character,(unsigned)settings.mood,
             (unsigned)settings.mood_points,pokyd_sentence_count());
      fflush(stdout);
     }

    free(line);
   }

  if (o_time) fprintf(stderr,"pokyd: %lu answers %.0f ms (clock(), 1 ms resolution)\n",
                    answers,answer_ms);

  if (f_transcript != NULL) fclose(f_transcript);

  /* Not politeness: the block counter is the only leak detector this code has,
     and phase 3 runs it in a wasm heap that has to be sized. */
  unfreed=pokyd_shutdown();
  if (unfreed != 0) {
    fprintf(stderr,"pokyd: %lu memory blocks were not freed\n",unfreed);
   }

  return(0);
 }
