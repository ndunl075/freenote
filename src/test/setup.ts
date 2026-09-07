import "fake-indexeddb/auto";
import { afterEach, beforeEach } from "vitest";
import { FreenoteDB, __setDb } from "@/lib/db/database";

// Each test gets a pristine database. Naming them uniquely sidesteps
// fake-indexeddb's connection-close races between suites.
let counter = 0;

beforeEach(() => {
  __setDb(new FreenoteDB(`freenote-test-${counter++}`));
});

afterEach(() => {
  __setDb(null);
});
