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
python tools/gen-src.py                  # original/  -> build/src/
python tools/transcode.py --check        # proves the round trip is byte-exact
python tools/transcode.py --to-cp1250    # src/engine/ -> build/cp1250/
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
- **Comments and identifiers stay Czech**, matching the original, so the two trees can
  be diffed by eye.
