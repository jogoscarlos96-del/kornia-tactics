import type { CombatState, UnitId } from '$lib/core';
import type { PersistedBattleStatus } from '$lib/persistence';

export type MultiplayerRole = 'host' | 'player' | 'spectator';

export type MultiplayerSession = Readonly<{
  battleId: string;
  participantId: string;
  participantKey: string;
  displayName: string;
  role: MultiplayerRole;
  controlledUnitIds: readonly UnitId[];
  realtimeTopic: string;
}>;

export type MultiplayerParticipant = Readonly<{
  id: string;
  displayName: string;
  role: MultiplayerRole;
  controlledUnitIds: readonly UnitId[];
}>;

export type MultiplayerBattle = Readonly<{
  id: string;
  name: string;
  status: PersistedBattleStatus;
  version: number;
  latestEventSequence: number;
  state: CombatState;
  savedAt: string;
  participant: MultiplayerParticipant;
  realtimeTopic: string;
}>;

export type MultiplayerCommit = Readonly<{
  id: string;
  version: number;
  latestEventSequence: number;
  realtimeTopic: string;
}>;

export interface MultiplayerGateway {
  createHostSession(writeKey: string, displayName: string): Promise<MultiplayerSession>;
  createPlayerSession(hostKey: string, displayName: string, unitIds: readonly UnitId[]): Promise<MultiplayerSession>;
  loadBattle(participantKey: string): Promise<MultiplayerBattle | null>;
  commitBattle(participantKey: string, expectedVersion: number, state: CombatState): Promise<MultiplayerCommit>;
}
