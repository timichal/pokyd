# IQ Pokyd 0.15, in a browser

IQ Pokyd is a Czech conversation program written by Aleš Janda (KÝBLSoft) in 2005,
in C and C++ against MFC, for Windows. This is that program compiled to WebAssembly
and given its own window back on a web page.

**<https://timichal.github.io/pokyd/>**

The engine is his, with two changes in two files (`PATCHES.md`). The dictionary and the
rule base are his data files. The window is his resource script, parsed and redrawn. It
says in 2026 what it said in 2005: `test/golden/rozhovor.txt` is a 23-sentence
conversation recorded from a native build of the original source, and the deployed page
reproduces it byte for byte.

Ported by Michal Zlatkovský, written with Claude Code. `PLAN.md` is the log of the
whole port, phase by phase.

## What is different

Not much, and every difference is here.

- **Three menu commands are gone.** *Konec* (a page has no window to close), *Nápověda
  na internetu* (the URL has not answered in twenty years) and *Velká nápověda* (its
  `CTI_ME.HTM` is not in the source drop). The two remaining popups became one.
- **Two dead addresses came off *O programu*.** `http://iqpokyd.kyblsoft.cz` and
  `iqpokyd@kyblsoft.cz` are replaced by a box titled *Upozornění 2026* pointing at this
  repository, and *Informace o verzi* gets a paragraph above the author's own saying the
  same. Those two paragraphs (`src/app/exhibit.ts`) are the only Czech in the port that
  is not his.
- **The settings dialog shows one page instead of two.** The second page held keyboard
  emulation, the mouse cursor, the background toggle, read-only mode and tooltips, none
  of which a browser build can honour; the conversation log came off the first page with
  them, because there is no file next to a page to write it to. `DROPPED` in
  `src/app/dialog.ts` lists all of them.
- **The transcript scrolls.** The original drew from the bottom and lost the start of a
  long conversation off the top. At rest the view is the same; only dragging upwards
  does something new.
- **Settings live in `localStorage`**, in his own `IQPOKYD.CFG` format rather than JSON.
  The user profile is not carried over at all: the one moment the original wrote
  `PROFIL.IQP` was `CMfcDlg::OnClose`, and a page has no reliable close.

## Build and run

You need Python 3, Node 24 and Emscripten (CI uses 6.0.9). For the native build, `g++`
as well.

```sh
python3 tools/build.py --wasm   # rule base + engine -> build/wasm/
npm ci
npm run dev                     # http://localhost:5173
npm run build                   # dist/
npm test                        # 18 programs; --quick skips the browser ones
```

`tools/build.py` without `--wasm` builds `build/native/pokyd.exe`, a console driver that
holds the same conversation on a command line: `build/native/pokyd.exe --data build/run`.

Pushing to `main` reproduces all of this on a Linux runner and publishes `dist/` to
GitHub Pages (`.github/workflows/deploy.yml`). Nothing compiled is committed; the only
inputs are what is in git. `src/README.md` describes the source pipeline and the
CP1250 handling, which is the part most likely to surprise you.

## Using it

The keys are his own accelerator table, `IDR_ZKRATKY`:

| key | what it does |
|---|---|
| F4 | settings |
| F1 | nápověda |
| Shift+F1 | O IQ Pokydu |
| Alt+V | Informace o verzi |
| F7 / F8 | mood better / worse |
| Ctrl+F7 / Ctrl+F8 | character better / worse |

### The debug menu

His too, and hidden the way he hid it: **Ctrl+Shift+Alt+D**, or type `::debuginfo` into
the sentence line and press *Řekni*. It prints ten of the engine's globals and lets you
set the exact mood, the spelling tolerance and the search recursion. The last two change
how the engine answers, which is what his own warning on that dialog is about.

### Query string

A developer's door, not a feature. `?seed=N` pins the `rand()` sequence, which is how a
transcript is reproduced; `?mood=1..5`; `?cache=no` or `?cache=rebuild` for the
dictionary cache; and `?bezpozadi`, his own command-line switch, for the plain black
background.

## Licence and attribution

IQ Pokyd is Aleš Janda's. `original/info.txt`, reproduced below, puts the sources under
the GNU GPL and in the next sentence forbids any commercial use. Those two do not fit
together: adding a restriction is the one thing the GPL rules out, so it is not clear
which half is in force.

So this port keeps both halves of what he asked for. His name stays on the screen and in
every file of his, `info.txt` is reproduced whole, the source is open, and nobody makes
money from any of it.

### `original/info.txt`

```
   Zdrojové kódy k Pokydu 7.0 a IQ Pokydu 0.15
   -------------------------------------------


   Tyto zdrojové kódy jsou pod licencí GNU/GPL. Můžete je použít k vlastní
   potřebě, ale nesmíte jej ani programy založené na tomto kódu využít komerčně!

   Jedná se o Pokyd 7.0 (v C, kompilováno Borland C++ 3.01)
   a IQ Pokyd 0.15 (v mixu C a C++, kompilováno MS Visual C++ 6.0).
   V IQ Pokydu není kompletní databáze jednotlivých slov, nechal jsem tam pouze
   slova od "a" a pak typické výjimky. Zbytek je kompletní tak jak jsem to
   dělal :-)

   Z dnešního pohledu se mi zdá, že jsem programoval celkem dost "prasácky",
   ale čistého kódu stejně nikdy nedosáhnu ;-)

   Zdrojáky jsou určené ke studiu, jak to celé fungovalo a funguje. Princip
   je jednoduchý - aspoň se mi tak zdá. V Pokydu navíc masivně používám
   přerušení procesoru, to však nesouvisí s vlastním algoritmem.
   Dost věcí ale asi nebude ze zdrojáku cizímu člověku jasné.

   Prosím veškeré dotazy, připomínky atd. směřovat na http://forum.kyblsoft.cz
   do rubriky IQ Pokyd, ať z toho něco mají i ostatní ;-)

   Pokud byste chtěli ve vývoji pokračovat, bude potřeba zdrojáky trošku
   "překopat". Sám už to dělám u IQ Pokydu, kde ho předělám (spolu s dalšími
   kvantami dalšího kódu) na rozpoznávače významu v textu. Možná to bude stejná
   utopie jako (IQ) Pokyd, kdo ví...

   Jinak proti pokračování nic nemám - jen prosím, pokud použijete alespoň část
   z těchto zdrojáků, tak ŽÁDNÉ VYDĚLÁVÁNÍ! Pokud to bude užitečné k čemukoli
   jinému, budu jen rád ;-)

   Okolo roku 2002 - tedy při poslední verzi Pokydu pro DOS - byl tento program
   legenda. K tomu jste přispěli i Vy!

   Děkuji!

   Aleš Janda
   autor programu Pokyd a IQ Pokyd

   ales.janda@kyblsoft.cz
   http://iqpokyd.kyblsoft.cz
   www.kyblsoft.cz
```
