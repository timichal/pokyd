/* IQ Pokyd - src/app/resources.ts - phase 6.1 of PLAN.md.

   GENERATED.  Do not edit: run `node tools/extract-rc.mjs` instead, and
   `node test/app/resources.test.ts` will tell you if this file has drifted
   from the script it came out of.

   What it is: `original/IQ Pokyd/!Prostre/IQPokyd.rc`, the author's own
   resource script, parsed.  Six dialogs, the menu, the accelerator table, the
   version block and the eighteen image files the program loads -- his strings,
   his control ids, his geometry, in the dialog units he wrote them in.  Phase
   6.3 rebuilds the main window from it, 7.1 the settings dialog, 8.2 and 8.3
   the help and about screens.

   Three things it is NOT, all of which cost a session to learn and none of
   which the .rc says out loud:

     1. **The main window's layout is not in here.**  IDD_HLAVNI_OKNO has eight
        controls and none of them is the conversation.  The transcript is a
        hundred STATIC windows created at runtime by
        PREFORMATUJ_TEXTY_CLOVEKA_A_POCITACE_NA_OBRAZOVCE (PROSTRED.FU:904),
        laid out in pixels against OKRAJE (15) and ROZESTUP (10), bottom-anchored
        and growing upwards.  What the eight controls in here do on a resize is
        PREKRESLI_PRVKY_V_OKNE_PRI_ZMENE_VELIKOSTI (PROSTRED.FU:1022), which
        overrides their template positions the first time the window is sized.
        So this file gives the inventory and the initial size; PROSTRED.FU gives
        the layout.
     2. **The colours are not in here either.**  They are six COLORREFs at
        PROSTRED.PR:12-17 and they are 0x00BBGGRR, not #RRGGBB.  They are
        reproduced as PALETTE below, converted, because nothing else would.
     3. **Dialog units are not pixels.**  A dialog unit is a quarter of the
        average character width of the dialog's own font horizontally and an
        eighth of its height vertically, so IDD_HLAVNI_OKNO's 324x181 is in
        Trebuchet MS 12 and IDD_NACITANI's 214x55 is in System 12.  dluToPx()
        does the conversion and takes the base units as an argument, because the
        .rc does not contain them and this file will not pretend otherwise.

   Written by us, not ported.  ASCII only, so every Czech letter is a \uXXXX
   escape with the author's own spelling, diacritics stripped, in the comment
   beside it.
*/


/** A rectangle in dialog units, in the .rc's own order and names. */
export interface RcRect {
  x: number;
  y: number;
  cx: number;
  cy: number;
}

/** What a control's "text" field said when it named another resource instead of
 *  saying something -- CONTROL 139 in the about box is the KYBLSoft logo. */
export interface RcTextResource {
  raw: string;
  /** The resource.h name, when exactly one name has that number. */
  symbol: string | null;
}

export interface RcControl {
  /** The statement keyword: LTEXT, DEFPUSHBUTTON, CONTROL, ... */
  kind: string;
  text: string | null;
  textResource: RcTextResource | null;
  /** The symbolic id.  Numbers are shared between dialogs -- see SHARED_IDS --
   *  so this, and never numericId, is what identifies a control. */
  id: string;
  numericId: number | null;
  /** The window class, either written out by a CONTROL statement or the one the
   *  resource compiler supplies for the keyword. */
  class: string;
  rect: RcRect;
  styles: string[];
  /** Styles the template explicitly turns off, as `NOT WS_VISIBLE`. */
  notStyles: string[];
  /** What the keyword adds on top of styles, WS_CHILD | WS_VISIBLE aside.
   *  Empty for CONTROL, which states everything itself. */
  implicitStyles: string[];
  visible: boolean;
}

export interface RcFont {
  size: number;
  face: string;
}

export interface RcDialog {
  id: string;
  numericId: number | null;
  /** DIALOGEX rather than DIALOG.  Only IDD_HLAVNI_OKNO is. */
  extended: boolean;
  rect: RcRect;
  styles: string[];
  notStyles: string[];
  exStyles: string[];
  caption: string | null;
  font: RcFont | null;
  /** The menu resource attached to the dialog, if any. */
  menu: string | null;
  controls: RcControl[];
}

export interface RcMenuItem {
  kind: "popup" | "item" | "separator";
  /** The text as written, mnemonic ampersand and tab included. */
  raw: string;
  /** The text as it appears on the screen: no ampersand, no shortcut. */
  label: string;
  /** The letter after the ampersand, which Alt reaches the item by. */
  mnemonic: string | null;
  /** What is printed on the right of the item, after the tab. */
  accelerator: string | null;
  id: string | null;
  numericId: number | null;
  /** Trailing flags: HELP on the one right-aligned item. */
  flags: string[];
  items: RcMenuItem[];
}

export interface RcMenu {
  id: string;
  numericId: number | null;
  items: RcMenuItem[];
}

export interface RcAccelerator {
  /** A character for an ASCII accelerator, or a VK_ name. */
  key: string;
  virtualKey: boolean;
  id: string;
  numericId: number | null;
  /** VIRTKEY, SHIFT, CONTROL, ALT, NOINVERT. */
  flags: string[];
}

export interface RcAccelerators {
  id: string;
  numericId: number | null;
  entries: RcAccelerator[];
}

export interface RcImage {
  id: string;
  numericId: number | null;
  /** Relative to RES_DIR, forward-slashed. */
  file: string;
}

export interface RcVersion {
  /** FILEVERSION, PRODUCTVERSION, FILEOS and the rest, as written. */
  fixed: Record<string, string>;
  /** The 040504b0 string block: CompanyName, FileDescription, ... */
  strings: Record<string, string>;
  /** The VarFileInfo translation pair: language 0x405 (Czech), codepage 1200. */
  translation: string[];
}

/** A numeric id more than one symbol shares. */
export interface RcSharedId {
  value: number;
  names: string[];
}


/** Where the image files below are, relative to the repository root. */
export const RES_DIR = "original/IQ Pokyd/!Prostre";


/** The six dialog templates, by symbolic id, in the order the script
 *  defines them. */
export const DIALOGS: Record<string, RcDialog> = {
  IDD_ABOUTBOX:  /* O IQ Pokydu */ {
    id: "IDD_ABOUTBOX",
    numericId: 100,
    extended: false,
    rect: { x: 0, y: 0, cx: 236, cy: 162 },
    styles: ["DS_MODALFRAME", "WS_POPUP", "WS_CAPTION", "WS_SYSMENU"],
    notStyles: [],
    exStyles: [],
    caption: "O IQ Pokydu",
    font: { size: 12, face: "System" },
    menu: null,
    controls: [
      {
        kind: "CTEXT",
        text: "IQ Pokyd v0.15",
        textResource: null,
        id: "IDC_NADPIS",
        numericId: 1026,
        class: "Static",
        rect: { x: 97, y: 16, cx: 126, cy: 9 },
        styles: ["SS_NOPREFIX"],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "DEFPUSHBUTTON",
        text: "OK",
        textResource: null,
        id: "IDOK",
        numericId: 1,
        class: "Button",
        rect: { x: 92, y: 141, cx: 50, cy: 14 },
        styles: ["WS_GROUP"],
        notStyles: [],
        implicitStyles: ["BS_DEFPUSHBUTTON", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "LTEXT",
        text: "Toto je jedna z prvn\u00edch verz\u00ed programu. Sledujte pros\u00edm dal\u0161\u00ed v\u00fdvoj na na\u0161ich internetov\u00fdch str\u00e1nk\u00e1ch.",  /* Toto je jedna z prvnich verzi programu. Sledujte prosim dalsi vyvoj na nasich internetovych strankach. */
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Static",
        rect: { x: 30, y: 51, cx: 176, cy: 18 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_LEFT", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "GROUPBOX",
        text: "Upozorn\u011bn\u00ed",  /* Upozorneni */
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Button",
        rect: { x: 26, y: 43, cx: 186, cy: 30 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_GROUPBOX"],
        visible: true,
      },
      {
        kind: "LTEXT",
        text: "http://iqpokyd.kyblsoft.cz",
        textResource: null,
        id: "IDC_INTERNET",
        numericId: 1094,
        class: "Static",
        rect: { x: 95, y: 79, cx: 83, cy: 8 },
        styles: ["SS_NOTIFY"],
        notStyles: [],
        implicitStyles: ["SS_LEFT", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: null,
        textResource: { raw: "139", symbol: "IDB_KYBLSOFT" },
        id: "IDC_STATIC",
        numericId: -1,
        class: "Static",
        rect: { x: 20, y: 13, cx: 66, cy: 22 },
        styles: ["SS_BITMAP"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "GROUPBOX",
        text: "",
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Button",
        rect: { x: 18, y: 7, cx: 70, cy: 30 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_GROUPBOX"],
        visible: true,
      },
      {
        kind: "EDITTEXT",
        text: null,
        textResource: null,
        id: "IDC_PODEKOVANI",
        numericId: 1059,
        class: "Edit",
        rect: { x: 17, y: 103, cx: 202, cy: 33 },
        styles: ["ES_MULTILINE", "ES_AUTOVSCROLL", "ES_READONLY", "WS_VSCROLL"],
        notStyles: [],
        implicitStyles: ["ES_LEFT", "WS_BORDER", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "CTEXT",
        text: "Ale\u0161 Janda \u00a9 K\u00ddBLSoft 1999-2005",  /* Ales Janda (c) KYBLSoft 1999-2005 */
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Static",
        rect: { x: 97, y: 26, cx: 126, cy: 9 },
        styles: ["SS_NOPREFIX"],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "CTEXT",
        text: ":: freeware ::",
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Static",
        rect: { x: 127, y: 35, cx: 65, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "RTEXT",
        text: "1. vyd\u00e1n\u00ed",  /* 1. vydani */
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Static",
        rect: { x: 183, y: 3, cx: 47, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_RIGHT", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "LTEXT",
        text: "Web:\nE-mail:",  /* Web:\nE-mail: */
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Static",
        rect: { x: 63, y: 79, cx: 28, cy: 17 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_LEFT", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "LTEXT",
        text: "iqpokyd@kyblsoft.cz",
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Static",
        rect: { x: 95, y: 87, cx: 79, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_LEFT", "WS_GROUP"],
        visible: true,
      }
    ],
  },
  IDD_HLAVNI_OKNO:  /* IQ Pokyd v0.15 */ {
    id: "IDD_HLAVNI_OKNO",
    numericId: 102,
    extended: true,
    rect: { x: 0, y: 0, cx: 324, cy: 181 },
    styles: [
      "WS_MINIMIZEBOX",
      "WS_MAXIMIZEBOX",
      "WS_POPUP",
      "WS_VISIBLE",
      "WS_CAPTION",
      "WS_SYSMENU",
      "WS_THICKFRAME"
    ],
    notStyles: [],
    exStyles: ["WS_EX_CONTEXTHELP", "WS_EX_STATICEDGE", "WS_EX_APPWINDOW"],
    caption: "IQ Pokyd v0.15",
    font: { size: 12, face: "Trebuchet MS" },
    menu: "IDR_MENU",
    controls: [
      {
        kind: "EDITTEXT",
        text: null,
        textResource: null,
        id: "IDC_VETA",
        numericId: 1007,
        class: "Edit",
        rect: { x: 46, y: 162, cx: 215, cy: 12 },
        styles: ["ES_AUTOHSCROLL"],
        notStyles: [],
        implicitStyles: ["ES_LEFT", "WS_BORDER", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "DEFPUSHBUTTON",
        text: "\u0158ekni",  /* Rekni */
        textResource: null,
        id: "IDC_NOVAVETA",
        numericId: 1009,
        class: "Button",
        rect: { x: 268, y: 162, cx: 43, cy: 12 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_DEFPUSHBUTTON", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "CTEXT",
        text: "IQ Pokyd v0.15",
        textResource: null,
        id: "IDC_NADPIS2",
        numericId: 1040,
        class: "Static",
        rect: { x: 116, y: 4, cx: 69, cy: 9 },
        styles: ["SS_CENTERIMAGE"],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "LTEXT",
        text: "Ale\u0161 Janda",  /* Ales Janda */
        textResource: null,
        id: "IDC_NADPIS1",
        numericId: 1041,
        class: "Static",
        rect: { x: 9, y: 3, cx: 44, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_LEFT", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "RTEXT",
        text: "K\u00ddBLSoft 2005",  /* KYBLSoft 2005 */
        textResource: null,
        id: "IDC_NADPIS3",
        numericId: 1042,
        class: "Static",
        rect: { x: 254, y: 3, cx: 53, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_RIGHT", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "LTEXT",
        text: "Tv\u00e1 v\u011bta",  /* Tva veta */
        textResource: null,
        id: "IDC_NAPISTVAVETA",
        numericId: 1084,
        class: "Static",
        rect: { x: 8, y: 163, cx: 33, cy: 11 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_LEFT", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "Progress1",
        textResource: null,
        id: "IDC_EFEKTPROGRES1",
        numericId: 1062,
        class: "msctls_progress32",
        rect: { x: 0, y: 0, cx: 6, cy: 176 },
        styles: ["PBS_VERTICAL", "PBS_SMOOTH"],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: [],
        visible: false,
      },
      {
        kind: "CONTROL",
        text: "Progress1",
        textResource: null,
        id: "IDC_EFEKTPROGRES2",
        numericId: 1063,
        class: "msctls_progress32",
        rect: { x: 316, y: 0, cx: 6, cy: 176 },
        styles: ["PBS_VERTICAL", "PBS_SMOOTH"],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: [],
        visible: false,
      }
    ],
  },
  IDD_NACITANI:  /* Spoustim IQ Pokyd... */ {
    id: "IDD_NACITANI",
    numericId: 130,
    extended: false,
    rect: { x: 0, y: 0, cx: 214, cy: 55 },
    styles: ["DS_MODALFRAME", "DS_CENTER", "WS_POPUP", "WS_CAPTION", "WS_SYSMENU"],
    notStyles: [],
    exStyles: [],
    caption: "Spou\u0161t\u00edm IQ Pokyd...",  /* Spoustim IQ Pokyd... */
    font: { size: 12, face: "System" },
    menu: null,
    controls: [
      {
        kind: "PUSHBUTTON",
        text: "P\u0159eru\u0161it",  /* Prerusit */
        textResource: null,
        id: "IDCANCEL",
        numericId: 2,
        class: "Button",
        rect: { x: 78, y: 34, cx: 50, cy: 14 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_PUSHBUTTON", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "Progress1",
        textResource: null,
        id: "IDC_PROGRESNACITANI",
        numericId: 1015,
        class: "msctls_progress32",
        rect: { x: 7, y: 19, cx: 170, cy: 11 },
        styles: ["PBS_SMOOTH", "WS_BORDER"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "LTEXT",
        text: "Spou\u0161t\u00edm IQ Pokyd...",  /* Spoustim IQ Pokyd... */
        textResource: null,
        id: "IDC_TEXT",
        numericId: 1024,
        class: "Static",
        rect: { x: 7, y: 7, cx: 200, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_LEFT", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "RTEXT",
        text: "0.0%",
        textResource: null,
        id: "IDC_PROCENTA",
        numericId: 1023,
        class: "Static",
        rect: { x: 178, y: 19, cx: 29, cy: 12 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_RIGHT", "WS_GROUP"],
        visible: true,
      }
    ],
  },
  IDD_NASTAVENI:  /* IQ Pokyd - nastaveni */ {
    id: "IDD_NASTAVENI",
    numericId: 133,
    extended: false,
    rect: { x: 0, y: 0, cx: 175, cy: 225 },
    styles: ["DS_MODALFRAME", "WS_POPUP", "WS_CAPTION", "WS_SYSMENU"],
    notStyles: [],
    exStyles: [],
    caption: "IQ Pokyd - nastaven\u00ed",  /* IQ Pokyd - nastaveni */
    font: { size: 12, face: "System" },
    menu: null,
    controls: [
      {
        kind: "DEFPUSHBUTTON",
        text: "&OK",
        textResource: null,
        id: "IDOK",
        numericId: 1,
        class: "Button",
        rect: { x: 25, y: 204, cx: 50, cy: 14 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_DEFPUSHBUTTON", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "PUSHBUTTON",
        text: "&Storno",
        textResource: null,
        id: "IDCANCEL",
        numericId: 2,
        class: "Button",
        rect: { x: 99, y: 204, cx: 50, cy: 14 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_PUSHBUTTON", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "GROUPBOX",
        text: "Na\u0161e charakteristiky",  /* Nase charakteristiky */
        textResource: null,
        id: "IDC_RAMECEK1",
        numericId: 1085,
        class: "Button",
        rect: { x: 7, y: 18, cx: 161, cy: 114 },
        styles: ["BS_CENTER"],
        notStyles: [],
        implicitStyles: ["BS_GROUPBOX"],
        visible: true,
      },
      {
        kind: "CTEXT",
        text: "Ty jsi...",
        textResource: null,
        id: "IDC_CLOVEKPOHLAVI",
        numericId: 1077,
        class: "Static",
        rect: { x: 19, y: 29, cx: 56, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "\u017e&ena",  /* z&ena */
        textResource: null,
        id: "IDC_CLOVEKZENA",
        numericId: 1028,
        class: "Button",
        rect: { x: 27, y: 39, cx: 46, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON", "BS_LEFT"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "&mu\u017e",  /* &muz */
        textResource: null,
        id: "IDC_CLOVEKMUZ",
        numericId: 1027,
        class: "Button",
        rect: { x: 27, y: 48, cx: 41, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CTEXT",
        text: "...a j\u00e1 m\u00e1m b\u00fdt",  /* ...a ja mam byt */
        textResource: null,
        id: "IDC_POCITACPOHLAVI",
        numericId: 1078,
        class: "Static",
        rect: { x: 92, y: 28, cx: 67, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "\u017ee&na",  /* ze&na */
        textResource: null,
        id: "IDC_POCITACZENA",
        numericId: 1029,
        class: "Button",
        rect: { x: 116, y: 38, cx: 43, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "m&u\u017e",  /* m&uz */
        textResource: null,
        id: "IDC_POCITACMUZ",
        numericId: 1030,
        class: "Button",
        rect: { x: 116, y: 47, cx: 43, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "LTEXT",
        text: "&a jmenuje\u0161 se",  /* &a jmenujes se */
        textResource: null,
        id: "IDC_JMENOCLOVEKASTATIC",
        numericId: 1079,
        class: "Static",
        rect: { x: 20, y: 59, cx: 55, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_LEFT", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "EDITTEXT",
        text: null,
        textResource: null,
        id: "IDC_JMENOCLOVEKA",
        numericId: 1032,
        class: "Edit",
        rect: { x: 19, y: 70, cx: 55, cy: 12 },
        styles: ["ES_AUTOHSCROLL"],
        notStyles: [],
        implicitStyles: ["ES_LEFT", "WS_BORDER", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "CTEXT",
        text: "a &jmenuji se",
        textResource: null,
        id: "IDC_JMENOPOCITACESTATIC",
        numericId: 1080,
        class: "Static",
        rect: { x: 94, y: 58, cx: 65, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "EDITTEXT",
        text: null,
        textResource: null,
        id: "IDC_JMENOPOCITACE",
        numericId: 1033,
        class: "Edit",
        rect: { x: 101, y: 69, cx: 58, cy: 12 },
        styles: ["ES_AUTOHSCROLL"],
        notStyles: [],
        implicitStyles: ["ES_LEFT", "WS_BORDER", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "CTEXT",
        text: "M\u016fj &charakter m\u00e1 b\u00fdt:",  /* Muj &charakter ma byt: */
        textResource: null,
        id: "IDC_CHARAKTERSTATIC",
        numericId: 1081,
        class: "Static",
        rect: { x: 9, y: 89, cx: 78, cy: 11 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "LISTBOX",
        text: null,
        textResource: null,
        id: "IDC_CHARAKTER",
        numericId: 1055,
        class: "ListBox",
        rect: { x: 16, y: 100, cx: 61, cy: 26 },
        styles: ["LBS_NOINTEGRALHEIGHT", "WS_VSCROLL", "WS_TABSTOP"],
        notStyles: [],
        implicitStyles: ["LBS_NOTIFY", "WS_BORDER"],
        visible: true,
      },
      {
        kind: "CTEXT",
        text: "...a n\u00e1&lada:",  /* ...a na&lada: */
        textResource: null,
        id: "IDC_NALADASTATIC",
        numericId: 1082,
        class: "Static",
        rect: { x: 88, y: 89, cx: 77, cy: 11 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "LISTBOX",
        text: null,
        textResource: null,
        id: "IDC_NALADA",
        numericId: 1057,
        class: "ListBox",
        rect: { x: 100, y: 100, cx: 60, cy: 26 },
        styles: ["LBS_NOINTEGRALHEIGHT", "WS_VSCROLL", "WS_TABSTOP"],
        notStyles: [],
        implicitStyles: ["LBS_NOTIFY", "WS_BORDER"],
        visible: true,
      },
      {
        kind: "GROUPBOX",
        text: "Prost\u0159ed\u00ed",  /* Prostredi */
        textResource: null,
        id: "IDC_RAMECEK2",
        numericId: 1086,
        class: "Button",
        rect: { x: 7, y: 138, cx: 161, cy: 55 },
        styles: ["BS_CENTER"],
        notStyles: [],
        implicitStyles: ["BS_GROUPBOX"],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "Ukl\u00e1&dat rozhovor do souboru",  /* Ukla&dat rozhovor do souboru */
        textResource: null,
        id: "IDC_UKLADATROZHOVOR",
        numericId: 1031,
        class: "Button",
        rect: { x: 34, y: 146, cx: 114, cy: 11 },
        styles: ["BS_AUTOCHECKBOX", "WS_TABSTOP"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "Pou\u017e\u00edvat z&vuky v programu",  /* Pouzivat z&vuky v programu */
        textResource: null,
        id: "IDC_POUZIVATZVUKY",
        numericId: 1038,
        class: "Button",
        rect: { x: 34, y: 157, cx: 114, cy: 11 },
        styles: ["BS_AUTOCHECKBOX", "WS_TABSTOP"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "Pou\u017e\u00edvat e&fekty v programu",  /* Pouzivat e&fekty v programu */
        textResource: null,
        id: "IDC_POUZIVATEFEKTY",
        numericId: 1035,
        class: "Button",
        rect: { x: 34, y: 168, cx: 119, cy: 11 },
        styles: ["BS_AUTOCHECKBOX", "WS_TABSTOP"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "&Preferovat spisovnou \u010de\u0161tinu",  /* &Preferovat spisovnou cestinu */
        textResource: null,
        id: "IDC_SPISOVNACESTINA",
        numericId: 1037,
        class: "Button",
        rect: { x: 34, y: 179, cx: 113, cy: 11 },
        styles: ["BS_AUTOCHECKBOX", "WS_TABSTOP"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "&Emulovat n\u00e1rodn\u00ed kl\u00e1vesnici",  /* &Emulovat narodni klavesnici */
        textResource: null,
        id: "IDC_EMULOVATKLAVESNICI",
        numericId: 1087,
        class: "Button",
        rect: { x: 18, y: 33, cx: 138, cy: 8 },
        styles: ["BS_AUTOCHECKBOX", "BS_LEFT", "WS_TABSTOP"],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: [],
        visible: false,
      },
      {
        kind: "CONTROL",
        text: "\u010desko&u",  /* cesko&u */
        textResource: null,
        id: "IDC_EMULOVATCESKOUKLAVESNICI",
        numericId: 1088,
        class: "Button",
        rect: { x: 25, y: 47, cx: 57, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: [],
        visible: false,
      },
      {
        kind: "CONTROL",
        text: "slo&venskou",
        textResource: null,
        id: "IDC_EMULOVATSLOVENSKOUKLAVESNICI",
        numericId: 1089,
        class: "Button",
        rect: { x: 25, y: 57, cx: 52, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: [],
        visible: false,
      },
      {
        kind: "CONTROL",
        text: "&QWERTY",
        textResource: null,
        id: "IDC_KLAVESNICEQWERTY",
        numericId: 1090,
        class: "Button",
        rect: { x: 94, y: 51, cx: 55, cy: 8 },
        styles: ["BS_AUTOCHECKBOX", "WS_TABSTOP"],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: [],
        visible: false,
      },
      {
        kind: "LTEXT",
        text: "Pro spr\u00e1vn\u00e9 pochopen\u00ed tv\u00e9 v\u011bty programem MUS\u00cd\u0160 ps\u00e1t s diakritikou, tj. s h\u00e1\u010dky a \u010d\u00e1rkami. Pokud nem\u00e1\u0161 nainstalov\u00e1nu n\u00e1rodn\u00ed kl\u00e1vesnici, kter\u00e1 je k tomu pot\u0159eba, nebo se ti ji jen nechce \"po\u0159\u00e1d\" p\u0159ep\u00ednat, m\u016f\u017eu ji v programu emulovat.",  /* Pro spravne pochopeni tve vety programem MUSIS psat s diakritikou, tj. s hacky a carkami. Pokud nemas nainstalovanu narodni klavesnici, ktera je k tomu potreba, nebo se ti ji jen nechce "porad" prepinat, muzu ji v programu emulovat. */
        textResource: null,
        id: "IDC_TEXTKEMULACI",
        numericId: 1091,
        class: "Static",
        rect: { x: 14, y: 72, cx: 147, cy: 54 },
        styles: [],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: ["SS_LEFT", "WS_GROUP"],
        visible: false,
      },
      {
        kind: "CONTROL",
        text: "Zobrazovat standardn\u00ed kurzor",  /* Zobrazovat standardni kurzor */
        textResource: null,
        id: "IDC_ZOBRAZOVATSTANDARDNIKURZOR",
        numericId: 1093,
        class: "Button",
        rect: { x: 34, y: 146, cx: 123, cy: 8 },
        styles: ["BS_AUTOCHECKBOX", "BS_MULTILINE", "WS_TABSTOP"],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: [],
        visible: false,
      },
      {
        kind: "CONTROL",
        text: "Nezobrazovat &pozad\u00ed okna",  /* Nezobrazovat &pozadi okna */
        textResource: null,
        id: "IDC_NEZOBRAZOVATPOZADI",
        numericId: 1092,
        class: "Button",
        rect: { x: 34, y: 158, cx: 123, cy: 8 },
        styles: ["BS_AUTOCHECKBOX", "BS_MULTILINE", "WS_TABSTOP"],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: [],
        visible: false,
      },
      {
        kind: "CONTROL",
        text: "Nez&apisovat na disk",
        textResource: null,
        id: "IDC_READONLYMOD",
        numericId: 1039,
        class: "Button",
        rect: { x: 34, y: 168, cx: 124, cy: 11 },
        styles: ["BS_AUTOCHECKBOX", "WS_TABSTOP"],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: [],
        visible: false,
      },
      {
        kind: "CONTROL",
        text: "Zo&brazovat popisky funkc\u00ed",  /* Zo&brazovat popisky funkci */
        textResource: null,
        id: "IDC_ZOBRAZOVATPOPISKY",
        numericId: 1036,
        class: "Button",
        rect: { x: 34, y: 179, cx: 119, cy: 11 },
        styles: ["BS_AUTOCHECKBOX", "WS_TABSTOP"],
        notStyles: ["WS_VISIBLE"],
        implicitStyles: [],
        visible: false,
      },
      {
        kind: "PUSHBUTTON",
        text: "Z\u00e1kladn\u00ed nastaven\u00ed",  /* Zakladni nastaveni */
        textResource: null,
        id: "IDC_ZAKLADNINASTAVENI",
        numericId: 1095,
        class: "Button",
        rect: { x: 0, y: 0, cx: 88, cy: 13 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_PUSHBUTTON", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "PUSHBUTTON",
        text: "Roz\u0161\u00ed\u0159en\u00e9 nastaven\u00ed",  /* Rozsirene nastaveni */
        textResource: null,
        id: "IDC_ROZSIRENENASTAVENI",
        numericId: 1096,
        class: "Button",
        rect: { x: 86, y: 0, cx: 89, cy: 13 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_PUSHBUTTON", "WS_TABSTOP"],
        visible: true,
      }
    ],
  },
  IDD_TEXT:  /* IQ Pokyd */ {
    id: "IDD_TEXT",
    numericId: 136,
    extended: false,
    rect: { x: 0, y: 0, cx: 227, cy: 196 },
    styles: ["DS_MODALFRAME", "WS_POPUP", "WS_CAPTION", "WS_SYSMENU"],
    notStyles: [],
    exStyles: [],
    caption: "IQ Pokyd",
    font: { size: 14, face: "Tahoma" },
    menu: null,
    controls: [
      {
        kind: "PUSHBUTTON",
        text: "OK",
        textResource: null,
        id: "IDC_BUTTON",
        numericId: 1097,
        class: "Button",
        rect: { x: 82, y: 179, cx: 58, cy: 12 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_PUSHBUTTON", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "",
        textResource: null,
        id: "IDC_TEXT",
        numericId: 1024,
        class: "RICHEDIT",
        rect: { x: 4, y: 3, cx: 218, cy: 166 },
        styles: [
          "ES_MULTILINE",
          "ES_READONLY",
          "ES_WANTRETURN",
          "WS_BORDER",
          "WS_VSCROLL",
          "WS_TABSTOP"
        ],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      }
    ],
  },
  IDD_DEBUGNASTAVENI:  /* IQ Pokyd v0.15 - DEBUG INFO */ {
    id: "IDD_DEBUGNASTAVENI",
    numericId: 160,
    extended: false,
    rect: { x: 0, y: 0, cx: 274, cy: 159 },
    styles: ["DS_MODALFRAME", "WS_POPUP", "WS_CAPTION", "WS_SYSMENU"],
    notStyles: [],
    exStyles: [],
    caption: "IQ Pokyd v0.15 - DEBUG INFO",
    font: { size: 10, face: "System" },
    menu: null,
    controls: [
      {
        kind: "DEFPUSHBUTTON",
        text: "&OK",
        textResource: null,
        id: "IDOK",
        numericId: 1,
        class: "Button",
        rect: { x: 68, y: 138, cx: 50, cy: 14 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_DEFPUSHBUTTON", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "EDITTEXT",
        text: null,
        textResource: null,
        id: "IDC_HODNOTY",
        numericId: 1060,
        class: "Edit",
        rect: { x: 7, y: 7, cx: 167, cy: 126 },
        styles: ["ES_MULTILINE", "ES_AUTOVSCROLL", "ES_READONLY", "WS_VSCROLL"],
        notStyles: [],
        implicitStyles: ["ES_LEFT", "WS_BORDER", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "EDITTEXT",
        text: null,
        textResource: null,
        id: "IDC_NALADABODY",
        numericId: 1076,
        class: "Edit",
        rect: { x: 242, y: 13, cx: 21, cy: 10 },
        styles: ["ES_AUTOHSCROLL"],
        notStyles: [],
        implicitStyles: ["ES_LEFT", "WS_BORDER", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "LTEXT",
        text: "P\u0159esn\u00e1 n\u00e1lada:",  /* Presna nalada: */
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Static",
        rect: { x: 184, y: 14, cx: 53, cy: 8 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_LEFT", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "CTEXT",
        text: "Tolerance pravopisu",
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Static",
        rect: { x: 181, y: 42, cx: 86, cy: 9 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "\u017e\u00e1&dn\u00e1",  /* za&dna */
        textResource: null,
        id: "IDC_ZADNATOLERANCEPRAVOPISU",
        numericId: 1061,
        class: "Button",
        rect: { x: 203, y: 52, cx: 41, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "\u00fa&pln\u00e1",  /* u&plna */
        textResource: null,
        id: "IDC_UPLNATOLERANCEPRAVOPISU",
        numericId: 1062,
        class: "Button",
        rect: { x: 203, y: 62, cx: 40, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CTEXT",
        text: "Rekurze prohled\u00e1v\u00e1n\u00ed",  /* Rekurze prohledavani */
        textResource: null,
        id: "IDC_STATIC",
        numericId: -1,
        class: "Static",
        rect: { x: 181, y: 77, cx: 86, cy: 9 },
        styles: [],
        notStyles: [],
        implicitStyles: ["SS_CENTER", "WS_GROUP"],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "\u017e\u00e1d&n\u00e1",  /* zad&na */
        textResource: null,
        id: "IDC_ZADNAREKURZEPROHLEDAVANI",
        numericId: 1063,
        class: "Button",
        rect: { x: 203, y: 87, cx: 34, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "&mal\u00e1",  /* &mala */
        textResource: null,
        id: "IDC_MALAREKURZEPROHLEDAVANI",
        numericId: 1064,
        class: "Button",
        rect: { x: 203, y: 97, cx: 34, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "s&t\u0159edn\u00ed",  /* s&tredni */
        textResource: null,
        id: "IDC_STREDNIREKURZEPROHLEDAVANI",
        numericId: 1065,
        class: "Button",
        rect: { x: 203, y: 107, cx: 34, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "&velk\u00e1",  /* &velka */
        textResource: null,
        id: "IDC_VELKAREKURZEPROHLEDAVANI",
        numericId: 1066,
        class: "Button",
        rect: { x: 203, y: 117, cx: 34, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "ma&xim\u00e1ln\u00ed",  /* ma&ximalni */
        textResource: null,
        id: "IDC_MAXIMALNIREKURZEPROHLEDAVANI",
        numericId: 1067,
        class: "Button",
        rect: { x: 203, y: 127, cx: 46, cy: 8 },
        styles: ["BS_AUTORADIOBUTTON"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      },
      {
        kind: "PUSHBUTTON",
        text: "&Storno",
        textResource: null,
        id: "IDCANCEL",
        numericId: 2,
        class: "Button",
        rect: { x: 141, y: 138, cx: 50, cy: 14 },
        styles: [],
        notStyles: [],
        implicitStyles: ["BS_PUSHBUTTON", "WS_TABSTOP"],
        visible: true,
      },
      {
        kind: "CONTROL",
        text: "Rychl\u00e9 ukon\u010dov\u00e1n\u00ed",  /* Rychle ukoncovani */
        textResource: null,
        id: "IDC_RYCHLEUKONCOVANI",
        numericId: 1083,
        class: "Button",
        rect: { x: 188, y: 28, cx: 79, cy: 10 },
        styles: ["BS_AUTOCHECKBOX", "WS_TABSTOP"],
        notStyles: [],
        implicitStyles: [],
        visible: true,
      }
    ],
  },
};


/** IDR_MENU, the menu bar of the main window.  The last item is a
 *  top-level MENUITEM with the HELP flag, which is what right-aligns it --
 *  and it opens the settings dialog, the same as Nastaveni does. */
export const MENUS: Record<string, RcMenu> = {
  IDR_MENU: {
    id: "IDR_MENU",
    numericId: 132,
    items: [
      {
        kind: "popup",
        raw: "&IQ Pokyd",
        label: "IQ Pokyd",
        mnemonic: "I",
        accelerator: null,
        id: null,
        numericId: null,
        flags: [],
        items: [
          {
            kind: "separator",
            raw: "",
            label: "",
            mnemonic: null,
            accelerator: null,
            id: null,
            numericId: null,
            flags: [],
            items: [],
          },
          {
            kind: "item",
            raw: "&Nastaven\u00ed...\tF4",  /* &Nastaveni...\tF4 */
            label: "Nastaven\u00ed...",  /* Nastaveni... */
            mnemonic: "N",
            accelerator: "F4",
            id: "ID_NASTAVENI",
            numericId: 32775,
            flags: [],
            items: [],
          },
          {
            kind: "item",
            raw: "&Konec\tAlt+F4",  /* &Konec\tAlt+F4 */
            label: "Konec",
            mnemonic: "K",
            accelerator: "Alt+F4",
            id: "ID_KONEC",
            numericId: 32774,
            flags: [],
            items: [],
          },
          {
            kind: "separator",
            raw: "",
            label: "",
            mnemonic: null,
            accelerator: null,
            id: null,
            numericId: null,
            flags: [],
            items: [],
          }
        ],
      },
      {
        kind: "popup",
        raw: "&N\u00e1pov\u011bda",  /* &Napoveda */
        label: "N\u00e1pov\u011bda",  /* Napoveda */
        mnemonic: "N",
        accelerator: null,
        id: null,
        numericId: null,
        flags: [],
        items: [
          {
            kind: "separator",
            raw: "",
            label: "",
            mnemonic: null,
            accelerator: null,
            id: null,
            numericId: null,
            flags: [],
            items: [],
          },
          {
            kind: "item",
            raw: "&Mal\u00e1 n\u00e1pov\u011bda\tF1",  /* &Mala napoveda\tF1 */
            label: "Mal\u00e1 n\u00e1pov\u011bda",  /* Mala napoveda */
            mnemonic: "M",
            accelerator: "F1",
            id: "ID_MALANAPOVEDA",
            numericId: 32785,
            flags: [],
            items: [],
          },
          {
            kind: "item",
            raw: "&Velk\u00e1 n\u00e1pov\u011bda...\tAlt+F1",  /* &Velka napoveda...\tAlt+F1 */
            label: "Velk\u00e1 n\u00e1pov\u011bda...",  /* Velka napoveda... */
            mnemonic: "V",
            accelerator: "Alt+F1",
            id: "ID_VELKANAPOVEDA",
            numericId: 32783,
            flags: [],
            items: [],
          },
          {
            kind: "separator",
            raw: "",
            label: "",
            mnemonic: null,
            accelerator: null,
            id: null,
            numericId: null,
            flags: [],
            items: [],
          },
          {
            kind: "item",
            raw: "&IQ Pokyd na internetu...\tAlt+F12",  /* &IQ Pokyd na internetu...\tAlt+F12 */
            label: "IQ Pokyd na internetu...",
            mnemonic: "I",
            accelerator: "Alt+F12",
            id: "ID_NAPOVEDA_INTERNET",
            numericId: 32791,
            flags: [],
            items: [],
          },
          {
            kind: "item",
            raw: "I&nformace o verzi\tAlt+V",  /* I&nformace o verzi\tAlt+V */
            label: "Informace o verzi",
            mnemonic: "n",
            accelerator: "Alt+V",
            id: "ID_OVERZI",
            numericId: 32776,
            flags: [],
            items: [],
          },
          {
            kind: "item",
            raw: "&O programu\tShift+F1",  /* &O programu\tShift+F1 */
            label: "O programu",
            mnemonic: "O",
            accelerator: "Shift+F1",
            id: "ID_OPROGRAMU",
            numericId: 32773,
            flags: [],
            items: [],
          },
          {
            kind: "separator",
            raw: "",
            label: "",
            mnemonic: null,
            accelerator: null,
            id: null,
            numericId: null,
            flags: [],
            items: [],
          }
        ],
      },
      {
        kind: "item",
        raw: "N\u00e1lada",  /* Nalada */
        label: "N\u00e1lada",  /* Nalada */
        mnemonic: null,
        accelerator: null,
        id: "ID_NASTAVENI",
        numericId: 32775,
        flags: ["HELP"],
        items: [],
      }
    ],
  },
};


/** IDR_ZKRATKY.  Two of these are the only way to reach a command that
 *  is in no menu: Ctrl+F7 and Ctrl+F8 move the character, F7 and F8 the
 *  mood -- phase 7.4. */
export const ACCELERATORS: Record<string, RcAccelerators> = {
  IDR_ZKRATKY: {
    id: "IDR_ZKRATKY",
    numericId: 134,
    entries: [
      {
        key: "D",
        virtualKey: false,
        id: "ID_CHEAT_DEBUGINFO",
        numericId: 32782,
        flags: ["VIRTKEY", "SHIFT", "CONTROL", "ALT", "NOINVERT"],
      },
      {
        key: "E",
        virtualKey: false,
        id: "ID_PREDCHOZIVETA",
        numericId: 32779,
        flags: ["VIRTKEY", "CONTROL", "NOINVERT"],
      },
      {
        key: "V",
        virtualKey: false,
        id: "ID_OVERZI",
        numericId: 32776,
        flags: ["VIRTKEY", "ALT", "NOINVERT"],
      },
      {
        key: "VK_ESCAPE",
        virtualKey: true,
        id: "ID_ZKRATKA_SMAZRADEK",
        numericId: 32778,
        flags: ["VIRTKEY", "NOINVERT"],
      },
      {
        key: "VK_F1",
        virtualKey: true,
        id: "ID_MALANAPOVEDA",
        numericId: 32785,
        flags: ["VIRTKEY", "NOINVERT"],
      },
      {
        key: "VK_F1",
        virtualKey: true,
        id: "ID_VELKANAPOVEDA",
        numericId: 32783,
        flags: ["VIRTKEY", "ALT", "NOINVERT"],
      },
      {
        key: "VK_F1",
        virtualKey: true,
        id: "ID_OPROGRAMU",
        numericId: 32773,
        flags: ["VIRTKEY", "SHIFT", "NOINVERT"],
      },
      {
        key: "VK_F12",
        virtualKey: true,
        id: "ID_NAPOVEDA_INTERNET",
        numericId: 32791,
        flags: ["VIRTKEY", "ALT", "NOINVERT"],
      },
      {
        key: "VK_F3",
        virtualKey: true,
        id: "ID_PREDCHOZIVETA",
        numericId: 32779,
        flags: ["VIRTKEY", "NOINVERT"],
      },
      {
        key: "VK_F4",
        virtualKey: true,
        id: "ID_NASTAVENI",
        numericId: 32775,
        flags: ["VIRTKEY", "NOINVERT"],
      },
      {
        key: "VK_F7",
        virtualKey: true,
        id: "ID_ZLEPSENINALADY",
        numericId: 32787,
        flags: ["VIRTKEY", "NOINVERT"],
      },
      {
        key: "VK_F7",
        virtualKey: true,
        id: "ID_ZLEPSENICHARAKTERU",
        numericId: 32789,
        flags: ["VIRTKEY", "CONTROL", "NOINVERT"],
      },
      {
        key: "VK_F8",
        virtualKey: true,
        id: "ID_ZHORSENINALADY",
        numericId: 32788,
        flags: ["VIRTKEY", "NOINVERT"],
      },
      {
        key: "VK_F8",
        virtualKey: true,
        id: "ID_ZHORSENICHARAKTERU",
        numericId: 32790,
        flags: ["VIRTKEY", "CONTROL", "NOINVERT"],
      }
    ],
  },
};


/** The bitmaps, in script order.  Phase 6.2 transcodes them. */
export const BITMAPS: RcImage[] = [
  { id: "IDB_KYBLSOFT", numericId: 139, file: "res/kyblsoft.bmp" },
  { id: "IDB_MENUKONEC", numericId: 162, file: "res/bitmap2.bmp" },
  { id: "IDB_MENUNASTAVENI", numericId: 163, file: "res/menunast.bmp" },
  { id: "IDB_MENUMALANAPOVEDA", numericId: 164, file: "res/menumala.bmp" },
  { id: "IDB_MENUVELKANAPOVEDA", numericId: 165, file: "res/menuvelk.bmp" },
  { id: "IDB_MENUOPROGRAMU", numericId: 166, file: "res/menuopro.bmp" },
  { id: "IDB_POZADIMALE", numericId: 170, file: "res/POZMALE.BMP" },
  { id: "IDB_MENUOVERZI", numericId: 173, file: "res/menuverz.bmp" },
  { id: "IDB_MENUINTERNET", numericId: 176, file: "res/internet.bmp" },
  { id: "IDB_KURZORKLAVESNICE", numericId: 179, file: "res/bmp00001.bmp" },
  { id: "IDB_POZADIHLAVNIHOOKNA", numericId: 168, file: "res/pozadi-iqpokyd.bmp" }
];


/** The icons.  IDR_MAINFRAME is the one Windows shows in the task bar;
 *  IDI_TVAR is also drawn on the Rekni button (mfcDlg.cpp:421). */
export const ICONS: RcImage[] = [
  { id: "IDR_MAINFRAME", numericId: 128, file: "res/IQPokyd.ico" },
  { id: "IDI_TVAR", numericId: 137, file: "res/icon1.ico" },
  { id: "IDI_TVAR16", numericId: 177, file: "res/ico00001.ico" }
];


/** VS_VERSION_INFO.  Phase 8.3 reproduces it. */
export const VERSION: RcVersion = {
  fixed: {
    FILEVERSION: "0,1,0,0",
    PRODUCTVERSION: "0,1,0,0",
    FILEFLAGSMASK: "0x3fL",
    FILEFLAGS: "0x0L",
    FILEOS: "0x4L",
    FILETYPE: "0x1L",
    FILESUBTYPE: "0x0L",
  },
  strings: {
    Comments: "Aktualizace programu zdarma na http://iqpokyd.kyblsoft.cz",
    CompanyName: "K\u00ddBLSoft",  /* KYBLSoft */
    FileDescription: "IQ Pokyd v0.15 - kecac\u00ed program od K\u00ddBLSoftu",  /* IQ Pokyd v0.15 - kecaci program od KYBLSoftu */
    FileVersion: "0, 1, 0, 0",
    InternalName: "IQPokyd",
    LegalCopyright: "Copyright (C) K\u00ddBLSoft 1999-2005",  /* Copyright (C) KYBLSoft 1999-2005 */
    LegalTrademarks: "",
    OriginalFilename: "IQPokyd.EXE",
    PrivateBuild: "",
    ProductName: "IQ Pokyd",
    ProductVersion: "0, 1, 0, 0",
    SpecialBuild: "",
  },
  translation: ["0x405", "1200"],
};


/** Numeric ids that more than one symbol shares, which is why nothing in
 *  this file is keyed by number.  Developer Studio handed out ids per
 *  dialog and let them collide across dialogs; IDC_EFEKTPROGRES1 in the
 *  main window and IDC_UPLNATOLERANCEPRAVOPISU in the debug dialog are both
 *  1062. */
export const SHARED_IDS: RcSharedId[] = [
  { value: 101, names: ["IDS_ABOUTBOX", "_APS_NEXT_SYMED_VALUE"] },
  { value: 102, names: ["IDD_MFC_DIALOG", "IDD_HLAVNI_OKNO"] },
  { value: 134, names: ["IDD_HLAVNIOKNO", "IDR_ZKRATKY"] },
  { value: 164, names: ["IDB_MENUMALANAPOVEDA", "IDC_KURZOR"] },
  { value: 1007, names: ["IDC_CISLO", "IDC_VETA"] },
  { value: 1008, names: ["IDC_CISLA", "IDC_ROZHOVOR"] },
  { value: 1009, names: ["IDC_CISLO2CISLA", "IDC_NOVAVETA"] },
  { value: 1035, names: ["IDC_ZABRAZOVATPOPISKY", "IDC_POUZIVATEFEKTY"] },
  { value: 1039, names: ["IDC_TEXT2", "IDC_READONLYMOD"] },
  { value: 1062, names: ["IDC_EFEKTPROGRES1", "IDC_UPLNATOLERANCEPRAVOPISU"] },
  { value: 1063, names: ["IDC_EFEKTPROGRES2", "IDC_ZADNAREKURZEPROHLEDAVANI"] },
  { value: 1064, names: ["IDC_MALAREKURZEPROHLEDAVANI", "IDC_ODPOVEDPOCITACE1"] },
  { value: 1065, names: ["IDC_STREDNIREKURZEPROHLEDAVANI", "IDC_ODPOVEDPOCITACE2"] },
  { value: 1066, names: ["IDC_VELKAREKURZEPROHLEDAVANI", "IDC_ODPOVEDPOCITACE3"] },
  { value: 1067, names: ["IDC_MAXIMALNIREKURZEPROHLEDAVANI", "IDC_ODPOVEDPOCITACE4"] }
];


/* ----------------------------------------------------------- dialog units */

/** The horizontal and vertical dialog base units of a dialog's font, in pixels.
 *  MFC takes them from the font's TEXTMETRIC: x is tmAveCharWidth, y is
 *  tmHeight.  They are a property of the font on the machine that draws the
 *  dialog and are not in the resource script, which is why nothing here makes
 *  one up. */
export interface DialogBaseUnits {
  x: number;
  y: number;
}

/** A dialog unit is a quarter of a base unit horizontally, an eighth of one
 *  vertically -- MapDialogRect, and the reason IDD_HLAVNI_OKNO's 324 units of
 *  width are not 324 pixels.  Done the way MapDialogRect does it, with MulDiv:
 *  multiply first, then divide, rounding to nearest. */
export function dluToPx(rect: RcRect, base: DialogBaseUnits): {
  x: number; y: number; width: number; height: number;
} {
  return {
    x: Math.round((rect.x * base.x) / 4),
    y: Math.round((rect.y * base.y) / 8),
    width: Math.round((rect.cx * base.x) / 4),
    height: Math.round((rect.cy * base.y) / 8),
  };
}

/* ------------------------------------------------------------- the palette */

/** The six colours the main window is drawn in, PROSTRED.PR:12-17.
 *
 *  They are COLORREFs in the source, which is 0x00BBGGRR -- byte-reversed from
 *  the #RRGGBB anyone reading them as hex would assume.  g_barvatextucloveka is
 *  written 0x0057FFFF and is yellow, not sky blue.  Converted here once so that
 *  nothing downstream has to remember, with the author's own constant name and
 *  literal beside each one. */
export const PALETTE = {
  /** g_barvapozadizadavanivety = 0x00110009 -- behind the sentence you type. */
  inputBackground: "#090011",
  /** g_barvatextuhlavnihookna = 0x00E0E0E0 -- anything not otherwise coloured. */
  windowText: "#e0e0e0",
  /** g_barvatextucloveka = 0x0057FFFF -- what you said. */
  humanText: "#ffff57",
  /** g_barvatextupocitace = 0x0057FF57 -- what IQ Pokyd answered. */
  pokydText: "#57ff57",
  /** g_barvahlavickovychtextu = 0x00FFFF90 -- IDC_NADPIS1 and IDC_NADPIS3. */
  headingText: "#90ffff",
  /** g_barvanapisuIQPokyd = 0x00FFFFFF -- IDC_NADPIS2, the title in the middle. */
  titleText: "#ffffff",
  /** CreateSolidBrush(0x000000), PROSTRED.FU:339 -- the window with no bitmap. */
  windowBackground: "#000000",
} as const;

/* ------------------------------------------------- what PROSTRED.FU adds */

/** The main window's runtime layout, which is in PROSTRED.FU and not in the
 *  resource script.  Pixels, not dialog units: the author wrote them against
 *  the client rectangle directly.
 *
 *  The transcript occupies the box below and is the whole of the conversation:
 *  a hundred STATIC children, created once, laid out from the bottom upwards
 *  with ROZESTUP between them, each one word-wrapped to the box's width and as
 *  tall as its line count.  Anything that does not fit above `top` is not
 *  drawn (PROSTRED.FU:962), so the window's height is how much history there
 *  is -- there is no scrollbar, and there never was. */
export const WINDOW_LAYOUT = {
  /** OKRAJE, PROSTRED.FU:901. */
  margin: 15,
  /** ROZESTUP, PROSTRED.FU:902 -- between one sentence and the next. */
  spacing: 10,
  /** The transcript box, as insets from the client rectangle
   *  (PROSTRED.FU:923-924): left and right are OKRAJE+10, the top is OKRAJE+20
   *  and the bottom is OKRAJE+45, which is where the input line begins. */
  transcript: { left: 25, right: 25, top: 35, bottom: 60 },
  /** The font those hundred statics are created with, PROSTRED.FU:917-919.
   *  lfHeight is positive here, so it is a cell height and not a point size. */
  transcriptFont: { face: "Trebuchet MS", lfHeight: 20 },
  /** IDC_NADPIS1 and IDC_NADPIS3, mfcDlg.cpp:370-376. */
  headingFont: { face: "Trebuchet MS", lfHeight: -18, weight: 500 },
  /** IDC_NADPIS2, the one in the middle, mfcDlg.cpp:378-383.  Garamond, and
   *  not the Trebuchet MS the template asks for. */
  titleFont: { face: "Garamond", lfHeight: -22, weight: 800 },
  /** OnGetMinMaxInfo, mfcDlg.cpp:990-991 -- the window would not go smaller. */
  minimumSize: { width: 400, height: 220 },
  /** How many sentences the window remembers, g_poslednich100vet. */
  transcriptCapacity: 100,
} as const;
