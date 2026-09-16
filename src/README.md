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
runs these files rather than a build of them. Phase 5.1 brought Vite and it consumes
them unchanged — the Vite root is the repository root precisely so that the page can
import them at the same specifiers node and `test/browser.mjs` already use.

| File | What it is |
|---|---|
| `cp1250.ts` | The codec. The full 256-entry CP1250 table and both directions across it, and the only place in the project where a byte becomes a character or the reverse. `pokyd_api.h` says every `char *` crossing the API is CP1250 and has to stay CP1250; this is the one door in that wall. |
| `protocol.ts` | The vocabulary of the worker boundary: twelve requests mirroring `pokyd_api.h` one for one, the reply union, and `PokydSettings`. Types only — nothing in it survives to runtime except the phase constants. |
| `engine.ts` | `PokydEngine`, the wasm module driven from JavaScript: the malloc/copy/free dance, the 220-byte settings struct, and the codec applied at every crossing. Transport-free on purpose — no `self`, no DOM — which is what lets node test it without a Worker. It also enforces the ordering rules `pokyd_api.h` only states. |
| `worker.ts` | The engine on its own thread. A strict FIFO queue, the throttled output relay, and errors turned into rejected replies. Thin: everything else is in the two files above. |
| `client.ts` | `PokydClient`, the page's half — one awaitable method per request, plus `start()`, which is the ordering rules expressed once so no caller has to remember them. |
| `cache.ts` | Phase 4.4: the 18 MB `SLOVNIK.TMP` kept in IndexedDB between visits, keyed by a hash of the dictionary the engine is actually holding. `startCached()` is `start()` with the lookup and the save inserted at the two places `pokyd_api.h` allows them. A storage failure is never a load failure — it costs fifteen seconds and a line in the report. |
| `progress.ts` | Phase 4.3: `PokydLoadingTracker`, the state machine that turns the engine's console into a loading bar — nine steps, the author's own captions, and weights from the measured cost of each. No DOM and no worker, so node tests all of it. |
| `loading.ts` | The loading window itself: `IDD_NACITANI` as an element, and `mountLoading(parent, client)`, which is a caption, a bar and a percentage attached to a client in one call. |

The worker is the point of phase 4.2, not a refinement of it. 3.4 measured
`pokyd_load_dictionaries()` at 15.3 s in Chrome, as **one synchronous call**: on the
main thread that is a page that does not repaint, scroll or answer the mouse for a
quarter of a minute. Measured through the worker, the longest the main thread was
kept waiting across the whole of that load is **12 ms**, and 902 animation frames
were drawn during it.

**`pokyd_progress()` is dead through the step that takes the time.** The assignment that
would move it through the inflection loop is `SLOVNIK.FU:3318`, behind
`#if IQPOKYDWINMFC == 1`, so a `BEZ_PROSTREDI` build never compiles it. The author
reported that step to the console instead, and Emscripten hands those characters to a JS
callback *synchronously, from inside the call that has not returned*. So the progress
signal is the engine's own output, decoded from CP1250 and relayed as `output` events.
`PROGRESS` at the foot of `protocol.ts` has the argument and the measurements.

Phase 4.3 then read that output properly and corrected two things everything above had
been assuming. **The fourteen-second step is the sort, not the inflection loop** —
`ROZSKLONUJ_PODLE_SPRAVNEHO_VZORU` takes 1.0 s and `SETRID_SLOVA_V_DATABAZI` 12.4 s, and
the sort prints a percentage of its own at `SLOVNIK.FU:2322`, 392,699 of them, very
nearly linear in time. And **the engine's captions are CP852, not CP1250**: they go out
through `NAPIS_TEXT_V_LATIN_2`, so `Skloňuji...` arrives as `Skloĺuji...`. `progress.ts`
matches them as the bytes they are and displays the author's own window text instead.

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

## `src/app/` — the page

Phase 5.1 onward: the exhibit, and the first code in this repository that a
visitor rather than a test ever runs. Eleven files and a directory of pictures,
two of them generated.

| File | What it is |
|---|---|
| `chat.ts` | `mountChat(parent, options)` — the author's main window: his photograph, his menu, his three headings, and the conversation growing upwards out of the bottom. Four states published on the root element as `data-state`: `loading`, `ready`, `busy`, `failed`. A caller of phase 4 and nothing else: `PokydClient` for the worker, `startCached` for the eighteen megabytes, `mountLoading` for the fifteen seconds. |
| `main.ts` | What `index.html` runs, and the only file here that needs Vite: where the worker chunk ended up (`?worker&url`), where the engine was emitted, and what the query string asked for. |
| `chat.css` | Phase 6.3, and **one rule in it is a decision** — every measurement and every colour is a custom property `chat.ts` sets from `resources.ts`, so a colour that moves in `PROSTRED.PR` moves on the page, and the exception is the transcript's `overflow-y`, which phase 6.5 turned from his `hidden` into `auto`. The file's header argues it. |
| `menu.ts` | Phase 6.3. `IDR_MENU` drawn — two popups, the accelerator text, the seven gutter bitmaps, and the right-justified caption. Anything with no handler yet is `MF_GRAYED` rather than silent. Since 7.1 it also binds `IDR_ZKRATKY`, by the same rule: four of those commands (F7, F8 and the two with Ctrl) are in no menu at all. |
| `caption.ts` | Phase 6.3, and one of the three files here that spell Czech by hand: `ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI` builds the status line with `strcat` out of two switches, so there is no resource to read its fourteen words from. `node test/app/caption.test.ts` finds every one of them in `PROSTRED.FU` as CP1250 bytes. |
| `greeting.ts` | Phase 6.4, and the second: `NAPIS_UVODNI_UVITANI`'s ten greetings, three of them inflected for the two `pohlavi`, plus the `rand()%10` that picks between them. `node test/app/greeting.test.ts` parses his switch back out of `PROSTRED.FU` and compares it part for part. |
| `dialog.ts` | Phase 7.1. `IDD_NASTAVENI` drawn — the list boxes, the radios, the name edits, and a frame of ours around them. Unlike the main window, **the layout of this one is entirely the resource script's**: a modal dialog is laid out by `MapDialogRect` and nothing moves afterwards, so there is not one measurement in the file. `DROPPED` is the one cut: the second page and the two buttons that switched to it are not drawn, and the reason for each control is written there. |
| `settings.ts` | Phase 7.1, and the third file here that spells Czech by hand — four strings `Nastaveni.cpp` holds as literals. `CNastaveni` with the window taken off: his `OnInitDialog`, his `OnOK`, `ZKONTROLUJ_SPRAVNOST_ZNAKU_VE_JMENE`, and the two lists of control ids his two pages showed (the second of which `dialog.ts` no longer draws). `node test/app/settings.test.ts` parses all of it back out of `Nastaveni.cpp` and compares. |
| `config.ts` | Phase 7.3. `IQPOKYD.CFG` — `ZAPIS_NASTAVENI_DO_SOUBORU` and `PRECTI_NASTAVENI_ZE_SOUBORU`, written to and read from `localStorage` under his own file name. **The stored settings are his file and not JSON**, which is what gives the format a specification instead of a schema of ours; his three return values and every one of his refusals are kept. |
| `dlu.ts` | Phase 6.3. `MapDialogRect`'s base units, measured off the face the visitor actually got rather than the one the author had — which is what puts a fallback font on his 20 pixels. |
| `assets.ts` | Phase 6.2, and **generated**: one Vite import per file in `assets/`, and `BITMAP_ASSETS` / `ICON_ASSETS` keyed by the author's own symbol, with the pixel size of each. Import the URL from here; never build one by hand, or a fingerprinted deploy will hand the visitor a 404. |
| `assets/` | Phase 6.2, and **generated**: the eleven bitmaps and three icons of `resources.ts`, decoded out of the archive and written as lossless PNG — eighteen files, because each `.ico` holds more than one size. `favicon.ico` beside them is `res/IQPokyd.ico` copied out byte for byte. |
| `resources.ts` | Phase 6.1, and **generated**: `original/IQ Pokyd/!Prostre/IQPokyd.rc` parsed by `tools/extract-rc.mjs`. Six dialogs, the menu, the accelerator table, the version block and the eighteen image files, with the author's strings, ids and geometry. Plus the two things the .rc does not contain — `PALETTE` and `WINDOW_LAYOUT` — which come out of `PROSTRED.PR` and `PROSTRED.FU`. |

**`resources.ts` is committed even though it is generated**, unlike everything
under `build/`: it is what `npm run typecheck` and the browser consume, a change
to the parse should show up as a diff, and `.github/workflows/deploy.yml` does
not have to know the extractor exists. `node tools/extract-rc.mjs` rewrites it,
`--check` says whether it is stale, `--dump` prints the parse readably, and
`node test/app/resources.test.ts` re-runs the parse in memory and fails if the
committed file has drifted — so "generated" cannot quietly become "hand-edited".

**`assets.ts` and `assets/` are committed on the same terms**, and regenerated the
same way: `node tools/extract-assets.mjs`, `--check` for staleness, `--dump` for the
sizes. What guards them is stronger than a diff, because a PNG is not readable as
one: `node test/app/assets.test.ts` decodes all eighteen with a decoder of its own
and compares them with `original/` **pixel for pixel, alpha included**. It is not a
byte comparison on purpose — a different zlib deflates the same image differently,
and CI would fail a test nothing was wrong with. That file's header says what else
it checks; the extractor's says why the output is lossless indexed PNG and not WebP,
and why one path in the `.rc` has to be resolved case-insensitively.

Three things the resource script does **not** say, all of which phase 6.1 had to
go and find, and all of which are written down in that file's header:

- **The main window's layout is not in `IQPokyd.rc`.** `IDD_HLAVNI_OKNO` has
  eight controls and none of them is the conversation. The transcript is a
  hundred `STATIC` children created at runtime by
  `PREFORMATUJ_TEXTY_CLOVEKA_A_POCITACE_NA_OBRAZOVCE` (`PROSTRED.FU:904`),
  bottom-anchored and growing upwards, with no scrollbar — what does not fit is
  not drawn (`:962`), and **the port keeps all of that except the last clause**;
  see phase 6.5 below. The eight controls that *are* in the template get repositioned by
  `PREKRESLI_PRVKY_V_OKNE_PRI_ZMENE_VELIKOSTI` (`PROSTRED.FU:1022`) the first
  time the window is sized, so the template gives the inventory and the initial
  size and `PROSTRED.FU` gives the layout.
- **The colours are `COLORREF`s, which are `0x00BBGGRR`.** `g_barvatextucloveka`
  is written `0x0057FFFF` and is **yellow**; read as `#RRGGBB` it would be sky
  blue. All six are converted once in `PALETTE` and checked against
  `prostred.pr` by the test.
- **Dialog units are not pixels**, and the base units are a property of the
  font on the machine drawing the dialog rather than anything in the script.
  `dluToPx(rect, base)` takes them as an argument for that reason.

Three things in it are worth knowing before changing any of them.

- **The app seeds the engine, and it has to.** `pokyd_seed` is `srand`, and the
  original called it twice — `mfcDlg.cpp:363` at startup and `PROSTRED.FU:307`
  again, where the greeting is drawn. A cold load reseeds from the clock
  on its way out (`SLOVNIK.FU:1732`) but **a warm one from the cache never seeds at
  all**, so without `Math.floor(Date.now() / 1000)` in `chat.ts` every returning
  visitor would get the same conversation, word for word, forever.
- **The welcome line is not drawn from the engine's `rand()`, and never was.**
  `NAPIS_UVODNI_UVITANI` ran *before* `NactiSlovniky()` (`mfcDlg.cpp:443`) and
  reseeded on the way in, and a cold load then reseeded again on the way out — so
  its draw was never part of the conversation's sequence. `greetingIndex()` in
  `greeting.ts` is one draw off a mirror of `src/shim/nahoda.cpp` with the same
  seed, which is both the faithful answer and the one that leaves
  `test/golden/rozhovor.txt` byte for byte where it was.
- **The transcript scrolls, and that is the one thing in the window that is not
  his.** Phase 6.5. `:962` breaks out of the draw loop the moment a sentence
  would cross the top inset, so in 2005 the beginning of a long conversation was
  simply gone and the height of the window was how much history there was. Here
  the box is a scroll container, and what a visitor who drags upwards reaches is
  the hundred of `g_poslednich100vet` — the engine's own forgetting, which is
  kept. Nothing about the resting view moved: `scrollToEnd()` in `chat.ts` pins
  the newest sentence to the bottom after every turn, and
  `test/app/chat.test.mjs` measures that it is `ROZESTUP` above the floor exactly
  as `:946` puts it. Two mechanics are worth knowing before touching the rule:
  the stack is bottom-aligned with `margin-block-start: auto` on the oldest turn
  rather than `justify-content: flex-end`, because flex-end puts a scroll
  container's overflow past the start edge where no browser will let you reach
  it; and `scrollbar-gutter: stable` is there because the author reserved fifteen
  pixels off the wrap width (`:856`) precisely so lines would not re-wrap, and a
  scrollbar appearing mid-conversation would re-wrap every line above it.
- **`workerUrl` and `moduleUrl` are required, with no defaults.** A default would
  have to be spelled `new URL("../web/worker.ts", import.meta.url)`, and Vite
  rewrites exactly that expression at build time into an emitted asset — so the
  bundle would carry a second, unbundled copy of the worker and of the 137 KB
  Emscripten glue, whether or not anything ever loaded them. Measured: it did.
- **The query string is a developer's door, not a feature.** `?seed=` pins the
  conversation to one `rand()` sequence, which is how `test/app/chat.test.mjs`
  compares a page against a transcript recorded from a console; `?mood=` sets
  `nalada` 1..5; `?cache=no` and `?cache=rebuild` get at the fifteen seconds phase
  4.4 makes disappear; `?bezpozadi` is the author's own switch. Since phase 7.1
  the settings are a dialog, and `?bezpozadi` now sets the *setting* rather than
  the page, which is how the switch and the window stay agreed —
  `ROZEBER_PRIKAZOVY_RADEK` ran before the settings file was read for the same
  reason (`SLOVNIK.FU:2033`). It is also the only door left to it: the checkbox
  was on the dialog page phase 7.1 drops.
- **The settings live in the engine, and the page reads them back.** There is no
  copy of `g_nastaveni` on this side. A change goes `setSettings` →
  `refreshCaption` → the window, so the menu's status line, the black background
  and the two edge bars are all the engine's own struct on the screen. It is also
  why `pokyd_set_mood` is a call of its own: `pokyd_set_settings` copies
  `naladabody` verbatim, and only `set_mood` recomputes it from `nalada`, which is
  what stops an OK on a name from throwing away twenty sentences of drift
  (`Nastaveni.cpp:166`).
- **A first visit opens the settings dialog, as it did in 2005.**
  `PRECTI_NASTAVENI_ZE_SOUBORU` returning 0 or 2 set `g_zobrazitnastaveni`, and
  the background thread sent the window `ID_NASTAVENI` (`PROSTRED.FU:498`). That
  thread is in `Aplikace/Prostred/`, which `BEZ_PROSTREDI` drops whole, so the
  load calls `openSettings` itself — after the welcome line, which is where the
  message pump would have got to it. A visitor who has been here before has a
  file that reads and is not asked again: the same rule per browser profile that
  it was per installation. What is not ported with it is the `MessageBox` a
  *broken* file also got, which was another of that thread's `hlasky`;
  `configStatus()` on the handle is what still tells a 0 from a 2.

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

## The web app: Vite, TypeScript, npm

Phase 5.1 is where this repository grew a `package.json`, and it grew exactly two
dependencies: `vite` and `typescript` (plus `@types/node`, which is what lets the
one `tsconfig.json` cover the node tests as well as the browser code). Nothing is
bundled at runtime that was not already here.

```sh
npm install
npm run dev          # http://localhost:5173, the page against src/ as it stands
npm run build        # dist/, what phase 5.3 deploys
npm run preview      # serve that dist/
npm run typecheck    # tsc --noEmit over src/ and test/
npm test             # every test in the repository -- test/run.mjs
```

`vite.config.ts` is short and two things in it are load-bearing:

- **`build/wasm/pokyd.mjs` and `pokyd.wasm` are served and emitted verbatim**, by a
  plugin, under `<base>/pokyd/`. They are generated and gitignored, so they cannot
  live in the source tree; they must stay in one directory, because the Emscripten
  glue finds the binary with `new URL('pokyd.wasm', import.meta.url)`; and neither
  may be transformed as a module, because the worker loads the glue by a runtime
  URL that Vite is told to leave alone (`@vite-ignore`, `src/web/worker.ts:115`).
  A missing file fails the build with the `tools/build.py --wasm` command in the
  error.
- **`worker: { format: "es" }`**, because `src/web/worker.ts` is started with
  `{ type: "module" }` and imports the glue dynamically. An IIFE worker could do
  neither.

`base` is `"./"`, so the built page runs from a subdirectory as happily as from
the root of a domain. Phase 5.3 needs that, and it is live on it:
<https://timichal.github.io/pokyd/> is a GitHub Pages project page in a
subdirectory. `.github/workflows/deploy.yml` builds the
whole chain from source on a Linux runner — rule compiler, rule base, Emscripten,
Vite — because nothing compiled is committed here. `npm test -- --quick` runs before
the upload, so a build that stopped reproducing `test/golden/rozhovor.txt` does not
get published.
