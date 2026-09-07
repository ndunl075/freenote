import { describe, expect, it } from "vitest";
import {
  acceptedForms,
  gradeAnswer,
  levenshtein,
  normalizeAnswer,
  sameAnswer,
  stripAccents,
  typoAllowance,
} from "./grading";

describe("normalizeAnswer", () => {
  it("lowercases, trims and collapses whitespace in both modes", () => {
    expect(normalizeAnswer("  Mitochondria   Powerhouse ", "strict")).toBe("mitochondria powerhouse");
    expect(normalizeAnswer("  Mitochondria   Powerhouse ", "lenient")).toBe("mitochondria powerhouse");
  });

  it("strips accents and punctuation only when lenient", () => {
    expect(normalizeAnswer("Café, s'il vous plaît!")).toBe("cafe sil vous plait");
    expect(normalizeAnswer("Café, s'il vous plaît!", "strict")).toBe("café, s'il vous plaît!");
  });

  it("drops a leading article but never the whole answer", () => {
    expect(normalizeAnswer("The Great Gatsby")).toBe("great gatsby");
    expect(normalizeAnswer("an apple")).toBe("apple");
    expect(normalizeAnswer("A")).toBe("a");
    expect(normalizeAnswer("the")).toBe("the");
  });

  it("keeps articles in strict mode", () => {
    expect(normalizeAnswer("the cat", "strict")).toBe("the cat");
  });

  it("removes apostrophes without splitting the word", () => {
    expect(normalizeAnswer("don’t")).toBe("dont");
    expect(normalizeAnswer("it's")).toBe("its");
  });
});

describe("stripAccents", () => {
  it("handles common diacritics", () => {
    expect(stripAccents("naïve résumé Ångström")).toBe("naive resume Angstrom");
  });
});

describe("levenshtein", () => {
  it("computes edit distance", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("flaw", "lawn")).toBe(2);
    expect(levenshtein("same", "same")).toBe(0);
  });

  it("counts an adjacent transposition as a single edit", () => {
    expect(levenshtein("teh", "the")).toBe(1);
    expect(levenshtein("recieve", "receive")).toBe(1);
  });
});

describe("typoAllowance", () => {
  it("scales with answer length", () => {
    expect(typoAllowance(1)).toBe(0);
    expect(typoAllowance(3)).toBe(0);
    expect(typoAllowance(4)).toBe(1);
    expect(typoAllowance(7)).toBe(1);
    expect(typoAllowance(8)).toBe(2);
    expect(typoAllowance(14)).toBe(2);
    expect(typoAllowance(30)).toBe(3);
  });
});

describe("acceptedForms", () => {
  it("accepts either side of a slash when both are real words", () => {
    expect(acceptedForms("colour / color")).toEqual(
      expect.arrayContaining(["colour color", "colour", "color"]),
    );
  });

  it("does not split unit-like slashes", () => {
    expect(acceptedForms("km/h")).toEqual(["km h"]);
  });

  it("accepts the answer without its parenthetical", () => {
    expect(acceptedForms("cat (animal)")).toEqual(expect.arrayContaining(["cat animal", "cat"]));
  });

  it("adds nothing extra in strict mode", () => {
    expect(acceptedForms("colour / color", "strict")).toEqual(["colour / color"]);
  });
});

describe("gradeAnswer", () => {
  it("accepts exact matches", () => {
    expect(gradeAnswer("Paris", "Paris")).toEqual({ correct: true, closeButTypo: false });
  });

  it("rejects empty input", () => {
    expect(gradeAnswer("   ", "Paris")).toEqual({ correct: false, closeButTypo: false });
  });

  it("ignores case, accents and punctuation when lenient", () => {
    expect(gradeAnswer("cafe", "Café!").correct).toBe(true);
    expect(gradeAnswer("great gatsby", "The Great Gatsby").correct).toBe(true);
    expect(gradeAnswer("the great gatsby", "Great Gatsby").correct).toBe(true);
  });

  it("forgives a typo on a long answer and flags it", () => {
    expect(gradeAnswer("mitochondira", "mitochondria")).toEqual({ correct: true, closeButTypo: true });
    expect(gradeAnswer("photosynthesys", "photosynthesis")).toEqual({
      correct: true,
      closeButTypo: true,
    });
  });

  it("does not forgive typos on very short answers", () => {
    expect(gradeAnswer("cat", "cot").correct).toBe(false);
    expect(gradeAnswer("dog", "dot").correct).toBe(false);
  });

  it("rejects answers that are too far off", () => {
    expect(gradeAnswer("mitochondria", "chloroplast").correct).toBe(false);
    expect(gradeAnswer("photo", "photosynthesis").correct).toBe(false);
  });

  it("is strict when asked", () => {
    expect(gradeAnswer("cafe", "Café", "strict").correct).toBe(false);
    expect(gradeAnswer("mitochondira", "mitochondria", "strict").correct).toBe(false);
    expect(gradeAnswer("PARIS", "paris", "strict").correct).toBe(true);
    expect(gradeAnswer("the cat", "cat", "strict").correct).toBe(false);
  });

  it("accepts any listed alternative", () => {
    expect(gradeAnswer("color", "colour / color").correct).toBe(true);
    expect(gradeAnswer("colour", "colour / color").correct).toBe(true);
  });

  it("does not count a wrong article-only difference as a typo of a different word", () => {
    expect(gradeAnswer("a car", "the cat").correct).toBe(false);
  });
});

describe("sameAnswer", () => {
  it("compares after normalisation", () => {
    expect(sameAnswer("The Cat", "cat")).toBe(true);
    expect(sameAnswer("cat", "dog")).toBe(false);
  });
});
