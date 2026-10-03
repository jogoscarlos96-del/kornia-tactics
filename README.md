# Kornia Tactics

Tactical battle companion for the Kornia Poke5e campaign.

## Phase 2

This repository now includes the application shell plus renderer-independent terrain, movement and deterministic pathfinding rules consumed by the PixiJS battlefield.

The prototype renders a 20×20 local battlefield containing Nico, Terratink and two DM-controlled Pecrow. Units can be selected, their reachable cells highlighted, paths previewed, and valid local movement committed. Combat, turns and persistence remain deferred.

## Stack

- SvelteKit / Svelte 5
- TypeScript
- PixiJS 8
- Vercel adapter

## Local development

```bash
pnpm install
pnpm dev
```

Phase 1 regression test:

```bash
pnpm test:phase1
```

See `docs/architecture.md` for the current architecture boundaries.

## Continuous integration

GitHub Actions installs dependencies and runs Svelte/type checks, unit tests, the Phase 1 regression test and a production build on every push to `main` and on pull requests.
