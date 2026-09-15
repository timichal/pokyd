/* IQ Pokyd - src/shim/nahoda.cpp - the generator nahoda.h promises.

   Written by us, not ported.  ASCII only.
*/

#include "nahoda.h"

/* `unsigned`, not `unsigned long`: the arithmetic has to wrap at 32 bits on every
   target, and long is 64 bits on a Linux host even though it is 32 on MinGW and
   on wasm32.  One global state, not the CRT's per-thread one -- the engine is
   single-threaded, and so is the worker phase 4.2 puts it in.

   The seed the MS CRT starts from with no srand() at all is 1, and so is ours:
   PROSTRED.FU's obfuscator and SLOVNIK.FU:1579 both srand() before drawing, but
   a driver that forgets to should still be reproducible rather than merely
   undefined. */
static unsigned nahodne_semeno = 1;

void POKYD_ZASEJ(unsigned semeno) {
  nahodne_semeno = semeno;
 }

int POKYD_NAHODA(void) {
  nahodne_semeno = nahodne_semeno*214013u + 2531011u;
  return (int)((nahodne_semeno >> 16) & 0x7fff);
 }
