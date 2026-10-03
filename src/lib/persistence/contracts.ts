import type { CombatState } from '$lib/core';

export type BattlePersistenceHandle = Readonly<{
  id: string;
  readKey: string;
  writeKey: string;
  version: number;
  latestEventSequence: number;
}>;

export type PersistedBattleStatus = 'active' | 'completed' | 'archived';

export type PersistedBattle = Readonly<{
  id: string;
  name: string;
  status: PersistedBattleStatus;
  version: number;
  latestEventSequence: number;
  state: CombatState;
  savedAt: string;
}>;

export type OwnedPokemonBinding = Readonly<{
  battleId: string;
  unitId: string;
  sourcePokemonId: number;
  moveBindings: Readonly<Record<string, number>>;
}>;

export interface BattlePersistenceGateway {
  createBattle(name: string, state: CombatState): Promise<BattlePersistenceHandle>;
  loadBattle(readKey: string): Promise<PersistedBattle | null>;
  commitBattle(handle: BattlePersistenceHandle, state: CombatState): Promise<BattlePersistenceHandle>;
  bindOwnedPokemon(
    handle: BattlePersistenceHandle,
    unitId: string,
    pokemonId: number,
    trainerWriteKey: string
  ): Promise<OwnedPokemonBinding>;
}

export class BattlePersistenceError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'BattlePersistenceError';
  }
}

export class BattleVersionConflictError extends BattlePersistenceError {
  constructor(message = 'The saved battle changed elsewhere. Reload it before saving again.') {
    super(message, '40001');
    this.name = 'BattleVersionConflictError';
  }
}
