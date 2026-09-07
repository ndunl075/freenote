import { describe, expect, it } from "vitest";
import { buildPdf } from "./pdf";

/** A tiny but structurally valid JPEG header + EOI. */
const fakeJpeg = () =>
  new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0xff, 0xd9]);

async function readPdf(blob: Blob): Promise<{ text: string; bytes: Uint8Array }> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // latin1 keeps byte offsets and string indices aligned, which is the whole
  // point of these assertions.
  return { text: Array.from(bytes, (b) => String.fromCharCode(b)).join(""), bytes };
}

describe("pdf writer", () => {
  it("emits a header, trailer and EOF marker", async () => {
    const { text } = await readPdf(buildPdf([{ jpeg: fakeJpeg(), widthPx: 100, heightPx: 200 }]));
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("writes one page object per image", async () => {
    const pages = [
      { jpeg: fakeJpeg(), widthPx: 100, heightPx: 200 },
      { jpeg: fakeJpeg(), widthPx: 100, heightPx: 200 },
      { jpeg: fakeJpeg(), widthPx: 100, heightPx: 200 },
    ];
    const { text } = await readPdf(buildPdf(pages));
    expect(text.match(/\/Type \/Page[^s]/g)).toHaveLength(3);
    expect(text).toContain("/Count 3");
  });

  it("records xref offsets that actually point at their objects", async () => {
    const { text } = await readPdf(
      buildPdf([
        { jpeg: fakeJpeg(), widthPx: 100, heightPx: 200 },
        { jpeg: fakeJpeg(), widthPx: 80, heightPx: 90 },
      ]),
    );

    // Anchor on the newline: a bare "xref\n" also matches inside "startxref".
    const xrefStart = text.lastIndexOf("\nxref\n") + 1;
    const entries = text
      .slice(xrefStart)
      .split("\n")
      .filter((l) => /^\d{10} \d{5} [nf] $/.test(l));

    // 1 free entry + 2 fixed objects + 3 objects per page.
    expect(entries).toHaveLength(1 + 2 + 2 * 3);

    entries.slice(1).forEach((entry, i) => {
      const offset = parseInt(entry.slice(0, 10), 10);
      expect(text.slice(offset)).toMatch(new RegExp(`^${i + 1} 0 obj`));
    });
  });

  it("points startxref at the xref table", async () => {
    const { text } = await readPdf(buildPdf([{ jpeg: fakeJpeg(), widthPx: 10, heightPx: 10 }]));
    const declared = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(declared, declared + 4)).toBe("xref");
  });

  it("copies JPEG bytes through untouched", async () => {
    const jpeg = fakeJpeg();
    const { bytes } = await readPdf(buildPdf([{ jpeg, widthPx: 10, heightPx: 10 }]));

    let found = false;
    outer: for (let i = 0; i <= bytes.length - jpeg.length; i++) {
      for (let j = 0; j < jpeg.length; j++) {
        if (bytes[i + j] !== jpeg[j]) continue outer;
      }
      found = true;
      break;
    }
    expect(found).toBe(true);
  });

  it("declares an image length matching the embedded bytes", async () => {
    const jpeg = fakeJpeg();
    const { text } = await readPdf(buildPdf([{ jpeg, widthPx: 10, heightPx: 10 }]));
    expect(text).toContain(`/Filter /DCTDecode /Length ${jpeg.length}`);
  });

  it("scales the media box to the image aspect ratio", async () => {
    const { text } = await readPdf(buildPdf([{ jpeg: fakeJpeg(), widthPx: 1224, heightPx: 1584 }]));
    // 612pt wide (US Letter), height follows the 1224x1584 ratio.
    expect(text).toContain("/MediaBox [0 0 612 792]");
  });

  it("produces a valid empty document for zero pages", async () => {
    const { text } = await readPdf(buildPdf([]));
    expect(text).toContain("/Count 0");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });
});
