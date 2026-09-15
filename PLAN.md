# Porting IQ Pokyd 0.15 to the web

A working plan, spanning multiple sessions. Check items off as they land.

**Goal:** a faithful, browser-playable recreation of IQ Pokyd 0.15 — a museum piece,
not a fork. Same engine, same answers, same look, running at a URL.

---

## Status

**Phase:** 1 — building the engine natively. 1.1 and 1.2 done.

**Next action:** Phase 1, step 1.3 — stub the Win32/MFC surface and get the first real
compile. 1.1 and 1.2 have only ever run the preprocessor; nothing has been compiled yet.

---

## Toolchain on this machine

Probed 2026-09-15. `gcc`/`g++` MinGW-W64 16.1.0 (ucrt64), `python` 3.14.7.
**No `clang`, no `cl`, no `emcc`** — Emscripten has to be installed before Phase 3 starts.
Phase 1 targets MinGW g++; expect to re-diff everything once clang enters the picture, since
hazard 1 (`char` signedness) differs between the two by default.

## Conventions

- **Never commit.** Michal commits everything himself. Leave changes in the working tree.
- `original/` is read-only. It is the archive. Never edit files in it; copy out instead.
- **`src/engine/` is the canonical source tree** (UTF-8). Edit there and nowhere else.
  Everything under `build/` is generated and gitignored — `build/src/` is the CP1250
  mirror of `original/`, `build/cp1250/` is what the compiler is actually pointed at.
- Original sources are **CP1250**, uniformly — see hazard 6, the "Latin 2" is data, not
  a second source encoding. Anything new we write is UTF-8.
- The engine speaks CP1250 bytes internally, end to end. Convert **only** at the JS boundary.
- Line endings are CRLF everywhere and `.gitattributes` pins them. The byte-exactness
  proof in `transcode.py --check` compares files on disk, so a clone that checked out LF
  would fail it.
- Comments and identifiers in ported/shim code stay in the original's Czech where they
  mirror original names, so the two can be diffed by eye.

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
| `original/IQ Pokyd/Data/Intelig/IQPOKYD.IQP` | 71 KB | Same rules, compiled + obfuscated. Header says 1999-**2004** while `GRAMATIK.C` writes 1999-**2005**, so this was built by an older compiler than the source we have. See task 2.4. |

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
2. **Format-string bug with user input.** `POROZUMEJ_VETE_NAPSANE_CLOVEKEM` (`VSTUP.FU:774`)
   does `sprintf(g_vetacloveka.slova[poziceslova].vlastnislovo, slovo)` — the user's own word
   as a format string. Typing `%s` will crash or leak memory. Must become `strcpy`. This is a
   required fix, not a cleanup.
3. **Hardcoded absolute includes.** ~~Every `.IN` file uses `#include "\!IQPokyd\!Zdrojak\..."`
   and `DOS.IN` uses `f:\!iqpokyd\...`.~~ **Solved in 1.1** by `tools/gen-src.py`, which mirrors
   the tree into `build/src/` with those paths rewritten relative. Note that no `-I` flag can
   fix this in place: gcc on Windows reads a leading `\` as "root of the current drive", so the
   path is *absolute* and the include search path is never consulted.
4. **Undefined behaviour under optimization.** Heavy `goto`, globals, fixed buffers, and at
   least one uninitialized read (`nejlepsiodpoved` in `VRAT_CISLO_ODPOVEDI_PODLE_HISTORIE`
   when every variant is in history). Build `-O1 -fno-strict-aliasing -fwrapv` and do not
   reach for `-O2` without re-diffing output.
5. **Startup cost.** 11,207 base words inflected into every form, capped at
   `MAX_POCET_VSECH_SLOV 500000`. Needs `ALLOW_MEMORY_GROWTH` and probably a few hundred MB
   of heap. Mitigation is built in: the engine already writes and reads a `SLOVNIK.TMP` cache
   (`ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU` / `PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU`).
   Persist that blob to IndexedDB and later loads skip the whole thing.
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

---

## Open questions

- [ ] Does the shipped `IQPOKYD.IQP` match `GRAMATIK.IQZ`? (task 2.4) If not, which wins?
      Leaning: recompile from the text source, since that's readable and diffable.
- [ ] **Line endings in the archive.** Every text file in `original/` was first committed
      under `core.autocrlf=true`, so git stores it LF-normalized and checks it out CRLF —
      the true bytes of the source drop are not recoverable from this repo. Harmless for
      source (whitespace), but `GRAMATIK.IQZ` is *data* the rule compiler parses by line, so
      a stray `\r` could land in a field. `.gitattributes` pins the checkout to CRLF so the
      behaviour is at least deterministic everywhere. Task 2.4 settles it for free: if the
      recompiled `IQPOKYD.IQP` matches the shipped one, CRLF was right. If Michal still has
      the original archive, re-adding `original/` under the new attributes would restore the
      true bytes — his call, and his commit.
- [ ] How faithful should the UI be? The original's assets are all here — 1.2 MB background
      bitmap, custom TTF, menu bitmaps, and `IQPokyd.rc` with exact dialog layouts. Decide at
      Phase 6 once there's something running.
- [ ] Do we want the debug/cheat panel (`Ctrl` shortcuts, `debugnastaveni.cpp`,
      `Debug/CHEAT.FU`)? It exposes mood points, last subject/predicate/object. Fun for a
      museum piece. Low priority.

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
- [ ] 1.3 Stub the Win32/MFC surface: build with `BEZ_PROSTREDI` and `IQPOKYDWINMFC=0`,
      stub `conio.h`, `NAHLAS_CHYBU`, `NAPIS_TEXT_V_LATIN_2`, and the `g_handletext*` /
      `g_procentanacitani` progress globals.
- [ ] 1.4 Apply the required fixes **in `src/engine/`**: `sprintf`→`strcpy` (hazard 2),
      `-fsigned-char`, `-fwrapv -fno-strict-aliasing -O1`. Record every change to original
      code in `PATCHES.md` with file, line, and why. From here on `transcode.py --check`
      will list those files as differing from the original; that list and `PATCHES.md` must
      agree, which makes the check an audit of the patch set.
- [ ] 1.5 Console driver: load `slovnik.iqp` + `IQPOKYD.IQP`, read stdin lines, print replies.
- [ ] 1.6 **Milestone: hold a conversation in Czech in a terminal.** Save a transcript to
      `test/golden/` as the reference for later diffs.

## Phase 2 — Data

- [x] 2.1 Decoder for `slovnik.iqp` — **done**, `tools/dump-dict.py`. Verified against the
      real file: 11,207 words, both checksums pass. `--all` dumps every entry, `-o` writes
      UTF-8 to a file. Confirms the info field: nouns/adjectives carry one paradigm byte
      matching `KONSTANT.K` (`pan:\x01` = `_pan_`, `abeceda:\x07` = `_zena_`,
      `pancéřový:\x1f` = `_mlady_`), verbs carry paradigm + aspect (`žvatlá:J\x01` =
      `_dela_` 74, vid 1). Only needed for inspection — the wasm engine reads the binary
      itself.
- [ ] 2.2 Decide which dictionary ships. Default: `original/slovnik.iqp` (11,207 words).
      Note in the README that it came from the released binary, not the source drop.
- [ ] 2.3 Build `GRAMATIK.C` as a host tool; recompile `GRAMATIK.IQZ` → `IQPOKYD.IQP`.
- [ ] 2.4 Diff the recompiled `IQPOKYD.IQP` against the shipped one, modulo the random
      obfuscation padding and header text. Resolves the 2004/2005 question above — and the
      line-endings question, since the shipped `.IQP` is binary and was never normalized
      while `GRAMATIK.IQZ` was. If they differ only in ways that track `\r`, that is the
      answer.
- [ ] 2.5 Pick the shipping rule base and record the decision here.

## Phase 3 — WebAssembly

- [ ] 3.1 `src/engine/pokyd_api.c` — the exported surface. Keep it minimal:
      `pokyd_init`, `pokyd_load_dictionaries`, `pokyd_say` (CP1250 in → CP1250 out),
      `pokyd_get_settings` / `pokyd_set_settings`, `pokyd_progress`,
      `pokyd_export_cache` / `pokyd_import_cache`.
- [ ] 3.2 Emscripten build: `-fsigned-char -O1 -fwrapv -fno-strict-aliasing`,
      `ALLOW_MEMORY_GROWTH`, `MODULARIZE`, preload `slovnik.iqp` + `IQPOKYD.IQP` into MEMFS.
- [ ] 3.3 Node smoke test: same inputs as 1.6, diff against the native transcript.
      **They must match exactly.** Any divergence is a hazard-1/4 bug — fix before moving on.
- [ ] 3.4 Measure cold-start time and peak heap. Decide whether the `SLOVNIK.TMP` cache is
      required for launch or a later optimization.

## Phase 4 — JS boundary

- [ ] 4.1 CP1250 ⇄ UTF-16 codec, both directions, with the full 256-entry table. Unit tests
      covering `ě š č ř ž ý á í é ů ú ň ť ď ó`.
- [ ] 4.2 Run the engine in a Web Worker; typed message protocol.
- [ ] 4.3 Wire up loading progress (`g_procentanacitani`) to real UI feedback.
- [ ] 4.4 Persist the `SLOVNIK.TMP` cache blob to IndexedDB, keyed by dictionary hash.
      Restore on subsequent loads.

## Phase 5 — Vertical slice

- [ ] 5.1 Vite + TypeScript project. Plainest possible chat page: input, transcript, nothing else.
- [ ] 5.2 **Milestone: hold a conversation with IQ Pokyd in a browser.**
- [ ] 5.3 Deploy it somewhere as a checkpoint, even ugly.

## Phase 6 — The retro UI

All the original assets are in `original/IQ Pokyd/!Prostre/res/`.

- [ ] 6.1 Read `IQPokyd.rc` — it's an exact spec for the dialogs, menus, and strings.
- [ ] 6.2 Extract and transcode: `pozadi-iqpokyd.bmp` and friends → PNG/WebP,
      `iqpokyd.ttf` → WOFF2, `IQPokyd.ico` → favicon.
- [ ] 6.3 Rebuild the main window: background, menu bar, the sentence/answer panes,
      the live "name × name, character: mood" menu caption (`ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI`).
- [ ] 6.4 Rebuild the welcome line — `NAPIS_UVODNI_UVITANI` picks one of 10 greetings,
      gender-inflected.
- [ ] 6.5 Decide how far to take it — window chrome? XP styling? (See open questions.)

## Phase 7 — Settings and state

Mirrors the `Nastaveni` class (`Vstup/NASTAVEN.PR`).

- [ ] 7.1 Settings dialog: genders, names, character (0–6), mood (1–5), `spisovná čeština`
      toggle, save-conversation toggle.
- [ ] 7.2 Mood drift across a session; menu caption updates live.
- [ ] 7.3 Persist settings to localStorage (the original used `IQPOKYD.CFG`).
- [ ] 7.4 Mood/character keyboard shortcuts from the original menu
      (`OnZlepseniNalady` / `OnZhorseniNalady` / `OnZlepseniCharakteru` / `OnZhorseniCharakteru`).
- [ ] 7.5 Decide whether to port the profile file (`PROFIL.IQP`) — what the bot remembers
      about you between sessions.

## Phase 8 — Extras

- [ ] 8.1 Conversation log (the original's `KYDY.TXT`) — keep in memory, offer as a download.
- [ ] 8.2 Help / about / version screens. `res/html1.htm` and the `.HLP` files are the source.
- [ ] 8.3 Attribution page: Aleš Janda / KÝBLSoft, `iqpokyd.kyblsoft.cz`, plus `info.txt`
      reproduced in full.
- [ ] 8.4 Optional: debug/cheat panel (see open questions).

## Phase 9 — Ship

- [ ] 9.1 README: what this is, whose it is, how it was ported, what changed and why
      (link `PATCHES.md`).
- [ ] 9.2 Licensing note. The author released under GNU/GPL *and* added "no commercial use",
      which the GPL does not actually permit as a combination. Whatever we conclude, the
      practical commitments are: keep attribution, keep `info.txt`, don't monetize it.
- [ ] 9.3 Static deploy. Check the mobile layout at least renders.
- [ ] 9.4 Final pass: compare a long browser conversation against the Phase 1 native
      transcript one more time.

---

## Reference

- Source pipeline and how to regenerate it: `src/README.md`.
  `tools/gen-src.py` (original → `build/src/`), `tools/transcode.py`
  (`build/src/` ⇄ `src/engine/` → `build/cp1250/`), `tools/dump-dict.py` (dictionary decoder).
- Engine entry point: `IQ_POKYDE_ODPOVEZ` — `Aplikace/Prostred/PROSTRED.FU:212`.
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
