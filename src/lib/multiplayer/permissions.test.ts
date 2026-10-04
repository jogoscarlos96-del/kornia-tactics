import { describe, expect, it } from 'vitest';
import { phase4VerticalSliceCombat } from '$lib/core';
import type { MultiplayerParticipant } from './contracts';
import { canActNow, canControlUnit } from './permissions';

const host: MultiplayerParticipant = Object.freeze({
  id: 'host',
  displayName: 'DM',
  role: 'host',
  controlledUnitIds: Object.freeze([])
});

const terratinkPlayer: MultiplayerParticipant = Object.freeze({
  id: 'player',
  displayName: 'Player 1',
  role: 'player',
  controlledUnitIds: Object.freeze(['pokemon-terratink'])
});

const spectator: MultiplayerParticipant = Object.freeze({
  id: 'spectator',
  displayName: 'Watcher',
  role: 'spectator',
  controlledUnitIds: Object.freeze([])
});

describe('multiplayer permissions', () => {
  it('lets the host control any battle unit', () => {
    expect(canControlUnit(host, 'pokemon-terratink')).toBe(true);
    expect(canControlUnit(host, 'pokemon-pecrow-a')).toBe(true);
  });

  it('limits players to explicitly assigned units', () => {
    expect(canControlUnit(terratinkPlayer, 'pokemon-terratink')).toBe(true);
    expect(canControlUnit(terratinkPlayer, 'pokemon-pecrow-a')).toBe(false);
  });

  it('never grants spectator control', () => {
    expect(canControlUnit(spectator, 'pokemon-terratink')).toBe(false);
  });

  it('requires the active unit to belong to the player', () => {
    expect(canActNow(terratinkPlayer, phase4VerticalSliceCombat)).toBe(true);
    const pecrowTurn = Object.freeze({
      ...phase4VerticalSliceCombat,
      turn: Object.freeze({ ...phase4VerticalSliceCombat.turn, activeIndex: 1 })
    });
    expect(canActNow(terratinkPlayer, pecrowTurn)).toBe(false);
    expect(canActNow(host, pecrowTurn)).toBe(true);
  });
});
