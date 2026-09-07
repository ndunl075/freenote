import { expect, test, type Page } from "@playwright/test";

/**
 * Library flows. The through-line here is that everything a user creates has to
 * still be there after a reload — with no server, the browser is the only copy.
 */

async function clearData(page: Page): Promise<void> {
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
  await page.goto("/");
}

test.beforeEach(async ({ page }) => {
  await clearData(page);
});

test("starts empty and offers a way in", async ({ page }) => {
  await expect(page.getByRole("button", { name: "New", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  // An empty library should explain itself, not just show a blank grid.
  await expect(page.getByText(/note|set/i).first()).toBeVisible();
});

test("creating a note opens the editor and the note survives a reload", async ({ page }) => {
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: /new note/i }).click();

  await expect(page).toHaveURL(/\/note\/?\?id=/, { timeout: 15_000 });
  await expect(page.getByRole("application").first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/");
  await expect(page.getByText("Untitled note").first()).toBeVisible({ timeout: 15_000 });
});

test("a renamed note keeps its title in the library", async ({ page }) => {
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: /new note/i }).click();
  await expect(page.getByRole("application").first()).toBeVisible({ timeout: 15_000 });

  const title = page.getByRole("textbox", { name: "Note title" });
  await title.click();
  await title.fill("Organic chemistry");
  await title.press("Enter");

  await page.goto("/");
  await expect(page.getByText("Organic chemistry").first()).toBeVisible({ timeout: 15_000 });
});

test("creating a study set navigates to it", async ({ page }) => {
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: /new study set/i }).click();
  await expect(page).toHaveURL(/\/(set|create-set)\/?\?id=/, { timeout: 15_000 });
});

test("search narrows the grid to matching titles", async ({ page }) => {
  // Seed two notes so there is something to filter between.
  await page.evaluate(async () => {
    const open = indexedDB.open("freenote");
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const now = Date.now();
    const tx = db.transaction(["notes", "pages"], "readwrite");
    for (const [i, name] of ["Photosynthesis", "Trigonometry"].entries()) {
      tx.objectStore("pages").put({
        id: `pg${i}`,
        noteId: `nt${i}`,
        index: 0,
        height: 1056,
        strokes: [],
        objects: [],
      });
      tx.objectStore("notes").put({
        id: `nt${i}`,
        subjectId: null,
        title: name,
        pageIds: [`pg${i}`],
        paper: "lined-wide",
        paperColor: "white",
        starred: false,
        createdAt: now,
        updatedAt: now - i * 1000,
      });
    }
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  });
  await page.reload();

  await expect(page.getByText("Photosynthesis").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Trigonometry").first()).toBeVisible();

  await page.getByRole("searchbox", { name: /search notes and sets/i }).fill("photo");

  await expect(page.getByText("Photosynthesis").first()).toBeVisible();
  await expect(page.getByText("Trigonometry")).toHaveCount(0);
});

test("settings reachable, and the theme choice survives a reload", async ({ page }) => {
  await page.getByRole("link", { name: /settings/i }).click();
  await expect(page).toHaveURL(/\/settings/, { timeout: 15_000 });

  await page.getByRole("radio", { name: /dark/i }).click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
    .toBe(true);

  await page.reload();
  await expect
    .poll(
      () => page.evaluate(() => document.documentElement.classList.contains("dark")),
      { timeout: 10_000 },
    )
    .toBe(true);
});

test("subjects can be created and persist", async ({ page }) => {
  await page.getByRole("button", { name: /new subject/i }).click();

  const field = page.getByRole("textbox").first();
  await field.fill("Physics");
  await field.press("Enter");

  await expect(page.getByText("Physics").first()).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByText("Physics").first()).toBeVisible({ timeout: 15_000 });
});
