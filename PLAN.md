# Porting IQ Pokyd 0.15 to the web

A working plan, spanning multiple sessions. Check items off as they land.

**Goal:** a faithful, browser-playable recreation of IQ Pokyd 0.15 — a museum piece,
not a fork. Same engine, same answers, same look, running at a URL.

---

## Status

**Phase:** 2 — data. **Done, all of it: 2.1 through 2.5.** Phase 1 likewise, 1.1–1.6.
**The engine runs, answers in Czech, and the conversation is on disk.**
`python3 tools/build.py` builds `build/native/pokyd.exe` and lays out `build/run/`;
`build/native/pokyd.exe --data build/run` holds a conversation. The patch set against
the original is still one line, recorded in `PATCHES.md`.

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

**Next action:** Phase 3 — WebAssembly, starting with 3.1, the exported surface in
`src/engine/pokyd_api.c`. **Install Emscripten first**; there is no `emcc` on this
machine and 3.2 cannot start without it. 3.3 is the gate that matters: the wasm build
must reproduce `test/golden/rozhovor.txt` byte for byte.

---

## Toolchain on this machine

Re-probed 2026-09-15 on a **second machine**, and the results carry over: `gcc`/`g++`
MinGW-W64 16.1.0 (ucrt64) is identical, `node` v24.20.0 is present (new — Phase 3.3 has
its smoke-test runner). The one difference is Python. **Use `python3`, not `python`.**
On this machine `python3` is 3.14.7 as before, but bare `python` resolves to a miniforge
3.12.7 that is first on `PATH`. The tools are stdlib-only and work under both, but the
commands throughout this file say `python3` so the recorded toolchain is the one actually
used.

**No `clang`, no `cl`, no `emcc`** — Emscripten has to be installed before Phase 3 starts.
Phase 1 targets MinGW g++; expect to re-diff everything once clang enters the picture, since
hazard 1 (`char` signedness) differs between the two by default. As of 1.3 the engine builds
clean on that g++ with the flags in `tools/build.py`.

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
   the whole thing — but read hazard 10 first, because the read side of it is broken in a
   way that only luck is fixing. A 4.5 s cold start is also cheap enough that 3.4 may
   reasonably decide the cache is an optimization, not a launch requirement.
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

10. **The cache path reads a `FILE *` that was already `fclose`d.** Found in 1.5 and the
    most dangerous thing in this list, because it currently works.
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

    Two consequences, both for phase 3. **Nothing may `fopen` between those two calls** —
    the accident only holds while the cache file is the very next thing opened, so the
    loader's order in `pokyd_api.c` is load-bearing. And **under Emscripten the `FILE` is
    `malloc`ed and `fclose` frees it**, so this is a use-after-free; musl will probably
    hand back the same block and it will probably keep working, but if it ever does not,
    the failure is silent — the header checksum mismatches, the engine reports
    `_SPATNY_UPLNY_SLOVNIK_` and re-inflects, and hazard 5's whole mitigation is quietly
    gone. Test for it at 3.3 by timing the *second* run, not the first. If it breaks,
    the fix is a one-identifier patch with a strong argument behind it.

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
        (`PROSTRED.FU:550`) minus the window. Both are written to be lifted into
        `pokyd_api.c` as they stand.
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

- [ ] 3.1 `src/engine/pokyd_api.c` — the exported surface. `src/driver/pokyd.cpp` is the
      rehearsal: its `NACTI_SLOVNIKY` and the `ODPOVEZ_NA_VETU` sequence are what
      `pokyd_load_dictionaries` and `pokyd_say` have to be, in that order, including the
      `OnNovaveta` pre-processing and the two calls hazard 10 says must stay adjacent.
      Keep it minimal:
      `pokyd_init`, `pokyd_load_dictionaries`, `pokyd_say` (CP1250 in → CP1250 out),
      `pokyd_get_settings` / `pokyd_set_settings`, `pokyd_progress`,
      `pokyd_export_cache` / `pokyd_import_cache`.
- [ ] 3.2 Emscripten build: `-fsigned-char -O1 -fwrapv -fno-strict-aliasing`,
      `ALLOW_MEMORY_GROWTH`, `MODULARIZE`, preload `slovnik.iqp` + `IQPOKYD.IQP` into MEMFS.
      Take both from `build/run/`, which `tools/build.py` already lays out with the right
      two files under the bare names `KONSTANT.K` expects — the rule base there is the one
      compiled from `GRAMATIK.IQZ` (2.5), not the 2004 binary.
- [ ] 3.3 Node smoke test: same inputs as 1.6, diff against the native transcript.
      **They must match exactly.** Any divergence is a hazard-1/4 bug — fix before moving on.
      Hazard 11 is already settled — `src/shim/nahoda.h` gives both builds the same
      `rand()` — so this test can pass; check that the shim is actually in the Emscripten
      include path before blaming the engine for a divergence. Time the *second* run too,
      not just the first — that is the only way hazard 10 shows itself. The inputs are
      `test/golden/rozhovor.in` and the settings in `test/golden/README.md`; the file to
      `cmp` against is `test/golden/rozhovor.txt`.
- [ ] 3.4 Measure cold-start time and peak heap; compare against 1.5's native 4.5 s /
      37 MB / 402,252 forms. Decide whether the `SLOVNIK.TMP` cache is required for launch
      or a later optimization — at 4.5 s native it may well be the latter.

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
