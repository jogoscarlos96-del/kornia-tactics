import { describe, expect, it } from 'vitest';
import {
  BATTLE_HANDLE_STORAGE_KEY,
  clearBattleHandle,
  loadBattleHandle,
  saveBattleHandle,
  type KeyValueStorage
} from './storage';

function memoryStorage(initial?: string): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial != null) data.set(BATTLE_HANDLE_STORAGE_KEY, initial);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); }
  };
}

describe('battle persistence handle storage', () => {
  it('round-trips read/write capabilities and optimistic version state', () => {
    const storage = memoryStorage();
    const handle = Object.freeze({
      id: 'battle-1',
      readKey: 'read-key',
      writeKey: 'write-key',
      version: 2,
      latestEventSequence: 4
    });

    saveBattleHandle(storage, handle);
    expect(loadBattleHandle(storage)).toEqual(handle);
  });

  it('ignores malformed local data instead of inventing a write capability', () => {
    const storage = memoryStorage('{"id":"battle-1","readKey":"read-only"}');
    expect(loadBattleHandle(storage)).toBeNull();
  });

  it('clears a stored handle without touching battle data', () => {
    const storage = memoryStorage('{}');
    clearBattleHandle(storage);
    expect(storage.getItem(BATTLE_HANDLE_STORAGE_KEY)).toBeNull();
  });
});
