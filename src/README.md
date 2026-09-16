# `src/`

## `src/engine/` — the ported original

A UTF-8 re-encoding of `original/IQ Pokyd/Aplikace/`, with the hardcoded DOS include
paths rewritten. **This is the canonical working copy**: what git tracks, what
`PATCHES.md` describes, and the only tree a human should edit.

It is not compiled directly. The engine is byte-oriented — it switches on single
CP1250 bytes (`case 'č':`), indexes a 28-letter alphabet, and checksums its own data
files — so the compiler has to be handed CP1250 bytes, exactly as MSVC 6 got them in
2005. Emscripten's clang cannot do that conversion for us (`-fexec-charset` there knows
only UTF-8 and IBM-1047), so we do it ourselves:

```
original/IQ Pokyd/Aplikace/   --tools/gen-src.py-->    build/src/      (CP1250 mirror)
build/src/                    --tools/transcode.py-->  src/engine/     (UTF-8, canonical)
src/engine/                   --tools/transcode.py-->  build/cp1250/   (what the compiler reads)
```

Everything under `build/` is generated and gitignored. Regenerate and verify with:

```sh
python3 tools/gen-src.py                  # original/  -> build/src/
python3 tools/transcode.py --check        # proves the round trip is byte-exact
python3 tools/transcode.py --to-cp1250    # src/engine/ -> build/cp1250/
```

`--check` asserts `to_cp1250(to_utf8(x)) == x` for all 37 files, so the UTF-8 encoding
provably changes nothing the compiler can see. If you edit `src/engine/`, `--check`
will report the file as differing from the original — that is expected once phase 1.4
lands, and every such difference belongs in `PATCHES.md`.

### Things that will trip you up

- **Line endings are CRLF and must stay CRLF.** `.gitattributes` pins them; the
  byte-exactness proof compares files on disk.
- **Type CP1250-representable characters only.** Czech is fine; a curly quote or an
  em dash is not, and `--check` will tell you so with a file and line.
- **`vstup/vstup.fu` has 60 `'\xNN'` byte constants** in `PREVED_Z_LATIN_2_NA_WINDOWS_1250`
  and `PREVED_Z_WINDOWS_1250_NA_LATIN_2`. The author's "Latin 2" is CP852, the DOS
  codepage, not ISO-8859-2. Those bytes are values from a foreign codepage, not
  characters — leave them escaped. Everything else in the tree is plain readable Czech.
- **Comments and identifiers stay Czech here**, matching the original, so the two
  trees can be diffed by eye. That rule belongs to this directory alone. Everything
  else in the repository — `src/shim/`, `src/api/`, `src/driver/`, `src/web/`,
  `tools/`, `test/` — is ours and is written in English; where one of our names
  mirrors something of the author's, his name for it is the comment beside it.

## `src/shim/` — the Win32/MFC surface, replaced

`Aplikace/` is plain C++ apart from a thin Windows crust it picked up from living
inside an MFC project. This directory is that crust, rewritten: it is what
`!Prostre/` used to hand the engine, minus the window. Our code, ASCII only (it is
handed to the compiler as-is, so it has to read identically in CP1250 and UTF-8).

| File | What it is |
|---|---|
| `engine.h` | What a driver includes. Mirrors `!Prostre/IQPokyd.h` in structure and order: forward declarations → `hlavicky.in` → class definitions → the engine's globals. |
| `engine.cpp` | The engine as one translation unit. Mirrors `!Prostre/IQPokyd.cpp`: `#define IQPOKYDWINMFC 0` then `#include "vsechno.in"`. `vsechno.in` is not a header — it is the program, and the original compiled it in exactly one `.cpp` too. |
| `tridy.h` | `Typ_slova`, `Struktura_vety`, `Nastaveni` — lines 43–130 of `!Prostre/IQPokyd.h`, verbatim. See below. |
| `win32.h` / `.cpp` | `BYTE`/`WORD`/`DWORD`, `MAX_PATH`, and the three calls the core still makes: `MessageBox`, `Sleep`, `GetModuleFileName`. |
| `prostredi.h` / `.cpp` | The two `Prostred/` globals referenced from outside the `IQPOKYDWINMFC == 1` guards: `g_HWNDhlavnihookna` and `g_zavritvlaknoprocesu`. |
| `nahoda.h` / `.cpp` | Our `rand()` and `srand()`, defined over `<stdlib.h>` before the engine is included. The Microsoft CRT's LCG, which is what the 2005 MFC build drew from and what ucrt64 still hands back — so it is a no-op here and it is what stops MinGW and musl from telling two different conversations. Hazard 11 in `PLAN.md`. |
| `conio.h` | Stub. `vsechno.in` includes `<conio.h>` unconditionally; `-I src/shim` puts this ahead of MinGW's, so every toolchain sees the same one. Emscripten has none at all. |

**The source drop's `Aplikace/` is not self-contained.** `Vstup/NASTAVEN.TR` still
calls itself *"soubor s definicí třídy pro nastavení"* and `Intelig/INTELIG.TR`
*"definice tříd Typ_slova a Struktura_vety"*, but both class bodies had long since
moved into `!Prostre/IQPokyd.h` and only forward declarations were left behind.
Compiling `Aplikace/` without `!Prostre/` means bringing them back. They live in
`src/shim/tridy.h` rather than in `src/engine/`, which keeps that tree a byte-exact
mirror of the original — `transcode.py --check` still reports it clean.

## `src/web/` — the JS side of the boundary

Phase 4.1 onward. TypeScript, no dependencies, no build step needed to test it:
node 24 strips the types itself, so `node test/web/cp1250.test.ts` runs as it stands,
and `test/browser.mjs` does the same stripping on the way out to a browser, so Chrome
runs these files rather than a build of them. Vite arrives at phase 5.1 and will
consume them unchanged.

| File | What it is |
|---|---|
| `cp1250.ts` | The codec. The full 256-entry CP1250 table and both directions across it, and the only place in the project where a byte becomes a character or the reverse. `pokyd_api.h` says every `char *` crossing the API is CP1250 and has to stay CP1250; this is the one door in that wall. |
| `protocol.ts` | The vocabulary of the worker boundary: twelve requests mirroring `pokyd_api.h` one for one, the reply union, and `PokydSettings`. Types only — nothing in it survives to runtime except the phase constants. |
| `engine.ts` | `PokydEngine`, the wasm module driven from JavaScript: the malloc/copy/free dance, the 220-byte settings struct, and the codec applied at every crossing. Transport-free on purpose — no `self`, no DOM — which is what lets node test it without a Worker. It also enforces the ordering rules `pokyd_api.h` only states. |
| `worker.ts` | The engine on its own thread. A strict FIFO queue, the throttled output relay, and errors turned into rejected replies. Thin: everything else is in the two files above. |
| `client.ts` | `PokydClient`, the page's half — one awaitable method per request, plus `start()`, which is the ordering rules expressed once so no caller has to remember them. |

The worker is the point of phase 4.2, not a refinement of it. 3.4 measured
`pokyd_load_dictionaries()` at 15.3 s in Chrome, as **one synchronous call**: on the
main thread that is a page that does not repaint, scroll or answer the mouse for a
quarter of a minute. Measured through the worker, the longest the main thread was
kept waiting across the whole of that load is **12 ms**, and 902 animation frames
were drawn during it.

One consequence worth knowing before phase 4.3 draws a progress bar: **`pokyd_progress()`
is dead through the step that takes the time.** The assignment that would move it
through the inflection loop is `SLOVNIK.FU:3318`, behind `#if IQPOKYDWINMFC == 1`, so
a `BEZ_PROSTREDI` build never compiles it. The author reported that step to the console
instead — `printf("\r%.1Lf%%", ...)` every tenth word — and Emscripten hands those
characters to a JS callback *synchronously, from inside the call that has not returned*.
So the progress signal is the engine's own output, decoded from CP1250 and relayed as
`output` events; the cold load produced 207 usable percentages. `PROGRESS` at the foot
of `protocol.ts` has the argument and the measurements.

The table is a **bijection on all 256 byte values**, including the five CP1250 leaves
undefined, so decode loses nothing and encode invents nothing. That is what lets
`slovnik.iqp` and `IQPOKYD.IQP` — which between them use every byte there is — survive a
round trip unchanged, and it is the codec's main test.

Two things about `encodeCp1250` are policy rather than table lookup, and both are
argued in the file's header: text CP1250 cannot hold becomes `?`, which the engine's
`JELI_PISMENO` treats as a word separator rather than as a letter, and input is
NFC-normalized first so decomposed Czech from an Apple keyboard does not silently lose
its diacritics.

Same house rules as the rest of our code: **English identifiers and ASCII only**,
which is why the table is spelled in `\uXXXX` escapes and the tests name Czech
letters by code point. `PokydSettings` mirrors `struct pokyd_settings` field for
field and in the same order — snake_case there because it is C, camelCase here
because it is TypeScript — with the author's own Czech name in a comment on every
line, so the two can still be read against each other.

## `src/api/` — the exported surface

`pokyd_api.h` is everything outside the engine may use: sixteen `extern "C"`
functions and one flat struct, no C++ type anywhere in it, so Emscripten can bind
it with `EXPORTED_FUNCTIONS` and the phase 4.2 worker never sees a class layout.
`pokyd_api.cpp` is that surface implemented — and it is also where the four things
the engine cannot supply itself now live:

| | Where the original does it |
|---|---|
| `PRIPRAV_GLOBALY` | `!Prostre/mfcDlg.cpp:405-418`, `CMfcDlg::OnInitDialog` |
| `pokyd_load_dictionaries` | `Prostred/PROSTRED.FU:550`, `VLAKNO__NACITEJ_JAK_DIVEJ` minus the window |
| `IQ_POKYDE_ODPOVEZ` | `Prostred/PROSTRED.FU:212`, verbatim |
| `pokyd_say` | `!Prostre/mfcDlg.cpp:596-607`, `CMfcDlg::OnNovaveta` |

Two of those exist nowhere else in a build without MFC: `PROSTRED.FU` is the file
`BEZ_PROSTREDI` removes, and it holds both the documented entry point and the
loader. `src/driver/` rehearsed all four at phase 1.5 and now calls them from here,
so there is exactly one copy and `test/golden/` tests it.

Everything crossing this boundary is **CP1250 bytes**, both directions. Phase 4.1's
codec is the only place they become text.

Four constraints the header states and the implementation re-states at the call
that enforces it. The first three fail silently; the fourth is louder. Phase 4.2
enforces all four again in `src/web/engine.ts`, on the JavaScript side of the
boundary, where the message can say why:

- **Seed after loading, never before.** `ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU`
  reseeds from the clock on its way out (`SLOVNIK.FU:1732`).
- **Import a cache before loading, not during.** The load is what reads
  `SLOVNIK.TMP`, so the file has to be on disk by then. Until phase 3.3 this was
  hazard 10's requirement as well — the two reads had to stay adjacent — and
  `PATCHES.md` 2 retired that argument without changing the rule.
- **`mood` is derived, `mood_points` is the state.** (`nalada` and `naladabody`
  in the author's names, which the struct carries in comments.) Writing `mood`
  through `pokyd_set_settings` is undone after the next sentence
  (`INTELIG.FU:1047`); `pokyd_set_mood` is what the original's own dialog does.
- **Shut down only after a load that succeeded.** Found at phase 4.2, the first
  caller to try it any other way. `UVOLNI_VESKEROU_DYNAMICKOU_PAMET` walks
  `g_vetacloveka` calling `Typ_slova::VYMAZ_OBSAH` (`INTELIG.FT:54`), which frees
  some twenty pointers unconditionally, and `UVOLNI_X(NULL)` is a fatal error by
  design (`SKLONOV.FU:1348`). Those pointers are allocated while the base dictionary
  is read, so on an engine that only ever ran `pokyd_init` they are all NULL and the
  call aborts. Left unguarded rather than fixed: a load that never happened has
  nothing to tear down, so drop the module or terminate the worker.

`PLAN.md` 3.1 called this file `src/engine/pokyd_api.c`. It is `.cpp` because
`engine.h` declares classes, so the translation unit is C++ whatever the extension
says, and it is in `src/api/` because `src/engine/` is the byte-exact mirror of
`original/` that `transcode.py --check` verifies — new code of ours has no business
in it. The exported surface is `extern "C"` either way.

## `src/driver/` — the console driver

`pokyd.cpp`, a `main()` that loads the dictionaries, reads sentences from stdin
and prints what IQ Pokyd answers. A dev tool, not part of the exhibit; ours, not
ported. `tools/build.py` links it automatically because the directory exists.

Since phase 3.1 it drives nothing itself: it is a caller of `pokyd_api.h` and a
console front end, which is what makes the golden transcript a test of the API
rather than of the driver.

```sh
python3 tools/build.py                                   # also lays out build/run/
build/native/pokyd.exe --data build/run                  # talk to it
build/native/pokyd.exe --data build/run --help           # every option
```

`--data` is the working directory, because the engine opens `SLOVNIK.IQP` and
`IQPOKYD.IQP` by bare name in the current directory (`OTEVRI_SOUBOR`, the
`IQPOKYDWINMFC != 1` branch) — so the driver `chdir`s there. It must be
writable: the first run inflects all 11,207 words — about five seconds, 402,252
forms, 37 MB peak — and leaves a 17 MB `SLOVNIK.TMP` next to them, after which
startup is 0.4 s. `build.py` fills
`build/run/` from `original/` and drops the cache if the dictionary underneath it
changed.

Two things worth knowing before reading the code:

- **stdout is noisy on purpose.** `vstup.fu:801-809` prints every base form it
  recognises, on every sentence — a debug leftover `PATCHES.md` explains we are not
  deleting. `--transcript FILE` is how you get a clean conversation out.
- **`--export-cache` / `--import-cache`** are `pokyd_export_cache` and
  `pokyd_import_cache` on the command line. Nothing else calls either yet — phase
  4.4 is where they earn their keep — so they are wired up here to be exercised
  rather than merely compiled. Importing a blob turns a 5.6 s cold start into
  0.23 s and produces the same transcript to the byte.

The two things the driver used to explain and no longer does — that the entry point
and the loader had to be brought back out of `PROSTRED.FU`, and that
`CMfcDlg::OnNovaveta`'s pre-processing is not optional — are now `src/api/`'s
business; see above.

Encodings: the engine is CP1250 end to end. The console gets CP852, because that
is what the engine's own `printf`s produce (`NAPIS_TEXT_V_LATIN_2`) and what a
Czech Windows console expects; `--cp1250` turns that off for pipes. A
`--transcript` file is always CP1250 with CRLF, so phase 1.6 and phase 3.3 can
diff byte for byte.

## Building

```sh
python3 tools/build.py          # regenerates build/cp1250/, compiles, links
python3 tools/build.py -v       # ...showing every command
```

Flags, and the reason for each, are documented at the top of `tools/build.py`.
Two that are easy to get wrong:

- **`-DBEZ_PROSTREDI=1`**, not a bare `-DBEZ_PROSTREDI`. `Debug/DEBUG.FU:115` tests
  `BEZ_PROSTREDI == 1`, which an empty macro turns into a preprocessor syntax error.
- **`IQPOKYDWINMFC` is not a build flag.** `engine.cpp` defines it to 0. That is what
  selects the author's own console paths — `printf` progress instead of
  `g_handletext1->SetWindowText`, plain `fopen` instead of `GetModuleFileName`.

The build prints ~39 warnings and that is on purpose; `PLAN.md` step 1.3 catalogues
them. Seven are `-Wmaybe-uninitialized`, which is hazard 4 handing us its own list.
