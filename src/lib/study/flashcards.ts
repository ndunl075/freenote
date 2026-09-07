import type { Term } from "@/lib/db";
import { createRng, nextSeed, shuffle } from "./random";

/**
 * Flashcards deck state.
 *
 * Plain flipping and navigating, plus Quizlet's "track progress" mode where
 * each card is swiped into a Know / Still learning pile and the deck ends on
 * a summary. Reviewing rebuilds the deck from the learning pile.
 */

export type CardSide = "term" | "definition";
export type Pile = "know" | "learning";

export interface FlashcardsState {
  /** Every term id in set order. */
  all: string[];
  /** Ids of the current deck in set order (a subset while reviewing). */
  base: string[];
  /** The deck as currently dealt — `base`, shuffled or not. */
  deck: string[];
  index: number;
  flipped: boolean;
  front: CardSide;
  sorting: boolean;
  shuffled: boolean;
  know: string[];
  learning: string[];
  finished: boolean;
  reviewing: boolean;
  seed: number;
}

export type FlashcardsAction =
  | { type: "next" }
  | { type: "prev" }
  | { type: "flip" }
  | { type: "goto"; index: number }
  | { type: "set-front"; front: CardSide }
  | { type: "toggle-shuffle" }
  | { type: "toggle-sorting" }
  | { type: "sort"; pile: Pile }
  | { type: "restart" }
  | { type: "review-learning" };

export interface CreateFlashcardsOptions {
  seed?: number;
  front?: CardSide;
  sorting?: boolean;
  shuffled?: boolean;
}

function deal(base: string[], shuffled: boolean, seed: number): { deck: string[]; seed: number } {
  if (!shuffled) return { deck: base.slice(), seed };
  const rng = createRng(seed);
  return { deck: shuffle(base, rng), seed: nextSeed(rng) };
}

export function createFlashcards(
  terms: readonly Term[],
  opts: CreateFlashcardsOptions = {},
): FlashcardsState {
  const all = terms.map((t) => t.id);
  const seed = opts.seed ?? Math.floor(Math.random() * 0x7fffffff);
  const shuffled = opts.shuffled ?? false;
  const dealt = deal(all, shuffled, seed);
  return {
    all,
    base: all.slice(),
    deck: dealt.deck,
    index: 0,
    flipped: false,
    front: opts.front ?? "term",
    sorting: opts.sorting ?? false,
    shuffled,
    know: [],
    learning: [],
    finished: false,
    reviewing: false,
    seed: dealt.seed,
  };
}

const without = (list: string[], id: string) => list.filter((x) => x !== id);

function advance(state: FlashcardsState): FlashcardsState {
  if (state.index >= state.deck.length - 1) return { ...state, flipped: false, finished: true };
  return { ...state, index: state.index + 1, flipped: false };
}

export function flashcardsReducer(state: FlashcardsState, action: FlashcardsAction): FlashcardsState {
  switch (action.type) {
    case "next":
      if (state.finished || !state.deck.length) return state;
      return advance(state);

    case "prev": {
      if (!state.deck.length) return state;
      if (state.finished) {
        // Step back onto the last card.
        const last = state.deck[state.deck.length - 1];
        return {
          ...state,
          finished: false,
          flipped: false,
          index: state.deck.length - 1,
          know: state.sorting ? without(state.know, last) : state.know,
          learning: state.sorting ? without(state.learning, last) : state.learning,
        };
      }
      if (state.index === 0) return state;
      const prevId = state.deck[state.index - 1];
      return {
        ...state,
        index: state.index - 1,
        flipped: false,
        // In sorting mode "back" doubles as undo.
        know: state.sorting ? without(state.know, prevId) : state.know,
        learning: state.sorting ? without(state.learning, prevId) : state.learning,
      };
    }

    case "flip":
      if (state.finished || !state.deck.length) return state;
      return { ...state, flipped: !state.flipped };

    case "goto": {
      if (!state.deck.length) return state;
      const index = Math.max(0, Math.min(state.deck.length - 1, action.index));
      return { ...state, index, flipped: false, finished: false };
    }

    case "set-front":
      if (action.front === state.front) return state;
      return { ...state, front: action.front, flipped: false };

    case "toggle-shuffle": {
      const shuffled = !state.shuffled;
      const dealt = deal(state.base, shuffled, state.seed);
      return {
        ...state,
        shuffled,
        deck: dealt.deck,
        seed: dealt.seed,
        index: 0,
        flipped: false,
        finished: false,
        know: [],
        learning: [],
      };
    }

    case "toggle-sorting": {
      const sorting = !state.sorting;
      return sorting ? { ...state, sorting } : { ...state, sorting, know: [], learning: [] };
    }

    case "sort": {
      if (!state.sorting || state.finished || !state.deck.length) return state;
      const id = state.deck[state.index];
      const know = action.pile === "know" ? [...without(state.know, id), id] : without(state.know, id);
      const learning =
        action.pile === "learning" ? [...without(state.learning, id), id] : without(state.learning, id);
      return advance({ ...state, know, learning });
    }

    case "restart": {
      const dealt = deal(state.all, state.shuffled, state.seed);
      return {
        ...state,
        base: state.all.slice(),
        deck: dealt.deck,
        seed: dealt.seed,
        index: 0,
        flipped: false,
        finished: false,
        reviewing: false,
        know: [],
        learning: [],
      };
    }

    case "review-learning": {
      if (!state.learning.length) return state;
      const base = state.all.filter((id) => state.learning.includes(id));
      const dealt = deal(base, state.shuffled, state.seed);
      return {
        ...state,
        base,
        deck: dealt.deck,
        seed: dealt.seed,
        index: 0,
        flipped: false,
        finished: false,
        reviewing: true,
        sorting: true,
        know: [],
        learning: [],
      };
    }

    default:
      return state;
  }
}

/* --- Selectors ------------------------------------------------------------ */

export function currentCardId(state: FlashcardsState): string | null {
  if (state.finished) return null;
  return state.deck[state.index] ?? null;
}

export function deckPosition(state: FlashcardsState): { position: number; total: number } {
  const total = state.deck.length;
  return { position: state.finished ? total : Math.min(total, state.index + 1), total };
}

export function pileOf(state: FlashcardsState, id: string): Pile | null {
  if (state.know.includes(id)) return "know";
  if (state.learning.includes(id)) return "learning";
  return null;
}
