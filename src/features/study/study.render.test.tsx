/**
 * Render-level coverage for every study screen. These run in jsdom against
 * fake-indexeddb, so they exercise the real repositories, reducers, and
 * component wiring — everything except pixels.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { DEFAULT_SETTINGS, matchRecords, progress as progressRepo, sets, terms as termsRepo } from "@/lib/db";

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), params: "" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.params),
  usePathname: () => "/",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { Blast } from "./blast/Blast";
import { SetEditor } from "./editor/SetEditor";
import { Flashcards } from "./flashcards/Flashcards";
import { Learn } from "./learn/Learn";
import { Match } from "./match/Match";
import { SetDetail } from "./SetDetail";
import { StudyRouter } from "./StudyRouter";
import { TestMode } from "./test/TestMode";

const ROWS = [
  { term: "mitochondria", definition: "powerhouse of the cell" },
  { term: "nucleus", definition: "holds the genetic material" },
  { term: "ribosome", definition: "site of protein synthesis" },
  { term: "chloroplast", definition: "site of photosynthesis" },
  { term: "lysosome", definition: "breaks down waste" },
  { term: "golgi apparatus", definition: "packages proteins" },
  { term: "cell membrane", definition: "controls what enters the cell" },
  { term: "vacuole", definition: "stores water and nutrients" },
];
const termFor = (definition: string) => ROWS.find((r) => r.definition === definition)!.term;

/** The live (not exiting) Learn question: its enabled option buttons and prompt. */
async function liveQuestion() {
  return waitFor(() => {
    const options = screen
      .queryAllByRole("button", { name: /^Option \d:/ })
      .filter((o) => !(o as HTMLButtonElement).disabled);
    // Four options normally; smaller sets have fewer distractors to draw from.
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options.length).toBeLessThanOrEqual(4);
    const prompt = document.querySelector("#learn-prompt")?.textContent?.trim();
    expect(prompt).toBeTruthy();
    return { options, prompt: prompt! };
  });
}

beforeAll(() => {
  // jsdom gaps that framer-motion and the modes touch. Reduced motion keeps
  // fling/pop animations instant so assertions don't race springs.
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  nav.push.mockReset();
  nav.params = "";
});

async function seed() {
  const set = await sets.create({ title: "Cell Biology", description: "Organelles" });
  const created = await termsRepo.addMany(set.id, ROWS);
  return { set, terms: created };
}

describe("SetDetail", () => {
  it("shows the title, mode tiles, and term rows with working stars", async () => {
    const { set } = await seed();
    render(<SetDetail id={set.id} />);

    expect(await screen.findByRole("heading", { level: 1, name: "Cell Biology" })).toBeTruthy();
    const modes = screen.getByRole("navigation", { name: "Study modes" });
    for (const label of ["Flashcards", "Learn", "Test", "Match", "Blast"]) {
      expect(within(modes).getByRole("link", { name: new RegExp(label) })).toBeTruthy();
    }
    expect(screen.getByRole("heading", { name: /Terms in this set \(8\)/ })).toBeTruthy();

    const star = screen.getAllByRole("button", { name: "Star this term" })[0];
    fireEvent.click(star);
    await waitFor(async () => {
      const list = await termsRepo.forSet(set.id);
      expect(list.some((t) => t.starred)).toBe(true);
    });
    // The first term is shown twice: on the preview flashcard and in the list.
    expect(screen.getAllByRole("button", { name: "Unstar this term" })).toHaveLength(2);
  });

  it("explains when a set is missing", async () => {
    render(<SetDetail id="nope" />);
    expect(await screen.findByText("We couldn't find that set")).toBeTruthy();
  });
});

describe("Flashcards", () => {
  it("flips with Space, advances with arrows, and sorts when tracking", async () => {
    const { set, terms } = await seed();
    render(<Flashcards set={set} terms={terms} settings={DEFAULT_SETTINGS} onPatchTerm={() => {}} />);

    const card = () => screen.getByRole("button", { name: /Press Space to flip/ });
    expect(card().getAttribute("aria-pressed")).toBe("false");
    expect(card().getAttribute("aria-label")).toContain("Term: mitochondria");

    fireEvent.keyDown(window, { key: " " });
    expect(card().getAttribute("aria-pressed")).toBe("true");
    expect(card().getAttribute("aria-label")).toContain("Definition: powerhouse of the cell");

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getAllByText("2 / 8").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("switch", { name: "Track progress" }));
    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("status", { name: "Know: 1" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Still learning" }));
    await waitFor(() => expect(screen.getByRole("status", { name: "Still learning: 1" })).toBeTruthy());
  });

  it("ends on a summary with next steps", async () => {
    const { set, terms } = await seed();
    render(<Flashcards set={set} terms={terms.slice(0, 2)} settings={DEFAULT_SETTINGS} onPatchTerm={() => {}} />);
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(await screen.findByText("You've reviewed all 2 cards.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restart Flashcards" }));
    expect(await screen.findByRole("button", { name: /Press Space to flip/ })).toBeTruthy();
  });
});

describe("Learn", () => {
  it("asks multiple choice, reveals a miss, and persists progress", async () => {
    const { set, terms } = await seed();
    render(<Learn set={set} terms={terms} settings={DEFAULT_SETTINGS} />);

    const { options, prompt } = await liveQuestion();
    expect(screen.getByText("Round 1")).toBeTruthy();

    const answer = termFor(prompt);
    const wrong = options.find((o) => !o.getAttribute("aria-label")!.endsWith(`: ${answer}`))!;
    fireEvent.click(wrong);

    expect(await screen.findByText("No worries, you're still learning!")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    await waitFor(async () => {
      const saved = await progressRepo.forSet(set.id);
      expect([...saved.values()].some((p) => p.seen === 1 && p.lapses === 1)).toBe(true);
    });

    fireEvent.keyDown(window, { key: "Enter" });
    const next = await liveQuestion();
    expect(next.prompt).not.toBe(prompt);
    // The miss was re-queued: the round grew from 7 to 8 questions.
    expect(screen.getByText("1 / 8")).toBeTruthy();
  });

  it("reaches the round summary after a full round", async () => {
    const { set, terms } = await seed();
    render(<Learn set={set} terms={terms.slice(0, 3)} settings={DEFAULT_SETTINGS} />);
    for (let i = 0; i < 3; i++) {
      const { options, prompt } = await liveQuestion();
      const right = options.find((o) => o.getAttribute("aria-label")!.endsWith(`: ${termFor(prompt)}`))!;
      fireEvent.click(right);
      // Correct answers auto-advance; Enter also works and is faster here.
      await screen.findByText("Nice work!");
      fireEvent.keyDown(window, { key: "Enter" });
      if (i < 2) await waitFor(() => expect(document.querySelector("#learn-prompt")?.textContent?.trim()).not.toBe(prompt));
    }
    expect(await screen.findByText("Your progress")).toBeTruthy();
    expect(screen.getByText("Perfect round — keep it up!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Round 2")).toBeTruthy();
    // Boxed-up terms graduate to written questions.
    expect(await screen.findByLabelText("Your answer")).toBeTruthy();
  });
});

describe("Test", () => {
  it("configures, renders the exam, warns on unanswered, and grades", async () => {
    const { set, terms } = await seed();
    render(<TestMode set={set} terms={terms} settings={DEFAULT_SETTINGS} />);

    expect(await screen.findByText("Set up your test")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start test" }));

    expect(await screen.findByText("1 of 8")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submit test" }));
    expect(await screen.findByText("Submit unfinished test?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submit anyway" }));

    expect(await screen.findByText("0%")).toBeTruthy();
    expect(screen.getByText("Your answers")).toBeTruthy();
    expect(screen.getAllByText("Not answered").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Take a new test" }));
    expect(await screen.findByText("Set up your test")).toBeTruthy();
  });
});

describe("Match", () => {
  it("plays a full game by tapping pairs and records the time", async () => {
    const { set, terms } = await seed();
    render(<Match set={set} terms={terms} />);

    expect(await screen.findByText("Ready to play?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start game" }));

    const tiles = await screen.findAllByRole("button", { name: /^(Term|Definition): / });
    expect(tiles).toHaveLength(12);

    const label = (el: HTMLElement) => el.getAttribute("aria-label")!;
    const termTiles = tiles.filter((t) => label(t).startsWith("Term: "));
    const defTile = (definition: string) => tiles.find((t) => label(t) === `Definition: ${definition}`)!;

    // One deliberate mismatch first.
    const first = termTiles[0];
    const firstTerm = label(first).slice("Term: ".length);
    const wrongDef = tiles.find((t) => label(t).startsWith("Definition: ") && label(t) !== `Definition: ${ROWS.find((r) => r.term === firstTerm)!.definition}`)!;
    fireEvent.click(first);
    fireEvent.click(wrongDef);
    await waitFor(() => expect(first.getAttribute("aria-pressed")).toBe("false"));

    for (const t of termTiles) {
      const term = label(t).slice("Term: ".length);
      const def = ROWS.find((r) => r.term === term)!.definition;
      fireEvent.click(t);
      fireEvent.click(defTile(def));
    }

    // The first game on a set is always a personal best.
    expect(await screen.findByText("New personal best!", {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByText(/1s of penalties for 1 wrong match/)).toBeTruthy();
    await waitFor(async () => expect(await matchRecords.best(set.id)).toBeTruthy());

    // A slower second game is not a record.
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    const again = await screen.findAllByRole("button", { name: /^(Term|Definition): / });
    expect(again).toHaveLength(12);
  });
});

describe("Blast", () => {
  it("starts, spawns a tile, and scores a typed answer", async () => {
    const { set, terms } = await seed();
    render(<Blast set={set} terms={terms} settings={DEFAULT_SETTINGS} />);

    fireEvent.click(await screen.findByRole("button", { name: "Start game" }));
    const input = await screen.findByLabelText("Type the term");

    const tile = await waitFor(() => {
      const el = document.querySelector("[data-blast-tile]");
      if (!el) throw new Error("no tile yet");
      return el as HTMLElement;
    });
    const answer = termFor(tile.textContent!.trim());
    fireEvent.change(input, { target: { value: answer } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(screen.getByText(/^1\d\d$/)).toBeTruthy());
    expect(screen.getByText("Streak 1")).toBeTruthy();
  });
});

describe("StudyRouter", () => {
  it("mounts the requested mode for a real set", async () => {
    const { set } = await seed();
    nav.params = `set=${set.id}&mode=match`;
    render(<StudyRouter />);
    expect(await screen.findByText("Ready to play?")).toBeTruthy();
  });

  it("handles a missing set and a missing id", async () => {
    nav.params = "set=missing&mode=learn";
    const { unmount } = render(<StudyRouter />);
    expect(await screen.findByText("We couldn't find that set")).toBeTruthy();
    unmount();
    nav.params = "";
    render(<StudyRouter />);
    expect(await screen.findByText("Pick a set to study")).toBeTruthy();
  });
});

describe("SetEditor", () => {
  it("creates a set from typed rows plus an import", async () => {
    render(<SetEditor />);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Bones" } });
    fireEvent.change(screen.getByLabelText("Term 1"), { target: { value: "femur" } });
    fireEvent.change(screen.getByLabelText("Definition 1"), { target: { value: "thigh bone" } });

    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.change(await screen.findByLabelText("Data to import"), {
      target: { value: "tibia\tshin bone\nulna\tforearm bone" },
    });
    expect(await screen.findByText("2 cards")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Import 2 cards/ }));

    await waitFor(() => expect(screen.getByLabelText("Term 3")).toBeTruthy());
    expect((screen.getByLabelText("Term 3") as HTMLInputElement).value).toBe("ulna");

    fireEvent.click(screen.getAllByRole("button", { name: "Create" })[0]);
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith(expect.stringMatching(/^\/set\/\?id=set_/)));

    const all = await sets.all();
    const created = all.find((s) => s.title === "Bones")!;
    const list = await termsRepo.forSet(created.id);
    expect(list.map((t) => t.term)).toEqual(["femur", "tibia", "ulna"]);
  });

  it("edits an existing set with autosave", async () => {
    const { set } = await seed();
    nav.params = `id=${set.id}`;
    render(<SetEditor />);
    const title = (await screen.findByLabelText("Title")) as HTMLInputElement;
    expect(title.value).toBe("Cell Biology");
    fireEvent.change(title, { target: { value: "Cell Biology II" } });
    await waitFor(async () => expect((await sets.get(set.id))?.title).toBe("Cell Biology II"), { timeout: 2000 });

    fireEvent.click(screen.getAllByRole("button", { name: /Delete card 1/ })[0]);
    await waitFor(async () => expect(await termsRepo.forSet(set.id)).toHaveLength(7));
  });

  it("requires a title before creating", async () => {
    render(<SetEditor />);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Create" })[0]);
    });
    expect(nav.push).not.toHaveBeenCalled();
  });
});
