/* ============================================================================
   Minimal PDF writer

   Notability exports notes as PDF, and so does freenote. Rather than pull in a
   PDF library for the one thing we need — a page per rendered image — this
   emits the ~200 bytes of PDF structure that wraps each JPEG directly.

   JPEGs embed with no re-encoding at all: PDF's DCTDecode filter *is* JPEG, so
   the compressed bytes are copied through untouched.
   ========================================================================= */

export interface PdfPageImage {
  /** Raw JPEG bytes. */
  jpeg: Uint8Array;
  widthPx: number;
  heightPx: number;
}

const encoder = new TextEncoder();

class PdfBuilder {
  private chunks: Uint8Array[] = [];
  private length = 0;
  /** Byte offset of each indirect object, indexed by object number. */
  private offsets: number[] = [0];

  push(data: string | Uint8Array): void {
    const bytes = typeof data === "string" ? encoder.encode(data) : data;
    this.chunks.push(bytes);
    this.length += bytes.length;
  }

  /** Opens object `n`, recording where it starts for the xref table. */
  beginObject(n: number, body: string): void {
    this.offsets[n] = this.length;
    this.push(`${n} 0 obj\n${body}\n`);
  }

  endObject(): void {
    this.push("endobj\n");
  }

  get size(): number {
    return this.length;
  }

  finish(objectCount: number, rootRef: number): Blob {
    const xrefOffset = this.length;

    // The xref table is fixed-width by spec: exactly 20 bytes per entry.
    let xref = `xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objectCount; i++) {
      xref += `${String(this.offsets[i] ?? 0).padStart(10, "0")} 00000 n \n`;
    }
    this.push(xref);
    this.push(
      `trailer\n<< /Size ${objectCount + 1} /Root ${rootRef} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    );

    return new Blob(this.chunks as BlobPart[], { type: "application/pdf" });
  }
}

/**
 * Builds a PDF with one page per image, each sized to the image's aspect ratio
 * at 72dpi-equivalent points.
 */
export function buildPdf(pages: PdfPageImage[]): Blob {
  const pdf = new PdfBuilder();
  pdf.push("%PDF-1.4\n");
  // A binary comment tells tools the file is not plain text.
  pdf.push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  // Object numbering: 1 = catalog, 2 = page tree, then 3 objects per page.
  const pageObjectNumbers = pages.map((_, i) => 3 + i * 3);
  const totalObjects = 2 + pages.length * 3;

  pdf.beginObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  pdf.endObject();

  const kids = pageObjectNumbers.map((n) => `${n} 0 R`).join(" ");
  pdf.beginObject(2, `<< /Type /Pages /Kids [ ${kids} ] /Count ${pages.length} >>`);
  pdf.endObject();

  pages.forEach((page, i) => {
    const pageObj = pageObjectNumbers[i];
    const contentObj = pageObj + 1;
    const imageObj = pageObj + 2;

    // Cap the long edge so a tall page stays a sane paper size.
    const scale = 612 / page.widthPx;
    const width = Math.round(page.widthPx * scale);
    const height = Math.round(page.heightPx * scale);

    pdf.beginObject(
      pageObj,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] ` +
        `/Resources << /XObject << /Im0 ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`,
    );
    pdf.endObject();

    // The cm operator scales the unit image square up to the page box.
    const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
    pdf.beginObject(contentObj, `<< /Length ${content.length} >>\nstream\n${content}endstream`);
    pdf.endObject();

    pdf.beginObject(
      imageObj,
      `<< /Type /XObject /Subtype /Image /Width ${page.widthPx} /Height ${page.heightPx} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream`,
    );
    pdf.push("\n");
    pdf.push(page.jpeg);
    pdf.push("\nendstream\n");
    pdf.endObject();
  });

  return pdf.finish(totalObjects, 1);
}
