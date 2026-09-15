# Patches to the original source

Every deliberate change to the 2005 source, with its justification. This file is the
prose half of an audit; the mechanical half is `python3 tools/transcode.py --check`,
which diffs `src/engine/` against `original/IQ Pokyd/Aplikace/` and names every file
that differs. **The two must agree.** A file listed by `--check` and absent here is an
accident; an entry here that `--check` does not corroborate is stale.

The governing rule is that this is a museum piece. A patch earns its place only if the
code cannot be built or run without it, and it is written to be the smallest edit that
clears the obstacle. Cleanups, modernizations and defensive hardening are not patches
and do not belong here — the "Considered and not applied" section below records the
ones that were looked at and rejected, so a later session does not re-litigate them.

Not covered here, because they are not changes to original code:

- `src/shim/` — our replacement for the Win32/MFC surface, described in `src/README.md`.
  One line of `src/shim/tridy.h` is marked `[shim]` where MSVC 6 accepted an extra
  qualification that ISO C++ rejects; that is a quotation with a note, not a patch.
- The `#include` rewrites done by `tools/gen-src.py` (hazard 3), which are a build-tree
  transformation and never touch `src/engine/`.
- The CP1250 ⇄ UTF-8 re-encoding done by `tools/transcode.py` (hazard 6), proven a
  round-trip identity by `--check` and therefore invisible to the compiler.

---

## Current patch set

| # | File | Line | Change | Net |
|---|---|---|---|---|
| 1 | `src/engine/vstup/vstup.fu` | 775 | `sprintf` → `strcpy` | −1 byte |

`transcode.py --check` reports exactly one file differing: `vstup/vstup.fu`. That
matches the table.

---

## 1. `vstup.fu:775` — `sprintf` → `strcpy`

**Phase 1.4. Hazard 2.**

```c
// original
    sprintf(g_vetacloveka.slova[poziceslova].vlastnislovo,slovo);
// patched
    strcpy(g_vetacloveka.slova[poziceslova].vlastnislovo,slovo);
```

In `POROZUMEJ_VETE_NAPSANE_CLOVEKEM`, `slovo` holds one word taken from the sentence the
human typed, and it is passed as `sprintf`'s *format* argument. The shape is the classic
format-string bug.

### The stated rationale was wrong, and the patch is still right

PLAN.md's hazard 2 says "typing `%s` will crash or leak memory". That is not reachable.
`slovo` is not the raw input: it is assembled a character at a time a few lines above
(`vstup.fu:751-761`) and a character is only copied in when `JELI_PISMENO` accepts it.
That predicate (`vzory/sklonov.fu:511`) admits `a-z`, `A-Z`, `*`, and any byte that is
negative as a `char` — which under the build's mandatory `-fsigned-char` (hazard 1) means
the high-bit CP1250 accented letters. Compiled and run over all 256 byte values, it
accepts 181 of them, and **every accepted byte below 0x80 is `a-zA-Z` or `*`**. `%` is
0x25 and is rejected, so it is a word separator, not a word character. No `%` can reach
this call, and none of the other conversion specifiers can either.

So there is no vulnerability to fix here, and the honest description of this patch is not
"security fix" but **"provably behaviour-preserving"**: with no `%` in the format string,
`sprintf(dst, src)` and `strcpy(dst, src)` write identical bytes. That is precisely what
makes it acceptable in a museum piece — the patch cannot change a single answer the
engine gives.

It is worth making anyway, for reasons that survive the correction:

- The safety property is **non-local and fragile**. It lives in `JELI_PISMENO`, in
  another module, and it depends on `char` being signed. Under an unsigned-`char`
  toolchain the `pismeno < 0` arm dies, which is hazard 1 — and hazard 1 is a real risk
  on the Emscripten build in Phase 3, where clang defaults to unsigned `char`. The
  argument above is only sound *because* `-fsigned-char` is set. `strcpy` needs no
  such argument.
- `sprintf` with a non-literal format trips `-Wformat-security` / `-Wformat-nonliteral`
  and is an error under some hardened configurations. Emscripten's clang is stricter than
  MinGW's gcc here, and Phase 3 should not have to argue with it.
- `strcpy` is what the line means. The file already uses `strcpy` in dozens of places
  (`vstup.fu:145`, `:199`, `:218`, …), so this is the author's own idiom, not ours.

### Bounds

Unchanged by the patch, and safe either way. `vlastnislovo` is allocated
`DELKA_JEDNODUCHEHO_SLOVA` (= 60) bytes in `intelig/intelig.ft:27`, and `slovo` is
truncated to at most 59 characters at `vstup.fu:763` immediately before this call. 59
characters plus a terminator is exactly 60. `strcpy` is therefore in bounds, with nothing
to spare — worth remembering if `DELKA_JEDNODUCHEHO_SLOVA` is ever touched.

### Verification

Build is unchanged in every observable way: 39 warnings, same seven categories in the
same counts, link check reports the same `Nastaveni` 220 B / answer buffer 201 B /
`Struktura_vety` 6568 B. `diff -r build/src build/cp1250` prints this one line and
nothing else.

---

## Considered and not applied

### `vstup.fu:1235` — `printf(novytext)` in `NAPIS_TEXT_V_LATIN_2`

A second instance of the same bug class, found while auditing for the first, and **not
patched**. Recorded here so the next session does not think it was missed.

```c
void NAPIS_TEXT_V_LATIN_2(char *text) {
  ...
  PREVED_Z_WINDOWS_1250_NA_LATIN_2(novytext);
  printf(novytext);          // <- non-literal format
```

This one is more interesting than the first, because it *is* reachable with
human-derived text. Three call sites pass a variable and are live:
`intelig/intelig.fu:146` and `:167` pass `g_slovavefronte`, a word lifted from the user's
sentence and re-inflected, and `vstup.fu:806` passes `g_slovozaklad` (see the note below).
The other eight variable call sites, at `vstup.fu:819-867`, sit inside a `/* */` block
the author commented out — dead code, and the reason that whole region carries no `#if`.

It is nevertheless safe, for the same reason and one more:

- Words reaching `g_slovavefronte` came through the same `JELI_PISMENO` filter, so they
  contain no `%`.
- `PREVED_Z_WINDOWS_1250_NA_LATIN_2` cannot introduce one. Its `switch` is guarded by
  `else if (znak < 0)`, so it only ever rewrites bytes that are already high-bit, and all
  30 of its replacement bytes are in `0x82..0xFD`. ASCII passes through untouched.
- None of the 15 string literals passed to the function contains a `%`.

Left alone because the criterion at the top of this file is not met: the code builds and
runs, the fix is not required, and `printf` is only on the console/debug path — Phase 3
exports answers as CP1250 buffers and does not call it at all. If a future step ever
routes arbitrary text through `NAPIS_TEXT_V_LATIN_2`, the fix is `printf("%s", novytext)`
and it belongs in the table above.

### `vstup.fu:801-809` — the unguarded debug print in `POROZUMEJ_VETE_NAPSANE_CLOVEKEM`

Found alongside the above, and **not patched**, but flagged because it will look like a
bug the first time anything runs.

The tail of `POROZUMEJ_VETE_NAPSANE_CLOVEKEM` prints every recognised reading of every
word to stdout — `"Speciální_slovo "` for id 0, otherwise the base form via
`NAPIS_TEXT_V_LATIN_2(g_slovozaklad)`. It is a debug leftover: unlike the block
immediately below it at 819-867, the author never commented it out, and it sits under no
`#if` and no runtime flag. Every sentence the engine parses writes this to the console.

Left alone. It is original behaviour, it is harmless, and deleting it would be a cleanup.
The consequence is for the callers, not the source: the Phase 1.5 console driver should
expect its own transcript to be interleaved with this, and the Phase 1.6 golden file must
either capture it deliberately or the driver must redirect it. Phase 3.1 should note that
`printf` in a wasm build goes to the JS console, which is noise but not a failure.

### The 39 build warnings

Catalogued in PLAN.md 1.3 and deliberately not silenced. `-Wall` is hazard 4's inventory;
the seven `-Wmaybe-uninitialized` in particular name the suspects to check first if the
native and wasm builds ever disagree. Warnings are not patches.

### `NAHLAS_CHYBU`'s `MessageBox` branch

The `BEZ_PROSTREDI` build selects the MFC branch, which looks like an author slip, but the
console branch below it calls a function that exists nowhere in the corpus. Handled in
`src/shim/` by giving `MessageBox` somewhere to go (stderr), not by editing the original.
See PLAN.md 1.3.

---

## Verifying the patch set

```sh
python3 tools/gen-src.py            # original -> build/src   (pristine, includes rewritten)
python3 tools/transcode.py --check  # names every file differing from the original
python3 tools/transcode.py --to-cp1250
diff -r build/src build/cp1250      # the patch set, as a diff, and nothing else
python3 tools/build.py
```

`diff -r build/src build/cp1250` is the authoritative view: `build/src` is the original
and `build/cp1250` is what the compiler is actually handed, so anything between them is a
patch and must appear in the table above.
