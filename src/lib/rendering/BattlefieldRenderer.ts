import type { BattleView } from '$lib/core';

export interface BattlefieldRenderer {
  mount(host: HTMLElement, battle: BattleView): Promise<void>;
  render(battle: BattleView): void;
  destroy(): void;
}
