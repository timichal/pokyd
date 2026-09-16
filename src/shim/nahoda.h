/* IQ Pokyd - src/shim/nahoda.h - our own rand(), so every build rolls the same dice.

   Hazard 11 of PLAN.md, settled here.  VRAT_CISLO_ODPOVEDI_PODLE_HISTORIE breaks
   a tie between equally-unheard answers with `rand()%pocetabsolutnichvitezu`
   (Intelig/INTELIG.FU:74 and :111), which happens on most sentences, and
   URCI_ZMENU_NALADY nudges the mood by `(rand()%3)-1` (:532).  The conversation
   is therefore a function of the seed *and of whose rand() it is*, and phase 3.3
   wants a native transcript and a wasm transcript to match byte for byte.  Two
   C runtimes will not agree on that for free, so we stop asking them to.

   Which generator, and why this one
   ---------------------------------
   The Microsoft CRT's, the one the original was built against:

       seed = seed*214013 + 2531011;   return (seed >> 16) & 0x7fff;

   Not an arbitrary choice.  IQ Pokyd 0.15 was an MFC program compiled with MSVC,
   so this *is* the sequence its answers came out of in 2005; and MinGW-W64 16.1.0
   (ucrt64) still hands back exactly this, verified against 2000 draws from each of
   six seeds before the shim was written.  So the shim changes nothing on the
   native side -- the phase 1.6 golden transcript is byte-identical with it and
   without it, which is how it was checked -- and it drags Emscripten's musl onto
   the same sequence rather than inventing a third one.

   How it is hooked up
   -------------------
   <stdlib.h> comes first, on purpose: the real declarations get in before the
   macros do, so the later `#include <stdlib.h>` in vsechno.in is a no-op and
   nothing ever sees `rand` rewritten inside a declaration.  The macros are
   function-like, so they only fire on a call -- `rand` as a plain token, if the
   corpus ever grew one, would be left alone.

   This is our code, not the engine's: no engine byte changes, so nothing here
   belongs in PATCHES.md.  English identifiers and ASCII only, like the rest of
   src/shim -- the file keeps its Czech name because it is where !Prostre/ put
   this, and the two trees are read side by side.
*/

#ifndef POKYD_SHIM_NAHODA_H
#define POKYD_SHIM_NAHODA_H

#include <stdlib.h>   /* first: see above */

#ifdef __cplusplus
extern "C" {
#endif

void pokyd_srand(unsigned seed);
int pokyd_rand(void);

#ifdef __cplusplus
}
#endif

#undef RAND_MAX
#define RAND_MAX 0x7fff

#define srand(seed) pokyd_srand((unsigned)(seed))
#define rand()        pokyd_rand()

#endif
