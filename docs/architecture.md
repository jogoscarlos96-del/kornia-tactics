# Kornia Tactics — Phase 1 architecture contract

## Repository boundary

Kornia Tactics is a separate application. It does not modify or import campaign Trainer/Pokémon-instance rows from the existing Kornia character-management application.

## Shared content boundary

Both apps may resolve the same canonical definitions for:

- official Pokémon species;
- Fakémon species;
- official moves;
- custom moves;
- abilities;
- Mega Evolutions.

Campaign characters, Trainer builds, owned Pokémon instances, encounters, battle state, HP/PP state and maps are Tactics-owned unless a later feature explicitly defines an integration contract.

## Species identity

Identifiers beginning with `F.` resolve as Fakémon. Other species identifiers resolve through the official Pokémon data source.

## Core/rendering rule

`src/lib/core` contains renderer-independent game data and rules. It must not import Svelte, PixiJS, browser APIs or UI components.

`src/lib/rendering` adapts `BattleView` data to a concrete renderer. PixiJS belongs here.

Svelte components compose application UI and own renderer lifecycle, but do not contain game-rule resolution.

## Phase 1 vertical slice

The local prototype contains:

- a 20×20 forest battlefield;
- Tactics-created Nico;
- Tactics-created Terratink;
- two Tactics-created Pecrow;
- PLAYER control for Nico/Terratink;
- DM control for the two Pecrow.

Phase 1 renders these units only. Movement, pathfinding, initiative, action validation, dice, damage, PP and persistence are intentionally deferred.
