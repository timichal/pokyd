/* IQ Pokyd - src/shim/win32.h - the Win32 surface the engine core still touches.

   Aplikace/ is plain C++ apart from a handful of Windows spellings it picked up
   from being compiled inside an MFC project: the BYTE/WORD/DWORD typedefs, and
   three calls inside NAHLAS_CHYBU / OTEVRI_SOUBOR.  This header supplies exactly
   those and nothing else, so the engine builds with no windows.h anywhere -- on
   MinGW today and on Emscripten in phase 3.

   Written by us, not ported.  ASCII only: unlike src/engine/ this file is handed
   to the compiler as it is, so it must read the same in CP1250 and UTF-8.
*/

#ifndef POKYD_SHIM_WIN32_H
#define POKYD_SHIM_WIN32_H

#include <stddef.h>
#include <signal.h>   /* NAHLAS_CHYBU raise()s SIGABRT; StdAfx.h used to supply this */

typedef unsigned char BYTE;
typedef unsigned short WORD;
typedef unsigned long DWORD;

#ifndef MAX_PATH
  #define MAX_PATH 260
#endif

/* NAHLAS_CHYBU (Debug/DEBUG.FU) reports through MessageBox and gives the thread
   pool 200 ms to notice before raise(SIGABRT).  Off Windows the message goes to
   stderr and there are no threads to wait for.

   The return value is a real decision.  _STORNO_ means "shall I try again?", and
   9 of its 11 call sites are a `goto ZNOVU` retry loop around an out-of-memory or
   a failed write.  With a user at the dialog, OK is the right default: the retry
   usually works.  With nobody there it spins forever.  So we answer IDCANCEL --
   the "Storno" the dialog text itself describes as "ukoncis program" -- and a
   build with no one watching stops at the error instead of hanging on it. */

#define MB_ICONINFORMATION 0
#define MB_SYSTEMMODAL     0
#define MB_OKCANCEL        0
#define IDOK               1
#define IDCANCEL           2

typedef void *HWND;

int MessageBox(HWND window, const char *text, const char *title, unsigned type);
void Sleep(unsigned long ms);

/* OTEVRI_SOUBOR (Slovnik/SLOVNIK.FU) uses this to load the data files from the
   directory of the .exe rather than the cwd.  Only the IQPOKYDWINMFC==1 branch
   calls it; declared so the file compiles either way. */
DWORD GetModuleFileName(void *module, char *path, DWORD size);

#endif
