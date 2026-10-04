# Phase 6A — Multiplayer authority proof

## Goal

Prove that one Kornia Tactics battle can survive independently of any browser and be operated safely enough for a friends-only DM + player session.

The first proof uses:

- one DM/host browser;
- one player browser controlling Terratink;
- persistent Supabase battle state;
- participant capability keys rather than traditional accounts;
- explicit unit ownership;
- optimistic version checks;
- automatic shared-state refresh;
- host override/recovery control.

This phase does **not** alter the renderer-independent combat rules.

## Database boundary

Phase 6 remains inside the existing isolated `tactics` schema.

New structures:

- `tactics.battle_participants` — scoped host/player/spectator identities;
- `tactics.battle_unit_controllers` — unit-to-participant ownership;
- `tactics.battles.realtime_key` — opaque future Realtime topic identity.

Direct browser table access remains disabled. Browser clients use narrowly scoped `SECURITY DEFINER` RPC functions and unguessable capability keys.

## Capability model

The Phase 5 battle `write_key` remains the master persistence capability and is never handed to a player client.

`tactics_create_host_session` exchanges that write capability for a host participant capability.

`tactics_create_player_session` may only be called using a valid host participant capability. It creates a player capability and assigns one or more battle units.

`tactics_get_multiplayer_battle` returns only the participant-scoped snapshot plus that participant's ownership information.

`tactics_commit_multiplayer_battle` rejects spectators and rejects a player write unless the **currently persisted active unit** belongs to that player. Hosts may commit any active turn for DM recovery and enemy control.

## Phase 6A synchronization

The first proof intentionally uses version polling instead of adding a Realtime client dependency immediately.

Every participant periodically requests the authoritative battle snapshot. A snapshot is replaced locally only when the server version is newer. Local actions use the participant-scoped commit RPC with the expected version; stale writes fail instead of overwriting newer state.

This transport is isolated behind `src/lib/multiplayer`. Replacing polling with Supabase Realtime Broadcast/Presence later must not require changes to combat resolution or Pixi rendering.

## Reconnect

A multiplayer invitation URL contains only the scoped participant capability:

`/multiplayer?session=<participant-key>`

Opening or refreshing that URL reloads the latest authoritative battle snapshot and restores the participant's role and controlled units.

The DM can create a fresh player invitation if an old invitation is lost. Reassigning Terratink to the new player session invalidates the old session's ability to act without deleting its read access.

## Security scope and accepted advisor warnings

Supabase's database advisor reports that anonymous/authenticated roles may execute the capability RPCs. This is intentional for the current Kornia guest/key identity model: clients are not required to create accounts, and possession of a high-entropy scoped capability is the authorization mechanism.

The underlying `tactics` tables retain RLS with no direct anon/authenticated policies or table grants.

The advisor also reports `rls_enabled_no_policy` on those private tables. That is intentional: the browser is not meant to query them directly.

## Important limitation: Phase 6A is not PvP-grade authority

Phase 6A validates:

- participant identity;
- active-unit ownership;
- battle version;
- persistent snapshots/events.

The browser still performs the normal renderer-independent combat calculation and submits the resulting state. A malicious client could therefore fabricate a state that passes the current ownership check.

That is acceptable for the friends-only multiplayer proof, but **not** for adversarial PvP.

### Phase 6B

The next authority step will submit action intents to a server/database authority rather than final state. The authority will validate and resolve:

- movement intent;
- move/target legality;
- dice;
- attack/save results;
- damage;
- PP/HP changes;
- turn advancement.

Only the resolved authoritative result will be persisted/broadcast.

## Phase 6A success criteria

1. DM creates a shared battle.
2. DM creates a Terratink invitation.
3. Player opens the invitation in another browser/private window.
4. Player can act only when Terratink is the active unit.
5. Player cannot control Pecrow.
6. DM can manually control Pecrow and may recover/override any unit.
7. Movement, Undo Movement, attacks and End Turn persist through scoped multiplayer commits.
8. The other browser automatically observes a newer battle version without manual refresh.
9. Refreshing either participant URL reconnects to the same battle.
10. Concurrent stale writes are rejected and the losing browser reloads authoritative state.
