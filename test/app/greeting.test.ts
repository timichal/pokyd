/* IQ Pokyd - test/app/greeting.test.ts - phase 6.4 of PLAN.md.

   src/app/greeting.ts is the second of the two files phase 6 added that spell
   Czech out by hand, and it does so for the reason src/app/caption.ts does: the
   ten greetings are string literals inside NAPIS_UVODNI_UVITANI, glued to three
   CStrings with `+`, and there is no resource script to read them from.  So this
   test does to it what test/app/caption.test.ts does to the status line:

     1. **nothing was invented.**  Every literal is looked for in
        src/engine/prostred/prostred.fu as CP1250 bytes, through phase 4.1's
        encoder, not as text -- a diacritic lost between the codepage and the
        file fails here.
     2. **nothing was reordered, and no `+` moved.**  His `switch` is parsed out
        of the function again, case by case, and each case's expression is split
        into literals and variable names and compared with GREETINGS part for
        part.  The order is what `rand()%10` indexes, so a list that slipped by
        one would greet the visitor with somebody else's line.
     3. **the three CStrings are inflected the way he inflects them.**  The two
        `if`s at :302-305 are read back, and both branches of each are compared
        with GREETING_VARIABLES -- including the empty string, which is the
        masculine one and the easiest of the four to lose.
     4. **the draw is the engine's own generator.**  The modulus is read out of
        `rand()%10` in the function, and the three constants of the LCG out of
        src/shim/nahoda.cpp, so greetingIndex() cannot drift from the sequence
        the 2005 build drew from without this failing.

   And then all 10 x 4 combinations of greeting and pair of genders, against a
   shape built from the same parsed switch.

   Run it:   node test/app/greeting.test.ts

   Needs nothing but node: no browser, no engine, no build.  Written by us, not
   ported.
*/

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { decodeCp1250, encodeCp1250 } from "../../src/web/cp1250.ts";
import {
  GREETINGS, GREETING_VARIABLES, GREETING_VARIABLE_GENDER,
  greeting, greetingIndex, openingGreeting,
} from "../../src/app/greeting.ts";
import type { GreetingPart, GreetingVariable } from "../../src/app/greeting.ts";
import type { PokydSettings } from "../../src/web/protocol.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FU = join(ROOT, "src", "engine", "prostred", "prostred.fu");
const NAHODA = join(ROOT, "src", "shim", "nahoda.cpp");

/* ------------------------------------------------------------- the harness */

let failures = 0;
let checks = 0;

function ok(label: string, cond: boolean, detail?: string): void {
  checks++;
  if (cond) {
    console.log("  ok    " + label);
  } else {
    failures++;
    console.log("  FAIL  " + label + (detail === undefined ? "" : "\n          " + detail));
  }
}

function eq(label: string, got: unknown, expected: unknown): void {
  const a = JSON.stringify(got);
  const b = JSON.stringify(expected);
  ok(label, a === b, a === b ? undefined : "got " + a + "\n          expected " + b);
}

function heading(text: string): void { console.log("\n" + text); }

/** What a Czech string looks like written as this repository writes it. */
function escape(text: string): string {
  return Array.from(text).map((ch) => {
    const code = ch.charCodeAt(0);
    return code > 0x7e ? "\\u" + code.toString(16).padStart(4, "0") : ch;
  }).join("");
}

/** A part list, printable and comparable. */
function show(parts: readonly GreetingPart[]): string[] {
  return parts.map((p) => typeof p === "string" ? escape(p) : "+" + p.variable);
}

console.log("IQ Pokyd - phase 6.4, the welcome line read back\n");

/* src/engine/ is UTF-8 (tools/transcode.py made it so), but the bytes that
   matter are the CP1250 ones the compiler sees, so every search below goes
   through the encoder in both directions -- the same round trip phase 4.1
   proved is lossless on this archive. */
const fuText = readFileSync(FU, "utf8");
const fuAsBytes = decodeCp1250(encodeCp1250(fuText));

/* ------------------------------- 1. the function, as the author wrote it */

heading("NAPIS_UVODNI_UVITANI, straight out of PROSTRED.FU");

const start = fuText.indexOf("void NAPIS_UVODNI_UVITANI(void) {");
ok("the function is still in prostred.fu", start !== -1);
const body = fuText.slice(start, fuText.indexOf("\nvoid ", start + 1));

/** One `case N:` of his switch, with the argument split back into the parts it
 *  was concatenated from: `"lit"+variable+"lit"` becomes the same list of
 *  strings and slots src/app/greeting.ts holds. */
function parseCase(expression: string): GreetingPart[] {
  const parts: GreetingPart[] = [];
  const re = /"([^"]*)"|\+?([A-Za-z_][A-Za-z0-9_]*)\+?/g;
  for (let m = re.exec(expression); m !== null; m = re.exec(expression)) {
    if (m[1] !== undefined) {
      /* A literal, and an empty one is not a part: he never writes one. */
      if (m[1].length > 0) parts.push(m[1]);
    } else if (m[2] !== undefined) {
      parts.push({ variable: m[2] as GreetingVariable });
    }
  }
  return parts;
}

const found: { at: number; parts: GreetingPart[] }[] = [];
{
  const re = /case (\d+): NAPIS_VETU_S_ODPOVEDI_NA_OBRAZOVKU\("",(.*?)\); break;/g;
  for (let m = re.exec(body); m !== null; m = re.exec(body)) {
    found.push({ at: Number(m[1]), parts: parseCase(m[2]!) });
  }
}

eq("the switch has ten cases, 0..9", found.map((c) => c.at),
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
eq("and GREETINGS is those ten, in that order and with his `+`s where he put them",
  GREETINGS.map(show), found.map((c) => show(c.parts)));

/* The first argument is the empty string in every one of the ten: this is the
   one call NAPIS_VETU_S_ODPOVEDI_NA_OBRAZOVKU makes with nothing said to it,
   and its `static BYTE prvniveta` is what drops the human's half (:131-140).
   That is why the greeting is a lone turn on the screen. */
eq("nobody said anything to get it -- all ten pass \"\" as the human's sentence",
  (body.match(/NAPIS_VETU_S_ODPOVEDI_NA_OBRAZOVKU\("",/g) ?? []).length, 10);
ok("and the first call of that function writes only the computer's line",
  /static BYTE prvniveta=1;/.test(fuText)
  && /if \(prvniveta != 1\) \{/.test(fuText));

/* --------------------------------------------- 2. the three inflected CStrings */

heading("kratkepohlavicloveka, kratkepohlavipocitace and priselpohlavi");
{
  /* PROSTRED.FU:302-303: the human's two, male branch first. */
  const human = /pohlavicloveka == 1\) \{ kratkepohlavicloveka="([^"]*)"; priselpohlavi="([^"]*)"; \}\s*\r?\n\s*else \{ kratkepohlavicloveka="([^"]*)"; priselpohlavi="([^"]*)"; \}/
    .exec(body);
  ok("the human's branch is still one if/else on `== 1`", human !== null);
  if (human !== null) {
    eq("  kratkepohlavicloveka, [female, male]",
      GREETING_VARIABLES.kratkepohlavicloveka.map(escape),
      [escape(human[3]!), escape(human[1]!)]);
    eq("  priselpohlavi, [female, male]",
      GREETING_VARIABLES.priselpohlavi.map(escape),
      [escape(human[4]!), escape(human[2]!)]);
  }

  /* :304-305: the computer's one. */
  const computer = /pohlavipocitace == 1\) \{ kratkepohlavipocitace="([^"]*)"; \}\s*\r?\n\s*else \{ kratkepohlavipocitace="([^"]*)"; \}/
    .exec(body);
  ok("the computer's branch is the other if/else", computer !== null);
  if (computer !== null) {
    eq("  kratkepohlavipocitace, [female, male]",
      GREETING_VARIABLES.kratkepohlavipocitace.map(escape),
      [escape(computer[2]!), escape(computer[1]!)]);
  }

  /* Whose pohlavi each one reads, taken off the `if` it is assigned inside
     rather than off its name -- priselpohlavi is the one whose name does not
     say. */
  const reads: Record<string, string> = {};
  for (const variable of Object.keys(GREETING_VARIABLES)) {
    const at = body.indexOf(variable + "=\"");
    const before = body.slice(0, at);
    reads[variable] = before.lastIndexOf("pohlavicloveka ==")
      > before.lastIndexOf("pohlavipocitace ==") ? "human" : "computer";
  }
  eq("and each is assigned inside the `if` on the gender it belongs to",
    GREETING_VARIABLE_GENDER, reads);

  /* Three names, and the three the switch actually refers to are the same three
     -- a fourth slot in GREETINGS would be a variable that does not exist. */
  const used = new Set<string>();
  for (const parts of GREETINGS) {
    for (const part of parts) if (typeof part !== "string") used.add(part.variable);
  }
  eq("the switch uses exactly the CStrings he declares",
    [...used].sort(), Object.keys(GREETING_VARIABLES).sort());
}

/* ---------------------------------- 3. the words are in the file as bytes */

heading("every literal found in PROSTRED.FU as a run of CP1250 bytes");
{
  const literals: string[] = [];
  for (const parts of GREETINGS) {
    for (const part of parts) if (typeof part === "string") literals.push(part);
  }
  for (const pair of Object.values(GREETING_VARIABLES)) {
    for (const word of pair) if (word.length > 0) literals.push(word);
  }

  const missing = literals.filter((word) => !fuAsBytes.includes(word));
  eq(literals.length + " literals, and every one of them is his",
    missing.map(escape), []);
}

/* -------------------------------------------------------------- 4. the draw */

heading("rand()%10, and whose rand() it is");
{
  /* The modulus, read off his own line rather than trusted to be ten. */
  const modulus = /switch\(rand\(\)%(\d+)\) \{/.exec(body);
  ok("the switch is still on rand()%N", modulus !== null);
  eq("and N is how many greetings there are", GREETINGS.length,
    modulus === null ? -1 : Number(modulus[1]));

  /* He reseeds from the clock on the way in, which is what src/app/chat.ts
     mirrors when it hands the same second to pokyd_seed. */
  ok("it reseeds from the clock first (PROSTRED.FU:307)",
    body.includes("srand(time(NULL));"));

  /* src/shim/nahoda.cpp:19-26 is the generator, and greetingIndex() is one draw
     off a mirror of it.  The constants are read out of the shim so that the two
     cannot drift apart silently. */
  const shim = readFileSync(NAHODA, "utf8");
  const lcg = /random_seed = random_seed\*(\d+)u \+ (\d+)u;\s*\r?\n\s*return \(int\)\(\(random_seed >> (\d+)\) & (0x[0-9a-f]+)\);/
    .exec(shim);
  ok("the shim's LCG is where it was", lcg !== null);
  if (lcg !== null) {
    const [mul, add, shift, mask] =
      [Number(lcg[1]), Number(lcg[2]), Number(lcg[3]), Number(lcg[4])];
    eq("  the Microsoft CRT's multiplier", mul, 214013);
    eq("  its addend", add, 2531011);
    eq("  its shift", shift, 16);
    eq("  and RAND_MAX", mask, 0x7fff);

    /* The same arithmetic, spelled out from what was just parsed, against
       greetingIndex over a wide spread of seeds -- including the ones that
       overflow a signed 32-bit multiply, which is the only way to get this
       wrong in JavaScript. */
    const draw = (seed: number): number => {
      const state = (Math.imul(seed >>> 0, mul) + add) >>> 0;
      return ((state >>> shift) & mask) % GREETINGS.length;
    };
    const seeds = [0, 1, 2, 3, 20050415, 1234567, 0x7fffffff, 0x80000000,
      0xfffffffe, 0xffffffff, 1136073600, 1735689600];
    const wrong = seeds.filter((s) => greetingIndex(s) !== draw(s));
    eq("greetingIndex is that generator, for " + seeds.length + " seeds", wrong, []);

    /* And it is a real spread rather than a constant: over 100,000 seeds all
       ten greetings come up. */
    const seen = new Set<number>();
    for (let s = 0; s < 100000; s++) seen.add(greetingIndex(s));
    eq("all ten come up over 100,000 seeds", seen.size, GREETINGS.length);
  }

  /* Every index it can hand back is one GREETINGS has. */
  const out = [0, 1, 999, 20050415, 0xffffffff].map(greetingIndex);
  ok("and it never leaves 0..9",
    out.every((i) => Number.isInteger(i) && i >= 0 && i < GREETINGS.length),
    JSON.stringify(out));
}

/* ------------------------------------------- 5. the line the visitor reads */

heading("the greeting itself, for all 10 x 4 settings");
{
  const settings = (over: Partial<PokydSettings>): PokydSettings => ({
    humanGender: 1, computerGender: 1, humanName: "", computerName: "",
    character: 3, mood: 3, moodPoints: 52,
    saveConversation: 1, useSounds: 1, useEffects: 0, formalCzech: 0,
    showLabels: 1, debugFastExit: 0, debugSpellingTolerance: 1,
    debugSpellingRecursion: 11, emulateKeyboard: 0, keyboardQwerty: 1,
    standardCursor: 0, cmdReadOnly: 0, cmdNoBackground: 0,
    ...over,
  });

  /* Built from the switch that was parsed above, not from GREETINGS, so this is
     a second road to the same string. */
  const expected = (index: number, human: number, computer: number): string =>
    found[index]!.parts.map((part) => {
      if (typeof part === "string") return part;
      const gender = GREETING_VARIABLE_GENDER[part.variable] === "human"
        ? human : computer;
      return GREETING_VARIABLES[part.variable][gender === 1 ? 1 : 0];
    }).join("");

  let wrong = 0;
  for (let index = 0; index < GREETINGS.length; index++) {
    for (const human of [0, 1]) {
      for (const computer of [0, 1]) {
        const got = greeting(index, settings({
          humanGender: human, computerGender: computer,
        }));
        if (got !== expected(index, human, computer)) wrong++;
      }
    }
  }
  eq("all 40 combinations", wrong, 0);

  /* The three that actually move, written out -- NASTAV_STANDARDNE's own
     default is a man talking to a man (NASTAVEN.PR:25-43), so that is what a
     first visit reads. */
  const man = settings({});
  const woman = settings({ humanGender: 0, computerGender: 0 });
  eq("a man greeted by a man", escape(greeting(1, man)),
    escape("Vítám tě! Jak ses měl?"));
  eq("a woman greeted by a woman", escape(greeting(1, woman)),
    escape("Vítám tě! Jak ses měla?"));
  eq("both halves of the longest one, masculine", escape(greeting(2, man)),
    escape("Nazdar! Jsem rád, že ses na mě přišel podívat."));
  eq("  and feminine", escape(greeting(2, woman)),
    escape("Nazdar! Jsem rád" + "a" + ", že ses na mě přišla podívat."));
  eq("the one that reads the computer's gender alone, masculine",
    escape(greeting(8, man)),
    escape("Jsem moc rád, že si se mnou jdeš pokydat."));
  eq("  and feminine", escape(greeting(8, settings({ computerGender: 0 }))),
    escape("Jsem moc ráda, že si se mnou jdeš pokydat."));

  /* Seven of the ten say the same thing to everybody. */
  const uninflected = GREETINGS
    .map((parts, i) => parts.every((p) => typeof p === "string") ? i : -1)
    .filter((i) => i !== -1);
  eq("seven of the ten are not inflected at all", uninflected,
    [0, 3, 4, 5, 6, 7, 9]);

  /* Ours, not his: his switch simply says nothing for a number outside 0..9. */
  const throws = (index: number): boolean => {
    try { greeting(index, man); return false; } catch { return true; }
  };
  ok("greeting 10 is refused", throws(10));
  ok("greeting -1 is refused", throws(-1));
  ok("and a fractional one too", throws(1.5));

  /* The whole of NAPIS_UVODNI_UVITANI in one call, which is what
     src/app/chat.ts uses.  Seed 20050415 is test/golden/README.md's, so this is
     the line test/app/chat.test.mjs finds at the top of the transcript. */
  eq("openingGreeting is the draw and the inflection together",
    escape(openingGreeting(20050415, man)),
    escape(greeting(greetingIndex(20050415), man)));
  eq("and for the golden seed it is \"Cest pest!\"",
    escape(openingGreeting(20050415, man)),
    escape("Čest pěst! Co tě ke mně přivádí?"));
}

/* ------------------------------------------------------------------- the end */

console.log(failures === 0
  ? "\nPASS -- " + checks + " checks.  The welcome line is the author's words,"
    + " in his order, inflected as he inflects them and drawn from his rand()."
  : "\nFAIL -- " + failures + " of " + checks + " checks did not hold.");
process.exit(failures === 0 ? 0 : 1);
