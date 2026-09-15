/* IQ Pokyd - src/shim/prostredi.h - the two Prostred/ globals the core still reaches for.

   BEZ_PROSTREDI drops Aplikace/Prostred/, and with it prostred.pr, which defined
   the MFC window handle and the four "close this thread" flags.  Two of those
   definitions are still needed, because two references to them sit outside the
   IQPOKYDWINMFC == 1 guards:

     g_HWNDhlavnihookna     Debug/DEBUG.FU:117,121,126 -- the owner window of the
                            MessageBox in NAHLAS_CHYBU.  The whole switch is under
                            `#if IQPOKYDWINMFC == 1 || BEZ_PROSTREDI == 1`, which
                            reads as a slip -- "no environment" ought to mean the
                            console branch below it -- but the console branch calls
                            a NAPIS_V_LATIN2 that exists nowhere in the corpus and
                            returns before its own second half, so it has not been
                            compiled in years.  We take the MessageBox branch as
                            written and give MessageBox somewhere to go (win32.h).

     g_zavritvlaknoprocesu  Slovnik/SLOVNIK.FU:3345, inside an `#if IQPOKYDWINMFC
                            != 1` block: the console path tests the loader-cancel
                            flag that only the MFC path could ever set.  Nothing in
                            a BEZ_PROSTREDI build sets it, so it stays 0 and the
                            test is inert -- which is the behaviour we want.

   Everything else in prostred.pr (g_handletext1..3, g_procentanacitani's readers,
   the other three thread flags, the brushes) is referenced only under
   IQPOKYDWINMFC == 1 and is genuinely gone.  g_procentanacitani itself is not a
   Prostred/ global at all -- Slovnik/SLOVNIK.PR:47 defines it, and the engine keeps
   updating it whether anyone is watching or not, which is what phase 4.3 will read.

   Written by us, not ported.  ASCII only.
*/

#ifndef POKYD_SHIM_PROSTREDI_H
#define POKYD_SHIM_PROSTREDI_H

#include "win32.h"

extern HWND g_HWNDhlavnihookna;
extern BYTE g_zavritvlaknoprocesu;

#endif
