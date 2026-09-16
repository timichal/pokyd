/* IQ Pokyd - src/app/greeting.ts - NAPIS_UVODNI_UVITANI, the line that is on the
   screen before anybody types anything.  Phase 6.4 of PLAN.md.

   PROSTRED.FU:299-322.  Ten greetings, one of them picked with `rand()%10`, and
   three of the ten are inflected for who is talking to whom: the author builds
   `kratkepohlavicloveka`, `kratkepohlavipocitace` and `priselpohlavi` out of the
   two pohlavi settings first and then concatenates them into the CString.  So a
   greeting here is not a string but a list of parts -- his literals, with a slot
   wherever he wrote a `+`, named after the CString he put there -- and
   test/app/greeting.test.ts parses his own switch back out of prostred.fu and
   compares it with the list, part for part.

   It is the second and last module phase 6 wrote that spells Czech by hand, and
   for the same reason src/app/caption.ts does: these words are string literals
   inside a function, not resources, so there is nothing generated to read them
   from.  The Czech below is his, in UTF-8 as src/engine/ keeps it, and the test
   finds every run of it in prostred.fu as CP1250 bytes rather than as text.

   **Where the number comes from, and why it is drawn here rather than asked of
   the engine.**  mfcDlg.cpp:443 calls this *before* NactiSlovniky() -- the
   greeting was on the screen while the dictionary inflected -- and it reseeds
   from the clock on the way in (`srand(time(NULL))`, :307).  On a cold start the
   draw is then thrown away again, because ZAPIS_DATABAZI_SLOV_DO_UPLNEHO_SLOVNIKU
   reseeds once more on its way out (SLOVNIK.FU:1732).  So in 2005 the greeting
   was never part of the conversation's rand() stream, and it is not part of ours
   either: greetingIndex() is one draw off a mirror of src/shim/nahoda.cpp,
   seeded with the same number src/app/chat.ts hands pokyd_seed, and the engine's
   own generator is left untouched.  That is what keeps test/golden/rozhovor.txt
   byte for byte what it was -- and it is also the faithful answer, not merely
   the convenient one.

   Written by us, not ported.  English identifiers, with the author's own names
   for his three CStrings kept as the slot names so the two are diffable by eye.
*/

import type { PokydSettings } from "../web/protocol.ts";

/* ------------------------------------------------------- his three CStrings */

/** The three CStrings NAPIS_UVODNI_UVITANI inflects before it picks a greeting,
 *  under the names he gave them (PROSTRED.FU:300). */
export type GreetingVariable =
  | "kratkepohlavicloveka"
  | "kratkepohlavipocitace"
  | "priselpohlavi";

/** What each of them is, indexed by pohlavi: [0] female, [1] male.  Straight off
 *  PROSTRED.FU:302-305, where the `== 1` branch is the male one -- see the note
 *  on GENDERS in src/app/caption.ts, which is where that was finally settled. */
export const GREETING_VARIABLES:
  Record<GreetingVariable, readonly [string, string]> = {
  kratkepohlavicloveka: ["a", ""],
  kratkepohlavipocitace: ["a", ""],
  priselpohlavi: ["přišla", "přišel"],
};

/** Whose pohlavi each of them reads. */
export const GREETING_VARIABLE_GENDER:
  Record<GreetingVariable, "human" | "computer"> = {
  kratkepohlavicloveka: "human",
  kratkepohlavipocitace: "computer",
  priselpohlavi: "human",
};

/** A slot standing where the author wrote a `+`. */
export interface GreetingSlot { readonly variable: GreetingVariable }

/** One piece of a greeting: a literal of his, or one of his three CStrings. */
export type GreetingPart = string | GreetingSlot;

const HUMAN: GreetingSlot = { variable: "kratkepohlavicloveka" };
const COMPUTER: GreetingSlot = { variable: "kratkepohlavipocitace" };
const CAME: GreetingSlot = { variable: "priselpohlavi" };

/* ------------------------------------------------------------- the ten of them */

/** PROSTRED.FU:310-319, case for case and in his order -- the order matters,
 *  because it is what `rand()%10` indexes. */
export const GREETINGS: readonly (readonly GreetingPart[])[] = [
  ["Ahoj! Dobře, že mě spouštíš :-)"],
  ["Vítám tě! Jak ses měl", HUMAN, "?"],
  ["Nazdar! Jsem rád", COMPUTER, ", že ses na mě ", CAME, " podívat."],
  ["Čest pěst! Co tě ke mně přivádí?"],
  ["Nazdárek, jdeš si zakydat?"],
  ["No, to je dobře, že se taky na mě přijdeš jednou podívat."],
  ["Zdar! Jak žiješ?"],
  ["Vítej, kámo!"],
  ["Jsem moc rád", COMPUTER, ", že si se mnou jdeš pokydat."],
  ["Ahoj, tak co je nového?"],
];

/* ------------------------------------------------------------------ the draw */

/** `rand()`, once, from a freshly seeded generator: src/shim/nahoda.cpp:19-26,
 *  which is the Microsoft CRT's LCG and therefore the sequence the 2005 build
 *  drew from.  Math.imul is what keeps the multiply 32-bit. */
export function greetingIndex(seed: number): number {
  const state = (Math.imul(seed >>> 0, 214013) + 2531011) >>> 0;
  return ((state >>> 16) & 0x7fff) % GREETINGS.length;
}

/* ------------------------------------------------------------- putting it together */

/** One of the ten, inflected for the two genders in `settings`.
 *
 *  The author has no bounds check here -- his `switch` simply says nothing for a
 *  number outside 0..9, which cannot happen after `%10` -- so this is ours, and
 *  it throws rather than greeting the visitor with an empty line. */
export function greeting(index: number, settings: PokydSettings): string {
  if (!Number.isInteger(index) || index < 0 || index >= GREETINGS.length) {
    throw new RangeError("there is no greeting " + index + ", only 0.."
      + (GREETINGS.length - 1));
  }
  return GREETINGS[index]!.map((part) => {
    if (typeof part === "string") return part;
    const gender = GREETING_VARIABLE_GENDER[part.variable] === "human"
      ? settings.humanGender : settings.computerGender;
    return GREETING_VARIABLES[part.variable][gender === 1 ? 1 : 0];
  }).join("");
}

/** The whole of NAPIS_UVODNI_UVITANI: draw, then inflect. */
export function openingGreeting(seed: number, settings: PokydSettings): string {
  return greeting(greetingIndex(seed), settings);
}
