import { describe, expect, it } from 'vitest';
import { findPath } from './pathfinding';
import type { BattleMap, MovementProfile } from './model';

const map: BattleMap = {
  id: 'test',
  name: 'Test',
  width: 6,
  height: 6,
  terrain: [
    { position: { x: 2, y: 1 }, kind: 'tree' },
    { position: { x: 2, y: 2 }, kind: 'water' },
    { position: { x: 1, y: 2 }, kind: 'difficult' }
  ]
};

const walker: MovementProfile = { speed: 6, capabilities: ['walk'] };
const flyer: MovementProfile = { speed: 6, capabilities: ['walk', 'fly'] };

describe('deterministic weighted pathfinding', () => {
  it('avoids blocked terrain and water for walking units', () => {
    const path = findPath({ map, start: { x: 1, y: 1 }, goal: { x: 3, y: 2 }, movement: walker });
    expect(path.reachable).toBe(true);
    expect(path.points).not.toContainEqual({ x: 2, y: 1 });
    expect(path.points).not.toContainEqual({ x: 2, y: 2 });
  });

  it('charges extra cost for difficult terrain', () => {
    const path = findPath({ map, start: { x: 0, y: 2 }, goal: { x: 1, y: 2 }, movement: walker });
    expect(path).toMatchObject({ reachable: true, cost: 2 });
  });

  it('lets flying units cross water and ignore difficult terrain cost', () => {
    const water = findPath({ map, start: { x: 1, y: 2 }, goal: { x: 2, y: 2 }, movement: flyer });
    expect(water).toMatchObject({ reachable: true, cost: 1 });
  });

  it('returns the same path for the same inputs', () => {
    const first = findPath({ map, start: { x: 0, y: 0 }, goal: { x: 5, y: 5 }, movement: walker });
    const second = findPath({ map, start: { x: 0, y: 0 }, goal: { x: 5, y: 5 }, movement: walker });
    expect(second).toEqual(first);
  });
});
