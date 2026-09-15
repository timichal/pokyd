# Porting IQ Pokyd 0.15 to the web

A working plan, spanning multiple sessions. Check items off as they land.

**Goal:** a faithful, browser-playable recreation of IQ Pokyd 0.15 — a museum piece,
not a fork. Same engine, same answers, same look, running at a URL.

---

## Status

**Phase:** 0 — nothing built yet. Planning complete.

**Next action:** Phase 1, step 1.1 — get `Aplikace/` compiling as a native console binary.

---

## Conventions

- **Never commit.** Michal commits everything himself. Leave changes in the working tree.
- `original/` is read-only. It is the archive. Never edit files in it; copy out instead.
- Original sources are **CP1250** (a few stragglers are Latin-2). Anything new we write is UTF-8.
- The engine speaks CP1250 bytes internally, end to end. Convert **only** at the JS boundary.
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
3. **Hardcoded absolute includes.** Every `.IN` file uses `#include "\!IQPokyd\!Zdrojak\..."`
   and `DOS.IN` uses `f:\!iqpokyd\...`. Needs a generated shim include tree or a sed pass.
4. **Undefined behaviour under optimization.** Heavy `goto`, globals, fixed buffers, and at
   least one uninitialized read (`nejlepsiodpoved` in `VRAT_CISLO_ODPOVEDI_PODLE_HISTORIE`
   when every variant is in history). Build `-O1 -fno-strict-aliasing -fwrapv` and do not
   reach for `-O2` without re-diffing output.
5. **Startup cost.** 11,207 base words inflected into every form, capped at
   `MAX_POCET_VSECH_SLOV 500000`. Needs `ALLOW_MEMORY_GROWTH` and probably a few hundred MB
   of heap. Mitigation is built in: the engine already writes and reads a `SLOVNIK.TMP` cache
   (`ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU` / `PRECTI_DATABAZI_SLOV_Z_UPLNEHO_SLOVNIKU`).
   Persist that blob to IndexedDB and later loads skip the whole thing.
6. **Mixed source encodings.** `VSTUP.FU` fails CP1250 decoding at line 1156 — there are
   Latin-2 bytes mixed in (the code has `PREVED_Z_LATIN_2_NA_WINDOWS_1250` helpers). Normalize
   deliberately, don't let a tool guess.
7. **`conio.h`, `_getch`, DOS-isms.** Present in the debug paths. Stub them.

---

## Open questions

- [ ] Does the shipped `IQPOKYD.IQP` match `GRAMATIK.IQZ`? (task 2.4) If not, which wins?
      Leaning: recompile from the text source, since that's readable and diffable.
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

- [ ] 1.1 Create `build/` with a generated shim include tree so `\!IQPokyd\!Zdrojak\Aplikace\...`
      resolves. Do not edit `original/`.
- [ ] 1.2 Normalize a working copy of the sources to UTF-8 (`src/engine/`), handling the
      Latin-2 stragglers in `VSTUP.FU`. Keep a byte-exact CP1250 copy too — the engine's
      *runtime* strings must stay CP1250 even if the *source files* are UTF-8.
- [ ] 1.3 Stub the Win32/MFC surface: build with `BEZ_PROSTREDI` and `IQPOKYDWINMFC=0`,
      stub `conio.h`, `NAHLAS_CHYBU`, `NAPIS_TEXT_V_LATIN_2`, and the `g_handletext*` /
      `g_procentanacitani` progress globals.
- [ ] 1.4 Apply the required fixes: `sprintf`→`strcpy` (hazard 2), `-fsigned-char`,
      `-fwrapv -fno-strict-aliasing -O1`. Record every change to original code in
      `PATCHES.md` with file, line, and why.
- [ ] 1.5 Console driver: load `slovnik.iqp` + `IQPOKYD.IQP`, read stdin lines, print replies.
- [ ] 1.6 **Milestone: hold a conversation in Czech in a terminal.** Save a transcript to
      `test/golden/` as the reference for later diffs.

## Phase 2 — Data

- [ ] 2.1 Port the `slovnik.iqp` decoder (already prototyped and verified — 11,207 words,
      checksums pass) into a proper tool at `tools/dump-dict.ts`. Useful for inspection and
      for a future text-form dictionary.
- [ ] 2.2 Decide which dictionary ships. Default: `original/slovnik.iqp` (11,207 words).
      Note in the README that it came from the released binary, not the source drop.
- [ ] 2.3 Build `GRAMATIK.C` as a host tool; recompile `GRAMATIK.IQZ` → `IQPOKYD.IQP`.
- [ ] 2.4 Diff the recompiled `IQPOKYD.IQP` against the shipped one, modulo the random
      obfuscation padding and header text. Resolves the 2004/2005 question above.
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
