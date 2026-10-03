import type { BattlePersistenceHandle } from './contracts';

export const BATTLE_HANDLE_STORAGE_KEY = 'kornia-tactics:battle-handle:v1';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isHandle(value: unknown): value is BattlePersistenceHandle {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string'
    && typeof row.readKey === 'string'
    && typeof row.writeKey === 'string'
    && typeof row.version === 'number'
    && Number.isFinite(row.version)
    && typeof row.latestEventSequence === 'number'
    && Number.isFinite(row.latestEventSequence);
}

export function saveBattleHandle(storage: KeyValueStorage, handle: BattlePersistenceHandle): void {
  storage.setItem(BATTLE_HANDLE_STORAGE_KEY, JSON.stringify(handle));
}

export function loadBattleHandle(storage: KeyValueStorage): BattlePersistenceHandle | null {
  const raw = storage.getItem(BATTLE_HANDLE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isHandle(parsed)) return null;
    return Object.freeze({ ...parsed });
  } catch {
    return null;
  }
}

export function clearBattleHandle(storage: KeyValueStorage): void {
  storage.removeItem(BATTLE_HANDLE_STORAGE_KEY);
}
