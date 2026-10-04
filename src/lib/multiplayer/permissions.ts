import { activeUnitId, type CombatState, type UnitId } from '$lib/core';
import type { MultiplayerParticipant } from './contracts';

export function canControlUnit(participant: MultiplayerParticipant, unitId: UnitId): boolean {
  if (participant.role === 'host') return true;
  if (participant.role === 'spectator') return false;
  return participant.controlledUnitIds.includes(unitId);
}

export function canActNow(participant: MultiplayerParticipant, state: CombatState): boolean {
  return canControlUnit(participant, activeUnitId(state));
}
