# `test/golden/` — the reference conversation

Phase 1.6 of `PLAN.md`: the milestone where the engine stops being something that
compiles and becomes something that talks. This directory is that conversation,
frozen, and it is what phase 3.3 diffs the WebAssembly build against.

## The files

| file            | encoding      | what it is |
| --------------- | ------------- | ---------- |
| `rozhovor.in`   | CP1250, CRLF  | 23 sentences of Czech, one per line, fed to the driver on stdin |
| `rozhovor.txt`  | CP1250, CRLF  | what IQ Pokyd answered — `--transcript` output, byte for byte |

Both are CP1250 because the engine is: it indexes a 28-letter alphabet and
switches on single bytes, and `--transcript` writes CP1250 with CRLF on every
platform precisely so a native run and a wasm run can be compared with `cmp`.
`.gitattributes` marks this directory `-text` so no checkout ever rewrites a byte
of it. Read them with `python3 tools/transcode.py` conventions in mind, or just
read the conversation reproduced at the bottom of this file.

## How to reproduce it

    python3 tools/build.py
    build/native/pokyd.exe --data build/run --cp1250 --seed 20050415         --character 3 --mood 3 --human m --computer m         --transcript out.txt < test/golden/rozhovor.in > NUL
    cmp out.txt test/golden/rozhovor.txt

`--cp1250` matters: without it the driver reads stdin as CP852 (the console
codepage) and every accented letter in `rozhovor.in` arrives as a different word.
Redirecting stdout away matters only for the noise — `vstup.fu:801-809` prints
every base form it recognises on every sentence, which is the original's
behaviour and why `--transcript` exists at all.

The settings are pinned on the command line rather than left to
`NASTAV_STANDARDNE()` so the golden file does not move if a default ever does:
character 3 (`prumerny`), mood 3 (`normalni`), both genders male.

## What must hold, and what was checked

**Same seed, same conversation.** `rand()` is what picks between equally-unheard
answers (`INTELIG.FU:74`, `:111`) and what nudges the mood (`:532`), so the
conversation is a function of the seed. As of this step it is a function of the
seed *only* — `src/shim/nahoda.h` takes `rand()`/`srand()` over from the C
runtime and implements the Microsoft CRT's own LCG, the one the 2005 MFC build
drew from. That was hazard 11, and it is now closed:

- MinGW-W64 16.1.0 (ucrt64) hands back exactly that sequence — verified over
  2000 draws from each of six seeds — so the shim changes nothing here;
- this transcript is byte-identical with the shim and without it;
- so is the 18,131,435-byte `SLOVNIK.TMP` the cold path writes, which runs
  thousands of draws through the obfuscator in `SLOVNIK.FU:1855-1861`.

Emscripten's musl would have diverged on the first tie. Now it cannot.

**Cold start and warm start agree.** Deleting `build/run/SLOVNIK.TMP` and running
again produces the same transcript. It has to: `ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU`
reseeds from the clock on its way out (`SLOVNIK.FU:1732`), which is why the driver
seeds *after* loading and not before.

**No profile.** `PROFIL.IQP` is read if present and never written (`PLAN.md` 7.5).
There is none in `build/run/`, and if one appears the answers will move.

**Nothing leaked.** The run ends with `UVOLNI_VESKEROU_DYNAMICKOU_PAMET` and a
block count; stderr was empty, cold and warm.

So a transcript that differs from this one means the engine differs. At 3.3 that
is a hazard-1 or hazard-4 bug in the wasm build, not a licence to re-record the
golden file.

**Phase 3.3 ran it and it holds.** `node test/wasm/smoke.mjs` drives the wasm
build through the same 23 sentences and reproduces this file byte for byte, cold
and warm, and the `SLOVNIK.TMP` its cold run exports is byte-identical to the
native one. It took one patch to the engine to get there — `PATCHES.md` 2, the
hazard-10 `FILE *` — and that patch changes neither this transcript nor that
cache on the native build.

## The conversation

```
> Ahoj!
< Ahoj, jsem rád, že jsi tu.
> Jak se máš?
< No, jak by se mi dařilo. Normálně. Vždyť jsem jenom stroj. Ale jinak dobrý.
> Jmenuji se Michal.
< Tak to nemáš moc dobrý.
> Já jsem programátor.
< Hm, to máš recht.
> Co děláš?
< Já nic dělám.
> Umíš česky?
< Snad jo, rebele.
> Kolik je ti let?
< No jo, to je docela dost možný.
> Kde bydlíš?
< Nevím, kam tím míříš.
> Máš rád hudbu?
< Snad jo, hochu.
> Já mám rád hudbu.
< Dělej si pro mě za mě co chceš.
> Jsi hloupý.
< S tím nic nenaděláš, tak to prostě je.
> Nejsem hloupý.
< No dobrá, když to říkáš...
> Proč se ptáš?
< Osud to takhle zařídil, tak se mě neptej na důvod!
> Můj počítač je rychlý.
< Tak to máš výjimečně pravdu.
> Znáš Aleše Jandu?
< Já myslím, že určitě.
> Dnes je hezky.
< Tak to je bezva.
> Nudím se.
< A proč nudíš?
> Chceš si hrát?
< Chci. Ty mi to můžeš splnit?
> Umíš počítat?
< No jo, to je docela dost možný.
> Kolik je pět a pět?
< Snad jo, rebele.
> Mám hlad.
< Já vím, mání není nic příjemného.
> Už musím jít.
< Tak ty musíš? Hm, to je jiná.
> Nashledanou!
< To teda jo, to je fakt.
```
