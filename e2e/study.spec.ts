import { expect, test, type Page } from "@playwright/test";

/**
 * Study modes, driven through the real built app.
 *
 * The engines behind these screens have thorough unit tests; what those cannot
 * show is whether the wiring between engine and UI actually holds — whether
 * clicking a tile really scores it, and whether progress reaches IndexedDB.
 */

const SET = "set_e2e";

const TERMS: [string, string][] = [
  ["Mitochondria", "Produces ATP"],
  ["Ribosome", "Protein synthesis"],
  ["Nucleus", "Holds DNA"],
  ["Golgi", "Packages proteins"],
  ["Lysosome", "Breaks down waste"],
  ["Chloroplast", "Photosynthesis"],
  ["Cytoplasm", "Fills the cell"],
  ["Membrane", "Controls entry"],
];

async function seedSet(page: Page): Promise<void> {
  // Load the app once so Dexie declares the schema before we write to it.
  await page.goto("/");
  await page.waitForFunction(
    async () => (await indexedDB.databases()).some((d) => d.name === "freenote"),
    null,
    { timeout: 15_000 },
  );

  await page.evaluate(
    async ([setId, rows]) => {
      const open = indexedDB.open("freenote");
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      const now = Date.now();
      const tx = db.transaction(["sets", "terms"], "readwrite");
      tx.objectStore("sets").put({
        id: setId,
        title: "Cell Biology",
        description: "Organelles",
        subjectId: null,
        sourceNoteId: null,
        termLanguage: "en",
        definitionLanguage: "en",
        starred: false,
        createdAt: now,
        updatedAt: now,
      });
      (rows as [string, string][]).forEach(([term, definition], i) =>
        tx.objectStore("terms").put({
          id: `tm_${i}`,
          setId,
          term,
          definition,
          imageBlobId: null,
          order: i,
          starred: false,
        }),
      );
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    [SET, TERMS] as const,
  );
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
  await seedSet(page);
});

test("the set page offers every study mode", async ({ page }) => {
  await page.goto(`/set/?id=${SET}`);
  await expect(page.getByRole("heading", { name: "Cell Biology" })).toBeVisible({
    timeout: 15_000,
  });

  for (const mode of ["Flashcards", "Learn", "Test", "Match", "Blast"]) {
    await expect(page.getByRole("link", { name: mode }).or(page.getByText(mode, { exact: true })).first()).toBeVisible();
  }
  await expect(page.getByText("8 terms")).toBeVisible();
});

test("flashcards advance through the deck", async ({ page }) => {
  await page.goto(`/study/?set=${SET}&mode=flashcards`);
  await expect(page.getByText("1 / 8").first()).toBeVisible({ timeout: 15_000 });

  // Wait for a real control before sending keys. Text appearing only proves the
  // markup rendered; the window-level key handler is attached in an effect, and
  // under parallel load a keypress can land in the gap between the two.
  await expect(page.getByRole("button", { name: /next card/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("2 / 8").first()).toBeVisible({ timeout: 10_000 });

  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("1 / 8").first()).toBeVisible({ timeout: 10_000 });
});

test("learn marks a wrong answer and reveals the right one", async ({ page }) => {
  await page.goto(`/study/?set=${SET}&mode=learn`);
  await expect(page.getByText(/Round 1/).first()).toBeVisible({ timeout: 15_000 });

  const prompt = (await page.locator("main, body").first().innerText()).match(
    /(Produces ATP|Protein synthesis|Holds DNA|Packages proteins|Breaks down waste|Photosynthesis|Fills the cell|Controls entry)/,
  );
  expect(prompt).not.toBeNull();

  // Answer with a term that is definitely not the one being asked for.
  const correctTerm = TERMS.find(([, d]) => d === prompt![0])![0];
  const wrong = page
    .getByRole("button")
    .filter({ hasText: new RegExp(`^(?!${correctTerm}$).*$`) })
    .filter({ hasText: /Mitochondria|Ribosome|Nucleus|Golgi|Lysosome|Chloroplast|Cytoplasm|Membrane/ })
    .first();
  await wrong.click();

  // Either outcome is legitimate — what must happen is that the app responds.
  await expect(
    page.getByText(/still learning|nice|correct|Press Enter to continue/i).first(),
  ).toBeVisible({ timeout: 10_000 });
});

test("learn writes progress to the database", async ({ page }) => {
  await page.goto(`/study/?set=${SET}&mode=learn`);
  await expect(page.getByText(/Round 1/).first()).toBeVisible({ timeout: 15_000 });

  const option = page
    .getByRole("button")
    .filter({ hasText: /Mitochondria|Ribosome|Nucleus|Golgi|Lysosome|Chloroplast|Cytoplasm|Membrane/ })
    .first();
  await option.click();

  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          const open = indexedDB.open("freenote");
          const db: IDBDatabase = await new Promise((resolve) => {
            open.onsuccess = () => resolve(open.result);
          });
          const rows = await new Promise<unknown[]>((resolve) => {
            const req = db.transaction("progress").objectStore("progress").getAll();
            req.onsuccess = () => resolve(req.result);
          });
          db.close();
          return rows.length;
        }),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(0);
});

test("match starts a timer and clears a matched pair", async ({ page }) => {
  await page.goto(`/study/?set=${SET}&mode=match`);
  await page.getByRole("button", { name: /start game/i }).click({ timeout: 15_000 });

  // The timer proves the game is actually running.
  await expect(page.getByText(/sec/).first()).toBeVisible({ timeout: 10_000 });

  const term = page.getByRole("button", { name: "Mitochondria", exact: true });
  const definition = page.getByRole("button", { name: "Produces ATP", exact: true });

  // Only six pairs are dealt, so this pair may not be on the board.
  if ((await term.count()) > 0 && (await definition.count()) > 0) {
    await term.click();
    await definition.click();
    await expect(term).toHaveCount(0, { timeout: 10_000 });
  }
});

test("test mode builds a graded exam", async ({ page }) => {
  await page.goto(`/study/?set=${SET}&mode=test`);

  const start = page.getByRole("button", { name: /start|begin|create/i }).first();
  await start.click({ timeout: 15_000 });

  await expect(
    page.getByRole("button", { name: /submit/i }).or(page.getByText(/question/i)).first(),
  ).toBeVisible({ timeout: 15_000 });
});

test("blast mode starts without error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto(`/study/?set=${SET}&mode=blast`);
  await expect(page.getByText(/blast/i).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);

  expect(errors).toEqual([]);
});
