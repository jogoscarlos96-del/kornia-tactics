# Kornia Tactics — architecture contract

## Repository boundary

Kornia Tactics is a separate application. It does not modify or import campaign Trainer/Pokémon-instance rows from the existing Kornia character-management application.

## Shared content boundary

Both apps resolve the same canonical definitions for:

- official Pokémon species;
- Fakémon species;
- official moves;
- custom moves;
- abilities;
- Mega Evolutions.

Campaign characters, Trainer builds, owned Pokémon instances, encounters, battle state, HP/PP state and maps are Tactics-owned unless a later feature explicitly defines an integration contract.

## Species and move identity

Identifiers beginning with `F.` resolve as Fakémon; the suffix is the canonical Fakémon read key. Other species identifiers resolve through official Pokémon data.

Custom moves use `custom:<uuid>`. Other move identifiers resolve through official move data.

The current vertical slice uses the live Kornia identifiers `F.JDGKP5JUV2ZED` for Terratink and `F.HHZWUF7HMTEQS` for Pecrow. These identifiers are regression-tested because read keys are canonical references and must not silently drift.

## Phase 3 shared-content adapter

`src/lib/content` owns the read-only canonical-content boundary. It is separate from battle rules and rendering.

- `KorniaContentAdapter` routes species, moves, abilities and Mega definitions to the correct source and memoizes canonical reads.
- Official Pokémon, moves and abilities are read from the canonical `poke5e` data files on the `main` branch.
- Fakémon resolve through the existing `get_fakemon` Supabase RPC.
- Custom moves resolve through `get_custom_move` and normalize to `custom:<uuid>`.
- Mega definitions resolve through `list_mega_evolutions`.
- Supabase private tables are not accessed directly by Tactics.
- Phase 3 performs no Supabase writes and creates no schema or migration.
- Live configuration uses `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_KEY`, matching the existing Kornia application convention.

The adapter exposes normalized DTOs while preserving the original source payload in `raw`, allowing combat adapters to add Poke5e-specific fields without coupling the core engine to storage shapes.

## Core/rendering rule

`src/lib/core` contains renderer-independent game data and rules. It must not import Svelte, PixiJS, browser APIs or UI components.

`src/lib/rendering` adapts battle data and presentation overlays to a concrete renderer. PixiJS belongs here.

Svelte components compose application UI and own renderer lifecycle. They may call core rules but do not resolve movement or combat themselves.

## Phase 2 movement contract

The local prototype contains a 20×20 square grid with integer coordinates and a top-left origin.

Movement is deterministic and terrain-aware:

- ground costs 1 movement point;
- difficult terrain costs 2 to walking units and 1 to flying units;
- water is blocked unless a movement profile includes swimming or flying;
- tree and rock cells are blocked in the Phase 2 two-dimensional prototype;
- occupied cells are blocked for pathfinding and cannot be movement destinations;
- eight-direction movement is allowed;
- diagonal movement costs the destination terrain cost and may not cut through blocked corners;
- pathfinding uses deterministic weighted A* with stable tie-breaking;
- reachable-cell calculation uses the same terrain and occupancy rules;
- movement creates a new immutable battle view rather than mutating the source state.

This conservative occupancy rule can later be expanded for ally pass-through, size categories and opportunity-attack rules without changing the renderer contract.

## Phase 4 combat contract

Phase 4 adds a renderer-independent local combat state on top of the battlefield view.

- Combat actions are submitted as intents containing actor, target, move and optional Move Power choice.
- The resolver validates active turn, remaining action, faint state, enemy targeting, known move, PP, Move Power and range before rolling.
- Attack bonus is `Move Power modifier + proficiency bonus`.
- Save DC is `8 + Move Power modifier + proficiency bonus` and saving-throw proficiency is supported.
- Proficiency follows the Poke5e/D&D progression `2 + floor((level - 1) / 4)`.
- Damage uses the move's level-banded damage dice. `MOVE` means the selected Move Power modifier.
- STAB adds the attacking Pokémon's proficiency bonus once when move type matches one of the user's types.
- Natural 1 attack rolls miss; natural 20 attack rolls hit and double damage dice only.
- Range uses five-foot grid squares. `melee` is one square; numeric foot ranges are converted to grid distance.
- Type effectiveness mirrors the current Kornia `poke5e` tier behavior: immunity deals 0; resistance subtracts defender proficiency; double resistance subtracts twice defender proficiency; weakness multiplies by 1.5; double weakness multiplies by 2; final non-immune damage has a minimum of 1.
- Dual-type matchups use the standard type multiplier only to choose the current Kornia effectiveness tier.
- A valid move spends one PP and the active unit's action even on a miss. Invalid actions spend nothing.
- HP cannot fall below 0.
- Combat resolution returns a new immutable state and appends an ordered local combat event rather than mutating the input.
- End Turn advances to the next non-fainted combatant and resets action availability.

The Phase 4 battle-start snapshot uses Tactics-owned instances: level-2 Terratink with Pound and Fairy Wind, and two level-1 Pecrow with Peck. Canonical species/move definitions were verified against Kornia, but no Trainer or owned-Pokémon record is imported or synchronized.

Advanced secondary move effects, reactions, ability automation, status effects, concentration, switching, persistent battle storage and canonical HP/PP write-back remain outside Phase 4.

## Vertical slice

The local prototype contains a 20×20 forest battlefield, Tactics-created Nico and Terratink, two Tactics-created Pecrow, PLAYER/DM control, sample terrain, unit selection, reachable-cell highlighting, shortest-path preview, local movement commit and turn-gated local combat.

Terratink and Pecrow can move into range, target an opposing combatant, use the selected Phase 4 moves, consume PP, roll attacks automatically, apply STAB/type damage, lose HP, faint at 0 HP, produce battle-log events and advance turns. Persistence remains Phase 5 work.
