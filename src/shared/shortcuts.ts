/**
 * System-wide chords, stored the way the host parses them:
 * `Control+Command+K`, modifiers first and one main key.
 */

export type ChordSource = {
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

/** Key codes the host understands, so a chord it cannot parse is never stored. */
const KEY_CODE =
  /^(?:Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Arrow(?:Up|Down|Left|Right)|Space|Enter|Escape|Tab|Backspace|Delete|Insert|Home|End|PageUp|PageDown|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Backquote|Comma|Period|Slash)$/;

const MODIFIER_GLYPHS: [keyof ChordSource, string, string][] = [
  ["ctrlKey", "Control", "⌃"],
  ["altKey", "Alt", "⌥"],
  ["shiftKey", "Shift", "⇧"],
  ["metaKey", "Command", "⌘"],
];

/** How a main key reads in the menu-bar-app idiom: ⌘K, not ⌘KeyK. */
const KEY_GLYPHS: Record<string, string> = {
  Space: "Space",
  Enter: "↩",
  Escape: "⎋",
  Tab: "⇥",
  Backspace: "⌫",
  Delete: "⌦",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Comma: ",",
  Period: ".",
  Slash: "/",
};

/** Spellings the host accepts for the same modifier. */
const MODIFIER_ALIASES: Record<string, string> = {
  control: "Control",
  ctrl: "Control",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
  command: "Command",
  cmd: "Command",
  super: "Command",
  meta: "Command",
  // macOS resolves the portable spelling to Command.
  commandorcontrol: "Command",
  commandorctrl: "Command",
  cmdorcontrol: "Command",
  cmdorctrl: "Command",
};

function keyGlyph(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return KEY_GLYPHS[code] ?? code;
}

/**
 * A chord worth binding needs a real key and a modifier that is not Shift
 * alone, which would swallow ordinary typing everywhere.
 */
export function chordFromKeyboard(event: ChordSource): string | null {
  if (!KEY_CODE.test(event.code)) return null;
  if (!event.ctrlKey && !event.altKey && !event.metaKey) return null;
  const parts = MODIFIER_GLYPHS.filter(([flag]) => event[flag] === true).map(
    ([, name]) => name,
  );
  parts.push(event.code);
  return parts.join("+");
}

/** The chord as macOS writes it, for the recording field. */
export function chordLabel(chord: string): string {
  const trimmed = chord.trim();
  if (!trimmed) return "";
  const tokens = trimmed.split("+").map((token) => token.trim());
  const key = tokens.pop();
  if (!key) return "";
  const held = new Set(
    tokens
      .map((token) => MODIFIER_ALIASES[token.toLowerCase()])
      .filter((name): name is string => Boolean(name)),
  );
  const glyphs = MODIFIER_GLYPHS.filter(([, name]) => held.has(name)).map(
    ([, , glyph]) => glyph,
  );
  return `${glyphs.join("")}${keyGlyph(key)}`;
}
