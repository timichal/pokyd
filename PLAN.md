# Porting IQ Pokyd 0.15 to the web

A working plan, spanning multiple sessions. Check items off as they land.

**Goal:** a faithful, browser-playable recreation of IQ Pokyd 0.15 — a museum piece,
not a fork. Same engine, same answers, same look, running at a URL.

---

## Status

**Phase:** 9 — ship — **is complete, 9.0 through 9.4, and so is the port.** A Czech
Windows program from 2005 holds a conversation in a browser at
<https://timichal.github.io/pokyd/>, and 9.4 checked it there rather than locally: the
deployed page, driven through all 23 sentences of `test/golden/rozhovor.in`, answers
with `test/golden/rozhovor.txt` **byte for byte** — the same transcript the native
MinGW build printed at phase 1.6, now out of a Linux-built wasm module in Chrome. The
mobile layout renders at 390×844 with nothing overflowing (9.3), and the two documents
this repository was missing are written: `README.md`, which says what this is, whose it
is, what changed and why, and reproduces `original/info.txt` in full (9.1), with the
licensing note in it (9.2) describing the GPL-plus-no-commercial-use contradiction
rather than pretending to resolve it.

9.0 was the exhibit saying what it is on the two screens a visitor would ask it on:
*Informace o verzi* opens with a 2026 preface above the author's own note, and *O
programu* has an **Upozornění 2026** box with a link to the source where
`http://iqpokyd.kyblsoft.cz` and `iqpokyd@kyblsoft.cz` used to sit. Both are
`src/app/exhibit.ts`, which is the only file in this port that writes Czech of its own
and the second place — after `exhibitMenu` — that it changes anything of his.
`versionText` is untouched and still holds against `mfcDlg.cpp` character for character;
`exhibitAbout` is arithmetic over his own rectangles, 50 checks in
`test/app/exhibit.test.ts` and a real-browser measurement of the new caption against the
box it was given in `test/app/chat.test.mjs`, now **371 checks**. `npm test` is 18 of 18.

**Phase 8** — extras — **is complete, and two of its four items are the decision not to
build them.** 8.1 and 8.3 are dropped: the conversation log has nothing to write to and
nothing left to promise, so `IDC_UKLADATROZHOVOR` came off the settings dialog with it,
and the attribution page was already on the screen twice over once 8.2 landed. What is
built is **8.2 — the help, version and about screens, and the menu merged around them** —
and **8.4, the cheat panel, drawn whole.**

The menu is the visible half. `exhibitMenu` (`src/app/caption.ts`) is **the one place
this port rearranges the author's own menu**: `ID_KONEC`, `ID_NAPOVEDA_INTERNET` and
`ID_VELKANAPOVEDA` are dropped — a window a page does not own, a URL that has not
answered in twenty years, and a `CTI_ME.HTM` that is not in the archive — and the two
popups that are left become one. **Nothing on the bar is greyed any more**, which closes
the rule 6.3 opened.

The three text screens are **string literals in the source and not the `.HLP` files the
plan named**; `test/app/help.test.ts` reassembles each of them out of the author's own C,
splice for splice, and got all 40 checks on the first run. The cheat panel needed new C:
`pokyd_debug_info` and `pokyd_set_mood_points`, eighteen exported functions now, with a
`static_assert` on one side of the struct and a thrown layout check on the other. Four
tests are new or rewritten — **40 checks** on the help screens, **56** on the cheat
panel, and `test/app/chat.test.mjs` grew from 219 to **355** and still reproduces the
golden conversation byte for byte on both visits.

One fix found by looking at the thing rather than at the tests: `mountText` and
`mountAbout` reported their close to the caller without taking themselves off the page,
so the X did nothing. Every way out of one of his dialogs is one `WM_CLOSE` and now says
so in the code.

**Phase 7** — settings and state — **is complete, 7.1 through 7.5. IQ Pokyd
can be set the way he could be set: his own dialog opens on F4, his own
IQPOKYD.CFG is written next to the page, and the exhibit a visitor comes back to
is the one they left.** The dialog is `src/app/dialog.ts` over
`src/app/settings.ts`, which is CNastaveni with the window taken off; the stored
settings are `src/app/config.ts`, and **they are his file rather than JSON**,
because his format is a specification with a parser already written against it.
Four commands that are in no menu at all — F7, F8 and the two with Ctrl — are
reachable for the first time, which is 7.4 and is the first use the port has made
of the accelerator table. 7.5 is a decision and not a thing built: `PROFIL.IQP`
is **not** ported, because the only moment it was ever written is
`CMfcDlg::OnClose` and a web page has no reliable close. Three tests are new —
**78 checks** on the dialog and **67** on the settings file, both of them parsed
back out of the author's own source, and `test/app/chat.test.mjs` grew to **219**
and still reproduces the golden conversation byte for byte on both visits, now
with the second one starting from the settings file the first one wrote.

It corrected `pohlavi` for the second and last time: the other value is **2**,
not 0, on four witnesses — and it matters, because `VSTUP.FU:1070` writes that
number straight into `Typ_slova::rod`.

**Phase 6** — the retro UI — **is complete, 6.1 through 6.5. The exhibit wears
the author's own window — his photograph, his menu, his colours and his
bottom-anchored conversation — and greets the visitor in it before a word is
typed.** 6.5 answered the two questions it was left holding. The chrome one
answered itself: the page is a *maximized* window, and a maximized window has no
title bar and no desktop, so there was nothing to draw and no XP frame is going
in. The other is **the first and only deliberate deviation in the window**: the
transcript scrolls. `PREFORMATUJ_TEXTY_...`:962 stopped drawing at the top inset,
so in 2005 the beginning of a long conversation was gone; here the box scrolls
back through the hundred sentences `g_poslednich100vet` keeps — the engine's own
forgetting stays, his window's does not. Nothing a visitor *sees* moved:
`scrollToEnd()` pins the newest sentence to the bottom after every turn, so the
resting view is his to the pixel; what changed is only what a drag upwards does.
`test/app/chat.test.mjs` was **123 checks** at the end of phase 6 and still
reproduced the golden conversation byte for byte under them; the "how faithful
should the UI be?" question is closed with phase 6, and phase 7 answered the two
it left about settings the same way.
Phase 5 is complete, 5.1 through 5.3, and
**IQ Pokyd is live at <https://timichal.github.io/pokyd/>.** A twenty-year-old Czech
Windows program holds a conversation in a browser, at a URL, saying byte for byte what
it said in 2005.
Phase 4 is complete, 4.1 through 4.4; phase 3 is complete, 3.1 through 3.4, gate passed
and numbers in; phases 1 and 2 are complete, 1.1–1.6 and 2.1–2.5.
**The engine runs, answers in Czech, and the conversation is on disk.**
`python3 tools/build.py` builds `build/native/pokyd.exe` and lays out `build/run/`;
`build/native/pokyd.exe --data build/run` holds a conversation. The patch set against
the original is two lines in two files, both recorded in `PATCHES.md`.

Measured on the way: cold start **4.5 s** (11,207 base words → **402,252** forms,
37 MB peak working set, a 17.3 MB `SLOVNIK.TMP`), warm start **0.4 s**, and a clean
teardown — zero unfreed blocks after a ten-sentence conversation. That is hazard 5
answered, and answered much more cheaply than it was written.

Hazard 11 is closed too, and cheaply. `src/shim/nahoda.h` takes `rand()`/`srand()` over
from the C runtime and implements the Microsoft CRT's own LCG — the generator the 2005
MFC build actually drew from. Natively it is a *verified* no-op: ucrt64 hands back that
exact sequence, so it costs nothing here and buys 3.3 its byte-for-byte diff. The
23-sentence golden conversation is in `test/golden/`, with a README recording the command
that made it.

Phase 2 then turned out to be one afternoon and two answered questions.
`python3 tools/build-gramatik.py` builds the author's own rule compiler out of
`original/` — no patch, no working copy, it compiles as it stands — recompiles
`GRAMATIK.IQZ`, and decodes both the result and the shipped `IQPOKYD.IQP` the way
`PRECTI_INTELIGENCI_ZE_SOUBORU` does. **The two rule streams are byte-identical**:
182 rules, 1,456 strings, 69,697 bytes, all four checksums verifying. The only
differences in the whole file are the copyright year in the header banner (2005 vs
2004) and the random obfuscation padding, which is reseeded from the clock on every
run by design. So `GRAMATIK.IQZ` in the source drop *is* the source of the shipped
rule base, the 2004/2005 discrepancy is a string literal and nothing more, and the
line-endings worry is settled: CRLF is right, and an LF checkout fails loudly rather
than quietly. Both open questions below are closed. Running the engine against the
rebuilt file reproduces `test/golden/rozhovor.txt` byte for byte.

2.5 then decided to **build the rule base rather than copy it**: `tools/build.py` now
runs `build-gramatik.py` and takes `IQPOKYD.IQP` from `build/gramatik/`. The equivalence
check runs on every build and fails it if the recompiled rules ever stop matching the
author's — which is what makes building from source the safer option rather than the
braver one. The dictionary is the 11,207-word `original/slovnik.iqp` (2.2).

**3.1 is done.** The exported surface is `src/api/pokyd_api.h` — fifteen `extern "C"`
functions and one flat struct, no C++ type in it — implemented in `pokyd_api.cpp`,
which is now the one place that holds `PRIPRAV_GLOBALY`, the loading sequence,
`IQ_POKYDE_ODPOVEZ` and `CMfcDlg::OnNovaveta`. The console driver stopped carrying
its own copies of all four and became a caller, which is what makes `test/golden/`
a test of the API rather than of the driver: the transcript still reproduces byte
for byte, **cold and warm**, and the 18,131,435-byte `SLOVNIK.TMP` the cold path
writes is byte-identical too.

`pokyd_export_cache` / `pokyd_import_cache` are wired to `--export-cache` /
`--import-cache` on the driver so they are exercised rather than merely compiled,
and phase 4.4 already has its answer: exporting the blob and importing it into an
empty data directory turns a **5.6 s cold start into 0.23 s** with the same
transcript to the byte.

Two notes for whoever reads 3.1 next. The file is `.cpp` in `src/api/`, not the
`.c` in `src/engine/` this plan asked for — `engine.h` declares classes, so the
translation unit is C++ whatever it is called, and `src/engine/` is the byte-exact
mirror `transcode.py --check` verifies. And `pokyd_progress()` is the one thing 3.1
could not test: loading is a single synchronous call, so nothing on the calling
thread can watch it. It compiles, it reads `g_procentanacitani`, and **4.3 owns the
question of who does the reading** — see the note under `pokyd_phase` about the
author's 0-50/50-100 subdivision being behind `IQPOKYDWINMFC == 1` and therefore
absent here.

**3.2 is done: the engine compiles to wasm.** `python3 tools/build.py --wasm` produces
`build/wasm/pokyd.mjs` (137 KB) and `pokyd.wasm` (450 KB) — `MODULARIZE`d as
`PokydModule`, all 17 exports present, both data files embedded in MEMFS at `/pokyd/`.
Node v24.20.0 loads it **from any directory with no options**, and `pokyd_init("/pokyd")`
returns 0. Emscripten is 6.0.9, installed at `C:/Program Files/emsdk`, and `build.py`
finds it by absolute path — it is not on `PATH` and does not need to be.

**3.3 is done, and the gate is passed: IQ Pokyd says the same things in a browser
engine that it says natively.** `node test/wasm/smoke.mjs` drives the wasm module
through the 23 sentences of `test/golden/rozhovor.in` and reproduces
`test/golden/rozhovor.txt` **byte for byte, cold and warm**. The cold run also exports
an 18,131,435-byte `SLOVNIK.TMP` that is **byte-identical to the native one** — 18 MB of
obfuscated, checksummed, `rand()`-padded data agreeing across two toolchains, which is a
far stronger statement than the 1,116-byte transcript on its own. Both runs tear down
with zero unfreed blocks. Hazards 1, 4 and 11 are answered by that, on evidence.

It cost one patch to the engine, and it is the one hazard 10 predicted: the cache read's
`FILE *` typo is a use-after-free that MinGW and MSVC hid and Emscripten traps on.
`PATCHES.md` 2 has the argument, the measurements and the author's own evidence that it
is a typo. The patch set is now two lines in two files, and it is still provably
answer-preserving: the native transcript and the native `SLOVNIK.TMP` are unchanged by it.

**3.4 is done, and it decided something.** `python3 tools/bench-native.py` and
`node test/wasm/bench.mjs [--browser]` measure the same bracketed call — the driver grew
a `--time` for it — on all three runtimes. A first visit costs **15.3 s in Chrome**,
3.6× the native 4.30 s, and the load is a *synchronous* call, so that is a frozen tab
rather than a progress bar; a warm start from the cache is **0.11 s**. So **the
`SLOVNIK.TMP` cache is a launch requirement**, which makes 4.4 load-bearing for 5.2, and
4.2 not optional either. Memory turned out unremarkable: 28.3 MB of wasm heap plus
17.4 MB of MEMFS held outside it, **48.7 MB for the whole tab**, against 38.0 MB of
native working set. And the browser bench reproduces the golden transcript byte for byte
in Chrome 152, cold and warm — 5.1's riskiest assumption retired before 5.1 starts.

**4.1 is done, and the web side has its first file.** `src/web/cp1250.ts` is the codec —
256 entries, both directions, no dependencies, and nothing else in the project may turn a
byte into a character. `node test/web/cp1250.test.ts` puts **71 checks** on it and needs
nothing but node, which strips the types itself; at 4.1 there was still no
`package.json`.

The table was not typed out by hand. It is generated from `TextDecoder("windows-1250")`
and cross-checked against Python's `cp1250`, which **agree on all 251 bytes Python
defines**. The five Python leaves undefined — `0x81 0x83 0x88 0x90 0x98` — are the C1
controls here, which is what the Encoding Standard says and what every browser does, and
filling them is what makes the map a **bijection on all 256 values**. That is not
pedantry: `slovnik.iqp` and `IQPOKYD.IQP` use every byte value there is (`0x90` included
— hazard 6 met it in the CP852 tables) and both **round-trip byte for byte**, as do
`GRAMATIK.IQZ` and both golden files. A codec with five holes in it could not have.

That round trip is also why 4.1 closes without an end-to-end run. `rozhovor.in` and
`rozhovor.txt` are exactly the bytes the engine consumes and produces, and decode→encode
returns them unchanged — so on the golden conversation the codec is provably invisible to
the engine. Wiring it to `pokyd_say` is 4.2's plumbing, not a further question about the
codec.

**Two things the round trip cannot settle, because they are decisions and not facts.**
Encoding is total on strings and CP1250 is not, so text the codepage cannot hold has to
become *something*: it becomes `?` (0x3F), which `JELI_PISMENO` rejects, so a stray emoji
arrives as a **word separator** rather than as a foreign letter inside a word — the
failure the tokenizer is built to survive. And input is NFC-normalized first, which is
load-bearing rather than tidy: Apple keyboards hand over decomposed Czech, `c` + U+030C,
and CP1250 has no combining caron, so without it `č` would silently arrive as `c`. Both
are on by default, both have a flag, and a best-fit pass (`ø`→`o`, `æ`→`ae`) sits
between them and the replacement byte — which is also roughly what an MFC `CString`
handed the engine in 2005.

Checked where it will actually run: headless **Chrome 152** returns results identical to
node's on the table, the 256-byte round trip, normalization, best fit and the astral
cases — and Chrome's own `TextDecoder("windows-1250")` agrees with our table on all 256
bytes. The module imports nothing, from node or anywhere, and typechecks clean under
`tsc --strict`.

**4.2 is done, and the tab no longer freezes.** `src/web/worker.ts` runs the engine on
its own thread, `src/web/client.ts` is the page's half, `src/web/protocol.ts` is the
vocabulary between them — twelve requests mirroring `pokyd_api.h` one for one — and
`src/web/engine.ts` is the wasm module driven from JavaScript, transport-free so that
node can test it without a Worker. Measured in Chrome 152: a **15.01 s** cold load
during which the longest the main thread was kept waiting is **12 ms**, with 902
animation frames drawn. That is 3.4's frozen quarter-minute answered.

Both runs reproduce `test/golden/rozhovor.txt` **byte for byte** — through the protocol,
through the client, and through 4.1's codec in both directions, which is the first time
the golden conversation has been held in strings rather than bytes. The cold run's
`SLOVNIK.TMP` is the same 18,131,435 bytes, transferred to the main thread and back into
a second worker. `node test/web/engine.test.ts` puts 33 checks on the same ground in
node; `node test/web/worker.test.mjs` puts 21 on it in a real browser.

**4.3 got its answer here, and it is not the one 3.1 expected.** `pokyd_progress()` is
*dead* through the step that takes the time: `SLOVNIK.FU:3318`, the assignment that would
move it through the fourteen-second inflection loop, is behind `#if IQPOKYDWINMFC == 1`.
Sampled 200-odd times across a real cold load it takes the values 0 and 100 and nothing
in between — so 3.1's predicted "0→100 three times over" does not happen either; there is
no ramp at all. What the author did instead was report that step to the console —
`printf("\r%.1Lf%%", ...)` every tenth word — and **Emscripten hands those characters to
a JS callback synchronously, from inside the call that has not returned**. So the worker
reads them while the load is still running, and the cold load yields 207 usable
percentages. The progress channel is the engine's own output, decoded from CP1250; 4.3
is a regular expression away, not a research project.

One thing found by being the first caller to try it: **`pokyd_shutdown()` aborts if the
load never succeeded.** `Typ_slova::VYMAZ_OBSAH` (`INTELIG.FT:54`) frees twenty pointers
unconditionally and `UVOLNI_X(NULL)` is fatal by design (`SKLONOV.FU:1348`); those
pointers are allocated while the base dictionary is read. Left unguarded — a load that
never happened has nothing to tear down — but now written down in `pokyd_api.h` and
refused by `engine.ts` with the reference.

**4.4 is done, and a second visit is 81× cheaper than the first.** `src/web/cache.ts`
keeps the 18 MB `SLOVNIK.TMP` in IndexedDB, and `startCached()` is the whole visit in one
call — init, settings, lookup, import, load, seed, save — in the order `pokyd_api.h` fixes.
Measured in Chrome 152: a first visit inflects for **14.53 s** and stores 18,131,435 bytes;
a return visit, with its own worker, its own wasm module and its own database connection,
loads in **0.18 s**. Both reproduce `test/golden/rozhovor.txt` byte for byte.

What comes back out of the store is not merely the right length. Hashed on its way out and
compared against the native `build/run/SLOVNIK.TMP`, it is **byte-identical** — 18 MB
through a structured clone and a database, still agreeing with what the MinGW build wrote.

The key is `pokyd/<version>/<dictionary hash>`, and the hash is read out of the module's
own MEMFS rather than assumed: `tools/build.py` embeds the dictionary *inside*
`pokyd.wasm`, so the only copy certainly in use is the one on the far side of the worker.
That cost the protocol its one addition, `dictionaryHash`, which is not an engine call at
all. The hash is FNV-1a 64 and not SHA-256, because `crypto.subtle` exists only in a secure
context and a cache that vanishes silently over plain HTTP is a worse failure than anything
64 bits risks here; it is checked against the published vectors and against Python's own
arithmetic over `original/slovnik.iqp` (`a620640e93e20cf3`).

**What a dictionary hash cannot see is the one thing 4.4 leaves to a human**, and it is
written down at `POKYD_CACHE_VERSION`. `SLOVNIK.TMP` is not a copy of the dictionary, it is
what the *engine* made of it — so a change to the inflection, to the flags, or to
`src/shim/nahoda.h` yields a blob that is wrong and still checksums perfectly, and the
engine would answer out of it all session. Bump that constant when the engine moves, or
pass a deploy id as `version`. It is the only known way left to serve a stale cache.

Storage never fails the load. A database that will not open, a full quota, a record that
came back damaged — each ends with IQ Pokyd loading the slow way and saying exactly the
same things, with the reason in the returned report rather than in an exception.
`node test/web/cache.test.ts` puts **48 checks** on the hash, the key and every one of
those branches in node, against a recording client and a store that fails on demand;
`node test/web/cache.test.mjs` puts **40** on the real thing in Chrome.

**4.3 is done, and it corrected something this plan had been repeating since phase 3.**
`src/web/progress.ts` is the state machine that turns the engine's console into a
loading bar and `src/web/loading.ts` draws it; between them they are the whole of the
loading window, and `mountLoading(document.body, client)` is the whole of using one.

**The fourteen-second step is not the inflection loop.** Sampled unthrottled across a
real cold load — 397,897 segments — `ROZSKLONUJ_PODLE_SPRAVNEHO_VZORU` runs for **1.0 s**
and writes 1,121 of them. The twelve and a half seconds belong to
`SETRID_SLOVA_V_DATABAZI`, the sort that follows, and **the sort prints a percentage of
its own** — `SLOVNIK.FU:2322`, 392,699 segments, rising 0.0 → 100.0 within a point and a
half of a straight line in time, with 82 backward steps of at most 0.1 in the lot. So the
one step that needed a progress bar had one all along, on a channel nobody had read yet.
The whole cold load, measured: 20 ms base dictionary, 1,221 ms inflecting, 12,457 ms
sorting, 241 ms writing, 174 ms reading it back, 6 ms intelligence. A warm load is 182 ms.

**The engine's captions are CP852, and 4.1's codec is right to leave them alone.**
`Skloňuji...` reaches JavaScript as `Skloĺuji...` because `NAPIS_TEXT_V_LATIN_2`
(`VSTUP.FU:1230`) converts to the DOS codepage on the way out — hazard 6's "Latin 2",
met again. `progress.ts` therefore *recognises* those four lines as the bytes they are
and never shows one. What it shows is the author's own text: the five `SetWindowText`
captions from `PROSTRED.FU`, the three from `SLOVNIK.FU`, and `IQPokyd.rc:124`'s
"Spouštím IQ Pokyd..." before the first step has begun.

**`IQPokyd.rc` paid off three phases early.** `IDD_NACITANI` (`:122-132`) is an exact
spec — caption, smooth bordered bar, right-aligned percentage — and
`VLAKNO__PROCENTA_PROGRESU` (`PROSTRED.FU:509-548`) says it is formatted with one decimal
and a **decimal comma**. That is what `loading.ts` draws, and the one thing it deliberately
does not copy is the author's 0–50/50–100 split between inflecting and sorting: against
this engine that bar reaches half way in one second. The weights are the measured ones.

**One change to `src/web/worker.ts`, and it was load-bearing.** The 60 ms throttle was
right for 397,897 percentages and wrong for the eight lines that are not percentages:
three of the four step markers land mid-run and were being dropped, which would have left
the caption on "Načítám základní slovník..." for the whole fifteen seconds. Bare
percentages are throttled now and nothing else is. In Chrome a cold load delivers **233
output events for those 397,897 segments, with all four markers among them.**

`node test/web/progress.test.ts` puts **92 checks** on it in node — a synthetic stream,
then real cold and warm loads — and is where the console output is written down: exactly
eight non-percentage lines per cold load and the markers' exact bytes.
`node test/web/progress.test.mjs` puts **47** on the real thing in Chrome, reading the
loading window back out of the DOM at every change.

**5.1 is done, and the repository has a `package.json` for the first time.** Two
dependencies, `vite` 7.3.6 and `typescript` 5.9.3 — plus `@types/node`, which is what
lets one `tsconfig.json` cover the node tests as well as the browser code. Nothing is
shipped at runtime that was not already here. `npx tsc --noEmit` passes over every
`.ts` in `src/` and `test/`, including the four phase-4 modules, which had never been
checked by anything but their author's intent.

The Vite root is the repository root, deliberately: the page imports `src/web/*.ts` at
the same specifiers node and `test/browser.mjs` already use, so phase 4 is consumed
unchanged rather than copied into an app directory. `index.html` is a mount point and
one module; `src/app/chat.ts` is the whole page — a transcript, a line to type into,
and four states published as `data-state` — and `src/app/main.ts` is the three things
a page cannot know for itself. The build is **612 KB, 450 of it the engine** (185 KB
gzipped), and the visitor's own code is 15.6 KB.

**Two things in 5.1 were not plumbing.** The first: **a warm start never seeds the
engine.** `pokyd_seed` is `srand`, the cold path reseeds from the clock on its way out
(`SLOVNIK.FU:1732`), and a visit that imports the cache runs neither — so without the
`Math.floor(Date.now() / 1000)` in `chat.ts` every returning visitor would have got the
same conversation, word for word, forever. The original called `srand(time(NULL))`
twice, at `mfcDlg.cpp:363` and again at `PROSTRED.FU:307` where the greeting is drawn;
this is that, and 6.4 will want it. Nothing before 5.1 could have noticed: every test
in phases 3 and 4 pins the seed on purpose.

The second: **`new URL(x, import.meta.url)` is not an expression under Vite, it is an
asset declaration.** Written as a default for `workerUrl`/`moduleUrl` it put a second,
unbundled copy of the worker *and* of the 137 KB Emscripten glue into `dist/`, loaded
by nothing. So both are required options with no defaults, and the caller that knows
where the build put things is the one that says — which is `main.ts` for the exhibit
and the page itself for a test. `vite.config.ts` emits the engine pair verbatim under
`<base>/pokyd/`, in one directory because the glue finds its binary with that same
expression, and `base` is `"./"` so a subdirectory deploy needs no rebuild.

**5.2 is done, and it is the milestone this port was for. IQ Pokyd holds the phase 1.6
conversation in a browser, byte for byte, on a first visit and on a second.**
`node test/app/chat.test.mjs` runs `vite build`, serves `dist/` over loopback, and puts
the built `index.html` in an iframe — then types the 23 sentences of
`test/golden/rozhovor.in` into the input and **presses the button**, one at a time,
waiting for `data-state` to come back to `ready`. What it compares against
`test/golden/rozhovor.txt` is the transcript read back out of the DOM and encoded to
CP1250: **1,116 bytes, identical**, on a cold visit and on a warm one. It drives no
client, constructs no worker and knows nothing of the protocol; the only module it
imports is the codec, and only to turn what was on a screen back into bytes.

Measured in Chrome 152: **16.3 s from opening the page to the first typed character**
on a first visit, **0.24 s on the second**, 46 turns on the screen, zero unfreed blocks
either time, and the same `pokyd/1/a620640e93e20cf3` key both times. 48 checks.

Two things it noticed that nothing else had. The author's own words are already on the
page — `IQPokyd.rc:106-115` gives the window's title, the `Tvá věta` beside the input
and the `Řekni` on the button, three phases before 6.1 reads that file properly. And
**the mood drifts**: `nalada` starts at `NASTAV_STANDARDNE`'s 3 and ends those 23
civil sentences at 1, the best of the five (`INTELIG.FU:532`). That is phase 7.2's
subject, now pinned by a test so that a change to it is noticed by something.

`npm test` also means something now: `test/run.mjs` runs all **ten** tests in this
repository in order — `--quick` keeps the six that do not launch a browser — and all
ten pass in a little over two minutes.

**5.3 is done, and phase 5 with it. IQ Pokyd is at
<https://timichal.github.io/pokyd/>.** `.github/workflows/deploy.yml` builds the whole
chain from source on a Linux runner — rule compiler, rule base, Emscripten, Vite — and
publishes `dist/` on every push to `main`. **The golden conversation is the gate**:
`npm test -- --quick` runs before the upload, `test/wasm/smoke.mjs` is in it, and a
Linux build that stopped saying what the 2005 binary said would refuse to deploy.
Hazard 11 is what makes that fair on a second toolchain.

It took four runs to get there, and two of the three failures found things that had
been true since 2005. The first found that `build/` is gitignored, so the
byte-exactness proof had nothing to compare against — `gen-src.py` runs before
`transcode.py --check` now. The second and third are both in the author's own
`GRAMATIK.C`, and neither could have surfaced on MinGW: a **one-byte global overflow**
at `:206` that Ubuntu's default `_FORTIFY_SOURCE` aborts on, and a **`void main(void)`**
at `:180` that returns garbage from a run that succeeded. One is exempted by a compile
flag, the other by not reading a status that never meant anything; in both cases the
rule-base equivalence check is what says so safely — see 5.3.

**6.1 is done, and the headline is what the resource script turned out not to say.**
`node tools/extract-rc.mjs` parses `IQPokyd.rc` — with `src/web/cp1250.ts`, because
a second codec in the pipeline is the thing phase 4.1 exists to prevent — and writes
`src/app/resources.ts`: **6 dialogs, 75 controls, the menu, 14 accelerators, 11
bitmaps, 3 icons** and the version block, with the author's strings, his symbolic ids
and his geometry in the dialog units he wrote them in. `node test/app/resources.test.ts`
puts **82 checks** on it, and the sharpest is the cheapest: **129 of the module's
strings are looked for in the original as runs of CP1250 bytes** and all 129 are
there, so a caption that drifted by one letter or a diacritic lost between the
codepage and a `\uXXXX` escape could not survive this file. The other nine carry an
escape — `\n`, `""`, and the seven menu items that print a shortcut after a tab — and
are checked by hand. Nothing was dropped either: the controls are counted again
straight off the file by a rule the test states itself.

**The main window's layout is not in `IQPokyd.rc`, and 6.3 has to read `PROSTRED.FU`
instead.** `IDD_HLAVNI_OKNO` has eight controls — the input, the button, three
headings, the label and two invisible edge progress bars — and **none of them is the
conversation**. The transcript is a hundred `STATIC` children created at runtime by
`PREFORMATUJ_TEXTY_CLOVEKA_A_POCITACE_NA_OBRAZOVCE` (`PROSTRED.FU:904`), laid out in
pixels against `OKRAJE` (15) and `ROZESTUP` (10), **bottom-anchored and growing
upwards, with no scrollbar** — what does not fit above the top inset is simply not
drawn (`:962`), so the window's height *is* how much history there is. And the eight
controls that are in the template do not stay where it puts them:
`PREKRESLI_PRVKY_V_OKNE_PRI_ZMENE_VELIKOSTI` (`:1022`) re-anchors all of them the
first time the window is sized. The template gives the inventory and the initial
size; `PROSTRED.FU` gives the layout. Both are now in `WINDOW_LAYOUT`, and the test
reads the constants back out of the engine source rather than trusting them.

**The colours are `COLORREF`s and a reader who takes them for `#RRGGBB` gets them
backwards.** `PROSTRED.PR:12-17` is `0x00BBGGRR`: `g_barvatextucloveka` is written
`0x0057FFFF` and is **yellow** (`#ffff57`), not sky blue; the computer answers in
green `#57ff57`, the two side headings are `#90ffff`, the middle title is white, the
rest of the window is `#e0e0e0` on black, and the line you type into is `#090011`.
`PALETTE` converts them once and the test reverses the bytes again from the engine
source, so the two cannot drift apart.

Four smaller things fell out, each of which saves a later phase a search.
**Numeric ids are not unique** — fifteen numbers are shared by more than one symbol,
`IDC_EFEKTPROGRES1` and `IDC_UPLNATOLERANCEPRAVOPISU` are both 1062 — so nothing in
the module is keyed by number. **One image path is in the wrong case**
(`res\POZMALE.BMP` against `res/pozmale.bmp` on disk), which a 2005 Windows
filesystem forgave and a web server will not: 6.2 has to fold it. **Four commands
are reachable only by accelerator** and appear in no menu — F7/F8 for the mood,
Ctrl+F7/Ctrl+F8 for the character — which is phase 7.4's whole list. And **the
about box's own text is not in the .rc either**: the thank-you list and the version
essay are string literals in `mfcDlg.cpp` (`:705-716` and `:823-845`), the latter
written in the `<b>/<u>/<c>/<h>` tag language `NAPIS_FORMATOVANY_TEXT_NAPOVEDY`
(`PROSTRED.FU:1116`) renders into `IDD_TEXT`'s RICHEDIT — 8.2 and 8.3's source.

**6.2 is done, and the whole of the author's artwork is in the repository as PNG.**
`node tools/extract-assets.mjs` reads `BITMAPS` and `ICONS` out of `resources.ts`,
decodes each file out of the archive and writes `src/app/assets/` — **18 files,
1,287,294 bytes of BMP and ICO down to 177,304 of PNG, 86% off** — with
`src/app/assets.ts` as the manifest, one Vite import per file, which is how a
subdirectory deploy gets them fingerprinted and emitted. Proved by building against
it once: all eighteen land in `dist/assets/`, none inlined.

**The claim the test makes is that not one pixel moved, and it checks it pixel by
pixel.** `node test/app/assets.test.ts` decodes every committed PNG with a decoder
written inside the test — its own inflate, its own unfilter, its own CRC — and
compares it with the BMP or ICO it came from, alpha included: **51 checks, under a
second, no browser and no engine.** It is deliberately *not* a byte comparison.
Re-running the extractor and diffing the output would test this machine's zlib, and
a different node on the Linux runner could deflate the same image differently and
fail a test nothing was wrong with. `--check` on the extractor is the byte
comparison and is for this machine only. Three more checks keep the decoder honest
about itself: the geometry of every bitmap is read straight off its
`BITMAPINFOHEADER` here, the AND mask of every icon is read bit by bit and held
against the PNG's alpha, and all 196 pixels of `bmp00001.bmp` are decoded from raw
bits by the test, sharing nothing with the extractor.

**PNG and not WebP, and the reason is not that WebP was hard.** Nothing on this
machine encodes WebP — no Pillow, no `cwebp`, no ImageMagick — and the one encoder
in reach is the headless Chrome already in the toolchain, whose output is a browser
version rather than a function of its input. But the decisive argument is the other
one: **lossy WebP would be the first thing in this port to change what the author
made.** `pozadi-iqpokyd.bmp` is a 900×459 night photograph of bare branches, already
posterised down to **135 colours**, and re-quantising it is exactly the improvement
a museum piece should refuse. An 8-bit *indexed* PNG carries those 135 colours
exactly and costs **161 KB against 1.2 MB**. Two smaller decisions fell out of that
one. Indexed beats truecolour on this archive because most of these images are
palettes (135 colours in a 900×459 frame is not a photograph any more), and the row
filters that help a photograph *hurt* an index — filtering the background adaptively
costs 200 KB where not filtering it at all costs 164 KB. So `encodePng` deflates
five ways and keeps the smallest, which needs no table of rules and no guessing.

**`iqpokyd.ttf` is not a TrueType font, and 6.2 is where that stopped being
believed.** It is 1,332 bytes beginning `MZ`, with a DOS stub that says so — "This
is a TrueType font, not a program" — which makes it a **`.FOT`**: the installation
stub `CreateScalableFontResource` writes, holding a *path* and no glyphs. The path
is `CEARIABI.TTF`, Microsoft's **Arial CE Bold Italic**, and that file is nowhere in
the archive. `font.fon` beside it is not the author's either: it is Microsoft's
`8514SYS.FON`, "Sistem Font (8514) - Hebrew", ©1988-1995. **Neither file is named
anywhere in the source**, and the fonts the program actually asks for are Windows
faces — Trebuchet MS, Garamond, Times New Roman, Courier New, System, Tahoma. So
there is no font to convert; 6.3 writes a `font-family` stack instead, and the two
orphans stay in the archive as what they are, dev-folder leftovers.

Four things worth knowing before 6.3 draws anything. The background is **stretched**
and the sub-window's tile **repeats** — both read off `PROSTRED.FU`, and both are one
CSS declaration each (the 6.3 entry has the line numbers). The ICO masks work and
are not decoration: `IDI_TVAR`'s 135×42 banner has 2,698 of its 5,670 pixels masked
out. **`ico00001.ico`'s 32×32 entry is blank** — 1,024 of 1,024 pixels transparent,
a size the author never drew, so `IDI_TVAR16` means the 16×16 and only that. And
`res\POZMALE.BMP` was worth the fold it got: `resolveInArchive()` resolves the
`.rc`'s Windows spelling against the real directory, which is what lets the Linux
runner build this at all.

**6.3 is done, and IQ Pokyd looks like IQ Pokyd.** `src/app/chat.ts` is the
author's main window now rather than a chat page: the photograph stretched behind
it, IDR_MENU across the top with the live caption on its right, his three
headings, his two text colours, and the conversation growing upwards out of the
bottom of the screen. Three modules are new — `src/app/menu.ts` draws the menu,
`src/app/caption.ts` is the two things about that menu which are not in the
resource script, and `src/app/dlu.ts` is the measuring. `test/app/chat.test.mjs`
grew from 48 checks to **104** and still reproduces `test/golden/rozhovor.txt`
byte for byte, cold and warm; `node test/app/caption.test.ts` puts **25** more on
the status line, in node, in a fifth of a second.

**The window's own numbers are measured, not guessed, and that is what 6.1 left
undone.** `dluToPx` has always needed base units the `.rc` does not contain, and
a LOGFONT's `lfHeight` is a *cell* height when it is positive — `PROSTRED.FU:918`
writes `20` for the conversation and `:951` then counts the whole layout in it.
So `dlu.ts` measures the face the visitor actually got, with a canvas, the way
MapDialogRect measures the face the machine actually had: 52 letters over 26 plus
one, halved. On this machine Trebuchet MS gives base units of 7 x 19 and a cell
ratio of 1.161, so the author's 20-pixel line is a **17.24 px** font — and a
visitor with no Trebuchet MS still gets a 20-pixel line, which is the point of
measuring rather than hard-coding.

**Everything else is a custom property `chat.ts` sets from `resources.ts`**, so
`chat.css` contains almost no numbers of its own and the ones it does each carry
an engine line. PALETTE drives the colours from the page rather than from the
stylesheet, which closes the loop: `test/app/resources.test.ts` reads those
COLORREFs back out of `PROSTRED.PR` and byte-reverses them again, and
`chat.test.mjs` now compares them with `getComputedStyle` on a real turn. A
colour that moved in the engine would move on the page and fail in two places.

**Two CSS declarations turned out to be whole behaviours.** A clipped box with
`justify-content: flex-end` *is* `PREFORMATUJ_TEXTY_...`:944-985 — newest at the
bottom, older ones stacking up, and what will not fit above the top inset simply
not drawn (`:962`). There is no scrollbar, there never was, and the test now
asserts that nothing scrolls in the box or on the page. And `background-size:
100% 100%` on a 900x459 photograph is `PREKRESLI_OBRAZOVKU` (`:827`) reloading
the bitmap at `okno.right x okno.bottom`: the aspect ratio is not kept, and
`cover` would have been the wrong answer quietly. The one place a bitmap *tiles*
is the loading window, because `IDD_NACITANI` is a sub-window and
`Nacitani.cpp:77` paints it with `g_stetecpozadipodokna` — `IDB_POZADIMALE`
through `CreatePatternBrush`. Phase 4.3's loading dialog was built to be
restyled by six custom properties and it was; it now sits in the middle of the
window on the author's grey noise.

**The caption is live, and the test proves it with the mood drift 5.2 already
measured.** `settingsCaption` is `ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI`
(`PROSTRED.FU:249`) and runs after every answer, so the same 23 sentences that
take `nalada` from 3 to 1 take the menu bar from `muž x muž, průměrný: normální`
to `muž x muž, průměrný: výborná` — checked at both ends, and checked to be
different. `caption.test.ts` parses the two switches out of `PROSTRED.FU` case by
case and holds all fourteen words against them **in the author's order**, as runs
of CP1250 bytes, and does the same to the seven `SetMenuItemBitmaps` pairings in
`mfcDlg.cpp`. Only `caption.ts` spells any Czech at all, and
`resources.test.ts` now fails if another phase-6 module starts to.

**It corrected a comment this port had been repeating since 3.1: `pohlavi` 1 is
male, not female.** `pokyd_settings.human_gender` said "0 male, 1 female" and the
engine disagrees in three places — `PROSTRED.FU:255` and `:263` print `muž` on
`== 1`, `:302` gives the masculine `přišel` on `== 1`, and `SLOVNIK.FU:2091`
writes `== 1 ? "muz" : "zena"` into the debug dump. `NASTAV_STANDARDNE`'s default
is 1, with `muži` in the margin. No code ever read the comment — 5.2's own check
asserts the default is 1 and calls it "the default" — but 7.1 is a settings
dialog with two gender controls in it and would have got them backwards. Fixed in
`pokyd_api.h` and `protocol.ts`, with the evidence in `caption.ts`.

**A menu item with nothing behind it is greyed, not silent.** Everything IDR_MENU
reaches belongs to phases 7 and 8, so `mountMenu` takes a map from the author's
symbolic ids to handlers and draws anything missing MF_GRAYED; a phase that lands
adds a key. The one command 6.3 can honour is `ID_NAPOVEDA_INTERNET`, which is a
URL (`mfcDlg.cpp:1005`), and the test asserts that it is the only enabled one —
so the day 7.1 lands, that line is what says so.

Two smaller things fell out. `prikaz_nezobrazovatpozadi` is now `?bezpozadi` on
the query string, spelled the way `ROZEBER_PRIKAZOVY_RADEK` spells it, and the
CSS is built around it as the 6.2 note asked: no photograph, no tile, a white
edit with black text (`mfcDlg.cpp:919`, `PROSTRED.FU:343`). And `chat.ts` stopped
carrying hand-copied strings altogether — the title, the label and the button are
read off `IDD_HLAVNI_OKNO`, which is what 6.1 built the module for.

**What 6.3 deliberately did not settle is 6.5's question**, and it is sharper now
that there is something running: the window forgets. There is no scrollbar
because there never was one, so a long conversation's beginning is gone. Faithful,
and a real loss on the web.

**Next action:** 6.4 — the welcome line. `NAPIS_UVODNI_UVITANI`
(`PROSTRED.FU:298-317`) picks one of ten greetings and inflects three of them for
both genders, and it calls `srand(time(NULL))` itself at `:307` — which is the
second of the two reseeds 5.1 already had to reproduce by hand, so the two need
reading together.

---

## Toolchain on this machine

Re-probed 2026-09-15 on a **second machine**, and the results carry over: `gcc`/`g++`
MinGW-W64 16.1.0 (ucrt64) is identical, `node` v24.20.0 is present (new — Phase 3.3 has
its smoke-test runner). The one difference is Python. **Use `python3`, not `python`.**
On this machine `python3` is 3.14.7 as before, but bare `python` resolves to a miniforge
3.12.7 that is first on `PATH`. The tools are stdlib-only and work under both, but the
commands throughout this file say `python3` so the recorded toolchain is the one actually
used.

**`npm` 12.0.2 ships with that node, and as of 5.1 the repository uses it.**
`npm install` brings `vite` 7.3.6, `typescript` 5.9.3 and `@types/node`, and nothing
else — 16 packages. One warning is expected and harmless: npm 12 blocks `esbuild`'s
postinstall script, and it is not needed, because the platform binary arrives as the
optional `@esbuild/win32-x64` dependency anyway. `npm run dev`, `build`, `preview`,
`typecheck` and `test` are the whole of the interface; `src/README.md` has the table.

**Chrome 152 is here too**, at the usual `C:/Program Files/Google/Chrome/`, and as of 3.4
it is part of the toolchain rather than a browser that happens to be installed:
`node test/wasm/bench.mjs --browser` launches it headless against a loopback server and
takes the results back over HTTP. It looks for Edge in the same list — both are on this
machine — and needs no driver, no puppeteer and nothing out of `node_modules`. It
predates the `package.json` 5.1 brought and is unaffected by it: the browser tests
still run on a plain `node`.

**`emcc` 6.0.9 is installed**, as of 3.2, at `C:/Program Files/emsdk` — the emsdk default
on Windows. It is **not activated and not on `PATH`**, deliberately, and nothing needs it to
be: `tools/build.py --wasm` finds it by absolute path (see 3.2 for the search order and the
two environment variables the location forces). Sourcing `emsdk_env` would also put emsdk's
bundled node 24.19.0 ahead of the system 24.20.0 that 3.3 runs on, which is a divergence
nobody wants to debug.

Still **no `clang`, no `cl`** other than emsdk's own. Phase 1 targets MinGW g++, and the two
disagree on hazard 1 (`char` signedness) by default — which is why `-fsigned-char` is written
down in `tools/build.py` rather than assumed. As of 1.3 the engine builds clean on that g++;
as of 3.2 it compiles on emsdk's clang too, with a different warning inventory (see 3.3).

## Conventions

- **Never commit.** Michal commits everything himself. Leave changes in the working tree.
- `original/` is read-only. It is the archive. Never edit files in it; copy out instead.
- **`src/engine/` is the canonical source tree** (UTF-8). Edit there and nowhere else.
  Everything under `build/` is generated and gitignored — `build/src/` is the CP1250
  mirror of `original/`, `build/cp1250/` is what the compiler is actually pointed at.
  So are `dist/` and `node_modules/`, as of 5.1: `npm run build` writes the first and
  `npm install` the second, and neither is ever edited or committed.
- Original sources are **CP1250**, uniformly — see hazard 6, the "Latin 2" is data, not
  a second source encoding. Anything new we write is UTF-8.
- The engine speaks CP1250 bytes internally, end to end. Convert **only** at the JS boundary.
- Line endings are CRLF everywhere and `.gitattributes` pins them. The byte-exactness
  proof in `transcode.py --check` compares files on disk, so a clone that checked out LF
  would fail it.
- **Everything we write is in English** — identifiers, comments, test labels, the lot.
  The Czech naming of 2005 belongs to `src/engine/`, which is a byte-exact mirror of the
  original and keeps it; nothing on our side of the line inherits it. Where one of our
  names does mirror the author's — a `pokyd_settings` field, a `POKYD_PHASE_*` constant —
  it gets an English name and carries his in a comment on the same line, which is what
  keeps the two diffable by eye. Two deliberate exceptions, both because they *are* the
  author's code and not ours: `PRIPRAV_GLOBALY` and `IQ_POKYDE_ODPOVEZ` in
  `src/api/pokyd_api.cpp`, transplanted verbatim out of the files `BEZ_PROSTREDI` removes,
  and the `src/shim/` filenames (`nahoda.h`, `prostredi.h`, `tridy.h`), which are where
  `!Prostre/` put the things they replace. Our own C functions are lower case, so a
  SHOUTING name in our code is always a call into the engine.
- **Two commands say whether the engine still answers the way it did.** The native one is
  in `test/golden/README.md`; the wasm one is `node test/wasm/smoke.mjs`, which needs
  `python3 tools/build.py --wasm` first and exits non-zero if anything moved. Run both
  after touching `src/engine/`, the build flags, or the shim. The two benches added at 3.4
  — `python3 tools/bench-native.py` and `node test/wasm/bench.mjs [--browser]` — diff the
  same transcript on every run, so they are slower ways of asking the same question and
  never a faster way of avoiding it.
- **Seven more ask about the JS boundary**, and they are not substitutes for the two
  above — run them after touching `src/web/`. `node test/web/cp1250.test.ts` says whether
  the codec still converts CP1250 both ways without losing anything, and never loads the
  engine. `node test/web/engine.test.ts` drives the golden conversation through the codec
  and the wasm module in node (`--no-cold` skips the fifteen-second cold load).
  `node test/web/worker.test.mjs` does the same in headless Chrome, through the worker
  and the message protocol, and is the one that measures whether the main thread stayed
  alive. `node test/web/cache.test.ts` checks the cache key and every branch of
  `startCached` in node, with no engine and no browser, and `node test/web/cache.test.mjs`
  runs the real IndexedDB round trip in Chrome — two visits, and the 18 MB blob hashed
  against the native `SLOVNIK.TMP`. `node test/web/progress.test.ts` holds the loading
  tracker to a real cold load in node and is where the engine's console output is
  written down (`--no-cold` again), and `node test/web/progress.test.mjs` runs the
  worker, the throttle and the loading window in Chrome. Anything under `src/web/` is
  UTF-8, ASCII-only in content, and CRLF like everything else, and it typechecks
  clean under `tsc --strict` — as does everything in `src/app/`.
- **One asks whether the resource script is still what we say it is.**
  `node test/app/resources.test.ts` — phase 6.1, no browser, no engine, a tenth of a
  second. It re-runs `tools/extract-rc.mjs` in memory and fails if the committed
  `src/app/resources.ts` has drifted from it, so run the extractor rather than
  editing that file. It also reads `PALETTE` and `WINDOW_LAYOUT` back out of
  `src/engine/prostred/`, which makes it the one test that notices if the engine's
  colours or margins move.
- **And one asks whether the pictures are still the author's pictures.**
  `node test/app/assets.test.ts` — phase 6.2, no browser, no engine, under a second.
  It decodes all eighteen files in `src/app/assets/` with a PNG decoder of its own
  and compares them with `original/` **pixel for pixel, alpha included**, so a lossy
  re-encode or a dropped mask fails here. Deliberately not a byte comparison: a
  different zlib deflates the same image differently and would fail a test nothing
  was wrong with. `node tools/extract-assets.mjs --check` is the byte comparison, and
  it is for this machine, not for CI. Run the extractor rather than editing
  `src/app/assets.ts` or anything under `src/app/assets/`.
- **And three ask whether the Czech we spell by hand is the author's.** Three
  modules under `src/app/` do, and only three, because in all three places his
  words are string literals inside a function rather than resources.
  `node test/app/caption.test.ts` — phase 6.3, a fifth of a second — holds
  `src/app/caption.ts` against `ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI`, which
  builds the status line's fourteen words with `strcat`: it parses both switches
  back out of `PROSTRED.FU` and compares them case by case, as CP1250 bytes, and
  does the same to the seven `SetMenuItemBitmaps` pairings in `mfcDlg.cpp`.
  `node test/app/greeting.test.ts` — phase 6.4, a tenth of one — does it to
  `src/app/greeting.ts` and `NAPIS_UVODNI_UVITANI`: his ten greetings parsed back
  out of the same file *with his `+`s in them*, both `if`s that inflect the three
  CStrings, the `rand()%10` that picks between them, and the LCG read out of
  `src/shim/nahoda.cpp` so the draw cannot drift from the engine's own.
  `node test/app/settings.test.ts` — phase 7.1, a fifth of a second — does it to
  `src/app/settings.ts` and `!Prostre/Nastaveni.cpp`, and it is the widest of the
  three: **78 checks**, of which the four Czech strings are only the last. It
  parses his twelve `LB_ADDSTRING`s back out of `OnInitDialog`, both
  `ZOBRAZ_NA_DIALOGU_POLICKO` runs out of his two page functions with their 0s
  and 1s, and the `IsDlgButtonChecked` pair that writes `pohlavi`, and it holds
  `checkName` to `ZKONTROLUJ_SPRAVNOST_ZNAKU_VE_JMENE` case by case.
  `node test/app/config.test.ts` — phase 7.3, **67 checks** — is the fourth and
  spells no Czech at all, because his settings file has none: it derives every
  label and every value word from `ZAPIS_NASTAVENI_DO_SOUBORU` and
  `PRECTI_NASTAVENI_ZE_SOUBORU`, checks the writer and the reader name the same
  seventeen parameters in the same order, round-trips every character, mood and
  recursion depth, and breaks the file nine ways to earn each of his refusals.
  `test/app/resources.test.ts` is where the other half lives: it fails if any
  *other* module under `src/app/` starts spelling Czech, in an escape or in UTF-8.
- **And one asks whether the page works**, which since 5.2 is the question that
  matters: `node test/app/chat.test.mjs` builds the app with Vite, drives the built
  `index.html` through the golden conversation in Chrome by typing into it, and
  compares what was on the screen with `test/golden/rozhovor.txt`. Since 6.3 it also
  reads the window back: the colours against PALETTE, the transcript box against
  `WINDOW_LAYOUT`, the menu against `MENUS`, and the live caption at both ends of the
  conversation — which is how the mood drift becomes something a test can see.
  Since 6.4 the first turn on the screen is the welcome line rather than a typed
  sentence, so it is held out of the golden comparison and checked on its own.
  Since 7.1 it also opens IDD_NASTAVENI both ways a visitor can — F4 and the
  menu — checks that the dropped second page is not on it and that the dialog
  lost exactly that page's button row, refuses a two-word name, sets a character
  through it, and presses F7, F8 and Ctrl+F8; and since 7.3 a first visit is
  *met* by that dialog and a second one is not, because the second starts from
  the IQPOKYD.CFG the first wrote — which is the one thing only two visits can
  show. **225 checks**, and the golden transcript still byte for byte under all
  of them.
  **`npm test` runs all fifteen**, in phase order, in a little over two minutes;
  `node test/run.mjs --quick` keeps the eleven that do not launch a browser.
  `npm run typecheck` covers every `.ts` in `src/` and `test/` at once.

---

## What IQ Pokyd actually is

Worth reading once so later sessions don't re-derive it.

Not a pattern-matching chatbot. It is a **Czech morphological engine** plus a rule-based
response generator. Roughly 11,000 lines of engine in `original/IQ Pokyd/Aplikace/`, plus
~1,900 lines of MFC UI in `original/IQ Pokyd/!Prostre/`.

| Module | Lines | What it does |
|---|---|---|
| `Aplikace/Vzory/` | ~6,500 | Declension + conjugation for every Czech paradigm — nouns (pán, hrad, muž, stroj, předseda, soudce, žena, růže, píseň, kost, město, moře, kuře, stavení, …), adjectives (mladý, jarní, matčin, otcův), pronouns, numerals, verbs (nese, bere, maže, peče, umře, tiskne, mine, začne, kryje, kupuje, prosí, trpí, sází, dělá), adverbs. Handles case, number, gender, animacy, person, tense, aspect, negation, imperative, vocative, and colloquial forms (*mladý → mladej*). |
| `Aplikace/Slovnik/` | 3,360 | Reads the base dictionary, then **inflects every word into every form** at startup and builds a sorted table indexed by first-two-letters. This is the "Skloňuji slovník…" progress bar. Result can be cached to `SLOVNIK.TMP`. |
| `Aplikace/Vstup/` | 1,484 | Tokenizes the sentence, looks each word up (with typo tolerance), attaches **all** candidate readings, converts between the attribute string format and the `Typ_slova` class. |
| `Aplikace/Intelig/` | 1,414 | Guesses subject/predicate/object, evaluates the rule language against that analysis, and generates a reply by **re-inflecting words taken from your own sentence**. |
| `Aplikace/Prostred/` | 1,173 | Win32/MFC glue. Guarded by `BEZ_PROSTREDI`. We replace this. |

The personality is emergent, not scripted: **mood** (1–5, výborná→hrozná) and **character**
(stroj, naivní, klidný, průměrný, nedůvěřivý, náladový, výbušný) select which of 7 canned
variants a rule uses, and each matched rule nudges mood for the rest of the conversation.

### Data we have

| File | Size | Status |
|---|---|---|
| `original/slovnik.iqp` | 90 KB | **The full base dictionary — 11,207 words.** Copied from the released binary, not part of the GPL source drop. Decodes clean, checksums verify. |
| `original/IQ Pokyd/Data/ZaklSlov/SLOVNIK.IQP` | 4 KB | The crippled 301-word dictionary from the source drop (author stripped it to "a" words + exceptions). Superseded by the above. |
| `original/IQ Pokyd/Data/Intelig/GRAMATIK.IQZ` | 106 KB | Rule base in **text** form — 182 rules, clean 14-line records. The readable source of truth. |
| `original/IQ Pokyd/Data/Intelig/IQPOKYD.IQP` | 71 KB | Same rules, compiled + obfuscated. **Verified (2.4) to be exactly what `GRAMATIK.C` makes of `GRAMATIK.IQZ`** — all 1,456 strings identical. The header's 1999-**2004** against `GRAMATIK.C`'s 1999-**2005** is a copyright-year literal the author bumped after his last data build, not an older compiler. |

### Rule format (`GRAMATIK.IQZ`)

14-line records. Line 1 = condition, line 2 = mood delta (`+N`/`-N`), lines 3–9 = seven
answer variants, line 10 blank, lines 11–13 reserved ("real-time kecy", unused), line 14 blank.

```
{P@?>2o-jc}j && ({R@5?>2o-jc-c1-vN-nN}j || {R@5?>2o-jc-c2-vN-nN}j) && {S@1>4p}j && o!1   #(ty) (delas) (neco)
+3
Jsem {0p@"činný"2>1p}, co?
To u mě není nic zvláštního.
To víš, já {R@?>c2} {S@1>4p} {0p@"radý"2>1p-T2}.
...
```

Mood picks the window: answer index = `variant(1..3) + mood(1..5) - 1`, so mood 1 draws from
variants 1–3 and mood 5 from 5–7. A 200-entry history stops repeats.

Word slots are `{A@[word]B>C-D}`:
- `A` — slot id `0`–`9`, or `P`/`R`/`S` (subject/predicate/object). Optionally followed by
  `c` (human's gender) or `p` (computer's gender).
- `[word]` — a literal base form in quotes, optional.
- `B` — "vnoření", the part-of-speech nesting path; `?` means "inherit / any".
- `C-D` — attributes, dash-separated.

Condition operators: `j` = matched, `n` = not matched, `&&`/`||`, parens, and scalar tests
against `p` (word count), `o` (is question), `c` (is the human typing nonsense), `h` (is the
sentence positive), `u` (how many sentences so far), `v` (meaning of last reply), `x`
(nothing matched yet), `e`/`y` (genders). `{{...}}` requires *all* readings of a word to match,
`{...}` requires at least one.

### Attribute codes

Derived from `PREVED_ATRIBUT` in `GRAMATIK.C` and the parser in `VSTUP.FU:947+`.
Text form (left) is what `GRAMATIK.IQZ` uses; the single char (right) is what's stored.

| Category | Mapping |
|---|---|
| pád (case) | `1p`–`7p` → `1`–`7` |
| osoba | `0o`,`1o`,`2o`,`3o` → `n`,`o`,`p`,`q` |
| číslo | `jc`→`y`, `mc`→`Y` |
| čas | `c1`–`c5` → `i`,`j`,`k`,`l`,`m` (5 = infinitive, 4 = imperative) |
| rod | `r1`,`r2`,`r3` → `r`,`s`,`t` |
| životnost | `zA`→`Z`, `zN`→`z` |
| číslo předmětu | `jC`→`x`, `mC`→`X` |
| rod předmětu | `R1`,`R2`,`R3` → `a`,`b`,`c` |
| vid | `vN`→`d`, `vD`→`e` |
| tvar | `T0`–`T9` → `A`–`J` |
| přídavek | `P0`–`P9` → `M`–`V` |
| zápor | `nA`→`W`, `nN`→`w` |

### Internal word normalization

`UPRAV_SLOVO_PRO_IQPOKYD` (`Vzory/SKLONOV.FU`) rewrites words into a phonemic form before
anything else touches them: `ch`→`*`, `di`/`dí`/`dě`→`ď`, `ti`/`tí`/`tě`→`ť`, `ni`/`ní`/`ně`→`ň`,
and `bě`/`fě`/`mě`/`pě`/`vě`/`wě` → uppercase `B`/`F`/`M`/`P`/`V`/`W` + `e`. So `abecední` is
stored as `abecedňí`. `ODUPRAV_SLOVO_PRO_IQPOKYD` reverses it on output. The alphabet is 28
letters (`POCET_PISMEN`), with the full dictionary indexed by letter pairs (`28² = 784`).

---

## Architecture decision: compile the original C/C++ to WebAssembly

**Decided.** Emscripten the original engine; write only the UI in TypeScript.

The engine core is already portable C/C++ — MFC appears only in `!Prostre/` and in
`Prostred/PROSTRED.FU`, and the latter is already behind a `BEZ_PROSTREDI` guard the author
used for his own DOS debugging builds. `Aplikace/` is plain C++ with `stdio`/`string`/`malloc`.

Rationale, given the goal is a museum piece we never intend to modify:

- **Fidelity is free.** A hand port would mean reimplementing 6,500 lines of undocumented
  Czech morphological heuristics and then proving 500,000 generated word forms match. Here
  the behaviour is the original's by construction.
- **It is the artifact.** Preserving the 2005 code *is* the point. "Unmaintainable legacy C"
  is not a defect in a museum exhibit.
- **The API surface is tiny.** Load dictionaries → `IQ_POKYDE_ODPOVEZ(sentence)` → read
  `g_odpovedpocitace`, plus a settings struct. A handful of exported functions.
- **CP1250 stops being a problem.** Keeping everything in original bytes internally and
  converting once at the boundary is simpler than deciding what Unicode means for an engine
  that indexes an alphabet of 28 single-byte letters.
- **Emscripten's virtual FS fits.** The engine `fopen`s `SLOVNIK.IQP` / `IQPOKYD.IQP`. Preload
  them into MEMFS and that code needs no changes at all.

Rejected: a TypeScript reimplementation (enormous verification burden, silent divergence),
and swapping in a modern Czech morphology library (different output — a different program).

**Stack:** Emscripten + TypeScript + Vite, deployed as static files. Engine runs in a Web
Worker. No server.

---

## Known hazards

Specific things that will bite. Each has a task attached in the phases below.

1. **`char` signedness.** MSVC6 and Borland default to *signed* `char`; clang targeting wasm
   defaults to *unsigned*. The dictionary checksums, `DEKODOVANY_ZNAK`, and the mood delta
   (`POSLEDNI_ZNAK(dekodovanapodminka)-100` in `INTELIG.FU`) all depend on signed wraparound.
   **Must build with `-fsigned-char`.** Silent corruption otherwise.
2. **Format-string bug with user input.** ~~`POROZUMEJ_VETE_NAPSANE_CLOVEKEM`
   (`VSTUP.FU:774`) does `sprintf(..., slovo)` — the user's own word as a format string.
   Typing `%s` will crash or leak memory.~~ **Fixed in 1.4, but the reasoning above was
   wrong and the correction matters.** `%` never reaches that call: `slovo` is assembled
   character by character at `vstup.fu:751-761` and only bytes `JELI_PISMENO` accepts get
   copied in. Compiled and run over all 256 values, that predicate accepts 181, and every
   accepted byte below 0x80 is `a-zA-Z` or `*`. `%` is 0x25 and is a word *separator*.
   So there was no vulnerability, and `sprintf`→`strcpy` is instead **provably
   behaviour-preserving** — which is why it was safe to apply to a museum piece.

   Two things survive the correction. The safety property is non-local and rests on
   `-fsigned-char`: it is the `pismeno < 0` arm of `JELI_PISMENO` that admits the accented
   CP1250 letters, so under clang's unsigned-`char` default the argument collapses — this
   is hazard 1 with teeth, and Phase 3 is where it bites. And a second instance of the
   same shape does exist and is **not** patched: `printf(novytext)` in
   `NAPIS_TEXT_V_LATIN_2` (`vstup.fu:1235`), which is reachable with user-derived text.
   It is safe for the same reason plus the fact that the CP1250→CP852 conversion only
   rewrites high-bit bytes. Full argument in `PATCHES.md`.
3. **Hardcoded absolute includes.** ~~Every `.IN` file uses `#include "\!IQPokyd\!Zdrojak\..."`
   and `DOS.IN` uses `f:\!iqpokyd\...`.~~ **Solved in 1.1** by `tools/gen-src.py`, which mirrors
   the tree into `build/src/` with those paths rewritten relative. Note that no `-I` flag can
   fix this in place: gcc on Windows reads a leading `\` as "root of the current drive", so the
   path is *absolute* and the include search path is never consulted.
4. **Undefined behaviour under optimization.** Heavy `goto`, globals, fixed buffers, and at
   least one uninitialized read (`nejlepsiodpoved` in `VRAT_CISLO_ODPOVEDI_PODLE_HISTORIE`
   when every variant is in history). Build `-O1 -fno-strict-aliasing -fwrapv` and do not
   reach for `-O2` without re-diffing output.
5. **Startup cost.** ~~Probably a few hundred MB of heap.~~ **Measured in 1.5 and much
   smaller than that.** 11,207 base words inflect into **402,252** forms — against a
   `MAX_POCET_VSECH_SLOV` of 500,000, so the cap has only 20% of headroom and a bigger
   dictionary would hit it — in **4.5 s**, peaking at **37 MB** of working set, and the
   `SLOVNIK.TMP` it leaves behind is **17.3 MB**. Warm start is **0.4 s**. Native x64
   numbers; wasm will differ, but not by the order of magnitude this was budgeted for.
   `ALLOW_MEMORY_GROWTH` still wanted. The mitigation is built in: the engine already
   writes and reads that cache (`ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU` /
   `PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU`), so persisting the blob to IndexedDB skips
   the whole thing — and as of 3.3 the read side of it is no longer held together by luck
   (hazard 10).

   **Closed at 3.4, on both sides, and the two halves of it came out differently.** Memory
   is a non-issue: 28.3 MB of wasm linear memory plus 17.4 MB of MEMFS beside it, 48.7 MB
   for the whole Chrome tab against 38.0 MB of native working set — 1.3×, not an order of
   magnitude. Time is the problem that was hiding behind it. A 4.5 s cold start would have
   been cheap enough to call the cache an optimization, but the browser's first run is
   **15.3 s** against a **0.11 s** warm one, and it is synchronous. So the cache is a
   launch requirement and 4.2's worker is not optional. See 3.4 for the table and for the
   three measurements 4.4 needs.
6. **Source encoding.** ~~Mixed: `VSTUP.FU` fails CP1250 decoding at line 1156, Latin-2
   bytes mixed in.~~ **Investigated in 1.2 and that reading was wrong.** The corpus is
   uniformly CP1250; nothing in it is Latin-2 text. What fails to decode is *data*: 60
   character literals in `PREVED_Z_LATIN_2_NA_WINDOWS_1250` / `PREVED_Z_WINDOWS_1250_NA_LATIN_2`
   are raw byte constants of another codepage, and one of them (`0x90`) is a byte CP1250
   leaves undefined. The author's "Latin 2" is **CP852**, the DOS PC Latin-2 codepage, not
   ISO-8859-2 — all 30 mappings verify against `cp852` exactly. In `src/engine/` those 60
   literals are written `'\xNN'`; everything else is readable Czech.

   The knock-on constraint, and the reason the UTF-8 tree is never compiled: getting CP1250
   *runtime* strings out of a UTF-8 *source* tree needs `-fexec-charset=CP1250`, which gcc
   supports (via iconv) and **Emscripten's clang does not** — its `-fexec-charset` knows only
   UTF-8 and IBM-1047. So the compiler is handed CP1250 bytes instead, regenerated from
   `src/engine/` by `tools/transcode.py --to-cp1250`. No charset flags on any toolchain.
7. **`conio.h`, `_getch`, DOS-isms.** Present in the debug paths. Stub them.
8. **Pre-C++11 string concatenation.** 10 sites write `"text "MACRO" text"` with no space
   (6 in `DEBUG.FU`, 4 in `SLOVNIK.FU`). C++11 reads `"text "MACRO` as a user-defined
   literal. GCC downgrades it to `-Wliteral-suffix` and still concatenates, but don't rely on
   that — **build `-std=gnu++98`**, which is also closer to what MSVC6 gave the original.
   Confirmed in 1.3: under `-std=gnu++98` gcc concatenates all 10 correctly. With `-Wall` it
   still points at them as `-Wc++11-compat` ("requires a space between string literal and
   macro"), which is a note about a future standard, not about this build.

9. **`Aplikace/` is not self-contained.** Found in 1.3. `Vstup/NASTAVEN.TR` describes itself
   as *"soubor s definicí třídy pro nastavení"* and `Intelig/INTELIG.TR` as *"definice tříd
   Typ_slova a Struktura_vety"*, but neither holds a class any more: the author had moved
   all five class bodies into `!Prostre/IQPokyd.h` (lines 43–170) and left forward
   declarations behind. So the GPL source drop's engine tree cannot be compiled from itself —
   `Typ_slova`, `Struktura_vety` and `Nastaveni` have to come back from the MFC header. They
   are recovered verbatim into `src/shim/tridy.h`, which keeps `src/engine/` a byte-exact
   mirror of the original. The other two, `IQPokydWav` (mmsystem) and `RozvrzeniVet`
   (`CString`), are referenced only from `Prostred/` and stay out. One line of the three had
   to change: MSVC6 accepted a member declared `void Typ_slova::ZKOPIRUJ_...` *inside*
   `class Typ_slova`; ISO C++ calls that an extra qualification. Dropping the qualifier
   declares the same member function.

10. **~~The cache path reads a `FILE *` that was already `fclose`d.~~ Closed at 3.3, by
    the one patch this hazard list ever asked for** — `PATCHES.md` 2. Found in 1.5 and
    described then as the most dangerous thing in this list, because it worked.
    `PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU` opens `SLOVNIK.TMP` into `g_uplnyslovnik`,
    then reads its padding-length byte and the padding itself from **`g_zakladnislovnik`**
    (`SLOVNIK.FU:1102-1105`) — the base dictionary, which
    `PRECTI_DATABAZI_SLOV_ZE_ZAKLADNIHO_SLOVNIKU` closed at `:1070`. A plain typo, one
    identifier wrong, on the fast path of every warm start.

    It survives because the C runtime hands the freed `FILE` slot straight back to the
    next `fopen`: measured on this MinGW/UCRT, `fopen`→`fclose`→`fopen` returns *the
    identical pointer*, so `g_zakladnislovnik` and `g_uplnyslovnik` are the same stream
    and the code does what the author meant. MSVC 6 pooled `FILE`s the same way, which is
    why this was never visible.

    That is exactly what happened, at the first wasm run, and the prediction above was
    right about the cause and wrong about two details worth correcting.

    **It did not keep working, and it did not fail silently.** Under Emscripten the
    `FILE` is `malloc`ed, `fclose` frees it, and in the engine's own sequence the next
    `fopen` is *not* served the same block — measured, `0x45780` closed, `0x50b40`
    opened. `getc` on the dangling pointer trapped: `memory access out of bounds` in
    `locking_getc`, on every load that had a cache to read. A minimal
    `fopen`/`fclose`/`fopen` under the same emcc *does* hand the pointer back, so the
    difference is allocator state, not musl policy — which is a good reminder that
    "it works here" was never the property this code needed.

    The fix was the predicted one-identifier patch, twice: `g_zakladnislovnik` →
    `g_uplnyslovnik` at `SLOVNIK.FU:1103` and `:1106`, which is the file those bytes are
    actually in. `PATCHES.md` 2 carries the argument — the writer puts the padding in
    `SLOVNIK.TMP`, `PRECTI_PROFIL_ZE_SOUBORU` is the author's own correct copy of the
    same reader, and the checksum only closes if the bytes come from the cache file.
    Natively it is provably a no-op: same transcript, same 18 MB `SLOVNIK.TMP`.

    **The knock-on constraint is retired.** "Nothing may `fopen` between those two calls"
    was load-bearing for `pokyd_api.cpp`, `pokyd_api.h`, `src/README.md` and the driver;
    all four said so and all four have been corrected. `pokyd_import_cache` is still its
    own call before `pokyd_load_dictionaries`, for the ordinary reason that the load is
    what reads the file.

11. **~~`rand()` is the C runtime's, and the toolchains do not agree.~~ Closed at 1.6,
    by the shim.** `VRAT_CISLO_ODPOVEDI_PODLE_HISTORIE` picks between equally-unheard
    answers with `rand()%pocetabsolutnichvitezu` (`INTELIG.FU:74` and `:111`), which
    happens on most sentences, and `URCI_ZMENU_NALADY` drifts the mood by `(rand()%3)-1`
    (`:532`), so the conversation was a function of the seed *and of whose `rand()` it is*
    — MinGW's LCG and Emscripten's musl would have diverged on the first tie, which
    directly contradicts 3.3's "they must match exactly".

    Of the two ways out — our own `rand` in the shim, or 3.3 comparing per-toolchain and
    losing its sharpest test — the shim won, and it turned out to cost nothing at all.
    `src/shim/nahoda.h` defines `rand()`/`srand()` over `<stdlib.h>` before the engine is
    included and implements **the Microsoft CRT's LCG** (`seed = seed*214013 + 2531011`,
    take bits 16–30) — not an arbitrary generator but the one IQ Pokyd's own MSVC build
    drew from in 2005, which makes this the faithful choice as well as the portable one.
    ucrt64's `rand` *is* that sequence (checked over 2000 draws from each of six seeds),
    so nothing moved natively: the 1.6 golden transcript is byte-identical with the shim
    and without it, and so is the 18,131,435-byte `SLOVNIK.TMP`, whose obfuscator
    (`SLOVNIK.FU:1855-1861`) runs thousands of draws through it. That last one is the
    strong check, and it is worth re-running as a one-liner if the shim is ever touched.

    Two things it does not change. Seeding still has to happen *after* loading:
    `ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU` reseeds from the clock on its way out
    (`SLOVNIK.FU:1732`), so a seed set before a cold start does not survive it — the
    driver seeds last for that reason, and 3.1 must too. And the shim's state is a single
    global, not the CRT's per-thread one; fine for the engine and for the phase 4.2
    worker, but not something to hand two threads.

---

## Open questions

- [x] ~~Does the shipped `IQPOKYD.IQP` match `GRAMATIK.IQZ`?~~ **Yes, exactly.** Task 2.4:
      recompiling `GRAMATIK.IQZ` with the author's own `GRAMATIK.C` reproduces all 1,456
      strings of the shipped rule base byte for byte. Nothing has to win — the only
      differences are the header's copyright year (a string literal, bumped 2004→2005
      after the data was last built) and the deliberately random obfuscation padding.
      Which file *ships* is 2.5, and is now a question of provenance rather than content.
- [x] **Line endings in the archive.** ~~Open.~~ **Answered by 2.4, in the good
      direction**, for the one file where it mattered: `GRAMATIK.IQZ`. The recompiled rule
      base matches the shipped one on all 69,697 bytes of rule text, which it could not do
      if git's CRLF round trip had misplaced a single byte of the input. The `.gitattributes`
      checkout is the author's bytes. The paragraphs below stand as the record of how that
      came to be in doubt, and the five binaries at the end of it are still worth re-adding
      if the original archive ever turns up.

      Every text file in `original/` was first committed
      under `core.autocrlf=true`, so git stores it LF-normalized and checks it out CRLF —
      the true bytes of the source drop are not recoverable from this repo. Harmless for
      source (whitespace), but `GRAMATIK.IQZ` is *data* the rule compiler parses by line, so
      a stray `\r` could land in a field. `.gitattributes` pins the checkout to CRLF so the
      behaviour is at least deterministic everywhere. Task 2.4 settles it for free: if the
      recompiled `IQPOKYD.IQP` matches the shipped one, CRLF was right. If Michal still has
      the original archive, re-adding `original/` under the new attributes would restore the
      true bytes — his call, and his commit.

      **Worse than recorded, and now partly fixed (1.4).** `original/** text eol=crlf`
      applied to *binaries* too, because the binary block under it did not list every
      binary extension in the archive. Five files were getting the CRLF smudge on every
      checkout: `!Prostre/font.fon` (+67 bytes), `res/Thumbs.db` (+86), and the three
      `.OBJ` (+22, +107, +169). Reproduced in a clean clone and fixed by adding
      `*.fon *.obj *.gid *.db` (both cases) to `.gitattributes`; verified by cloning from
      the fixed repo and getting blob-exact bytes and a clean `git status`. The 32 files
      that matter were never affected — `slovnik.iqp`, both `.IQP`s, all 19 bitmaps, the
      TTF, the three `.EXE`s and the `.HLP`/`.GID` all match their blobs byte-for-byte,
      because their extensions were already declared.

      What this does **not** fix is the blobs themselves. Those five were committed
      through the text filter, and CRLF→LF is not injective: a true `0D 0A` and a bare
      `0A` both store as `0A`. Their pre-commit bytes are gone. Only `font.fon` is
      plausibly archive material and it is not in the Phase 6.2 asset list, so nothing
      downstream depends on it — but if the original archive turns up, those five are the
      files to re-add, not just `GRAMATIK.IQZ`.
- [x] ~~How faithful should the UI be?~~ **Answered by phase 6, and the answer is
      "his, to the pixel, with one deviation."** Everything a visitor sees is read
      from the archive — 6.1's `IQPokyd.rc` parse, 6.2's eighteen decoded images,
      the `PROSTRED.PR` colours and the `PROSTRED.FU` layout — and 6.5 recorded
      the single place the web is allowed to differ: the transcript scrolls,
      where his was clipped at the top inset. No window chrome and no XP frame,
      because the page is a maximized window and a maximized window has none. The
      custom TTF turned out not to be a font (6.2), so the font work is a CSS
      stack and not an asset.
- [x] ~~Do we want the debug/cheat panel?~~ **Yes, and it is phase 8.4.** Mood points,
      last subject/predicate/object, the two spelling parameters and his twelve tool
      tips, reached by Ctrl+Shift+Alt+D or by typing `::debuginfo`. `Debug/CHEAT.FU` is
      **not** part of it and is not ported: `VRAT_TEXT_CHEATU_MISA` is a private letter
      XOR-128'd into a string constant, and the only code that ever showed it is
      commented out in `mfcDlg.cpp:573-585` with the author's own note that it was a
      cheat "jen ve verzi 0.1". It was not reachable in 0.15 and it is not made
      reachable here — running an obfuscator over somebody's letter to somebody is not
      the same as publishing it.

---

## Phase 1 — Build the engine natively

The gate for everything else. If `Aplikace/` won't build without MFC on a desktop compiler,
we learn it now and cheaply. Also gives us a reference binary to diff the wasm build against.

- [x] 1.1 **Done** — `tools/gen-src.py` mirrors `original/IQ Pokyd/Aplikace/` into `build/src/`
      (37 files), rewriting the 54 hardcoded includes to relative paths
      (`\!IQPokyd\!Zdrojak\Aplikace\Vzory\sklonov.pr` → `vzory/sklonov.pr`). Names are
      lowercased — the original is inconsistent (`\Aplikace\` vs `\aplikace\`) and only
      worked because Windows is case-insensitive; Emscripten on a case-sensitive host would not
      be. Contents are copied byte-for-byte, still CP1250; verified that the only lines differing
      from the original are the 54 `#include`s. `build/` is generated and gitignored.
      **Gate passed:** `g++ -x c++ -DBEZ_PROSTREDI -E vsechno.in` exits 0, expands 18,806 lines
      across all 26 engine files, zero unresolved includes. `hlavicky.in` likewise. The only
      diagnostics are hazard 8 below. (This is preprocessing only — actual compilation is 1.2–1.4.)
- [x] 1.2 **Done** — `tools/transcode.py` re-encodes between CP1250 and UTF-8 in both
      directions. `src/engine/` (37 files, UTF-8, CRLF, no BOM) is now the canonical tree;
      `--to-cp1250` regenerates `build/cp1250/`, which is what the compiler gets, since the
      UTF-8 tree is deliberately *not* compilable (hazard 6: `case 'č':` would become a
      multi-character literal, and Emscripten's clang has no `-fexec-charset=CP1250`).
      **Gate passed:** `--check` proves `to_cp1250(to_utf8(x)) == x` byte-for-byte for all
      37 files, so the re-encoding changes nothing the compiler can see — it is a
      normalization, not a patch. `diff -r build/src build/cp1250` is empty, and the 1.1
      preprocessing gate gives an identical line count on both trees under identical flags
      (18,784 with `-std=gnu++98`, 18,806 without; that delta is the flag, not the
      transcoding). The only escapes introduced are the 60 CP852 byte constants of hazard 6.
      `.gitattributes` added to pin CRLF, without which the proof breaks on a Linux clone.
      Also confirmed: `-std=gnu++98` silences hazard 8 completely — zero diagnostics.
- [x] 1.3 **Done** — `src/shim/` is the Win32/MFC surface, replaced, and `tools/build.py`
      drives the build. **Gate passed: the engine compiles and links.**
      `build/native/pokyd.exe` is for now a generated link check that prints the size of
      `Nastaveni` (220 B), `g_odpovedpocitace` (201 B) and `Struktura_vety` (6568 B); once
      `src/driver/` exists build.py links that instead. `src/engine/` is untouched —
      `transcode.py --check` still reports the working copy clean, so `PATCHES.md` has
      nothing to say yet.

      The surface turned out smaller than this step assumed, and differently shaped:

      - **`NAPIS_TEXT_V_LATIN_2` needed no stub.** It is real engine code,
        `Vstup/VSTUP.FU:1230`, and does what it says — CP1250 → CP852, then `printf`.
      - **`g_procentanacitani` needed no stub either.** It is not a `Prostred/` global;
        `Slovnik/SLOVNIK.PR:47` defines it and the engine keeps it current whether or not
        anyone is reading. That is what phase 4.3 wires to the loading bar.
      - **`g_handletext1..3` are genuinely gone**, and that is fine: every reference to them
        is under `#if IQPOKYDWINMFC == 1`.
      - What *is* needed from `Prostred/` is two globals whose references sit outside those
        guards — `g_HWNDhlavnihookna` (the MessageBox owner in `NAHLAS_CHYBU`) and
        `g_zavritvlaknoprocesu` (`SLOVNIK.FU:3345`, where the console path tests a cancel
        flag only the MFC path could ever set; inert here, which is what we want).
      - **`NAHLAS_CHYBU` is not stubbed, it is taken as written.** Its switch is guarded by
        `#if IQPOKYDWINMFC == 1 || BEZ_PROSTREDI == 1`, so a `BEZ_PROSTREDI` build gets the
        MessageBox branch. That reads like a slip — "no environment" ought to select the
        console branch below it — but that branch calls a `NAPIS_V_LATIN2` which exists
        nowhere in the corpus and `return`s before its own second half, so it has not been
        compiled in twenty years. We gave `MessageBox` somewhere to go instead (stderr).
      - The one real judgement call: the shim's `MessageBox` returns **`IDCANCEL`**, not
        `IDOK`. 9 of the 11 `_STORNO_` call sites are a `goto ZNOVU` retry loop around an
        out-of-memory or a failed write. With a user at the dialog OK is right — the retry
        usually works. With nobody there it spins forever, so the shim answers "Storno" and
        the process stops at the error instead of hanging on it.
      - `BEZ_PROSTREDI` **must be `=1`**, not a bare define: `DEBUG.FU:115` tests
        `BEZ_PROSTREDI == 1`, and an empty macro makes that line a preprocessor syntax error.
      - `<signal.h>` had to come back — `NAHLAS_CHYBU` calls `raise(SIGABRT)` and used to get
        it from `StdAfx.h`.

      Hazard 9 below, the missing class definitions, is the finding that mattered and is what
      the step actually cost.

      **Warnings: 39, all catalogued, none silenced except formatting.** `-Wall` stays on
      because it is hazard 4's own inventory. 10 `-Wc++11-compat` (hazard 8, benign under
      `gnu++98`); 10 `-Wconversion-null` and 5 `-Wpointer-arith`, every one of them `NULL`
      used as a `BYTE` 0 in `POROVNEJ_MNOZINU_ATRIBUTU_Z_TYPU_SLOVA`, which MSVC6's
      `#define NULL 0` made exact and gcc's `__null` keeps exact; 4 `-Wunused-variable`, 1
      `-Wunused-but-set-variable`, 1 `-Wparentheses`; 1 `-Wchar-subscripts`
      (`INTELIG.FU:611` — a rule slot id 0–9 held in a `char`, worth a second look under
      `-fsigned-char` even though the values cannot go high). And **7
      `-Wmaybe-uninitialized`**, which is hazard 4 naming its own suspects:
      `nejlepsiodpoved` (`INTELIG.FU:119`, exactly as predicted), `poziceps`,
      `poziceprostoru`, `hodnota1`, `hodnota2`, `debuginfoznak`, `vysledek`. Suppressed:
      `-Wno-write-strings` (1588 hits of the pre-ISO `char *p = "literal"`) and
      `-Wno-misleading-indentation` (57 hits of the author's one-space indent style).
- [x] 1.4 **Done** — `src/engine/vstup/vstup.fu:775` is now `strcpy`, and `PATCHES.md`
      exists as the prose half of the audit. The patch set is **one line, −1 byte**;
      `transcode.py --check` names exactly one differing file and `diff -r build/src
      build/cp1250` prints exactly that line, so the two halves agree. The build is
      unchanged in every observable way: 39 warnings in the same seven categories and the
      same counts, same link-check output (220 / 201 / 6568 B).

      The step's own finding is that **hazard 2 was misdiagnosed** — there was never a
      reachable format-string bug, because `%` cannot survive `JELI_PISMENO`. See the
      rewritten hazard 2 above. The patch stands anyway, now justified as provably
      behaviour-preserving rather than as a security fix, which is a stronger footing for
      a museum piece: it cannot change an answer the engine gives.

      Two further findings, both recorded in `PATCHES.md` under "considered and not
      applied", neither patched:
      - `printf(novytext)` in `NAPIS_TEXT_V_LATIN_2` (`vstup.fu:1235`) is the same bug
        shape and *is* reachable with user-derived text (`intelig.fu:146`/`:167` pass a
        re-inflected word from your own sentence). Safe for the same `JELI_PISMENO`
        reason, plus the CP1250→CP852 switch being guarded by `znak < 0` with all 30
        replacement bytes in `0x82..0xFD`. Left alone; `printf("%s", …)` if that ever
        changes.
      - **`vstup.fu:801-809` prints to stdout on every sentence**, unguarded — every
        recognised base form, via `NAPIS_TEXT_V_LATIN_2`. A debug leftover the author
        commented out in the block just below (819-867) but not here. 1.5 and 1.6 have to
        cope with the noise rather than delete it.
- [x] 1.5 **Done — it talks.** `src/driver/pokyd.cpp` loads the dictionaries, reads stdin
      and prints replies; `tools/build.py` links it and lays out `build/run/` (the data
      files copied out of the read-only archive, because the engine writes `SLOVNIK.TMP`
      next to them). `src/engine/` was not touched — `transcode.py --check` still names
      exactly the one 1.4 file — so `PATCHES.md` has nothing new to say.

      ```
      > ahoj
      < Tě péro! Dobře, že se tu zase ukazuješ.
      > jak se máš?
      < Za moc to nestojí, ale nijak si nestěžuju. Co ty?
      ```

      Both warnings above held, and the answers to them are the reusable part:

      - **`IQ_POKYDE_ODPOVEZ` is gone with `Prostred/`**, so the driver carries a verbatim
        copy of `PROSTRED.FU:212`, and the loader is `VLAKNO__NACITEJ_JAK_DIVEJ`
        (`PROSTRED.FU:550`) minus the window. Both were written to be lifted into
        the exported surface as they stand, and 3.1 lifted them: they live in
        `src/api/pokyd_api.cpp` now and the driver calls them.
      - **The pre-processing around the entry point is not optional, and it is not in
        `Prostred/` either** — it is in `CMfcDlg::OnNovaveta` (`mfcDlg.cpp:596-607`):
        `PREVED_NA_MALA_PISMENA` → `UPRAV_DLOUHE_SLOVO_PRO_IQPOKYD` →
        `UPRAV_VETU_PRO_IQPOKYD` → `IQ_POKYDE_ODPOVEZ` → `ODUPRAV_VETU_PRO_IQPOKYD`.
        That is the engine being handed lowercase, phonemically normalized text with
        *ses*/*bych* split into two words. **`pokyd_say` is this whole sequence, not
        `IQ_POKYDE_ODPOVEZ` alone** — dropping any of it changes the answers. Note
        `UPRAV_VETU_PRO_IQPOKYD` frees its argument and returns a new pointer.
      - **`NACTI_A_ROZSKLONUJ_ZAKLADNI_SLOVNIK`'s DOS tail is handled by giving in to
        it.** Under `IQPOKYDWINMFC != 1` it re-reads the base dictionary itself and then
        frees *everything* and checks the block counter, so the driver hands it a clean
        slate (`UVOLNI_VESKEROU_DYNAMICKOU_PAMET` first) and re-loads from the cache it
        just wrote. Left as-is, the first load would leak 11,207 strings past its block
        check and turn it into a fatal `NAHLAS_CHYBU`.
      - The five globals `mfcDlg.cpp:405-418` allocates (`g_aktualnivetacloveka`,
        `g_predchozivetacloveka`, the three `debug_poslední*`) have to exist before
        anything runs and be rebuilt after anything frees them: `UVOLNI_VESKEROU_DYNAMICKOU_PAMET`
        frees all five unconditionally and `UVOLNI_X(NULL)` is fatal.
      - `engine.h` gained three externs the original never needed (`g_odpovedipocitace`,
        `g_idodpovedipocitace`, `g_smyslposlednivetypocitace`): the MFC code never loaded a
        dictionary itself, `PROSTRED.FU` did, from inside the same translation unit.

      And two findings that outlive this step — **hazard 10 below, the `FILE *` the cache
      path reads after closing it**, which is the one to worry about in phase 3; and
      **hazard 5 turning out to be cheap**: 4.5 s and 37 MB, not the minutes and hundreds
      of megabytes it was written up as. Also confirmed empirically, at last: typing
      `%s %d %n %%` comes back as *"S d n? Aha, tak to mi nějak uniklo."* — `%` is a word
      separator and never reaches a format string, which is exactly what 1.4's corrected
      hazard 2 argued on paper.

      The driver itself: `--data DIR` (it `chdir`s, since `OTEVRI_SOUBOR` opens bare names
      in the cwd), `--transcript FILE` for a clean CP1250/CRLF conversation away from the
      `vstup.fu:801-809` noise, `--seed N`, `--character`/`--mood`/`--human`/`--computer`,
      `--state` to watch the mood drift (it does: ten sentences moved it 46 → 20 points).
      The console gets CP852 both ways, because that is what the engine's own `printf`s
      already produce; `--cp1250` turns that off for pipes.
- [x] 1.6 **Milestone: hold a conversation in Czech in a terminal** — **done**, and it
      talks back. 23 sentences in `test/golden/rozhovor.in`, what IQ Pokyd answered in
      `test/golden/rozhovor.txt`, and `test/golden/README.md` records the exact command,
      the settings (`--seed 20050415 --character 3 --mood 3 --human m --computer m`) and
      what must hold for the file to stay valid. Both data files are CP1250 with CRLF and
      `.gitattributes` marks them `-text`, so no checkout can rewrite a byte of the thing
      3.3 diffs against.

      *"Jsi hloupý." → "S tím nic nenaděláš, tak to prostě je."* The mood machinery is
      visibly working — it opens with *"Ahoj, jsem rád, že jsi tu."* and by the end is
      answering *"Tak ty musíš? Hm, to je jiná."*

      **Hazard 11 settled first, as the step required, and it cost nothing.** The shim
      `rand` is in `src/shim/nahoda.h` / `.cpp` and is the Microsoft CRT's LCG; hazard 11
      above has the argument and the verification. Nothing in the engine changed, so
      `PATCHES.md` gains an entry under "considered and not applied", not a patch.

      What was checked, beyond the shim being a no-op: **cold start and warm start produce
      the same transcript** (delete `SLOVNIK.TMP`, run again, `cmp`), which is the driver's
      seed-after-load order paying off; **stderr is empty both ways**, so the block counter
      still balances after a 23-sentence conversation; and the build is still 39 warnings
      in the same seven categories. There is no `PROFIL.IQP` in `build/run/` — if one ever
      appears the answers move, and the golden file is void.

## Phase 2 — Data

- [x] 2.1 Decoder for `slovnik.iqp` — **done**, `tools/dump-dict.py`. Verified against the
      real file: 11,207 words, both checksums pass. `--all` dumps every entry, `-o` writes
      UTF-8 to a file. Confirms the info field: nouns/adjectives carry one paradigm byte
      matching `KONSTANT.K` (`pan:\x01` = `_pan_`, `abeceda:\x07` = `_zena_`,
      `pancéřový:\x1f` = `_mlady_`), verbs carry paradigm + aspect (`žvatlá:J\x01` =
      `_dela_` 74, vid 1). Only needed for inspection — the wasm engine reads the binary
      itself.
- [x] 2.2 Decide which dictionary ships — **`original/slovnik.iqp`, the full 11,207-word
      one, same as the released program used.** Decided; nothing to build. The alternative
      was `Data/ZaklSlov/SLOVNIK.IQP` from the source drop, and it is not a real
      alternative: the author stripped it to 301 words (the `a`-words plus exceptions) so
      the GPL drop would not carry his dictionary. A 301-word IQ Pokyd is not IQ Pokyd —
      most sentences would fall through to the "I don't know that word" rules. So the
      museum piece ships the museum piece's vocabulary. `tools/build.py` already lays it
      out as `build/run/SLOVNIK.IQP` and phase 3.2 preloads the same file.

      The one thing this owes the reader is **provenance**, because it is the single file
      here that did not come from the source drop: it was lifted out of the released
      binary. That belongs in the 9.1 README, alongside the licensing note in 9.2 — the
      dictionary is the part of the archive whose GPL status the author was evidently
      least comfortable with, and the honest thing is to say where it came from rather
      than let it look like source. Noted here so 9.1 cannot forget it.
- [x] 2.3 Build `GRAMATIK.C` as a host tool; recompile `GRAMATIK.IQZ` → `IQPOKYD.IQP`.
      **Done — `python3 tools/build-gramatik.py`.** It needed no patch: the author's rule
      compiler builds on this gcc exactly as it sits in `original/`, six warnings and no
      errors, so there is no working copy of it under `src/` and nothing for `PATCHES.md`.
      The tool copies `GRAMATIK.C` and `GRAMATIK.IQZ` byte-for-byte into `build/gramatik/`
      (lowercased, because `main()` `fopen`s `"gramatik.iqz"` by that exact name),
      compiles with the engine's own hazard flags, and runs it in that directory.

      Three things worth carrying forward:
      - **The `-Warray-bounds` hit is real and is left alone.** `strcpy(prostoridslov,
        "<14 spaces>")` writes 15 bytes into a `char[14]`. `prostoridslov` is a global
        declared between `hlavicka[5000]` and `znak`, so the stray NUL lands on `znak` or
        on padding, and `znak` is not read until after the last `strcpy`. Harmless in
        2005, harmless here, and the byte-identical output proves it.
      - **CRLF is not optional.** `PRECTI_RADEK` treats `\r` as the terminator and eats
        the byte after it, so an LF-only `GRAMATIK.IQZ` runs the whole file into one line
        and dies at 10,000 characters. The tool checks the line endings up front and says
        so, rather than letting the author's error message stand in for the diagnosis.
      - `src/shim/nahoda.h` is force-included so the obfuscation padding comes from the
        MS CRT LCG, the 2005 build's generator. A verified no-op on ucrt64 (`PATCHES.md`),
        kept so it stays one on a toolchain where it would not be.
- [x] 2.4 Diff the recompiled `IQPOKYD.IQP` against the shipped one — **done, and the
      answer is that they are the same file.** `build-gramatik.py` decodes both exactly as
      `PRECTI_INTELIGENCI_ZE_SOUBORU` (`Slovnik/SLOVNIK.FU:1348`) does — same header walk,
      same per-string position-keyed obfuscation, both checksum pairs verified — and
      compares the decoded rule streams. **All 1,456 strings match, byte for byte**: 182
      conditions plus 7 answers each, 69,697 bytes of rule text, and the encoded bodies are
      the same length too (71,155 B). What differs is exactly two things, neither of them
      data:

      | | shipped | rebuilt |
      |---|---|---|
      | header banner | `… KYBLSoft 1999-2004` | `… KYBLSoft 1999-2005` |
      | obfuscation | 2 padding bytes, key `0x74` | random per run |

      So the 2004/2005 discrepancy is a **copyright-year string literal the author bumped
      after he last rebuilt the data**, not an older rule compiler and not an older rule
      base. `GRAMATIK.IQZ` as it sits in the source drop is the true source of the shipped
      `IQPOKYD.IQP`.

      And it settles the line-endings question for free, in the direction we hoped. The
      shipped `.IQP` is binary and was never normalized; `GRAMATIK.IQZ` was. If git's
      round trip had put a single byte of that file wrong, the rule stream could not
      match — and it matches on all 69,697 bytes. **The CRLF checkout reproduces the
      author's bytes.** (Checked the other way too: feeding the tool an LF-converted copy
      fails on the first read.)

      End-to-end as well, not just on paper: with the rebuilt `IQPOKYD.IQP` in place of
      the shipped one, `build/native/pokyd.exe` reproduces `test/golden/rozhovor.txt`
      byte for byte.

      `--dump` writes the decoded rule base as readable CP1250 text — 182 blocks of
      condition + mood + 7 answers, attributes in their compiled single-char form. Useful
      for reading what the engine actually evaluates, as opposed to what `GRAMATIK.IQZ`
      says; `build/gramatik/rules.txt` if you want it.
- [x] 2.5 Pick the shipping rule base — **build it from `GRAMATIK.IQZ`.** Michal's call,
      and it holds the original plan's leaning: with 2.4 showing the two candidates are
      byte-for-byte equivalent in every string the engine reads, the tie breaks on which
      is *cleaner*, and deriving the artefact from readable source beats trusting a binary
      we cannot read. So the repo ships a rule base it can regenerate, not one it has to
      be taken on faith about.

      Wired up: `tools/build.py`'s `DATA` now points `IQPOKYD.IQP` at
      `build/gramatik/IQPOKYD.IQP`, and `build.py` runs `build-gramatik.py --quiet` right
      after `transcode.py`, before laying out `build/run/`. One line in the build output:

          rules   IQPOKYD.IQP: 182 rules, 1456 strings, checksums verify, identical to
                  the shipped rule base

      That line is the point. The equivalence proof is not a thing we did once in
      September 2026 — it **runs on every build and fails it** if the recompiled rule
      stream ever stops matching the author's. Building from source is only defensible
      because that check is standing, so the two changes belong together.

      Two consequences worth knowing:
      - **The rebuild is conditional.** `ZAPIS_HLAVICKU` reseeds from the clock, so an
        unconditional rebuild would hand a different `IQPOKYD.IQP` to every build for no
        change in any rule — bad for a content-hashed deploy (9.3) and just noisy in a
        working tree. `build/gramatik/otisk.txt` holds a SHA-256 of both archive files,
        the `nahoda` shim, the compilers and the flags; the compile and run are skipped
        while it matches, `--force` overrides. Verification is *not* conditional and runs
        every time.
      - **The bytes are still not reproducible across machines**, only stable on one.
        Two clones building the same commit get rule bases with different padding and
        different keys — identical content, different files. That is the author's
        obfuscator, not our build, and nothing downstream reads the padding. If 9.3 ever
        wants a deterministic asset, the cheapest fix is to pin the seed through the
        `nahoda` shim rather than to go back to copying the 2004 file.

      What this does **not** change: `original/IQ Pokyd/Data/Intelig/IQPOKYD.IQP` stays
      exactly where it is. It is the archive, it is the comparison target, and 9.1 should
      say that the rule base the site runs on was rebuilt from the author's own text
      source with the author's own compiler — and that it matches what he shipped.

## Phase 3 — WebAssembly

- [x] 3.1 ~~`src/engine/pokyd_api.c`~~ **`src/api/pokyd_api.h` + `.cpp`** — the exported
      surface. `.cpp` because `engine.h` declares classes, so the translation unit is C++
      whatever the extension says; `src/api/` because `src/engine/` is the byte-exact
      mirror `transcode.py --check` verifies and new code of ours has no business in it.
      The surface itself is `extern "C"` and exposes no C++ type, so 3.2 can hand the
      names straight to `EXPORTED_FUNCTIONS`.

      Everything the plan asked for is there — `pokyd_init`,
      `pokyd_load_dictionaries`, `pokyd_say` (CP1250 in → CP1250 out),
      `pokyd_get_settings` / `pokyd_set_settings`, `pokyd_progress`,
      `pokyd_export_cache` / `pokyd_import_cache` — plus six that earned their place:
      `pokyd_shutdown` (returns the unfreed-block count, which is the only leak detector
      this code has), `pokyd_error`, `pokyd_seed` (hazard 11, and it has to be callable
      *after* loading), `pokyd_set_mood` (`mood` is derived from `mood_points`, so
      writing it through the settings struct alone is undone after the next sentence —
      `INTELIG.FU:1047`), `pokyd_sentence_count` (rules test `g_pocetrecenychvet`, so it
      is state), `pokyd_phase`, and `pokyd_free`.

      `src/driver/pokyd.cpp` was the rehearsal and is now a caller: all four of
      `PRIPRAV_GLOBALY`, the loading sequence, `IQ_POKYDE_ODPOVEZ` and `OnNovaveta` moved
      into `pokyd_api.cpp`, so there is one copy and `test/golden/` tests *it*. Verified
      after the move: the transcript reproduces byte for byte on the warm path and on the
      cold path, `SLOVNIK.TMP` comes out byte-identical to the 1.6 one (18,131,435 bytes),
      and teardown still reports zero unfreed blocks.

      The cache pair is wired to the driver's `--export-cache` / `--import-cache` so it is
      exercised and not merely compiled: export the blob, delete `SLOVNIK.TMP`, import it
      back, and the 5.6 s cold start becomes 0.23 s with the same transcript. That is
      phase 4.4's mechanism proven natively, and hazard 10's adjacency held.

      One thing 3.1 could not test: `pokyd_progress`. Loading is a single synchronous
      call, so nothing on the calling thread can read it — whose job that is, is 4.3's.
      The header also records why the progress bar will look odd if nobody thinks about
      it: the author's 0–50 / 50–100 subdivision of the inflection step is
      `g_praveprovadenaakce` 2/3/4 at `SLOVNIK.FU:3260`, `:3329`, `:3340`, all three
      inside `#if IQPOKYDWINMFC == 1`, so in a `BEZ_PROSTREDI` build `g_procentanacitani`
      runs 0→100 three times over during `POKYD_PHASE_INFLECTING`. **4.2 measured that and
      it is worse than predicted** — there is no ramp at all, only 0 and 100 — because
      `SLOVNIK.FU:3318` is behind the same guard. See 4.3.
- [x] 3.2 **Emscripten build — `python3 tools/build.py --wasm`.** Same script as the native
      build, one flag. The compile flags are the native ones unchanged: the hazard set is the
      engine's requirement, not a g++ preference, and `-fsigned-char` is the one that
      silently changes the dictionary checksums if it goes missing on clang (hazard 1).

      **emcc is found by absolute path and is deliberately not on `PATH`.** `najdi_emcc()`
      searches `POKYD_EMCC`, then `$EMSDK`, then the usual install roots
      (`C:/Program Files/emsdk` first — that is where it is on this machine), then `PATH`
      as a last resort for whoever does have it activated. Nothing needs `emsdk_env`
      sourced: emcc resolves its own `.emscripten` relative to itself, verified by running
      it with an empty environment.

      Two things the install location forced, both in `em_prostredi()`. The emsdk ships a
      602 MB `cache/` that lives under `C:/Program Files` and needs elevation to write —
      and the first link wants to write to it — so `EM_CACHE` is redirected to
      `%LOCALAPPDATA%/pokyd/emcache`, *only* when the shipped one is genuinely not
      writable, so an activated emsdk keeps its own answer. The redirect costs one sysroot
      rebuild, ~30 s, `libc.a` being most of it, and never again. `EM_CONFIG` is pinned to
      the install's own `.emscripten` so a stray `~/.emscripten` cannot quietly redirect
      the build.

      **`--embed-file`, not `--preload-file`** — a deviation from what this line used to
      ask for, and the reason should survive. Preloading emits a fourth artifact,
      `pokyd.data`, whose loader resolves that name through `Module.locateFile` and falls
      back to the bare name — which node reads relative to the *process working directory*,
      not to `pokyd.mjs`. So a preloaded module only loads from `build/wasm/` unless every
      caller passes a `locateFile`, and that cannot be defaulted from `--pre-js` either:
      the packager's loader is emitted at the top of the factory and runs before pre-js
      does. This was hit for real, as an `ENOENT` on `D:/code/pokyd/pokyd.data`, before it
      was understood. The two files are 161 KB together (`SLOVNIK.IQP` 90,289 +
      `IQPOKYD.IQP` 71,287), which is cheaper to inline than to write a configuration
      contract that 3.3, 4.2 and 5.1 each have to honour separately. Revisit if `PROFIL.IQP`
      (7.5) or a larger dictionary ever joins them.

      They still come from `build/run/`, laid out by the same `priprav_run_adresar()` the
      native driver uses, so the rule base is the one compiled from `GRAMATIK.IQZ` (2.5)
      and not the 2004 binary. They land at `/pokyd/` in MEMFS, which is what
      `pokyd_init("/pokyd")` chdir()s into — the engine opens every file by bare name in
      the current directory and writes the 17 MB `SLOVNIK.TMP` next to them, so it has to
      be writable. Hence `ALLOW_MEMORY_GROWTH`, which the inflected dictionary needs on its
      own account anyway.

      `src/driver/` is left out of this build: it has a `main()` and this is a library,
      hence `--no-entry` and `-sINVOKE_RUN=0`. `EXPORTS` is the fifteen of `pokyd_api.h`
      plus `_malloc` and `_free`, which 4.1 needs because no UTF-8 helper will write CP1250
      bytes into the heap on its behalf. The link runs with `build/run/` as its working
      directory so that nothing about this machine's checkout reaches the output — checked,
      there is no `D:/code/pokyd` anywhere in `pokyd.mjs`.

      Verified in node v24.20.0, imported from the repo root rather than from `build/wasm/`:
      all 17 exports present, `/pokyd/` holds `SLOVNIK.IQP` (90,289 B) and `IQPOKYD.IQP`
      (71,287 B), `pokyd_init("/pokyd")` returns 0 and `pokyd_phase()` reads
      `POKYD_PHASE_IDLE`. **No sentence has been said yet** — the module has never been
      past loading, and `pokyd_load_dictionaries()` has never been called in wasm. That is
      3.3, and until it passes, nothing here is evidence about the engine's answers.
- [x] 3.3 **Node smoke test — `node test/wasm/smoke.mjs`, and it passes.** The wasm build
      reproduces `test/golden/rozhovor.txt` byte for byte, cold and warm. The runner is
      `test/wasm/smoke.mjs`: no arguments, no build step of its own, exit code 0 or 1.

      ```
      cold  load 14.21 s, 23 answers in 6 ms
            transcript 1116 bytes, identical      SLOVNIK.TMP 18,131,435 bytes,
            0 unfreed blocks                      identical to the native one
      warm  load  0.12 s, 23 answers in 2 ms
            transcript 1116 bytes, identical      0 unfreed blocks
      ```

      **The SLOVNIK.TMP comparison is the real test** and it was worth writing: the
      transcript is 1,116 bytes and touches a few dozen rules, while the cache is 18 MB
      of every inflected form, obfuscated with `rand()` padding and checksummed twice.
      Two toolchains agreeing on it byte for byte is hazard 1 (`char` signedness),
      hazard 4 (overflow and aliasing under `-O1`) and hazard 11 (`rand()`) all answered
      at once. Hazard 6's 1,208 `-Winvalid-source-encoding` are confirmed informational:
      clang keeps the raw byte, and the bytes are right.

      Warm is tested by exporting the cold run's blob and importing it into a **second
      module instance** — MEMFS does not survive an instance, so there is no other way to
      time a second run, and it exercises `pokyd_import_cache` (phase 4.4's mechanism) on
      the way. It is 0.12 s, faster than the native 0.4 s, because the blob never touches
      a disk.

      **It did not pass first time, and hazard 10 is why** — see below and `PATCHES.md` 2.
      The failure was a hard `RuntimeError: memory access out of bounds` inside `getc`,
      not the silent re-inflection this plan predicted.

      Three notes for whoever reads the runner. It **decodes nothing**: `rozhovor.in` is
      CP1250 on disk, the API takes CP1250, and the transcript is written back as the
      bytes the engine returned, so phase 4.1's codec is not silently on trial here.
      It **checks the `pokyd_settings` layout** against what `NASTAV_STANDARDNE` wrote
      before trusting a single offset, because a JS-side offset table that drifts from
      the header would corrupt every setting at once and still produce a plausible
      conversation. And it **discards the engine's own console output** unless `--noise`
      asks for it — 2.6 MB of progress bar and `vstup.fu:801-809` per run — which costs
      nothing measurable either way (14.15 s noisy, 14.21 s quiet), so the 14 s is real
      compute and not console traffic.
- [x] 3.4 **Measured on all three runtimes, and the decision is written down: the
      `SLOVNIK.TMP` cache is a launch requirement.** ~~At 4.5 s native it may well be
      the latter.~~ Three commands produce the numbers, and each of them is also a
      test — every run diffs its own transcript against `test/golden/rozhovor.txt` and
      reports a failure instead of a timing if it moved:

      ```
      python3 tools/bench-native.py            the native build, cold and warm
      node test/wasm/bench.mjs                 the wasm build, in node
      node test/wasm/bench.mjs --browser       the wasm build, in headless Chrome
      ```

      One machine (AMD64, 16 cores, Windows 11), one build, one sitting. Every load
      figure is a bracket around `pokyd_load_dictionaries()` and nothing else — the
      driver grew a `--time` for exactly that, so the native and wasm numbers measure
      the same call:

      ```
                             cold      cold     warm            peak memory
                          1st run   settled
      native                4.30 s    4.30 s   0.129 s   38.0 MB peak working set
      node v24.20.0        13.9  s   10.6  s   0.115 s   28.3 MB wasm + 17.4 MB MEMFS
      Chrome 152 headless  15.3  s    9.3  s   0.112 s   48.7 MB whole tab
      ```

      **The decision.** A first visit costs **15.3 s in a real browser**, 3.6× native,
      and the load is a single synchronous call, so those fifteen seconds are a frozen
      tab, not a progress bar. A warm start from the cache is **0.11 s**, 135× better,
      and byte-identical in what it answers. Nobody waits fifteen seconds for a museum
      piece. So **4.4 is load-bearing for 5.2, not a nicety after it**, and so is 4.2:
      a synchronous fifteen-second call cannot run on the UI thread even once.

      **The first run is the only honest cold number, and it is not the median.** Cold
      runs 2 and 3 land at 9–10 s against the first one's 14–15 s, in node and in Chrome
      alike: the first pass runs baseline-compiled wasm and the tier-up only pays off
      afterwards. A visitor gets the first pass. `bench.mjs` prints both and says which
      is which, because a median here would quietly report a number nobody experiences.

      **Hazard 5 is fully answered, and the memory is unremarkable.** The wasm linear
      memory peaks at **28.3 MB** — below the native process's 38.0 MB working set, which
      carries a C runtime and a mapped executable the browser accounts for elsewhere.
      MEMFS holds the 17.4 MB `SLOVNIK.TMP` in JS arrays *outside* that linear memory, so
      the engine's real footprint is the two added: 45.7 MB, and Chrome's own
      `measureUserAgentSpecificMemory()` says **48.7 MB for the whole tab** at the moment
      the dictionary is loaded. That is 1.3× the native process, not the order of
      magnitude this was once budgeted for. The `402,252` forms are the same number the
      native build reports, which is the engine's own `MAX_POCET_VSECH_SLOV` printout and
      not an inference.

      **Three notes 4.4 will want**, all measured:

      - The blob is **three copies at once** on a naive warm start — the caller's
        `Uint8Array`, the `_malloc`ed copy `pokyd_import_cache` takes, and MEMFS's own.
        The warm tab reads **64 MB** against the cold run's 48.7 MB purely because the
        exported blob was still alive in JS. Hand it over and drop the reference.
      - **Exporting the cache is the peak, not loading it.** `pokyd_export_cache`
        `malloc`s 18 MB inside the heap: the linear memory goes 16.3 MB at start → 28.3 MB
        loaded → **41.9 MB** the moment the blob is taken. Importing one into a fresh
        instance is nearly free by comparison (16.3 → 19.6 MB), because the 18 MB fits in
        the initial heap the dictionary has not claimed yet. Both calls themselves cost
        ~6 ms.
      - The blob **gzips to 11.3 MB, 62%** — the obfuscation padding is what stops it
        going further. Which means shipping a prebuilt `SLOVNIK.TMP` as a static asset is
        a live alternative to computing one, and a legitimate one: 3.3 proved the file is
        byte-identical across toolchains, so a shipped cache is verifiable rather than
        merely convenient. That trade — 11 MB over the wire against 15 s of frozen tab on
        the first visit — is 4.4's to make, and 9.x's if the answer depends on hosting.

      What is **still missing**: a reading on hardware that is not this laptop, and one on
      a phone, where both the 15 s and the 48.7 MB matter more than they do here. Neither
      changes the decision — the gap between 4.3 s and 15.3 s is far too wide for hardware
      variance to close — so they are recorded here as wanted, not as blocking.

      Two things the benches are careful about, for whoever edits them. They work in
      `build/bench/run/`, never `build/run/`, because making a cold run means deleting
      `SLOVNIK.TMP` and `test/wasm/smoke.mjs` diffs the wasm cache against the native one
      in `build/run/`. And `test/wasm/bench-core.mjs` is shared verbatim between node and
      the browser page, so the two tables cannot drift into measuring different call
      sequences; `test/wasm/bench.html` is a page, served with COOP/COEP by the bench's
      own loopback server, because `measureUserAgentSpecificMemory()` is only handed to a
      cross-origin-isolated document.

      **A side effect worth having: IQ Pokyd answers correctly in an actual browser.**
      The browser bench reproduces `test/golden/rozhovor.txt` byte for byte in Chrome 152,
      cold and warm, with zero unfreed blocks — which is 5.1's riskiest assumption
      retired before 5.1 starts. The driver's `--time` is the only source change 3.4 made,
      and the golden transcript is byte-identical with it.

## Phase 4 — JS boundary

3.4 measured this phase into a priority order it did not have before: **4.1, then 4.2 and
4.4, and only then 5.1.** A 15.3 s synchronous first load is a frozen tab, so the worker
is not a refinement and the cache is not an optimization.

- [x] 4.1 CP1250 ⇄ UTF-16 codec, both directions, with the full 256-entry table. Unit tests
      covering `ě š č ř ž ý á í é ů ú ň ť ď ó`. **Done** — `src/web/cp1250.ts`,
      71 checks in `test/web/cp1250.test.ts`, all 30 accented Czech letters and all 256
      bytes both ways. See the Status section for the two decisions encode had to make.
- [x] 4.2 **Run the engine in a Web Worker; typed message protocol. Done.** Four files:
      `src/web/protocol.ts` (the vocabulary — twelve requests mirroring `pokyd_api.h` one
      for one, the reply union, `PokydSettings`), `src/web/engine.ts` (`PokydEngine`, the
      wasm module driven from JavaScript), `src/web/worker.ts` (the thread) and
      `src/web/client.ts` (`PokydClient`, the page's half). Two tests:
      `node test/web/engine.test.ts`, 33 checks with no Worker anywhere, and
      `node test/web/worker.test.mjs`, 21 checks in headless Chrome.

      **The measurement the phase exists for: a 15.01 s cold load during which the main
      thread was never blocked for more than 12 ms**, with 902 animation frames drawn
      through it. Against 3.4's 15.3 s of frozen tab, that is the whole argument.

      `engine.ts` is transport-free on purpose — no `self`, no DOM — which is what lets
      node drive it directly and makes `worker.ts` thin enough to trust: a FIFO queue, a
      throttled output relay, and errors turned into rejected replies. It also enforces
      the ordering rules `pokyd_api.h` only states, on the JS side where the message can
      name the line of the engine that makes each one necessary.

      The transcript is now held in **strings**: `rozhovor.in` decoded, said, the answers
      re-encoded, and the result compared against `rozhovor.txt` byte for byte. It
      matches cold and warm, in node and in Chrome — so 4.1's codec is provably invisible
      to the conversation and not merely invisible on a round trip. The cold run's
      `SLOVNIK.TMP` is the same 18,131,435 bytes, and it survives being transferred to
      the main thread and back into a second worker.

      Two things learned here, both written up at 4.3 and in `pokyd_api.h`:
      `pokyd_progress()` has no gradient through the inflection loop, and
      `pokyd_shutdown()` aborts if the load never succeeded.

      `test/browser.mjs` came out of `test/wasm/bench.mjs` on the way: the loopback
      server and the headless-Chrome launcher, now shared by both browser tests, plus one
      addition — it strips the types out of any `.ts` it serves with node's own
      `stripTypeScriptTypes`, so Chrome imports `src/web/*.ts` unbundled, at the same
      specifiers node uses. At 3.4 there was still no `package.json`. The bench
      reproduces 3.4's numbers exactly after the move (15,330 ms cold, 28.3 MB wasm,
      17.4 MB MEMFS, 48.7 MB tab).
- [x] 4.3 **Wire up loading progress to real UI feedback. Done**, and measuring the
      stream first moved the ground twice. Two files: `src/web/progress.ts`
      (`PokydLoadingTracker`, the state machine — no DOM, no worker) and
      `src/web/loading.ts` (`PokydLoadingView` and `mountLoading()`, the loading window
      on a page). One change to `src/web/worker.ts`, and it is load-bearing: see below.

      **The long step is not the inflection loop.** Everything written here and in
      `pokyd_api.h` up to now called it "the fourteen-second inflection loop". Sampled
      unthrottled across a real cold load — 397,897 segments — the inflection loop is
      **1.0 s and 1,121 of them**. The twelve and a half seconds are
      `SETRID_SLOVA_V_DATABAZI`, the sort that follows it, and **the sort prints a
      percentage of its own**: `SLOVNIK.FU:2322`, 392,699 of them, rising 0.0 → 100.0
      within a point and a half of a straight line in time. The step that needed a
      progress bar had one all along, on a channel nobody had read. Measured: base
      dictionary 20 ms, inflecting 1,221 ms, sorting 12,457 ms, writing 241 ms, the
      re-read and the 18 MB cache 174 ms, intelligence 6 ms. A warm load is 182 ms.

      **The captions are CP852, not CP1250.** `Skloňuji...` arrives as `Skloĺuji...`,
      and it is not a fault in 4.1's codec: the engine prints them through
      `NAPIS_TEXT_V_LATIN_2` (`VSTUP.FU:1230`), which converts to CP852 first — hazard
      6's "Latin 2" — for a DOS console. So `progress.ts` *recognises* those four lines
      as the bytes they are and never displays them. What it displays is the author's
      own loading-window text, from `PROSTRED.FU:568/576/579/586/599`,
      `SLOVNIK.FU:3261/3331/3342` and `IQPokyd.rc:124`.

      **`IQPokyd.rc:122-132` turned out to be the spec**, three phases before 6.1 was
      going to read it: `IDD_NACITANI` is a caption, a smooth bordered bar, a
      right-aligned percentage and a cancel button, and `VLAKNO__PROCENTA_PROGRESU`
      (`PROSTRED.FU:509-548`) formats that percentage with one decimal and a **decimal
      comma**. `loading.ts` draws that. The cancel button is the one control left out:
      `g_zavritvlaknoprocesu` and every check of it are behind `IQPOKYDWINMFC`, so there
      is nothing for a button to set.

      **The one deliberate divergence** is the weighting. The author gave inflecting
      0–50% and sorting 50–100% (`PROSTRED.FU:517-520`), which against this engine is a
      bar that reaches half way in one second and spends twelve and a half crossing the
      rest. The weights are the measured ones instead, and that is the whole reason 4.3
      exists.

      **The worker change.** `worker.ts` sent at most one `output` per 60 ms, which is
      right for 397,897 percentages and wrong for the eight lines that are not one:
      three of the four step markers land in the middle of a percentage run and were
      being dropped, so the caption would never have changed. The throttle now applies
      to bare percentages only. `test/web/progress.test.mjs` is what says all four
      markers cross the boundary — 233 events for 397,897 segments, and every marker
      among them.

      Two tests. `node test/web/progress.test.ts` puts **92 checks** on it in node,
      against a synthetic stream and then against real cold and warm loads, and is where
      the engine's console output is written down: exactly eight non-percentage lines per
      cold load, the four markers' bytes, and the sort out-printing the inflection loop
      392,702 to 1,122. `node test/web/progress.test.mjs` puts **47** on the real thing
      in Chrome — the worker, the throttle, and the loading window read back out of the
      DOM at every change, ending on `100,0%` with the author's comma.
- [x] 4.4 **Persist the `SLOVNIK.TMP` cache blob to IndexedDB, keyed by dictionary hash.
      Done.** `src/web/cache.ts` is the whole of it: `fnv1a64`, `pokydCacheKey`,
      `PokydCacheStore` and `startCached()`, which is `PokydClient.start()` with the
      lookup and the save inserted at the two places `pokyd_api.h` allows them — after
      init, because the dictionary hash is read out of the module's MEMFS, and before
      load, because the engine looks for `SLOVNIK.TMP` as it starts and never again.

      **14.53 s on a first visit, 0.18 s on the next one, in Chrome 152**, with the
      golden transcript byte for byte on both. The stored blob is byte-identical to the
      native `build/run/SLOVNIK.TMP` — hashed on its way back out of the database and
      compared, rather than measured.

      The key is `pokyd/<version>/<dictionary hash>`. It had to come from the worker: the
      dictionary is embedded inside `pokyd.wasm`, so the page has no copy of its own to
      hash, and `dictionaryHash` is the protocol's one addition that is not an engine
      call. `POKYD_CACHE_VERSION` covers what the dictionary hash cannot — see the Status
      section for why that constant is the last hand-maintained thing in this phase.

      3.4's three constraints, revisited. The blob still lives three times over on a warm
      start (IndexedDB's copy, the wasm heap, the MEMFS file) and none of the three can
      be skipped from JavaScript; what `startCached` does avoid is a fourth, by handing
      `importCache` the buffer to *transfer*. The export is still the memory peak, and it
      now happens exactly once per dictionary. Shipping a prebuilt 11.3 MB gzip was not
      needed and is not done: 15 s once is cheaper than 11 MB every deploy, and it would
      have wanted the same `POKYD_CACHE_VERSION` discipline anyway.

      Storage failure is never load failure — a refused database, a full quota and a
      damaged record all end in a slow load and a line in the report. 48 checks in
      `test/web/cache.test.ts` (node, no engine), 40 in `test/web/cache.test.mjs`
      (Chrome, the real thing).

## Phase 5 — Vertical slice

- [x] 5.1 **Vite + TypeScript project. Plainest possible chat page: input, transcript,
      nothing else. Done.** `package.json` is the repository's first, and it has two
      dependencies: `vite` 7.3.6 and `typescript` 5.9.3, plus `@types/node` so that one
      `tsconfig.json` covers the node tests as well as the browser code. `npm run
      typecheck` passes over every `.ts` in `src/` and `test/` — including the four
      phase-4 modules, which until now had only been checked by hand.

      The Vite root is the repository root, so `src/web/*.ts` is imported at the same
      specifiers node and `test/browser.mjs` use and phase 4 is consumed rather than
      copied. `src/app/chat.ts` is the page: `mountChat(parent, options)`, a transcript,
      a line to type into, and `data-state` = `loading` | `ready` | `busy` | `failed`.
      `src/app/main.ts` is what `index.html` runs and the only file that needs Vite.
      `src/app/chat.css` is plain and phase 6 replaces it. The build is **612 KB**, 450
      of it the engine (185 KB gzipped); the page's own JavaScript is 15.6 KB.

      **A warm start never seeds the engine**, and nothing before 5.1 could have noticed
      because every earlier test pins the seed. `pokyd_seed` is `srand`; the cold path
      reseeds from the clock on its way out (`SLOVNIK.FU:1732`) and a visit that imports
      the cache runs neither, so a returning visitor would have got the same
      conversation forever. The app seeds with `Date.now()/1000`, which is the original's
      own `srand(time(NULL))` at `mfcDlg.cpp:363` and `PROSTRED.FU:307`.

      **`new URL(x, import.meta.url)` is an asset declaration under Vite, not an
      expression.** As a default for `workerUrl`/`moduleUrl` it emitted a second,
      unbundled copy of the worker and of the 137 KB glue into `dist/`, loaded by
      nothing. Both are now required options: the caller that knows where the build put
      things is the one that says. `vite.config.ts` emits the engine pair verbatim under
      `<base>/pokyd/` — one directory, because the glue finds its binary with that same
      expression, and untransformed, because the worker imports it by a runtime URL
      (`@vite-ignore`).
- [x] 5.2 **Milestone: hold a conversation with IQ Pokyd in a browser. Done, and it is
      the phase 1.6 conversation, byte for byte.** `node test/app/chat.test.mjs` runs
      `vite build`, serves `dist/` over loopback and puts the built `index.html` in an
      iframe; then it types the 23 sentences of `test/golden/rozhovor.in` into the input
      and presses the button, one at a time, waiting for `data-state` to return to
      `ready`. What it compares against `test/golden/rozhovor.txt` is the transcript
      read back out of the DOM and encoded to CP1250 — **1,116 bytes, identical, cold
      and warm.** It imports one module, the codec, and only to do that encoding: it
      drives no client and knows nothing of the protocol.

      Chrome 152: **16.3 s from opening the page to the first typed character** on a
      first visit, **0.24 s on the second**, 46 turns on the screen, zero unfreed blocks
      either time, one cache key for both. 48 checks.

      Two things it noticed. The author's own words are on the page already —
      `IQPokyd.rc:106-115` gives the title, the `Tvá věta` beside the input and the
      `Řekni` on the button, three phases before 6.1 reads that file properly. And the
      **mood drifts**: `nalada` starts at `NASTAV_STANDARDNE`'s 3 and ends those 23 civil
      sentences at 1, the best of the five (`INTELIG.FU:532`) — 7.2's subject, now
      pinned by a test.

      `npm test` runs `test/run.mjs`, which is every test in this repository in phase
      order — **nine** of them when 5.2 landed, eleven since 6.2; `--quick` keeps the ones
      that do not launch a browser. They all pass, in a little over two minutes.
- [x] 5.3 **Deploy it somewhere as a checkpoint, even ugly. Done — it is live at
      <https://timichal.github.io/pokyd/>.** `.github/workflows/deploy.yml` builds it
      and publishes it on every push to `main`. It is a project page in a
      subdirectory, which `base: "./"` handles with no rebuild.

      The workflow builds **the whole chain from source on a Linux runner**, because
      nothing compiled is in this repository: `gen-src.py` and `transcode.py --check`
      first — `build/` is gitignored, so the CP1250 mirror the byte-exactness proof
      compares against has to be rebuilt before it can be asserted — then
      `tools/build.py --wasm`, which compiles the author's own rule compiler out of
      `original/`, rebuilds the rule base, checks it against the shipped `IQPOKYD.IQP`
      and only then runs Emscripten; then `npm ci`, `npm run typecheck`, the tests,
      and `npm run build`. Emscripten 6.0.9 is installed but **not activated**, exactly
      as on this machine, and `find_emcc()` picks it up from `$EMSDK` — which is set
      by a step and not in the workflow's `env:`, because the `runner` context does
      not exist up there.

      **The golden conversation is the deploy gate**, not a formality: `npm test --
      --quick` runs the five tests that need no browser, and `test/wasm/smoke.mjs` is
      among them, so a Linux build that stopped saying what the 2005 binary said would
      refuse to publish. That is a fair test on a second toolchain only because hazard
      11 is closed — `src/shim/nahoda.h` owns `rand()`, so the conversation does not
      depend on the C library underneath it. The four browser tests, 5.2's included,
      stay on a machine with Chrome; the workflow does not gamble on the runner having
      one.

      **The second run found a real bug, and it is the author's.** `GRAMATIK.C:206`
      does `strcpy(prostoridslov, "<14 spaces>")` into a `char[14]` — fourteen
      characters and the terminator he forgot to count — so the NUL lands one byte
      past a global. MinGW never noticed in twenty years; Ubuntu's gcc enables
      `_FORTIFY_SOURCE` by default and `__strcpy_chk` aborted the run before a single
      rule was compiled. `tools/build-gramatik.py` now passes `-U_FORTIFY_SOURCE` on
      **`CFLAGS` only**, so the exemption covers the archive's translation unit and
      nothing of ours. Turned off rather than patched, because *no patch, no working
      copy* is this script's whole claim and 2.4's evidence rests on it — and the
      overflow is benign in effect for a reason the file itself gives:
      `prostoridslov` is only ever indexed (`:289`, `:293`), never read as a string,
      so nothing wants that terminator. That is not taken on trust either: the
      equivalence check runs on every build and compares the rules against the
      shipped `IQPOKYD.IQP` byte for byte, so a byte that landed somewhere that
      mattered would fail the build rather than ship.

      **And a second one, in the same file, which cost a run of its own.**
      `GRAMATIK.C:180` is `void main(void)` with no `return` anywhere in it, so the
      exit status is whatever was left in the return register. MinGW handed back 0 for
      twenty years; Linux/gcc handed back garbage on the very run that printed
      *Soubor uspesne preveden.* — the rule base had been built correctly and the
      build failed anyway. It is wrong in the other direction too: all 21 of his error
      paths call `exit(0)`. So `build-gramatik.py` no longer reads that status.
      **What judges the run is the file it was supposed to write**, and the output is
      deleted before the compiler runs — which is the load-bearing half, because
      without it a compiler that died before writing would leave the previous run's
      `IQPOKYD.IQP` in place and everything downstream would verify yesterday's rules.

      **It deployed on the fourth run: <https://timichal.github.io/pokyd/>.** The
      exhibit is public, built from source by CI, and the golden conversation gated
      it. That is the checkpoint 5.3 asked for.

      One thing came out of that run and it is housekeeping: the `@v4`/`@v3` actions
      target Node 20, which GitHub deprecated in September 2025 and now force-runs on
      24. All five are bumped to the majors that declare `node24` — checkout `@v7`,
      setup-node `@v7`, cache `@v6`, upload-pages-artifact `@v5` (which pulls
      upload-artifact `@v7`, the other half of the warning) and deploy-pages `@v5`.
      Every input and output this workflow uses survives the jump; they were read out
      of each action's own `action.yml` at that tag rather than assumed.

      Worth remembering before any *second* deploy: the first visit costs fifteen
      seconds of CPU in the visitor's tab and 18 MB of their IndexedDB, and a stale
      cache is the one failure a dictionary hash cannot see — read the note on
      `POKYD_CACHE_VERSION` in `src/web/cache.ts`.

## Phase 6 — The retro UI

All the original assets are in `original/IQ Pokyd/!Prostre/res/`.

- [x] 6.1 **Done** — `tools/extract-rc.mjs` parses `IQPokyd.rc` (through `cp1250.ts`,
      not a second codec) into `src/app/resources.ts`: 6 dialogs, 75 controls, the
      menu, 14 accelerators, 11 bitmaps, 3 icons and the version block, generated and
      committed, with `--check` and a drift test. `test/app/resources.test.ts` puts
      **82 checks** on it, 129 of them by finding the module's strings in the archive
      as runs of CP1250 bytes.

      It is an exact spec for the *dialogs, menus and strings*, and for the main
      window it is **not a spec for the layout** — see the Status section. Three
      things it does not say, all now in `resources.ts`: the transcript is a hundred
      runtime `STATIC`s laid out by `PROSTRED.FU` (`WINDOW_LAYOUT`), the colours are
      byte-reversed `COLORREF`s in `PROSTRED.PR` (`PALETTE`), and dialog units need
      base units the script does not contain (`dluToPx`).
- [x] 6.2 **Done** — `node tools/extract-assets.mjs` decodes every image in
      `BITMAPS` and `ICONS` out of the archive and writes `src/app/assets/`:
      **18 files, 1,287,294 bytes of BMP and ICO down to 177,304 of PNG**, with
      `src/app/assets.ts` as the manifest 6.3 imports. `test/app/assets.test.ts`
      puts **51 checks** on it and compares **every pixel of all eighteen** with
      the archive, alpha included.

      **PNG, lossless, and no WebP** — the argument is in the extractor's header
      and in the Status section. **No WOFF2 either, and that is a finding:**
      `iqpokyd.ttf` is not a TrueType font. The font work in this phase is a CSS
      font stack in 6.3, not an asset.

      Formats met on the way, all decoded from scratch: 1-, 4-, 8- and 24-bit
      uncompressed DIBs, **RLE4 and RLE8**, and the ICO AND mask that gives the
      icons their transparency. The one miscased path is folded by
      `resolveInArchive()`, which resolves the `.rc`'s Windows spelling against
      the real directory — the reason the Linux runner can build this at all.
- [x] 6.3 **Done** — `src/app/chat.ts` is the author's main window: the stretched
      photograph, IDR_MENU with the live `name × name, character: mood` caption,
      his three headings, his two text colours and the conversation growing
      upwards out of the bottom of the screen. Three modules are new —
      `src/app/menu.ts` draws IDR_MENU, `src/app/caption.ts` is
      `ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI` plus the seven
      `SetMenuItemBitmaps` pairings, `src/app/dlu.ts` measures a font the way
      MapDialogRect does. `test/app/chat.test.mjs` grew to **104 checks** and
      still reproduces the golden transcript byte for byte; `node
      test/app/caption.test.ts` puts **25** more on the status line in node.

      **Nothing in `chat.css` is a decision.** Every measurement is a custom
      property `chat.ts` sets from `resources.ts`, PALETTE included, so a colour
      that moves in `PROSTRED.PR` moves on the page — and the page test compares
      `getComputedStyle` with PALETTE, which the 6.1 test reads back out of the
      engine. Two declarations turned out to be whole behaviours: a clipped box
      with `justify-content: flex-end` *is* `PREFORMATUJ_TEXTY_...`:944-985, and
      `background-size: 100% 100%` *is* `PREKRESLI_OBRAZOVKU` reloading the
      bitmap at the window's size. The one bitmap that tiles is the loading
      window's, because `IDD_NACITANI` is a sub-window (`Nacitani.cpp:77`).

      **It corrected `pohlavi`:** 1 is male, not female, against three witnesses
      in the engine — `pokyd_api.h` and `protocol.ts` had said the opposite since
      3.1 and 7.1 would have inherited it.

      Menu commands that belong to later phases are drawn MF_GRAYED rather than
      doing nothing quietly; `ID_NAPOVEDA_INTERNET` is the one 6.3 can honour,
      and the test asserts it is the only enabled one. `?bezpozadi` is
      `prikaz_nezobrazovatpozadi`, spelled as `ROZEBER_PRIKAZOVY_RADEK` spells
      it.
- [x] 6.4 **Done** — `src/app/greeting.ts` is `NAPIS_UVODNI_UVITANI`
      (`PROSTRED.FU:299`), and the exhibit now says hello before a word is typed.
      A greeting there is not a string but a **list of parts** — his literals with
      a slot wherever he wrote a `+`, named after the CString he put there — so
      `test/app/greeting.test.ts` can parse his own switch back out of the file
      and compare it part for part. **37 checks**, no browser and no engine: the
      ten cases in his order, both `if`s that inflect the three CStrings (all four
      branches, the empty masculine one included), all 18 literals found in
      `PROSTRED.FU` as runs of CP1250 bytes, all 10 × 4 gender combinations
      against a second reading of the same switch, and the draw.

      **The draw is the interesting part, and it is not the engine's.**
      `mfcDlg.cpp:443` calls the greeting *before* `NactiSlovniky()` and it
      reseeds from the clock on the way in (`:307`); a cold load then reseeds
      once more on its way out (`SLOVNIK.FU:1732`). So in 2005 the welcome line
      was never part of the conversation's `rand()` stream, and it is not part of
      ours: `greetingIndex()` is one draw off a mirror of `src/shim/nahoda.cpp`
      with the same seed `chat.ts` hands `pokyd_seed`, and the engine's generator
      is untouched. That is the faithful answer *and* the one that leaves
      `test/golden/rozhovor.txt` byte for byte where it was — the test reads the
      LCG's three constants out of the shim so the two cannot drift apart.

      The one deviation, and it is a timing one: he had the greeting on the
      window all through the load, and here it waits for the engine, because the
      two `pohlavi` that inflect it are the engine's and the page cannot ask
      before `pokyd_init` has run. Seed 20050415 draws greeting 3, so
      `test/app/chat.test.mjs` now knows exactly what the top of the transcript
      says; it grew to **111 checks** and still reproduces the golden
      conversation byte for byte under it.

      It also closed a hole in 6.1: the guard that says no *other* module under
      `src/app/` spells Czech was looking for `\uXXXX` escapes, and this
      repository writes its Czech in UTF-8, so it had been passing vacuously. It
      now looks for both, and covers `main.ts` and `assets.ts` as well.
- [x] 6.5 **Done, and it decided two things — one of them the only deliberate
      deviation in the window.**

      **The transcript scrolls.** `PREFORMATUJ_TEXTY_...`:962 breaks out of the
      draw loop the moment a sentence would cross the top inset, so in 2005 there
      was no scrollbar and the beginning of a long conversation was simply gone:
      the height of the window *was* how much history there was. That is kept
      everywhere except the last clause. `overflow: hidden` became `overflow-y:
      auto`, and a visitor who drags upwards now reaches the hundred sentences of
      `g_poslednich100vet` — the engine's own forgetting, which stays, and which
      is therefore exactly how far back the drag goes.

      The argument for breaking fidelity here, since it is the first time this
      port has: a web page whose scroll gesture does nothing does not read as
      faithful, it reads as broken. Fidelity is what a visitor *sees*, and
      nothing a visitor sees has moved — `scrollToEnd()` pins the newest
      sentence to the bottom after every turn, so the resting view is his to the
      pixel and a screenshot of this page and a screenshot of 2005 are the same
      picture. What changed is only what a gesture he had no input device for
      now does. `chat.css`'s header carries the reasoning, `src/README.md` lists
      it among the things to know before touching the file, and
      `test/app/chat.test.mjs` holds it to the claim: **123 checks**, and the
      golden transcript still byte for byte under them.

      Two mechanics were not obvious and are worth not rediscovering.
      `justify-content: flex-end` — which is what 6.3 bottom-anchored the stack
      with — cannot be used in a scroll container: the overflow goes past the
      *start* edge, which no browser will scroll to. The stack is bottom-aligned
      with `margin-block-start: auto` on the oldest turn instead, which collapses
      to zero the moment the content is taller than the box. And
      `scrollbar-gutter: stable`, because the author reserved fifteen pixels off
      the wrap width (`:856`) precisely so that lines would not re-wrap — a
      scrollbar appearing halfway through a conversation would have re-wrapped
      every line above it. The box is also `tabIndex = 0` with a name on it,
      because a scroll container Chrome will not focus is history reachable by
      mouse alone.

      **The chrome question is answered by having no chrome.** The page is a
      *maximized* window — `IDR_MENU` across the top of the viewport, the client
      rectangle filling the rest — and a maximized window has no title bar and
      no desktop behind it. So there was nothing to draw, and no XP frame, fake
      caption buttons or draggable window is going in: that would be invented UI
      the archive has no source for, and it would be the piece most likely to
      fight 9.3's mobile pass. The one thing it would have bought — resize the
      window to get more history — is what the scroll decision above gives for
      free.

      That closes phase 6 and the "how faithful should the UI be?" question with
      it.

## Phase 7 — Settings and state

Mirrors the `Nastaveni` class (`Vstup/NASTAVEN.PR`) and the dialog over it
(`!Prostre/Nastaveni.cpp`). **Done, 7.1 through 7.5**, and 7.5 is a decision
rather than a thing built.

- [x] 7.1 **Done** — `src/app/dialog.ts` draws IDD_NASTAVENI and
      `src/app/settings.ts` is CNastaveni with the window taken off: his
      `OnInitDialog`, his `OnOK`, his two pages, his name check.
      `node test/app/settings.test.ts` puts **78 checks** on it, every one of
      them parsed back out of `Nastaveni.cpp` rather than written down twice —
      the twelve `LB_ADDSTRING`s, the two `ZOBRAZ_NA_DIALOGU_POLICKO` runs with
      their 0s and 1s, the `IsDlgButtonChecked` pair that writes the gender, and
      all four Czech strings as runs of CP1250 bytes.

      **The layout of this window *is* the resource script**, which the main
      window's was not: a modal dialog is laid out by `MapDialogRect` once and
      nothing moves afterwards, so there is not one measurement in `dialog.ts`.
      What `Nastaveni.cpp` had to say about it on top of the template was the
      two pages his two buttons switch between (a `CTabCtrl` he left commented
      out at :340), the group captions they relabel, and
      `ZOBRAZ_NA_DIALOGU_POLICKO`'s `&`↔`~` swap, which is how a hidden control
      loses its mnemonic — and all three went with the page that is dropped
      below, because with one page nothing is ever hidden. `settings.ts` still
      holds every one of them, and the test still reads them out of his file.

      **It corrected `pohlavi` again, and this time finished it: the second
      value is 2, not 0.** 6.3 got half of it off the `if` that prints "muž";
      the other half is that the `else` branch is a **2**, from four witnesses —
      `OnOK` (:140-143), `PRECTI_NASTAVENI_ZE_SOUBORU` computing
      `kodhodnoty-MUZ__+1` off `MUZ__` 3 and `ZENA__` 4, `NASTAV_STANDARDNE`'s
      own 1, and `PROSTRED.FU:779` inflecting on `== 2`. It matters because
      `VSTUP.FU:1070` assigns the number straight into `Typ_slova::rod`, where 1
      and 2 are the genders the paradigms are indexed by: a 0 written there is
      not a gender at all. The author's own header said "0...muz, 1...zena"
      (`IQPokyd.h:84`), which is wrong twice over and is where the port's
      comments got it.

      **The second page is dropped whole, and that is the one cut in the
      dialog.** `Rozšířené nastavení` (:381-424) is nine controls and two
      buttons, and after the port there was nothing behind any of them: the four
      keyboard ones and their paragraph need `EMULUJ_KLAVESNICI`, which is a
      whole layout that is not ported; the standard-cursor one asks for the DOS
      underscore the program drew itself; the tool tips are twenty-odd
      `Nastaveni.cpp` literals that nothing shows; `Read only mod` guards
      `fopen()` and there are no files here; and `Nezobrazovat pozadí` is the
      author's own command-line switch, which stays one — `?bezpozadi`. Six of
      them were drawn greyed until this change, which is `src/app/menu.ts`'s rule
      for a command with no handler; a page that is *entirely* greyed is a
      different thing, so it is gone instead, with the two buttons that switched
      to it. The dialog is 13 dialog units shorter for it — the row those buttons
      stood in — and everything else keeps the template's own rectangle moved up
      by that one number. `src/app/dialog.ts`'s `DROPPED` is the list and the
      reason for each; `ADVANCED_CONTROLS` stays in `settings.ts` because it is
      the *author's* arrangement and `test/app/settings.test.ts` still holds it
      against his two `ShowWindow` runs.

      **Dropping it left one trap, and `read()` is where it is sprung.** `OnOK`
      writes the whole struct at once (:163-168), so a control that is not on the
      dialog must not be read as "not ticked" — or one OK on a name would clear
      `zobrazovatpopisky`, `klavesniceqwerty` and `prikaz_nezobrazovatpozadi`
      behind the visitor's back. A missing control falls back to what the
      settings already said, and the browser test checks the two that
      `NASTAV_STANDARDNE` leaves on come back out of an OK still on.

      **"Používat zvuky" is live and does nothing**, and that is faithful rather
      than sloppy: the archive ships no `TUKNUTI.WAV`, and the author's own
      bubble help for that checkbox says in capitals that the value does not
      matter while the file is missing.

      **Two deviations, both small and both the platform's.** A two-word name
      got `MessageBox(...,MB_SYSTEMMODAL)` in 2005; `alert()` blocks the whole
      page, so the same two sentences of his are written into the dialog over
      the button row and the focus goes to the edit he sent it to. And the frame
      is ours: phase 6.5 refused to draw an XP title bar on the main window
      because a maximized window has none, but this one is a `DS_MODALFRAME |
      WS_CAPTION | WS_SYSMENU` popup that did have one — so it is drawn, in the
      same XP defaults `chat.css` already dresses IDR_MENU in, carrying the
      template's own CAPTION and an IDCANCEL close box and nothing invented.

      `pouzivatefekty` also stopped being dead: the checkbox is
      `NASTAV_VIDITELNOST_EFEKTNICH_PROGRESSBARU` (`PROSTRED.FU:163`) and the
      two edge bars climb once per sentence, which is `VLAKNO__EFEKTY`'s case 1
      — `pozice += 100` every 20 ms to 1000 and then off, started by
      `mfcDlg.cpp:568` and by nothing else in this build.
- [x] 7.2 **Done, and mostly already done by 6.3.** The caption has moved with
      `nalada` since phase 6.3, because `ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI`
      is called after every answer and `nalada` is recomputed from `naladabody`
      after every sentence (`INTELIG.FU:532`). What 7.1 added is the two other
      places a visitor now sees the same drift: the mood list box opens on it,
      and F7/F8 walk it. `test/app/chat.test.mjs` has watched the caption move
      from `normální` to `výborná` across the golden conversation since 6.3 and
      now checks the list box agrees with it.
- [x] 7.3 **Done — and the stored settings are his file, not JSON.**
      `src/app/config.ts` is `ZAPIS_NASTAVENI_DO_SOUBORU` and
      `PRECTI_NASTAVENI_ZE_SOUBORU` (`SLOVNIK.FU:2081` and `:1911`), written to
      `localStorage` under his own `IQPOKYD.CFG`. That is the decision in the
      phase, and it is not sentiment: his format is a specification with a
      parser already written against it, and porting the parser is how the port
      learns what the settings are. JSON would have been a schema of our
      invention with our own idea of a valid mood.

      `node test/app/config.test.ts` is **67 checks** and almost all of them are
      derived rather than declared: every label his `fprintf` writes, in order;
      every `strcmp(parametr,...)` his reader knows, compared with the lines the
      writer writes, so a file this port wrote would be read by the 2005 binary;
      the four value vocabularies parsed out of his `strcmp` chains; the whole
      round trip for all 35 characters and moods and all five recursion depths
      with their check digit; and nine ways to break the file, each one of his
      `goto CHYBAVSOUBORU`s. His three return values are kept — 0 no file, 1
      read, 2 somebody has been playing with it — and `mfcDlg.cpp:438`'s answer
      to a 2 is kept with them: start again from `NASTAV_STANDARDNE`.

      Two things fell out of writing it. **His reader trusts the first two lines
      absolutely** (`:1931-1934` skips them unread), so a file that has lost its
      header is not refused — the third line is eaten in the header's place and
      whatever it said is quietly not applied. Found by expecting a refusal and
      not getting one; kept, and written down in the test. And **the settings
      file is the one place in this port that spells Czech without diacritics**,
      because he wrote it that way: `prumerny` in the file, `průměrný` on the
      screen.

      **A first visit opens the settings dialog, as it did in 2005.**
      `PRECTI_NASTAVENI_ZE_SOUBORU` returning 0 or 2 set `g_zobrazitnastaveni`
      and the background thread sent the window `ID_NASTAVENI`
      (`PROSTRED.FU:498`). That thread is in `Aplikace/Prostred/`, which
      `BEZ_PROSTREDI` drops whole, so the load calls `openSettings` itself; it
      is the one place in the port where a missing thread is worked around
      rather than written off, because what it does is not environment but the
      program's front door. Being asked who you are is how IQ Pokyd starts —
      the name and the two `pohlavi` inflect everything it says afterwards —
      and a visitor who never finds F4 would never be asked at all.

      It runs **after** the welcome line, which is also where 2005 put it: a
      `SendMessage` from that thread is run by the main thread's message pump,
      which does not turn until `OnInitDialog` has returned. A visitor who has
      been here before has a file that reads (1) and is not asked again — the
      same rule per browser profile that it was per installation — and
      `test/app/chat.test.mjs` checks both halves, because its two visits are
      exactly a first run and a second.

      What is *not* put back is the `MessageBox` a broken file also got
      (`_NEKDO_SI_HRAL_S_NASTAVENIM_`, `PROSTRED.FU:485-496`): it is one of that
      thread's four `hlasky`, none of which this build has, so a 2 opens the
      dialog without the apology in front of it.
      `PokydChatHandle.configStatus()` still reports all three values, so a page
      that wants to tell a 0 from a 2 can.
- [x] 7.4 **Done**, and it is four lines of `mfcDlg.cpp` (:944-972) plus a
      table. `src/app/menu.ts` now binds IDR_ZKRATKY as well as drawing
      IDR_MENU, by the same rule: an accelerator whose command has no handler is
      not bound, exactly as an item with no command is greyed. F7 and F8 move
      `nalada` through `pokyd_set_mood` — which is his two lines, the mood and
      then `SPOCITEJ_NALADABODY_Z_NALADY` — and Ctrl+F7 and Ctrl+F8 move
      `charakter` through the settings, which has no second field to recompute.
      **These four are in no menu at all**, so before 7.4 the accelerator table
      was the only part of the archive the port had read and not used.
- [x] 7.5 **Decided: `PROFIL.IQP` is not ported**, and the decision has three
      legs, the first of which is the platform's rather than a preference.

      What the file holds is `g_posledniodpovedi` (`SLOVNIK.FU:1891`), the
      history of answers it has already given — which
      `VYBER_JEDNU_ODPOVED_Z_ODPOVEDI_PODLE_HISTORIE` consults at
      `INTELIG.FU:59` and `:95` when it picks between equally good answers. So
      it is real conversation state and not a statistic, and restoring it would
      visibly change what IQ Pokyd says.

      1. **The moment it was written does not exist here.** The only caller of
         `ZAPIS_PROFIL_DO_SOUBORU` is `CMfcDlg::OnClose` (`mfcDlg.cpp:633`). A
         web page has no reliable close: `beforeunload` is best-effort and a
         mobile tab is usually killed rather than closed. A profile that is
         saved most of the time is worse than one that is not saved at all,
         because "what it remembers about you" would then depend on how you left.
      2. **There is no door in the API for it.** `pokyd_export_cache` is
         `SLOVNIK.TMP` by name (`pokyd_api.h`), so this would need two more
         exports, a protocol pair and a second store — for a file of a few
         hundred bytes.
      3. **It would cost the port's strongest check.** `test/app/chat.test.mjs`
         reproduces the golden transcript on a first visit *and* on a second,
         and that is the claim that the browser and the 2005 binary are the same
         program. A persisted answer history makes the second visit a different
         conversation by design. The golden transcript was recorded from the
         native driver, which never writes the file either — so not porting it
         is also what keeps the two runtimes comparable.

      Reading it is already wired and stays: `pokyd_api.cpp:209` calls
      `PRECTI_PROFIL_ZE_SOUBORU` in the loading sequence, which is
      `POKYD_PHASE_EXTERNAL`, and it returns 0 when there is no file — which is
      every visit. If a later phase wants it, the honest shape is the one 4.4
      already has for `SLOVNIK.TMP`: export on a `visibilitychange`, key it
      beside the dictionary hash, and give the test a switch to ignore it.

## Phase 8 — Extras

- [x] ~~8.1 Conversation log (the original's `KYDY.TXT`)~~ — **dropped, with the setting
      that switched it.** `ukladatrozhovor` wrote `KYDY.TXT` next to the executable; a
      page has no next-to, an in-memory transcript offered as a download would be a
      feature of ours rather than his, and since 6.5 the conversation is already on the
      screen and scrolls back the hundred sentences `g_poslednich100vet` keeps. So there
      is nothing left for the tick to promise, and `IDC_UKLADATROZHOVOR` is the ninth
      entry in `DROPPED` (`src/app/dialog.ts`) — **the first one taken off the page that
      *is* drawn**, which is what made `droppedRows` necessary: a band with nothing in it
      closes up, so the three checkboxes under it move into its place and "Prostředí"
      gets 11 dialog units shorter. The setting itself is untouched: `NASTAV_STANDARDNE`
      still sets it to 1, the engine still carries it, and `src/app/config.ts` still
      writes `Ukladat rozhovor: ano` into `IQPOKYD.CFG`, because that file is his format
      and not ours to edit.
- [x] **8.2 Help / about / version screens.** ~~`res/html1.htm` and the `.HLP` files are
      the source.~~ **They are not, and that line was wrong.** `res/html1.htm` is a
      forty-byte AppWizard stub that says "Ahoj!!", and the two `.HLP` files are WinHelp
      binaries nothing in the program opens. The three screens are **string literals in
      the source**: `ZOBRAZ_NAPOVEDU` (`PROSTRED.FU:775`), `CMfcDlg::OnOverzi`
      (`mfcDlg.cpp:815`) and `CAboutDlg::OnInitDialog`'s paragraph of thanks (`:705`).
      All three are in `src/app/help.ts`, and `test/app/help.test.ts` **reassembles each
      of them out of the author's own C string literals** — splice for splice, macro
      included — and compares them for a man and for a woman. 40 checks, and they passed
      on the first run, so the transcription is byte-exact.

      The windows are `src/app/screens.ts`: `IDD_TEXT` twice over and `IDD_ABOUTBOX`
      once, in the frame phase 7.1 invented and phase 8.2 moved into `src/app/frame.ts`
      so that all four of his dialogs share one. The rich edit is the interesting half —
      `NAPIS_FORMATOVANY_TEXT_NAPOVEDY` (`:1116`) reads four tags and sends one
      `EM_SETCHARFORMAT` per run between them, and each argument is one CSS declaration:
      `<u>` is a *double* underline, `<c>` is `crBackColor 0x00FFE0D0` and therefore
      `#d0e0ff` byte-reversed, `<h>` is 350 twips against the body's 220.

      **The menu was merged and three commands were dropped**, which is the other half of
      8.2 and the only place this port rearranges the author's own menu:
      `exhibitMenu` in `src/app/caption.ts`, with `DROPPED_COMMANDS` beside it.
      `ID_KONEC` closes a window a page does not own; `ID_NAPOVEDA_INTERNET` and
      `CAboutDlg`'s own `IDC_INTERNET` both open `http://iqpokyd.kyblsoft.cz`, which has
      not answered in twenty years; and `ID_VELKANAPOVEDA` shells out to
      `JMENO_SOUBORU_S_NAPOVEDOU`, which is `CTI_ME.HTM` (`KONSTANT.K:29`) and **is not
      in the archive at all** — it shipped beside the executable. Four commands are left
      and four items do not want two popups, so the two are one, in his order, with a
      separator where they met. **Nothing on the bar is greyed any more**, which closes
      the rule phase 6.3 opened: every item drawn has a handler.
- [x] ~~8.3 Attribution page~~ — **dropped: 8.2 made it redundant.** `IDD_ABOUTBOX` is
      the attribution page and always was — Aleš Janda © KÝBLSoft 1999-2005, ":: freeware
      ::", the KÝBLSoft logo, both addresses and the whole paragraph of thanks — and the
      Malá nápověda signs off with the same name and the same two addresses. His name is
      on the main window before a menu is opened (`IDC_NADPIS1`, `IDC_NADPIS3`). A page
      of ours saying it a third time would be the only screen in the exhibit he did not
      write. `original/info.txt` belongs in the README instead (9.1), which is where the
      licensing note (9.2) already had to live.
- [x] **8.4 The cheat panel.** `IDD_DEBUGNASTAVENI`, drawn whole — **the only one of his
      four dialogs this port draws with nothing dropped and nothing greyed.**
      Ctrl+Shift+Alt+D, which is `ID_CHEAT_DEBUGINFO` and the one entry in `IDR_ZKRATKY`
      with all three modifiers, or `::debuginfo` typed into the sentence line
      (`mfcDlg.cpp:562`) — his two doors, and both work, the second one returning before
      the engine or the input line is touched, exactly as `OnNovaVeta` does.

      **It needed new C.** The report prints ten globals that live inside the engine's own
      translation unit and nothing outside it could reach one, so `pokyd_api.h` grew a
      second struct — `pokyd_debug`, filled by `pokyd_debug_info` in one call because the
      author's own tool tip claims it is a snapshot ("platné v okamžiku spuštění tohoto
      dialogu") — plus `pokyd_set_mood_points`, which is `pokyd_set_mood` the other way
      round. Eighteen exported functions now, and **the five counters in that struct are
      `unsigned int` rather than the engine's `DWORD`**: `src/web/engine.ts` reads it out
      of the heap against a written-down table of offsets, and `long` is four bytes on
      wasm32 and on Windows and eight on Linux, so a width that followed the data model
      would put that table right on one host and wrong on another. `pokyd_api.cpp` carries
      a `static_assert` on the size and `engine.ts` throws on the table, so the two cannot
      drift apart quietly.

      Everything else in it is the author's, including the parts that read oddly:
      "Minimální počet slov" is `debug_maxpocetvsechslov`, the high-water mark, and
      "Aktuální nálada počítače" prints `naladabody` with the `nalada` word beside it.
      `src/app/debug.ts` is `CDebugNastaveni` with the window taken off and
      `test/app/debug.test.ts` reads all of it back out of `debugnastaveni.cpp` — his
      `sprintf`, his two `CheckDlgButton` switches, both refusals, the one `MB_OKCANCEL`
      and all twelve `AddTool` calls. **His `OnOK` is a loop and not a parse**, and that
      is visible from outside: `999x` is refused for being out of range rather than for
      the `x`, because the overflow test fires on the third 9 before the fourth character
      is ever read. The test checks it with exactly that input.

      Two things it makes good that earlier phases wrote off. The twelve tool tips are
      **the only tool tips in the port** and are the best writing in the archive — a
      paragraph per option explaining what it really does — so `zobrazovatpopisky`
      means something again, and with it the closing note the report grows when it is
      off. And the `MB_OKCANCEL` is the only question in the whole program: moving one of
      the three parameters that change how the engine reads a sentence asks before it
      saves, and Cancel abandons the whole of `OnOK`, the mood included (`:218`). A page
      has no modal that is not a lie, so the question is written into the dialog over the
      buttons, where the two refusals already go, and the second press of OK is the
      answer.

## Phase 9 — Ship

- [x] **9.0 The web edition says so on its own two screens.** Everything in this port is
      the author's except the fact that it is a web page in 2026, and that is exactly
      what a visitor opening *Informace o verzi* or *O programu* wants told. Both are in
      `src/app/exhibit.ts` — **the only file here that writes Czech of its own**, and the
      second place after `exhibitMenu` that this port changes what he made:
      - *Informace o verzi* gets a **preface, not a rewrite**: `webVersionText` puts a
        second `<h><u>` heading and a paragraph above `CMfcDlg::OnOverzi`'s text and
        leaves that text alone, so `test/app/help.test.ts` goes on comparing it with
        `mfcDlg.cpp` character for character.
      - *O programu* loses `http://iqpokyd.kyblsoft.cz`, `iqpokyd@kyblsoft.cz` and the
        "Web: / E-mail:" label over them — the `DROPPED_COMMANDS` argument, twice: a site
        that has not answered in twenty years and a mailbox behind a dead domain. In
        their place `exhibitAbout` puts a second group box, **Upozornění 2026**, in his
        own rectangle a line taller, with the one address on that screen that does answer
        as a real link. The logo, the copyright line and the thanks are untouched.

      `exhibitAbout` is a pure function over the parse in `src/app/resources.ts` — it
      drops three controls, adds two, and moves the rest by two offsets it computes off
      his own geometry, so `src/app/resources.ts` stays generated and unedited.
      `node test/app/exhibit.test.ts` is 50 checks on both halves, and
      `test/app/chat.test.mjs` grew to **371**: it measures the new caption against the
      rectangle it was given **in a real browser** and fails if the words hang out of it,
      which is the one thing dialog-unit arithmetic cannot tell you.
- [x] **9.1 `README.md`, and there was none before it.** What this is, whose it is,
      what changed and why, how to build it and how to open the debug menu — short,
      because `PLAN.md` is the long version and `PATCHES.md` is the audit. The "what is
      different" list is five items and it is the whole of them: the three dropped menu
      commands, the two dead addresses off *O programu*, the one settings page instead
      of two, the transcript that scrolls, and the settings in `localStorage` with no
      `PROFIL.IQP` behind them. **`original/info.txt` is reproduced in full at the
      foot**, which is what phase 8.3's dropped page was for.
- [x] **9.2 Licensing note, in the README.** It describes the situation rather than
      resolving it: `info.txt` says GNU/GPL and in the next sentence says no commercial
      use, adding a restriction is the one thing the GPL rules out, so the two halves
      cannot both be in force and nothing in the archive says which one is. The author
      has not been reachable at either address in that file for many years. What the
      port does instead is keep both halves of what he asked for — attribution on the
      screen and in every file of his, `info.txt` whole, source open, no money — and
      asks a fork to do the same.
- [x] **9.3 Static deploy, and the mobile layout renders.** <https://timichal.github.io/pokyd/>
      driven at 390×844 over CDP: no horizontal overflow (`documentElement.scrollWidth`
      is 390), the menu bar and its live caption are on the first line, `IDD_NASTAVENI`
      opens on arrival and fits inside the viewport, the transcript takes 725 px of the
      820 the client gets, and the sentence line and *Řekni* sit on the bottom row. The
      one thing that touches at that width is the heading row — "IQ Pokyd v0.15" and
      "KÝBLSoft 2005" meet with no gap. They are `WINDOW_LAYOUT`'s own rectangles, so
      that is his geometry in a narrower window and not a bug in ours.
- [x] **9.4 Final pass, run against the deployed page and not a local build.**
      `?seed=20050415&mood=3`, *Storno* on the settings dialog it opens by itself, then
      all 23 sentences of `test/golden/rozhovor.in` typed into the sentence line and
      sent with *Řekni*. The 46 lines read back off the screen are
      `test/golden/rozhovor.txt` **byte for byte** — the transcript the native MinGW
      build printed at phase 1.6, now coming out of a Linux-built wasm module in Chrome
      on a GitHub Pages URL. Ctrl+Shift+Alt+D and `::debuginfo` both open
      `IDD_DEBUGNASTAVENI` there, and F4, F1, Shift+F1, Alt+V, F7 and Ctrl+F7 all do
      what `IDR_ZKRATKY` says. Locally, `npm test` is **18 of 18**.

---

## Reference

- **What a visitor or a fork reads first: `README.md`** — phase 9.1 and 9.2, and the
  only document here written for someone who has not read this file. It has the five
  differences from the original, the build and run commands, the two ways into the debug
  menu, the licensing note and `original/info.txt` in full. Keep it short: `PLAN.md` is
  the long version.
- **Changes to original code: `PATCHES.md`.** One line so far. It pairs with
  `python3 tools/transcode.py --check`, which names every file differing from the
  original; that list and `PATCHES.md` must agree, and `diff -r build/src build/cp1250`
  shows the patch set as a diff.
- Source pipeline and how to regenerate it: `src/README.md`.
  `tools/gen-src.py` (original → `build/src/`), `tools/transcode.py`
  (`build/src/` ⇄ `src/engine/` → `build/cp1250/`), `tools/dump-dict.py` (dictionary decoder).
- Rule base: `python3 tools/build-gramatik.py` builds the author's `GRAMATIK.C` out of
  `original/` (unpatched), recompiles `GRAMATIK.IQZ` → `build/gramatik/IQPOKYD.IQP`,
  verifies both checksum pairs and compares the result against the shipped `IQPOKYD.IQP`.
  **`tools/build.py` runs it**, so this is a build step and not just an audit — phase 2.5.
  `--force` rebuilds past the stamp, `--dump FILE` writes the decoded rules as readable
  CP1250 text. It is also the `.IQP` decoder, mirroring `PRECTI_INTELIGENCI_ZE_SOUBORU`
  (`Slovnik/SLOVNIK.FU:1348`).
- Building: `python3 tools/build.py`. Every flag is justified in that file's docstring, and
  the Win32/MFC replacement it compiles against is `src/shim/`, described in `src/README.md`.
  It also compiles the rule base (via `build-gramatik.py`) and lays out `build/run/`, the
  working directory the driver wants.
- Running it: `build/native/pokyd.exe --data build/run` (`--help` for the options).
  `src/driver/pokyd.cpp` says at each call site which line of the original it mirrors.
- The JS boundary: `src/web/cp1250.ts` is the codec and the only place a byte becomes a
  character in either direction — phase 4.1. Its 256-entry table's provenance, and the
  two policy decisions encode had to make, are in that file's header; the evidence is in
  `test/web/cp1250.test.ts`, run with plain `node`.
- The worker: `src/web/protocol.ts` is the vocabulary, `src/web/engine.ts` drives the
  wasm module, `src/web/worker.ts` is the thread and `src/web/client.ts` the page's half
  — phase 4.2, and `src/README.md` has the table. Read `PROGRESS` at the foot of
  `protocol.ts` before designing anything that shows a loading bar.
- The page: `index.html` is the Vite entry, `src/app/chat.ts` is the whole of what a
  visitor sees and `src/app/main.ts` is what `index.html` runs — phase 5.1, and
  `src/README.md` has the table and the three things worth knowing before changing any
  of them. `npm run dev` serves it, `npm run build` writes `dist/`.
- The four text screens: `src/app/help.ts` is the words — `ZOBRAZ_NAPOVEDU`,
  `CMfcDlg::OnOverzi` and the about box's thanks, all three of them string literals in
  the archive rather than resources — plus `markup()`, the parsing half of
  `NAPIS_FORMATOVANY_TEXT_NAPOVEDY`. `src/app/screens.ts` draws `IDD_TEXT` and
  `IDD_ABOUTBOX` over it, `src/app/frame.ts` is the window all four of his dialogs wear,
  and `node test/app/help.test.ts` reassembles every one of those strings out of his own
  C string literals — phase 8.2. Read `DROPPED_COMMANDS` in `src/app/caption.ts` before
  wondering where a menu item went, and `src/app/exhibit.ts` for the two paragraphs on
  those screens that are ours and not his.
- What is *not* his: `src/app/exhibit.ts` — the 2026 preface on *Informace o verzi* and
  the **Upozornění 2026** box that replaced the two dead addresses in `IDD_ABOUTBOX`
  (phase 9.0). It is the only file in the port that writes Czech of its own, and with
  `DROPPED_COMMANDS` in `src/app/caption.ts` it is one of the two places this port
  changes what the author made. Read it before wondering where the web address went.
- The cheat panel: `src/app/debug.ts` is `CDebugNastaveni` with the window taken off and
  `src/app/cheat.ts` draws `IDD_DEBUGNASTAVENI` over it — phase 8.4, and the only one of
  his dialogs the port draws whole. `node test/app/debug.test.ts` reads his `sprintf`,
  his two switches, both refusals, the `MB_OKCANCEL` and all twelve tool tips back out of
  `debugnastaveni.cpp`. Ctrl+Shift+Alt+D, or type `::debuginfo`. What it reads out of the
  engine is `pokyd_debug_info` (`src/api/pokyd_api.h`); the note there about `unsigned
  int` is load-bearing on Linux.
- The settings: `src/app/settings.ts` is `CNastaveni` with the window taken off —
  his `OnInitDialog`, his `OnOK`, his name check and the two lists of controls his
  two pages showed — and `src/app/dialog.ts` draws IDD_NASTAVENI over it (phase
  7.1), minus the second of those pages: `DROPPED` there is what is not drawn and
  why. `src/app/config.ts` is `IQPOKYD.CFG`, his own file format, in
  `localStorage` under his own file name (phase 7.3). Read the header of
  `settings.ts` before touching any of the three: it has the four things reading
  the C got right, `pohlavi` being 1 or 2 among them.
- Deploying it: `.github/workflows/deploy.yml` — phase 5.3. It builds the engine, the
  rule base and the page from source on a Linux runner, gates on the golden
  conversation, and publishes `dist/` to GitHub Pages. Nothing compiled is committed,
  which is why it reproduces the whole chain rather than uploading an artefact.
- All the tests: `npm test`, which is `node test/run.mjs` — eighteen programs in phase
  order, `--quick` for the fourteen that do not launch a browser. The one that says the
  port works is `test/app/chat.test.mjs`, phase 5.2: it builds the app, drives the
  built page through the golden conversation in Chrome and compares what was on the
  screen with `test/golden/rozhovor.txt`.
- The author's resource script, read: `node tools/extract-rc.mjs` parses
  `original/IQ Pokyd/!Prostre/IQPokyd.rc` into `src/app/resources.ts` — phase 6.1.
  `--check` says whether that file is stale, `--dump` prints the parse readably, and
  `node test/app/resources.test.ts` is what stops the generated file being edited by
  hand. It is the place to look for any string, id or dialog rectangle of the
  original, and its header records the three things the script does *not* contain:
  the main window's runtime layout, the palette, and the dialog base units.
- The author's pictures, transcoded: `node tools/extract-assets.mjs` decodes every
  image in `BITMAPS` and `ICONS` out of the archive and writes `src/app/assets/`
  plus `src/app/assets.ts` — phase 6.2. `--check` says whether they are stale,
  `--dump` prints the sizes, and `node test/app/assets.test.ts` compares all
  eighteen with the archive pixel for pixel. Read that file's header before
  drawing with any of them: it is where the ICO mask, the one miscased path and
  the indexed-PNG decision are written down. **Do not edit `src/app/assets.ts` or
  anything under `src/app/assets/`** — run the extractor.
- Running a page in a browser: `test/browser.mjs` serves the repo over loopback, launches
  headless Chrome or Edge at it, and takes the results back on `POST /result`. It
  strips the types out of `.ts` on the way through, so a browser imports `src/web/*.ts`
  unbundled at the same specifiers node uses. No driver, no puppeteer, and nothing
  out of `node_modules` — it predates 5.1's `package.json` and does not use it.
- Engine entry point: `IQ_POKYDE_ODPOVEZ` — `Aplikace/Prostred/PROSTRED.FU:212`, and it is
  not the whole story: `!Prostre/mfcDlg.cpp:596-607` wraps it in the pre-processing the
  engine assumes has happened. Both are reproduced in `src/driver/pokyd.cpp`.
  Pipeline is `POROZUMEJ_VETE_NAPSANE_CLOVEKEM` → `ZPRACUJ_VETU`
  (= `ROZEBER_NEINTELIGENTNE_VETU` + `ODPOVEZ_PODLE_IQ_PODMINEK`) →
  `VYBER_JEDNU_ODPOVED_Z_ODPOVEDI_PODLE_HISTORIE`.
- Rule evaluation: `PRECTI_IQ_PODMINKU` — `Aplikace/Intelig/INTELIG.FU`.
- Reply generation: `ODPOVEZ_PODLE_IQ_PODMINEK` — same file.
- Binary formats: `original/IQ Pokyd/Specifik/Binarni/`. The `ZAKLSLOV.TXT` description is
  accurate and was confirmed against a working decoder.
- `Specifik/Textove/INTELIG.TXT` describes **4** answer variants. It is out of date — the real
  format is 7. `Specifik/info.txt` warns the specs are stale. Trust `GRAMATIK.C`.
- File signatures: 1 = base dictionary, 2 = full dictionary, 3 = grammar/intelligence,
  4 = user profile, 5 = conversation records.
