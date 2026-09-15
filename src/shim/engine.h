/* IQ Pokyd - src/shim/engine.h - declarations of the whole engine.

   The non-MFC counterpart of !Prostre/IQPokyd.h, and assembled in the same order
   it was: forward-declare the classes, pull in Aplikace/hlavicky.in (every
   function, constant and prototype), then define the classes, then list the
   globals.  Anything that drives the engine -- the phase 1.5 console driver,
   later pokyd_api.c -- includes this and nothing else.

   Build with:  -I src/shim -I build/cp1250 -DBEZ_PROSTREDI=1
   or just run tools/build.py.  See src/README.md for why the compiler is pointed
   at build/cp1250 rather than at src/engine.

   Written by us, not ported.  ASCII only.
*/

#ifndef POKYD_SHIM_ENGINE_H
#define POKYD_SHIM_ENGINE_H

#include "win32.h"

/* IQPokyd.h forward-declares these before hlavicky.in, because the prototypes in
   there take them by reference.  Same order here. */
class Typ_slova;
class Struktura_vety;
class RozvrzeniVet;

#include "hlavicky.in"

/* ...and defines them after it, because Struktura_vety sizes an array with
   MAX_POCET_SLOV_CLOVEKA, which hlavicky.in brings in.  Same order here too. */
#include "tridy.h"
#include "prostredi.h"

/* The engine's globals.  hlavicky.in declares the functions but not these; the
   original listed them by hand in IQPokyd.h so the other MFC translation units
   could see them, and a driver needs the same view.  Same list, minus the ones
   whose types went with Prostred/ (the brushes, the CString log, the dialog).
   All are defined in Vstup/VSTUP.PR, Intelig/INTELIG.PR, Slovnik/SLOVNIK.PR and
   Debug/DEBUG.PR -- that is, inside engine.cpp's translation unit. */

extern Nastaveni g_nastaveni;
extern Struktura_vety g_vetacloveka;
extern Typ_slova g_prostorslovviqpodminkach[10];

extern char *g_aktualnivetacloveka,*g_predchozivetacloveka;
extern char g_odpovedpocitace[MAX_DELKA_ODPOVEDI_POCITACE+1];

extern DWORD g_pocetslovvzakladnidatabazi,g_pocetiqpodminek;
extern DWORD g_pocetodpovedipocitace,g_pocetrecenychvet;
extern long double g_procentanacitani;   /* 0..100, drives the loading bar */

extern DWORD debug_pocetalokovani,debug_maxpocetvsechslov;
extern char *debug_poslednipodmetcloveka,*debug_posledniprisudekcloveka,*debug_poslednipredmetcloveka;

#endif
