# Kornia Tactics

Tactical battle companion for the Kornia Poke5e campaign.

## Phase 1

This repository currently establishes the application shell and the architectural split between renderer-independent battle data and PixiJS rendering.

The prototype renders a 20×20 local battlefield containing Nico, Terratink and two DM-controlled Pecrow. It intentionally does not implement movement or combat yet.

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

Core-only sanity check, which does not require Svelte or PixiJS at runtime:

```bash
pnpm test:phase1
```

See `docs/architecture.md` for the Phase 1 boundaries.
