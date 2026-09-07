import { expect, test, type Page } from "@playwright/test";

/**
 * The test that matters most here is that ink survives a reload.
 *
 * freenote has no server. If IndexedDB persistence breaks, a user's notes are
 * simply gone — there is no backup on someone else's machine to fall back on.
 * Everything else in this file is secondary to that one guarantee.
 */

const NOTE_ID = "note_e2e";
const PAGE_ID = "page_e2e";

/**
 * Seeds a note directly into IndexedDB.
 *
 * The app has to open the database first, because Dexie is what declares the
 * schema — writing before that would create a store-less database that the
 * real app then refuses to upgrade.
 */
async function seedNote(page: Page): Promise<void> {
  await page.goto("/note/?id=bootstrap-schema");
  await page.waitForFunction(
    async () => (await indexedDB.databases()).some((d) => d.name === "freenote"),
    null,
    { timeout: 15_000 },
  );

  await page.evaluate(
    async ([noteId, pageId]) => {
      const open = indexedDB.open("freenote");
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });

      const now = Date.now();
      const tx = db.transaction(["notes", "pages"], "readwrite");
      tx.objectStore("pages").put({
        id: pageId,
        noteId,
        index: 0,
        height: 1056,
        strokes: [],
        objects: [],
      });
      tx.objectStore("notes").put({
        id: noteId,
        subjectId: null,
        title: "E2E note",
        pageIds: [pageId],
        paper: "lined-wide",
        paperColor: "white",
        starred: false,
        createdAt: now,
        updatedAt: now,
      });

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    [NOTE_ID, PAGE_ID] as const,
  );
}

/** Draws a stroke by dragging across the ink surface. */
async function draw(page: Page, points: [number, number][]): Promise<void> {
  const canvas = page.getByRole("application").first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Ink canvas has no bounding box");

  await page.mouse.move(box.x + points[0][0], box.y + points[0][1]);
  await page.mouse.down();
  for (const [x, y] of points.slice(1)) {
    await page.mouse.move(box.x + x, box.y + y, { steps: 6 });
  }
  await page.mouse.up();
}

/** Strokes actually written to disk, read straight out of IndexedDB. */
async function storedStrokeCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const open = indexedDB.open("freenote");
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const rows = await new Promise<{ strokes?: unknown[] }[]>((resolve, reject) => {
      const req = db.transaction("pages").objectStore("pages").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.reduce((n, p) => n + (p.strokes?.length ?? 0), 0);
  });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("freenote");
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      }),
  );
});

test("boots without contacting anything off-device", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (req) => {
    const host = new URL(req.url()).hostname;
    if (host !== "127.0.0.1" && host !== "localhost") external.push(req.url());
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // The privacy claim is only true if the built app makes no outbound calls —
  // including for fonts, which next/font self-hosts precisely so this holds.
  expect(external).toEqual([]);
});

test("shows a clear message for a note that does not exist", async ({ page }) => {
  await page.goto("/note/?id=does-not-exist");
  await expect(page.getByText(/could not be found/i)).toBeVisible({ timeout: 15_000 });
});

test("ink persists across a reload", async ({ page }) => {
  await seedNote(page);

  await page.goto(`/note/?id=${NOTE_ID}`);
  await expect(page.getByRole("application").first()).toBeVisible({ timeout: 15_000 });

  await draw(page, [
    [120, 200],
    [220, 250],
    [320, 200],
  ]);

  // Writes are debounced, so give the flush a beat before reading disk.
  await expect.poll(() => storedStrokeCount(page), { timeout: 10_000 }).toBeGreaterThan(0);
  const saved = await storedStrokeCount(page);

  await page.reload();
  await expect(page.getByRole("application").first()).toBeVisible({ timeout: 15_000 });
  expect(await storedStrokeCount(page)).toBe(saved);
});

test("undo removes the last stroke and redo brings it back", async ({ page }) => {
  await seedNote(page);
  await page.goto(`/note/?id=${NOTE_ID}`);
  await expect(page.getByRole("application").first()).toBeVisible({ timeout: 15_000 });

  await draw(page, [
    [140, 300],
    [260, 340],
  ]);
  await expect.poll(() => storedStrokeCount(page), { timeout: 10_000 }).toBe(1);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => storedStrokeCount(page), { timeout: 10_000 }).toBe(0);

  await page.getByRole("button", { name: "Redo" }).click();
  await expect.poll(() => storedStrokeCount(page), { timeout: 10_000 }).toBe(1);
});

test("the eraser removes a stroke it is swiped through", async ({ page }) => {
  await seedNote(page);
  await page.goto(`/note/?id=${NOTE_ID}`);
  await expect(page.getByRole("application").first()).toBeVisible({ timeout: 15_000 });

  await draw(page, [
    [150, 400],
    [350, 400],
  ]);
  await expect.poll(() => storedStrokeCount(page), { timeout: 10_000 }).toBe(1);

  await page.getByRole("button", { name: "Eraser" }).click();
  await draw(page, [
    [250, 360],
    [250, 440],
  ]);

  await expect.poll(() => storedStrokeCount(page), { timeout: 10_000 }).toBe(0);
});

test("switching tools swaps the option tray", async ({ page }) => {
  await seedNote(page);
  await page.goto(`/note/?id=${NOTE_ID}`);
  await expect(page.getByRole("application").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Highlighter" }).click();
  await expect(page.getByRole("button", { name: "Colour #ffe14d" })).toBeVisible();

  await page.getByRole("button", { name: "Eraser" }).click();
  await expect(page.getByText("Eraser", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Colour #ffe14d" })).toHaveCount(0);
});

test("the sticky note tool actually places a note", async ({ page }) => {
  await seedNote(page);
  await page.goto(`/note/?id=${NOTE_ID}`);
  await expect(page.getByRole("application").first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Sticky note" }).click();

  // Insert tools are actions, not modes: they place, then hand back to lasso.
  const sticky = page.getByRole("textbox", { name: "Sticky note" });
  await expect(sticky).toBeVisible({ timeout: 10_000 });

  await sticky.fill("Remember the Krebs cycle");
  await page.waitForTimeout(1200);
  await page.reload();

  await expect(page.getByRole("textbox", { name: "Sticky note" })).toHaveValue(
    "Remember the Krebs cycle",
    { timeout: 15_000 },
  );
});
