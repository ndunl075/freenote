import { describe, expect, it } from "vitest";
import type { Page } from "@/lib/db/types";
import { htmlToLines, parseLine, rowsFromNote } from "./noteToSet";

const page = (objects: Page["objects"], index = 0): Page => ({
  id: `p${index}`,
  noteId: "n",
  index,
  height: 1056,
  strokes: [],
  objects,
});

const text = (id: string, html: string, x = 0, y = 0): Page["objects"][number] => ({
  kind: "text",
  id,
  x,
  y,
  width: 400,
  html,
  fontSize: 16,
  color: "#000",
});

describe("htmlToLines", () => {
  it("turns block tags and breaks into line boundaries", () => {
    expect(htmlToLines("<p>one</p><p>two</p>")).toEqual(["one", "two"]);
    expect(htmlToLines("a<br>b<br/>c")).toEqual(["a", "b", "c"]);
  });

  it("strips inline markup but keeps its text", () => {
    expect(htmlToLines("<b>bold</b> and <i>italic</i>")).toEqual(["bold and italic"]);
  });

  it("decodes the entities a contenteditable actually produces", () => {
    expect(htmlToLines("a&nbsp;&amp;&nbsp;b")).toEqual(["a & b"]);
  });

  it("drops blank lines", () => {
    expect(htmlToLines("<p>one</p><p></p><p>  </p><p>two</p>")).toEqual(["one", "two"]);
  });
});

describe("parseLine", () => {
  it("splits on every supported separator", () => {
    expect(parseLine("mitosis: cell division")).toEqual({
      term: "mitosis",
      definition: "cell division",
    });
    expect(parseLine("mitosis — cell division")).toEqual({
      term: "mitosis",
      definition: "cell division",
    });
    expect(parseLine("mitosis\tcell division")).toEqual({
      term: "mitosis",
      definition: "cell division",
    });
    expect(parseLine("mitosis|cell division")).toEqual({
      term: "mitosis",
      definition: "cell division",
    });
  });

  it("prefers the longest separator when several could match", () => {
    // " - " must not win over " — " inside an em-dashed line.
    expect(parseLine("photo - synthesis — making sugar")).toEqual({
      term: "photo - synthesis",
      definition: "making sugar",
    });
  });

  it("rejects a bullet, which is a dash with nothing before it", () => {
    expect(parseLine("- just a bullet point")).toBeNull();
  });

  it("rejects a line with no separator", () => {
    expect(parseLine("just a sentence of notes")).toBeNull();
  });

  it("rejects a separator with an empty side", () => {
    expect(parseLine("term: ")).toBeNull();
    expect(parseLine(": definition")).toBeNull();
  });

  it("keeps colons inside the definition", () => {
    expect(parseLine("ratio: a to b: simplified")).toEqual({
      term: "ratio",
      definition: "a to b: simplified",
    });
  });
});

describe("rowsFromNote", () => {
  it("reads objects top to bottom, then left to right", () => {
    const pages = [
      page([
        text("c", "<p>third: 3</p>", 0, 200),
        text("a", "<p>first: 1</p>", 0, 10),
        text("b", "<p>second: 2</p>", 300, 10),
      ]),
    ];
    expect(rowsFromNote(pages).map((r) => r.term)).toEqual(["first", "second", "third"]);
  });

  it("reads pages in document order", () => {
    const pages = [
      page([text("b", "<p>beta: 2</p>")], 1),
      page([text("a", "<p>alpha: 1</p>")], 0),
    ];
    expect(rowsFromNote(pages).map((r) => r.term)).toEqual(["alpha", "beta"]);
  });

  it("includes sticky notes", () => {
    const pages = [
      page([
        {
          kind: "sticky",
          id: "s",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          text: "osmosis: water movement\nsolute: dissolved thing",
          color: "#ffe14d",
        },
      ]),
    ];
    expect(rowsFromNote(pages)).toHaveLength(2);
  });

  it("ignores strokes and images, which hold no readable text", () => {
    const pages = [
      page([
        {
          kind: "image",
          id: "i",
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          rotation: 0,
          blobId: "b",
        },
      ]),
    ];
    expect(rowsFromNote(pages)).toEqual([]);
  });

  it("lets a later correction of the same term win", () => {
    const pages = [
      page([
        text("a", "<p>enzyme: wrong answer</p>", 0, 0),
        text("b", "<p>Enzyme: a biological catalyst</p>", 0, 100),
      ]),
    ];
    const rows = rowsFromNote(pages);
    expect(rows).toHaveLength(1);
    expect(rows[0].definition).toBe("a biological catalyst");
  });
});
