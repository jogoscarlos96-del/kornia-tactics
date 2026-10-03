# Kornia Tactics — architecture contract

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

## Phase 2 vertical slice

The local prototype contains:

- a 20×20 forest battlefield;
- Tactics-created Nico;
- Tactics-created Terratink;
- two Tactics-created Pecrow;
- PLAYER control for Nico/Terratink;
- DM control for the two Pecrow;
- ground, difficult, tree, rock and water terrain examples;
- unit selection;
- reachable-cell highlighting;
- shortest-path preview;
- local movement commit.

Initiative, action economy, combat validation, dice, damage, PP and persistence remain deferred to later phases.
