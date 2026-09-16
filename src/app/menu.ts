/* IQ Pokyd - src/app/menu.ts - IDR_MENU, drawn.

   Phase 6.3 of PLAN.md.

     1. **The menu the author wrote**, straight out of src/app/resources.ts:
        a popup and a right-justified item, their separators, their mnemonics,
        their accelerator text, and the 14x14 bitmaps mfcDlg.cpp:388-401 hangs
        on them with SetMenuItemBitmaps.  Nothing here spells a Czech word:
        every string is read from MENUS.IDR_MENU, which tools/extract-rc.mjs
        read out of IQPokyd.rc as CP1250 bytes.

     2. **The three things about that menu that are not in the script**, which
        are in src/app/caption.ts and not here, because a node test can have
        that file and cannot have this one: the words
        ZAPIS_DO_MENU_AKTUALNI_STAV_NASTAVENI puts in the right-justified item,
        the seven bitmaps mfcDlg.cpp hangs on seven commands, and which of those
        commands the exhibit still has -- see below.

     3. **the author's accelerator table**, added at phase 7.1: IDR_ZKRATKY
        names the same commands by key, and four of them -- the mood and the
        character, F7, F8 and the two with Ctrl -- are in no menu at all, so
        that table is the only way to reach them.  It is bound by the same rule
        as the items: an entry whose command is not in `commands` is not bound.

   **A command with nothing behind it is greyed, not silent.**  `commands` is a
   map from the author's symbolic id to a handler, an item with no entry in it
   is drawn MF_GRAYED, and a phase that lands adds a key.  Phase 6.3 could
   honour one, ID_NAPOVEDA_INTERNET, which is a URL (mfcDlg.cpp:1005); 7.1 added
   ID_NASTAVENI and the four shortcuts; **8.2 filled the menu in and emptied it
   at the same time.**  Three of the seven commands cannot be honoured at all --
   ID_KONEC, ID_VELKANAPOVEDA and, as it turns out, that same URL -- so the menu
   this file is handed is no longer IDR_MENU itself but `exhibitMenu(IDR_MENU)`,
   which drops those three and merges what is left into one popup.  Nothing here
   knows which ones or why; src/app/caption.ts does, because a node test can
   have that file.  After 8.2 and 8.4 nothing on the bar is greyed: every item
   drawn has a handler, and ID_CHEAT_DEBUGINFO reaches its dialog by key alone,
   as it did in 2005.

   The caption is a menu item too, and the same ID_NASTAVENI as "Nastaveni...",
   which is the author's doing: IQPokyd.rc:150 gives it the HELP flag, and that
   is what right-justifies it.

   Written by us, not ported.  English identifiers and ASCII only, like the rest
   of the non-engine code -- and there is no Czech in this file at all: every
   word it draws is read from a module generated out of the author's own bytes.
*/

import { ACCELERATORS, MENUS } from "./resources.ts";
import type { RcAccelerators, RcMenu, RcMenuItem } from "./resources.ts";
import { BITMAP_ASSETS } from "./assets.ts";
import { MENU_BITMAPS, exhibitMenu } from "./caption.ts";

/* ----------------------------------------------------------------- the menu */

export interface PokydMenuOptions {
  /** What each of the author's commands does, keyed by his symbolic id --
   *  ID_NASTAVENI, ID_OPROGRAMU and the rest.  An item whose id is not a key
   *  here is drawn greyed and cannot be chosen, which is how a menu written in
   *  2005 sits honestly on top of a port that is only at phase 6. */
  commands?: Record<string, () => void>;
  /** `exhibitMenu(IDR_MENU)` by default -- the author's menu with the three
   *  commands a browser cannot honour taken out and the two popups merged, for
   *  which src/app/caption.ts has the reasoning.  A test can hand in another,
   *  and handing in MENUS["IDR_MENU"] itself gets the 2005 arrangement back. */
  menu?: RcMenu;
  /** IDR_ZKRATKY by default.  Phase 7.1: the same commands, reached by key
   *  instead of by pointer -- and four of them are reachable no other way,
   *  because ID_ZLEPSENINALADY and its three neighbours are in the accelerator
   *  table and in no menu (mfcDlg.cpp:118-121).  An entry whose command is not
   *  in `commands` is not bound, exactly as an item with no command is greyed:
   *  a key that does nothing quietly is the same broken promise. */
  accelerators?: RcAccelerators;
}

export interface PokydMenuHandle {
  element: HTMLElement;
  /** The right-justified item's text.  `settingsCaption` is what makes one. */
  setCaption(text: string): void;
  /** Shut whichever popup is open.  Called on Escape, on a click elsewhere and
   *  after a command runs. */
  close(): void;
  remove(): void;
}

const CLASS = "pokyd-menu";

/** The label of an item, split the way Windows reads it: `&` marks the
 *  mnemonic and a tab starts the accelerator text.  Read off `raw` rather than
 *  off `label`, because the ampersand is the only thing that says which letter
 *  is underlined -- "I&nformace o verzi" underlines the n, not the I. */
function renderLabel(raw: string): DocumentFragment {
  const text = raw.split("\t")[0];
  const fragment = document.createDocumentFragment();
  const at = text.indexOf("&");
  if (at === -1 || at === text.length - 1) {
    fragment.append(text);
    return fragment;
  }
  fragment.append(text.slice(0, at));
  const mnemonic = document.createElement("u");
  mnemonic.textContent = text[at + 1];
  fragment.append(mnemonic, text.slice(at + 2));
  return fragment;
}

export function mountMenu(
  parent: Element,
  options: PokydMenuOptions = {},
): PokydMenuHandle {
  const menu = options.menu ?? exhibitMenu(MENUS["IDR_MENU"]);
  const commands = options.commands ?? {};

  const element = document.createElement("nav");
  element.className = CLASS + "bar";
  element.setAttribute("role", "menubar");
  /* The author's window title is the page title; this is the menu bar of that
     window, and a screen reader should be told which. */
  element.setAttribute("aria-label", "IQ Pokyd");

  /** Every popup on the bar, so that opening one closes the others. */
  const popups: { title: HTMLButtonElement; list: HTMLElement }[] = [];
  let open: number = -1;

  function show(index: number): void {
    open = index;
    popups.forEach((popup, i) => {
      const on = i === index;
      popup.title.setAttribute("aria-expanded", String(on));
      popup.list.hidden = !on;
    });
  }

  function close(): void { show(-1); }

  function run(id: string): void {
    close();
    const command = commands[id];
    if (command !== undefined) command();
  }

  /** One line of a dropdown.  A separator is a separator; everything else is a
   *  button with a 14x14 gutter, a label and its accelerator. */
  function popupItem(item: RcMenuItem): HTMLElement {
    if (item.kind === "separator") {
      const rule = document.createElement("hr");
      rule.className = CLASS + "-separator";
      rule.setAttribute("role", "separator");
      return rule;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = CLASS + "-item";
    button.setAttribute("role", "menuitem");

    const gutter = document.createElement("span");
    gutter.className = CLASS + "-bitmap";
    const bitmap = item.id === null ? undefined : MENU_BITMAPS[item.id];
    const asset = bitmap === undefined ? undefined : BITMAP_ASSETS[bitmap];
    if (asset !== undefined) {
      const img = document.createElement("img");
      img.src = asset.url;
      img.width = asset.width;
      img.height = asset.height;
      img.alt = "";
      gutter.appendChild(img);
    }

    const label = document.createElement("span");
    label.className = CLASS + "-label";
    label.appendChild(renderLabel(item.raw));

    const accelerator = document.createElement("span");
    accelerator.className = CLASS + "-accelerator";
    accelerator.textContent = item.accelerator ?? "";

    button.append(gutter, label, accelerator);

    const id = item.id;
    if (id === null || commands[id] === undefined) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    } else {
      button.addEventListener("click", (): void => { run(id); });
    }
    if (id !== null) button.dataset["command"] = id;
    return button;
  }

  /* --------------------------------------------------------- the bar itself */

  /** The right-justified item, kept so that setCaption can rewrite it.  It is
   *  an ordinary MENUITEM with the HELP flag, so it is found by that and not by
   *  its position. */
  let captionButton: HTMLButtonElement | null = null;

  for (const item of menu.items) {
    if (item.kind === "popup") {
      const title = document.createElement("button");
      title.type = "button";
      title.className = CLASS + "-title";
      title.setAttribute("aria-haspopup", "true");
      title.setAttribute("aria-expanded", "false");
      title.appendChild(renderLabel(item.raw));

      const list = document.createElement("div");
      list.className = CLASS + "-popup";
      list.setAttribute("role", "menu");
      list.hidden = true;
      for (const child of item.items) list.appendChild(popupItem(child));

      const index = popups.length;
      popups.push({ title, list });

      title.addEventListener("click", (): void => {
        show(open === index ? -1 : index);
        if (open === index) {
          const first = list.querySelector<HTMLButtonElement>("button:enabled");
          if (first !== null) first.focus();
        }
      });
      /* Once one popup is open, moving the pointer along the bar moves the
         open popup with it -- which is what a menu bar does. */
      title.addEventListener("mouseenter", (): void => {
        if (open !== -1 && open !== index) show(index);
      });

      const holder = document.createElement("div");
      holder.className = CLASS + "-holder";
      holder.append(title, list);
      element.appendChild(holder);
      continue;
    }

    if (item.kind !== "item") continue;

    const button = document.createElement("button");
    button.type = "button";
    button.className = CLASS + "-title";
    if (item.flags.includes("HELP")) {
      button.classList.add(CLASS + "-state");
      captionButton = button;
    }
    button.appendChild(renderLabel(item.raw));
    const id = item.id;
    if (id === null || commands[id] === undefined) {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    } else {
      button.addEventListener("click", (): void => { run(id); });
    }
    element.appendChild(button);
  }

  /* ------------------------------------------------------------ the closing */

  const onPointerDown = (event: Event): void => {
    if (open === -1) return;
    if (!element.contains(event.target as Node)) close();
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (open === -1) return;
    if (event.key === "Escape") {
      event.preventDefault();
      const title = popups[open].title;
      close();
      title.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp"
      && event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const step = event.key === "ArrowRight" ? 1 : popups.length - 1;
      const next = (open + step) % popups.length;
      event.preventDefault();
      show(next);
      const first = popups[next].list.querySelector<HTMLButtonElement>("button:enabled");
      if (first !== null) first.focus();
      return;
    }

    const items = Array.from(
      popups[open].list.querySelectorAll<HTMLButtonElement>("button:enabled"));
    if (items.length === 0) return;
    event.preventDefault();
    const down = event.key === "ArrowDown";
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = at === -1
      ? (down ? 0 : items.length - 1)
      : (at + (down ? 1 : items.length - 1)) % items.length;
    items[next].focus();
  };

  /* ------------------------------------------------------ the accelerators */

  /* IDR_ZKRATKY, as a browser spells it.  The table is VIRTKEY throughout, so
     an entry is either a VK_ name -- which is the browser's own `key` with the
     prefix taken off, for every key this table uses -- or a single letter,
     which `key` gives back in whatever case the shift state produced. */
  const table = options.accelerators ?? ACCELERATORS["IDR_ZKRATKY"];
  const bindings = (table === undefined ? [] : table.entries)
    .filter((entry) => entry.id !== null && commands[entry.id] !== undefined)
    .map((entry) => ({
      id: entry.id!,
      key: entry.key.startsWith("VK_")
        ? entry.key.slice(3).replace(/^ESCAPE$/, "Escape")
        : entry.key.toLowerCase(),
      ctrl: entry.flags.includes("CONTROL"),
      alt: entry.flags.includes("ALT"),
      shift: entry.flags.includes("SHIFT"),
    }));

  const onAccelerator = (event: KeyboardEvent): void => {
    /* A key that reaches a dialog belongs to the dialog: TranslateAccelerator
       ran on the main window's messages and a modal has its own loop.  The
       target is an Element for a key pressed into a control and the Document
       itself for one pressed into the page, so it is asked rather than cast. */
    const target = event.target;
    if (target instanceof Element
      && target.closest(".pokyd-dialog") !== null) return;
    for (const binding of bindings) {
      if (event.key.toLowerCase() !== binding.key.toLowerCase()) continue;
      if (event.ctrlKey !== binding.ctrl || event.altKey !== binding.alt) continue;
      if (event.shiftKey !== binding.shift) continue;
      event.preventDefault();
      run(binding.id);
      return;
    }
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("keydown", onAccelerator);

  parent.appendChild(element);

  return {
    element,
    setCaption: (text: string): void => {
      if (captionButton !== null) captionButton.textContent = text;
    },
    close,
    remove: (): void => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keydown", onAccelerator);
      element.remove();
    },
  };
}
