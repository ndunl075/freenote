import { customAlphabet } from "nanoid";

// URL-safe, no lookalike characters — ids show up in shareable export files.
const alphabet = "0123456789abcdefghijkmnpqrstuvwxyz";
const generate = customAlphabet(alphabet, 16);

export const newId = (prefix?: string): string =>
  prefix ? `${prefix}_${generate()}` : generate();
