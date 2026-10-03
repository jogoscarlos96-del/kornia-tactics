<script lang="ts">
  import { onMount } from 'svelte';
  import {
    moveUnit,
    movementPathForUnit,
    reachableCellsForUnit,
    type BattleView,
    type GridPoint,
    type UnitId
  } from '$lib/core';
  import { PixiBattlefieldRenderer } from '$lib/rendering/PixiBattlefieldRenderer';

  export let battle: BattleView;

  let host: HTMLDivElement;
  let renderer: PixiBattlefieldRenderer | undefined;
  let currentBattle = battle;
  let selectedUnitId: UnitId | undefined;
  let hoveredCell: GridPoint | undefined;
  let lastMessage = 'Select a unit to inspect its movement range.';

  $: selectedUnit = currentBattle.units.find((unit) => unit.id === selectedUnitId);
  $: reachableCells = selectedUnitId ? reachableCellsForUnit(currentBattle, selectedUnitId) : [];
  $: previewResult = selectedUnitId && hoveredCell
    ? movementPathForUnit(currentBattle, selectedUnitId, hoveredCell)
    : undefined;
  $: previewPath = previewResult?.reachable && selectedUnit && previewResult.cost <= selectedUnit.movement.speed
    ? previewResult.points
    : [];
  $: if (renderer) {
    renderer.render(currentBattle, { selectedUnitId, reachableCells, previewPath });
  }

  onMount(() => {
    renderer = new PixiBattlefieldRenderer();
    void renderer.mount(host, currentBattle, {
      onUnitClick: selectUnit,
      onCellClick: moveSelectedUnit,
      onCellHover: (cell) => {
        hoveredCell = cell;
      }
    });

    return () => renderer?.destroy();
  });

  function selectUnit(unitId: UnitId) {
    selectedUnitId = unitId;
    const unit = currentBattle.units.find((candidate) => candidate.id === unitId);
    lastMessage = unit
      ? `${unit.name} selected · movement ${unit.movement.speed} squares.`
      : 'Select a unit to inspect its movement range.';
  }

  function moveSelectedUnit(destination: GridPoint) {
    if (!selectedUnitId) {
      lastMessage = 'Select a unit before choosing a destination.';
      return;
    }

    const result = moveUnit(currentBattle, selectedUnitId, destination);
    if (!result.ok) {
      lastMessage = movementFailureMessage(result.reason);
      return;
    }

    currentBattle = result.battle;
    hoveredCell = undefined;
    const unit = currentBattle.units.find((candidate) => candidate.id === selectedUnitId);
    lastMessage = `${unit?.name ?? 'Unit'} moved ${result.path.cost} square${result.path.cost === 1 ? '' : 's'}.`;
  }

  function movementFailureMessage(reason: string | undefined): string {
    if (reason === 'occupied') return 'That square is occupied.';
    if (reason === 'over-budget') return 'That destination is outside this unit’s movement range.';
    if (reason === 'unreachable') return 'No valid path reaches that square.';
    return 'That movement cannot be completed.';
  }
</script>

<div class="battlefield-shell">
  <div class="interaction-bar">
    <div>
      <strong>{selectedUnit?.name ?? 'No unit selected'}</strong>
      <span>{lastMessage}</span>
    </div>
    {#if selectedUnit}
      <span class="movement">Move {selectedUnit.movement.speed}</span>
    {/if}
  </div>
  <div class="viewport" bind:this={host}></div>
</div>

<style>
  .battlefield-shell { display: grid; gap: 10px; }
  .interaction-bar {
    min-height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 12px 14px;
    border: 1px solid rgba(214, 229, 217, 0.14);
    border-radius: 14px;
    background: #151d17;
  }
  .interaction-bar div { display: grid; gap: 3px; }
  .interaction-bar strong { font-size: 0.95rem; }
  .interaction-bar span { color: #9eafa2; font-size: 0.82rem; }
  .movement {
    white-space: nowrap;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(244, 233, 138, 0.28);
    color: #efe8a5 !important;
  }
  .viewport {
    width: 100%;
    overflow: auto;
    border: 1px solid rgba(214, 229, 217, 0.18);
    border-radius: 18px;
    background: #101913;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.28);
  }

  .viewport :global(.battlefield-canvas) {
    display: block;
    max-width: none;
  }
</style>
