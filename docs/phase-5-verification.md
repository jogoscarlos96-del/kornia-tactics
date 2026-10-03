# Phase 5 Verification

Phase 5 adds persistent battle saves while preserving the architecture rule that generated battle units never mutate canonical campaign Pokemon unless an owned Pokemon is explicitly bound.

## Database verification

The applied Supabase migrations are checked into `supabase/migrations/`.

Verified against the shared Kornia Supabase project:

- battle creation returns separate read/write capability keys;
- save commits use optimistic version checks;
- stale versions are rejected;
- persisted battle events are append-only and immutable;
- every committed version receives a snapshot;
- save/reload preserves positions, turn state, HP, PP and ordered events;
- the internal canonical-resource helper is not executable by `anon` or `authenticated` roles;
- generated units never update canonical Pokemon resources.

A rollback-only integration test exercised canonical HP and PP write-back through the Tactics commit path and verified the canonical rows changed atomically inside the transaction before rollback restored the original values.

## Repository verification

Run:

```bash
pnpm check
pnpm test
pnpm test:phase5
pnpm build
```

The pull-request workflow runs the repository-wide check, unit-test and production-build gates.
