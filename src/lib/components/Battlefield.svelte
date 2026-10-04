<script lang="ts">
  import { onMount } from 'svelte';
  import {
    movementPathForUnit,
    reachableCellsForUnit,
    type BattleView,
    type GridPoint,
    type TacticalMovementResult,
    type UnitId
  } from '$lib/core';
  import { PixiBattlefieldRenderer } from '$lib/rendering/PixiBattlefieldRenderer';

  export let battle: BattleView;
  export let activeUnitId: UnitId;
  export let movementUsed = false;
  export let onMoveRequest: ((unitId: UnitId, destination: GridPoint) => TacticalMovementResult) | undefined = undefined;

  let host: HTMLDivElement;
  let renderer: PixiBattlefieldRenderer | undefined;
  let receivedBattle = battle;
  let receivedActiveUnitId = activeUnitId;
  let currentBattle = battle;
  let selectedUnitId: UnitId | undefined = activeUnitId;
  let hoveredCell: GridPoint | undefined;
  let lastMessage = `${activeUnitName()}'s turn. Choose a destination or an action.`;

  $: if (battle !== receivedBattle) {
    receivedBattle = battle;
    currentBattle = battle;
  }
  $: if (activeUnitId !== receivedActiveUnitId) {
    receivedActiveUnitId = activeUnitId;
    selectedUnitId = activeUnitId;
    hoveredCell = undefined;
    lastMessage = `${activeUnitName()}'s turn. Choose a destination or an action.`;
  }
  $: selectedUnit = currentBattle.units.find((unit) => unit.id === selectedUnitId);
  $: selectedCanMove = selectedUnitId === activeUnitId && !movementUsed;
  $: reachableCells = selectedUnitId && selectedCanMove ? reachableCellsForUnit(currentBattle, selectedUnitId) : [];
  $: previewResult = selectedUnitId && selectedCanMove && hoveredCell
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

  function activeUnitName(): string {
    return currentBattle?.units.find((unit) => unit.id === activeUnitId)?.name ?? activeUnitId;
  }

  function selectUnit(unitId: UnitId) {
    if (unitId !== activeUnitId) {
      selectedUnitId = activeUnitId;
      const inspected = currentBattle.units.find((candidate) => candidate.id === unitId);
      lastMessage = `${inspected?.name ?? 'That unit'} cannot act now. It is ${activeUnitName()}'s turn.`;
      return;
    }

    selectedUnitId = unitId;
    const unit = currentBattle.units.find((candidate) => candidate.id === unitId);
    lastMessage = movementUsed
      ? `${unit?.name ?? 'Unit'} has already spent movement this turn.`
      : `${unit?.name ?? 'Unit'} selected · movement ${unit?.movement.speed ?? 0} squares.`;
  }

  function moveSelectedUnit(destination: GridPoint) {
    if (!selectedUnitId) {
      selectedUnitId = activeUnitId;
      lastMessage = `It is ${activeUnitName()}'s turn.`;
      return;
    }
    if (selectedUnitId !== activeUnitId) {
      selectedUnitId = activeUnitId;
      lastMessage = `Only ${activeUnitName()} can move right now.`;
      return;
    }
    if (movementUsed) {
      lastMessage = `${activeUnitName()} has already spent movement this turn. Undo it or end the turn.`;
      return;
    }
    if (!onMoveRequest) {
      lastMessage = 'Movement is not available.';
      return;
    }

    const result = onMoveRequest(selectedUnitId, destination);
    if (!result.ok) {
      lastMessage = movementFailureMessage(result.reason);
      return;
    }

    currentBattle = result.state.battle;
    hoveredCell = undefined;
    const unit = currentBattle.units.find((candidate) => candidate.id === selectedUnitId);
    lastMessage = `${unit?.name ?? 'Unit'} moved ${result.cost} square${result.cost === 1 ? '' : 's'} · movement spent for this turn.`;
  }

  function movementFailureMessage(reason: string | undefined): string {
    if (reason === 'not-active-turn') return `Only ${activeUnitName()} can move right now.`;
    if (reason === 'movement-already-used') return `${activeUnitName()} has already spent movement this turn.`;
    if (reason === 'same-position') return 'Choose a different destination.';
    if (reason === 'occupied') return 'That square is occupied.';
    if (reason === 'over-budget') return 'That destination is outside this unit’s movement range.';
    if (reason === 'unreachable') return 'No valid path reaches that square.';
    return 'That movement cannot be completed.';
  }
</script>

<div class="battlefield-shell">
  <div class="interaction-bar">
    <div>
      <strong>TURN · {activeUnitName()}</strong>
      <span>{lastMessage}</span>
    </div>
    {#if selectedUnit}
      <span class:movement-used={movementUsed} class="movement">
        {movementUsed ? 'Movement spent' : `Move ${selectedUnit.movement.speed} available`}
      </span>
    {/if}
  </div>
  <div class="viewport" bind:this={host}></div>
</div>

<style>
  .battlefield-shell { display: grid; gap: 10px; }
  .interaction-bar {
    min-height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 12px 14px;
    border: 1px solid rgba(244, 233, 138, 0.3);
    border-radius: 14px;
    background: #151d17;
  }
  .interaction-bar div { display: grid; gap: 3px; }
  .interaction-bar strong { font-size: 0.95rem; color: #f1e99d; }
  .interaction-bar span { color: #9eafa2; font-size: 0.82rem; }
  .movement {
    white-space: nowrap;
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid rgba(244, 233, 138, 0.28);
    color: #efe8a5 !important;
  }
  .movement-used {
    border-color: rgba(214, 229, 217, 0.14);
    color: #829187 !important;
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
