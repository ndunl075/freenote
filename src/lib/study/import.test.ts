import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMPORT_OPTIONS,
  guessTermSeparator,
  parseImport,
  unescapeSeparator,
  type ImportOptions,
} from "./import";

const opts = (patch: Partial<ImportOptions>): ImportOptions => ({ ...DEFAULT_IMPORT_OPTIONS, ...patch });

describe("parseImport", () => {
  it("splits tab-separated rows on newlines by default", () => {
    expect(parseImport("femur\tthigh bone\ntibia\tshin bone")).toEqual([
      { term: "femur", definition: "thigh bone" },
      { term: "tibia", definition: "shin bone" },
    ]);
  });

  it("handles Windows line endings and blank lines", () => {
    expect(parseImport("a\t1\r\n\r\nb\t2\r\n")).toEqual([
      { term: "a", definition: "1" },
      { term: "b", definition: "2" },
    ]);
  });

  it("splits on the first comma so definitions keep their commas", () => {
    expect(parseImport("femur,the long, strong thigh bone", opts({ termSeparator: "comma" }))).toEqual([
      { term: "femur", definition: "the long, strong thigh bone" },
    ]);
  });

  it("supports semicolon row separators", () => {
    expect(
      parseImport("a\t1; b\t2 ;c\t3", opts({ rowSeparator: "semicolon" })),
    ).toEqual([
      { term: "a", definition: "1" },
      { term: "b", definition: "2" },
      { term: "c", definition: "3" },
    ]);
  });

  it("supports custom separators including escaped newlines", () => {
    const text = "femur - thigh bone\n\ntibia - shin bone";
    expect(
      parseImport(
        text,
        opts({
          termSeparator: "custom",
          customTermSeparator: " - ",
          rowSeparator: "custom",
          customRowSeparator: "\\n\\n",
        }),
      ),
    ).toEqual([
      { term: "femur", definition: "thigh bone" },
      { term: "tibia", definition: "shin bone" },
    ]);
  });

  it("keeps a row without a separator as a term with an empty definition", () => {
    expect(parseImport("lonely")).toEqual([{ term: "lonely", definition: "" }]);
  });

  it("returns nothing for empty custom separators or empty text", () => {
    expect(parseImport("a - b", opts({ termSeparator: "custom", customTermSeparator: "" }))).toEqual([]);
    expect(parseImport("")).toEqual([]);
  });
});

describe("helpers", () => {
  it("unescapes typed sequences", () => {
    expect(unescapeSeparator("\\n\\t")).toBe("\n\t");
  });

  it("guesses tab over comma", () => {
    expect(guessTermSeparator("a\tb, c")).toBe("tab");
    expect(guessTermSeparator("a, b")).toBe("comma");
    expect(guessTermSeparator("plain")).toBe("tab");
  });
});
