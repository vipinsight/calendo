import { describe, expect, it } from "vitest";
import { chordFromKeyboard, chordLabel } from "../src/shared/shortcuts";

const chord = (overrides: Partial<Parameters<typeof chordFromKeyboard>[0]>) =>
  chordFromKeyboard({
    code: "KeyK",
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...overrides,
  });

describe("recording a chord", () => {
  it("writes the modifiers the host parses, in a fixed order", () => {
    expect(chord({ ctrlKey: true, metaKey: true })).toBe("Control+Command+KeyK");
    expect(chord({ altKey: true, shiftKey: true, metaKey: true })).toBe(
      "Alt+Shift+Command+KeyK",
    );
  });

  it("refuses a bare key or one held with Shift alone", () => {
    expect(chord({})).toBeNull();
    expect(chord({ shiftKey: true })).toBeNull();
  });

  it("refuses a modifier with no key of its own", () => {
    expect(chord({ code: "MetaLeft", metaKey: true })).toBeNull();
    expect(chord({ code: "CapsLock", ctrlKey: true })).toBeNull();
  });

  it("takes function keys, digits, and punctuation", () => {
    expect(chord({ code: "F5", ctrlKey: true })).toBe("Control+F5");
    expect(chord({ code: "Digit1", metaKey: true })).toBe("Command+Digit1");
    expect(chord({ code: "ArrowUp", altKey: true })).toBe("Alt+ArrowUp");
  });
});

describe("showing a chord", () => {
  it("reads as macOS writes it", () => {
    expect(chordLabel("Control+Command+KeyK")).toBe("⌃⌘K");
    expect(chordLabel("Alt+Shift+Command+Digit1")).toBe("⌥⇧⌘1");
    expect(chordLabel("Control+ArrowUp")).toBe("⌃↑");
  });

  it("understands the spellings the host also accepts", () => {
    expect(chordLabel("CmdOrCtrl+KeyK")).toBe("\u2318K");
    expect(chordLabel("Ctrl+Cmd+KeyK")).toBe("⌃⌘K");
  });

  it("has nothing to show for an unset shortcut", () => {
    expect(chordLabel("")).toBe("");
    expect(chordLabel("   ")).toBe("");
  });
});
