import type { BattleView, GridPoint, ReachableCell, UnitId } from '$lib/core';

export type BattlefieldOverlay = Readonly<{
  selectedUnitId?: UnitId;
  reachableCells?: readonly ReachableCell[];
  previewPath?: readonly GridPoint[];
}>;

export type BattlefieldInteractionHandlers = Readonly<{
  onUnitClick?: (unitId: UnitId) => void;
  onCellClick?: (cell: GridPoint) => void;
  onCellHover?: (cell: GridPoint | undefined) => void;
}>;

export interface BattlefieldRenderer {
  mount(
    host: HTMLElement,
    battle: BattleView,
    handlers?: BattlefieldInteractionHandlers
  ): Promise<void>;
  render(battle: BattleView, overlay?: BattlefieldOverlay): void;
  destroy(): void;
}
