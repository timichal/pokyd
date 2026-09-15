/* IQ Pokyd - src/shim/engine.cpp - the engine, as one translation unit.

   The non-MFC counterpart of !Prostre/IQPokyd.cpp.  vsechno.in is not a header:
   it is the program, and the original built it by #including it into exactly one
   .cpp of the MFC project.  We do the same, minus the MFC.

   IQPOKYDWINMFC 0 selects the author's own console paths -- printf progress
   instead of g_handletext1->SetWindowText, plain fopen instead of
   GetModuleFileName.  BEZ_PROSTREDI (set on the command line, and it must be 1,
   not empty: Debug/DEBUG.FU:115 tests `BEZ_PROSTREDI == 1`) drops Prostred/,
   which is the MFC window itself.

   Written by us, not ported.  ASCII only.
*/

#include "engine.h"

#define IQPOKYDWINMFC 0
#include "vsechno.in"
