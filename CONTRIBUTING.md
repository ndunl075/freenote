# Contributing to freenote

Thanks for wanting to help.

## The one rule

**freenote never sends user data anywhere.** No analytics, no error reporting, no sync, no
fonts from a CDN, no "anonymous" telemetry. A pull request that introduces an outbound
network call at runtime will be declined regardless of how useful the feature is — the whole
point of the project is that this guarantee is structural, not a policy someone could quietly
change later.

There's an end-to-end test asserting the app makes no off-device requests. Please keep it
passing.

## Getting set up

```bash
pnpm install
pnpm dev
```

Before opening a pull request:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

If you touched drawing, persistence, or a study mode, run `pnpm e2e` too.

## What we're looking for

- **Bug fixes**, especially anything involving lost or corrupted notes. That's the worst
  category of bug this app can have.
- **Study modes and editor tools** that match how the apps we're modelling actually behave.
- **Accessibility**: keyboard paths, ARIA, focus handling, reduced motion.
- **Performance** on long notes and large study sets.

## Things worth knowing

- `src/lib/` is pure logic with no React, and is where tests are cheapest to write. If you're
  adding behaviour, try to put the thinking part there and keep the component thin.
- `src/features/*` may import from `src/lib/*` and `src/components/*`, but never from each
  other.
- Strokes are the highest-volume record in the database. Think about allocation and storage
  cost before adding a field to one.
- A schema migration may add or reshape data, but must never drop a field that held user
  content.

## Style

Match the surrounding code. Comments should explain *why* something is done a particular way,
especially when the obvious approach would be wrong — those are the comments that stay useful.
