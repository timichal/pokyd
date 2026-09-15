/* IQ Pokyd - src/shim/conio.h - stub for the Borland/MSVC console header.

   vsechno.in includes <conio.h> unconditionally and three places call getch():
   NAHLAS_CHYBU's dead console branch and the two "press any key" pauses at the
   end of UVOLNI_VESKEROU_DYNAMICKOU_PAMET.  None of them belong in a pipe, a
   worker, or a wasm module.  -I src/shim puts this ahead of MinGW's real one so
   the engine sees the same header on every toolchain.

   Written by us, not ported.  ASCII only.
*/

#ifndef POKYD_SHIM_CONIO_H
#define POKYD_SHIM_CONIO_H

int getch(void);
int _getch(void);
int kbhit(void);
int _kbhit(void);

#endif
