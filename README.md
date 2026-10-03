# Kornia Tactics

Tactical battle companion for the Kornia Poke5e campaign.

## Phase 5

Kornia Tactics now includes the local movement/combat vertical slice plus persistent Supabase battle saves.

The prototype runs on a 20×20 battlefield containing Nico, Terratink and two DM-controlled Pecrow. Units can move with deterministic pathfinding, resolve turn-gated Poke5e attacks, spend PP, lose HP, append ordered combat events, save the full battle state, reload it after refresh, and reject stale concurrent saves through optimistic versioning.

Persistence lives in the shared Kornia Supabase project but uses an isolated `tactics` schema. Browser clients reach it only through capability-checked RPCs. Generated battle units do not modify campaign Pokémon; canonical HP/PP write-back is available only after an owned Pokémon is explicitly bound with both the battle write capability and its Trainer write key.

## Stack

- SvelteKit / Svelte 5
- TypeScript
- PixiJS 8
- Supabase/PostgreSQL persistence
- Vercel adapter

## Local development

Copy `.env.example` to `.env` and provide the same public Supabase project URL/key used by the existing Kornia application.

```bash
pnpm install
pnpm dev
```

Useful verification commands:

```bash
pnpm check
pnpm test
pnpm test:phase4
pnpm test:phase5
pnpm build
```

See `docs/architecture.md` for the architecture boundaries and the Phase 5 persistence contract. The exact applied database migrations are checked into `supabase/migrations/`.

## Continuous integration

GitHub Actions installs dependencies and runs Svelte/type checks, unit tests, the Phase 1 regression test and a production build on pushes to `main` and on pull requests.
