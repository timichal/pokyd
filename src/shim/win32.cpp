/* IQ Pokyd - src/shim/win32.cpp - what the Win32 surface in win32.h does instead.

   Written by us, not ported.  ASCII only.
*/

#include <stdio.h>
#include "win32.h"
#include "conio.h"

int MessageBox(HWND /*window*/, const char *text, const char *title, unsigned /*type*/) {
  fprintf(stderr, "\n%s\n%s\n", title ? title : "", text ? text : "");
  fflush(stderr);
  return IDCANCEL;   /* see win32.h: nobody is here to press OK */
 }

void Sleep(unsigned long /*ms*/) {
 }

DWORD GetModuleFileName(void * /*module*/, char *path, DWORD size) {
  if (size > 0) path[0] = 0;
  return 0;
 }

/* The three getch() calls are all "press any key" pauses on paths that now run
   unattended.  Returning Enter keeps NAHLAS_CHYBU's dead console branch honest
   and lets the two teardown pauses fall through. */
int getch(void) { return '\r'; }
int _getch(void) { return '\r'; }
int kbhit(void) { return 0; }
int _kbhit(void) { return 0; }
