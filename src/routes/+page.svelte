<script lang="ts">
  import { onMount } from 'svelte';
  import Battlefield from '$lib/components/Battlefield.svelte';
  import {
    activeUnitId,
    combatUnit,
    endTacticalTurn,
    moveActiveUnit,
    normalizeTacticalCombatState,
    phase4VerticalSliceCombat,
    resolveMoveAction,
    startBattleWithInitiative,
    undoActiveMovement,
    type GridPoint,
    type InitiativeEntry,
    type MoveActionFailureReason,
    type TacticalCombatState,
    type TacticalMovementResult,
    type UnitId
  } from '$lib/core';
  import {
    BattleVersionConflictError,
    clearBattleHandle,
    createLiveBattlePersistenceGateway,
    loadBattleHandle,
    readLivePersistenceConfiguration,
    saveBattleHandle,
    type BattlePersistenceGateway,
    type BattlePersistenceHandle
  } from '$lib/persistence';

  let combat: TacticalCombatState = normalizeTacticalCombatState(phase4VerticalSliceCombat);
  let targetId: UnitId | undefined = 'pokemon-pecrow-a';
  let combatMessage = 'Initiative will be rolled when the battle starts.';
  let persistence: BattlePersistenceGateway | undefined;
  let persistenceHandle: BattlePersistenceHandle | undefined;
  let persistenceBusy = false;
  let persistenceMessage = 'Persistence is initializing.';
  let savedAt: string | undefined;

  $: activeId = activeUnitId(combat);
  $: active = combatUnit(combat, activeId);
  $: activeView = combat.battle.units.find((unit) => unit.id === activeId);
  $: enemyTargets = combat.units.filter((candidate) => {
    const view = combat.battle.units.find((unit) => unit.id === candidate.unitId);
    return Boolean(view && activeView && view.teamId !== activeView.teamId && candidate.currentHp > 0);
  });
  $: if (enemyTargets.length > 0 && !enemyTargets.some((target) => target.unitId === targetId)) {
    targetId = enemyTargets[0].unitId;
  }

  onMount(() => {
    const configuration = readLivePersistenceConfiguration();
    const storedHandle = configuration ? loadBattleHandle(window.localStorage) : null;

    if (configuration) {
      persistence = createLiveBattlePersistenceGateway(configuration);
    }

    if (persistence && storedHandle) {
      void restoreSavedBattle(storedHandle, true);
      return;
    }

    combat = startBattleWithInitiative(phase4VerticalSliceCombat);
    combatMessage = `${unitName(activeUnitId(combat))} won initiative and acts first.`;
    persistenceMessage = configuration
      ? 'Ready to create a persistent battle save.'
      : 'Persistence unavailable: configure PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY.';
  });

  function requestMove(unitId: UnitId, destination: GridPoint): TacticalMovementResult {
    const result = moveActiveUnit(combat, unitId, destination);
    if (result.ok) {
      combat = result.state;
      combatMessage = `${unitName(unitId)} moved ${result.cost} square${result.cost === 1 ? '' : 's'} and has spent movement for this turn.`;
    } else if (result.reason === 'movement-already-used') {
      combatMessage = `${unitName(activeId)} has already spent movement this turn.`;
    } else if (result.reason === 'not-active-turn') {
      combatMessage = `It is ${unitName(activeId)}'s turn.`;
    }
    return result;
  }

  function undoMovement() {
    const result = undoActiveMovement(combat);
    if (!result.ok) {
      combatMessage = result.reason === 'action-already-used'
        ? 'Movement cannot be undone after the turn action has resolved.'
        : 'There is no movement to undo.';
      return;
    }

    combat = result.state;
    combatMessage = `${unitName(activeId)} returned to the turn-start position. Movement is available again.`;
  }

  function useMove(moveId: string) {
    if (!targetId) {
      combatMessage = 'Choose a valid opposing target first.';
      return;
    }
    const result = resolveMoveAction(combat, { actorId: activeId, targetId, moveId });
    if (!result.ok) {
      combatMessage = failureMessage(result.reason);
      return;
    }
    combat = normalizeTacticalCombatState(result.state);
    const event = result.event;
    const targetName = combat.battle.units.find((unit) => unit.id === event.targetId)?.name ?? event.targetId;
    combatMessage = event.outcome === 'miss'
      ? `${event.moveName} missed ${targetName}. PP ${event.ppAfter}.`
      : `${event.moveName} dealt ${event.damage} damage to ${targetName}${event.critical ? ' — critical hit!' : ''}`;
  }

  function nextTurn() {
    combat = endTacticalTurn(combat);
    combatMessage = `${unitName(activeUnitId(combat))}'s turn. Movement and action are available.`;
  }

  async function saveBattle() {
    if (!persistence) {
      persistenceMessage = 'Persistence is not configured for this deployment.';
      return;
    }

    persistenceBusy = true;
    try {
      const nextHandle = persistenceHandle
        ? await persistence.commitBattle(persistenceHandle, combat)
        : await persistence.createBattle(combat.battle.name, combat);
      persistenceHandle = nextHandle;
      saveBattleHandle(window.localStorage, nextHandle);
      savedAt = new Date().toISOString();
      persistenceMessage = `Saved battle version ${nextHandle.version} · ${nextHandle.latestEventSequence} combat event${nextHandle.latestEventSequence === 1 ? '' : 's'}.`;
    } catch (error) {
      persistenceMessage = persistenceFailureMessage(error);
    } finally {
      persistenceBusy = false;
    }
  }

  async function reloadSavedBattle() {
    if (!persistenceHandle) {
      persistenceMessage = 'No local saved-battle capability is available to reload.';
      return;
    }
    await restoreSavedBattle(persistenceHandle, false);
  }

  async function restoreSavedBattle(handle: BattlePersistenceHandle, automatic: boolean) {
    if (!persistence) return;

    persistenceBusy = true;
    persistenceMessage = automatic ? 'Restoring the last saved battle…' : 'Reloading the authoritative saved battle…';
    try {
      const saved = await persistence.loadBattle(handle.readKey);
      if (!saved) {
        clearBattleHandle(window.localStorage);
        persistenceHandle = undefined;
        savedAt = undefined;
        combat = startBattleWithInitiative(phase4VerticalSliceCombat);
        combatMessage = `${unitName(activeUnitId(combat))} won initiative and acts first.`;
        persistenceMessage = 'The saved battle no longer exists. A new save can be created.';
        return;
      }

      combat = normalizeTacticalCombatState(saved.state);
      persistenceHandle = Object.freeze({
        id: saved.id,
        readKey: handle.readKey,
        writeKey: handle.writeKey,
        version: saved.version,
        latestEventSequence: saved.latestEventSequence
      });
      saveBattleHandle(window.localStorage, persistenceHandle);
      savedAt = saved.savedAt;
      persistenceMessage = `Restored battle version ${saved.version} from Supabase.`;
      combatMessage = `${unitName(activeUnitId(combat))}'s turn · restored from the saved snapshot.`;
    } catch (error) {
      persistenceMessage = persistenceFailureMessage(error);
    } finally {
      persistenceBusy = false;
    }
  }

  function unitName(unitId: UnitId): string {
    return combat.battle.units.find((unit) => unit.id === unitId)?.name ?? unitId;
  }

  function initiativeText(entry: InitiativeEntry): string {
    if (entry.naturalRoll == null || entry.total == null) return 'Existing saved turn order';
    const modifier = entry.modifier >= 0 ? `+${entry.modifier}` : String(entry.modifier);
    return `d20 ${entry.naturalRoll} ${modifier} = ${entry.total}`;
  }

  function failureMessage(reason: MoveActionFailureReason): string {
    if (reason === 'out-of-range') return 'That target is outside the move’s range.';
    if (reason === 'action-already-used') return 'This unit has already used its action. End the turn to continue.';
    if (reason === 'no-pp') return 'That move has no PP remaining.';
    if (reason === 'target-fainted') return 'That target has already fainted.';
    if (reason === 'not-active-turn') return 'Only the active unit can act.';
    return `The move cannot be used (${reason}).`;
  }

  function persistenceFailureMessage(error: unknown): string {
    if (error instanceof BattleVersionConflictError) {
      return 'Save conflict: the persisted battle changed elsewhere. Reload the saved battle before trying again.';
    }
    if (error instanceof Error) return `Persistence error: ${error.message}`;
    return 'Persistence error: the battle could not be saved or restored.';
  }

  function formatSavedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
  }
</script>

<svelte:head>
  <title>Kornia Tactics</title>
  <meta name="description" content="A tactical battle companion for the Kornia Poke5e campaign." />
</svelte:head>

<div class="shell">
  <header class="topbar">
    <div>
      <p class="eyebrow">Kornia Tactics · Phase 5 Playtest</p>
      <h1>{combat.battle.name}</h1>
      <p class="lede">Initiative, turn-gated movement, automated combat and persistent battle saves.</p>
    </div>
    <div class="badge">Round {combat.turn.round} · {unitName(activeId)}'s turn</div>
  </header>

  <main class="workspace">
    <section class="board-panel" aria-label="Battlefield">
      <Battlefield
        battle={combat.battle}
        activeUnitId={activeId}
        movementUsed={combat.turn.movementUsed}
        onMoveRequest={requestMove}
      />
    </section>

    <aside class="sidebar">
      <section class="card active-card">
        <p class="card-label">Active turn</p>
        <h2 class="turn-heading">▶ {unitName(activeId)}'s Turn</h2>
        {#if active}
          <p>HP {active.currentHp}/{active.maxHp} · AC {active.armorClass}</p>
          <div class="turn-resources">
            <span>Movement <strong>{combat.turn.movementUsed ? 'Spent' : 'Available'}</strong></span>
            <span>Action <strong>{combat.turn.actionUsed ? 'Spent' : 'Available'}</strong></span>
          </div>
          {#if combat.turn.movementUsed}
            <button class="undo-move" type="button" on:click={undoMovement} disabled={combat.turn.actionUsed}>
              Undo movement
            </button>
            {#if combat.turn.actionUsed}
              <small class="undo-note">Movement locks once the turn action has resolved.</small>
            {/if}
          {/if}
          <label>
            <span>Target</span>
            <select bind:value={targetId}>
              {#each enemyTargets as target}
                <option value={target.unitId}>{unitName(target.unitId)} · HP {target.currentHp}/{target.maxHp}</option>
              {/each}
            </select>
          </label>
          <div class="moves">
            {#each active.moves as move}
              <button
                type="button"
                on:click={() => useMove(move.id)}
                disabled={combat.turn.actionUsed || move.ppCurrent <= 0 || !targetId}
              >
                <strong>{move.name}</strong>
                <small>{move.type} · {move.range} · PP {move.ppCurrent}/{move.ppMax}</small>
              </button>
            {/each}
          </div>
          <button class="end-turn" type="button" on:click={nextTurn}>End turn</button>
        {/if}
        <p class="message">{combatMessage}</p>
      </section>

      <section class="card initiative-card">
        <p class="card-label">Initiative</p>
        <ol class="initiative-list">
          {#each combat.turn.initiative as entry, index}
            <li class:initiative-active={entry.unitId === activeId}>
              <span>
                <strong>{index + 1}. {unitName(entry.unitId)}</strong>
                <small>{initiativeText(entry)}</small>
              </span>
              {#if entry.unitId === activeId}<em>NOW</em>{/if}
            </li>
          {/each}
        </ol>
      </section>

      <section class="card persistence-card">
        <p class="card-label">Persistence</p>
        <h2>{persistenceHandle ? `Saved v${persistenceHandle.version}` : 'Unsaved battle'}</h2>
        <p>{persistenceMessage}</p>
        {#if savedAt}
          <small>Last server snapshot: {formatSavedAt(savedAt)}</small>
        {/if}
        <div class="persistence-actions">
          <button type="button" on:click={saveBattle} disabled={!persistence || persistenceBusy}>
            {persistenceBusy ? 'Working…' : persistenceHandle ? 'Save battle' : 'Create save'}
          </button>
          {#if persistenceHandle}
            <button type="button" on:click={reloadSavedBattle} disabled={persistenceBusy}>Reload saved</button>
          {/if}
        </div>
        <small class="safety-note">The current vertical slice is Tactics-owned. Campaign Pokémon HP/PP are unchanged unless an owned Pokémon is explicitly bound later.</small>
      </section>

      <section class="card">
        <p class="card-label">Combatants</p>
        <ul class="units">
          {#each combat.units as unit}
            <li class:fainted={unit.currentHp <= 0} class:active-combatant={unit.unitId === activeId}>
              <span>{unitName(unit.unitId)}</span>
              <small>HP {unit.currentHp}/{unit.maxHp}</small>
            </li>
          {/each}
        </ul>
      </section>

      <section class="card log-card">
        <p class="card-label">Battle log</p>
        {#if combat.events.length === 0}
          <p>No attacks resolved yet.</p>
        {:else}
          <ol>
            {#each [...combat.events].reverse().slice(0, 6) as event}
              <li>
                <strong>{unitName(event.actorId)} · {event.moveName}</strong>
                <span>{event.outcome} · {event.damage} damage · {event.effectiveness}</span>
              </li>
            {/each}
          </ol>
        {/if}
      </section>

      <section class="card muted">
        <p class="card-label">Playtest scope</p>
        <p>Initiative now determines turn order. Each unit may commit movement once per turn; movement can be undone before resolving the turn action. Combat calculations are otherwise unchanged.</p>
      </section>
    </aside>
  </main>
</div>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { background: #0b100d; }
  :global(body) {
    margin: 0;
    min-width: 320px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color: #edf2ed;
    background: radial-gradient(circle at 15% 0%, rgba(73, 113, 81, 0.16), transparent 34rem), #0b100d;
  }
  .shell { min-height: 100vh; padding: 28px; }
  .topbar { max-width: 1380px; margin: 0 auto 22px; display: flex; align-items: end; justify-content: space-between; gap: 24px; }
  h1 { margin: 2px 0 6px; font-size: clamp(1.8rem, 4vw, 3.2rem); line-height: 1; }
  .eyebrow, .card-label { margin: 0; color: #b7c9ba; text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.72rem; font-weight: 750; }
  .lede { margin: 0; color: #9eb0a2; }
  .badge { border: 1px solid rgba(244, 233, 138, 0.32); border-radius: 999px; padding: 10px 14px; color: #efe8a5; white-space: nowrap; }
  .workspace { max-width: 1380px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) 350px; gap: 18px; align-items: start; }
  .board-panel { min-width: 0; }
  .sidebar { display: grid; gap: 12px; }
  .card { padding: 18px; border-radius: 16px; background: #151d17; border: 1px solid rgba(214, 229, 217, 0.12); }
  .active-card { border-color: rgba(244, 233, 138, 0.42); box-shadow: inset 0 0 0 1px rgba(244, 233, 138, 0.06); }
  .initiative-card { border-color: rgba(244, 233, 138, 0.2); }
  .persistence-card { border-color: rgba(127, 187, 245, 0.24); }
  .card h2 { margin: 6px 0; font-size: 1.15rem; }
  .turn-heading { color: #f1e99d; }
  .card p { color: #a9b7ac; line-height: 1.45; }
  .card.muted { background: #111713; }
  .turn-resources { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
  .turn-resources span { display: grid; gap: 2px; padding: 8px 9px; border-radius: 9px; background: #101713; color: #829187; font-size: 0.72rem; }
  .turn-resources strong { color: #dce7de; font-size: 0.82rem; }
  label { display: grid; gap: 5px; margin: 14px 0; color: #b7c9ba; font-size: 0.8rem; }
  select { width: 100%; padding: 9px 10px; border-radius: 9px; border: 1px solid rgba(214, 229, 217, 0.18); background: #0f1511; color: #edf2ed; }
  .moves { display: grid; gap: 8px; }
  .moves button, .end-turn, .undo-move, .persistence-actions button { width: 100%; border: 1px solid rgba(214, 229, 217, 0.15); border-radius: 10px; padding: 10px 11px; background: #202b22; color: #edf2ed; text-align: left; cursor: pointer; }
  .moves button { display: grid; gap: 3px; }
  .moves button:disabled, .undo-move:disabled, .persistence-actions button:disabled { cursor: not-allowed; opacity: 0.45; }
  .moves small { color: #9eafa2; }
  .undo-move { margin: 2px 0 0; text-align: center; background: #2a2d25; }
  .undo-note { display: block; margin-top: 6px; line-height: 1.35; }
  .end-turn { margin-top: 10px; text-align: center; background: #2b342b; }
  .message { margin: 12px 0 0 !important; font-size: 0.86rem; }
  .initiative-list { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 6px; }
  .initiative-list li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 9px; border-radius: 9px; background: #101713; }
  .initiative-list li span { display: grid; gap: 2px; }
  .initiative-list strong { color: #dce7de; font-size: 0.84rem; }
  .initiative-list small { font-size: 0.72rem; }
  .initiative-list em { color: #f1e99d; font-size: 0.68rem; font-style: normal; font-weight: 800; letter-spacing: 0.08em; }
  .initiative-list .initiative-active { background: rgba(244, 233, 138, 0.08); border: 1px solid rgba(244, 233, 138, 0.2); }
  .persistence-actions { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .persistence-actions button { text-align: center; }
  .persistence-actions button:first-child { background: #20302a; }
  .safety-note { display: block; margin-top: 10px; line-height: 1.4; }
  .units { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 7px; }
  .units li { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; }
  .units .active-combatant { color: #f1e99d; font-weight: 700; }
  .units .fainted { opacity: 0.45; text-decoration: line-through; }
  small { color: #829187; }
  .log-card ol { margin: 10px 0 0; padding-left: 20px; display: grid; gap: 9px; }
  .log-card ol li { color: #9eafa2; font-size: 0.8rem; }
  .log-card ol strong, .log-card ol span { display: block; }
  .log-card ol strong { color: #dce7de; margin-bottom: 2px; }

  @media (max-width: 960px) {
    .shell { padding: 18px; }
    .topbar { align-items: start; flex-direction: column; }
    .workspace { grid-template-columns: 1fr; }
    .sidebar { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  }
</style>
