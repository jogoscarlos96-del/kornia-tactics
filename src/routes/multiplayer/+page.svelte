<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
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
    type MoveActionFailureReason,
    type TacticalCombatState,
    type TacticalMovementResult,
    type UnitId
  } from '$lib/core';
  import {
    canActNow,
    createLiveMultiplayerGateway,
    type MultiplayerBattle,
    type MultiplayerGateway
  } from '$lib/multiplayer';
  import {
    BattleVersionConflictError,
    createLiveBattlePersistenceGateway,
    readLivePersistenceConfiguration,
    type BattlePersistenceGateway
  } from '$lib/persistence';

  let combat: TacticalCombatState = normalizeTacticalCombatState(phase4VerticalSliceCombat);
  let persistence: BattlePersistenceGateway | undefined;
  let multiplayer: MultiplayerGateway | undefined;
  let sharedBattle: MultiplayerBattle | undefined;
  let sessionKey = '';
  let inviteUrl = '';
  let targetId: UnitId | undefined = 'pokemon-pecrow-a';
  let statusMessage = 'Create a shared battle as DM, or open a player invitation link.';
  let combatMessage = 'Waiting for a multiplayer battle.';
  let busy = false;
  let polling = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  $: activeId = activeUnitId(combat);
  $: active = combatUnit(combat, activeId);
  $: participant = sharedBattle?.participant;
  $: mayAct = participant ? canActNow(participant, combat) : false;
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
    if (!configuration) {
      statusMessage = 'Multiplayer unavailable: PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_KEY are not configured.';
      return;
    }

    persistence = createLiveBattlePersistenceGateway(configuration);
    multiplayer = createLiveMultiplayerGateway(configuration);
    sessionKey = new URL(window.location.href).searchParams.get('session')?.trim() ?? '';
    if (sessionKey) void loadSession(true);
  });

  onDestroy(() => stopPolling());

  async function createSharedBattle() {
    if (!persistence || !multiplayer || busy) return;
    busy = true;
    try {
      const initial = startBattleWithInitiative(phase4VerticalSliceCombat);
      const handle = await persistence.createBattle(`${initial.battle.name} · Multiplayer`, initial);
      const host = await multiplayer.createHostSession(handle.writeKey, 'DM');
      sessionKey = host.participantKey;
      setSessionUrl(sessionKey);
      await loadSession(true);
      statusMessage = 'Shared battle created. Create a Terratink player invitation when ready.';
      combatMessage = `${unitName(activeUnitId(combat))} acts first.`;
    } catch (error) {
      statusMessage = failureText(error);
    } finally {
      busy = false;
    }
  }

  async function createTerratinkInvite() {
    if (!multiplayer || !sharedBattle || sharedBattle.participant.role !== 'host' || busy) return;
    busy = true;
    try {
      const player = await multiplayer.createPlayerSession(sessionKey, 'Terratink Player', ['pokemon-terratink']);
      const url = new URL(window.location.href);
      url.search = '';
      url.searchParams.set('session', player.participantKey);
      inviteUrl = url.toString();
      statusMessage = 'Terratink player invitation created. Open it in another browser or private window.';
    } catch (error) {
      statusMessage = failureText(error);
    } finally {
      busy = false;
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      statusMessage = 'Player invitation copied.';
    } catch {
      statusMessage = 'Copy failed. Select the invitation URL manually.';
    }
  }

  async function loadSession(force: boolean) {
    if (!multiplayer || !sessionKey) return;
    try {
      const loaded = await multiplayer.loadBattle(sessionKey);
      if (!loaded) {
        statusMessage = 'This multiplayer session no longer exists.';
        stopPolling();
        return;
      }
      if (force || !sharedBattle || loaded.version > sharedBattle.version) {
        sharedBattle = loaded;
        combat = normalizeTacticalCombatState(loaded.state);
        combatMessage = mayActMessage(loaded);
      }
      startPolling();
    } catch (error) {
      statusMessage = failureText(error);
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => void pollForChanges(), 1500);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = undefined;
  }

  async function pollForChanges() {
    if (!multiplayer || !sessionKey || busy || polling || !sharedBattle) return;
    polling = true;
    try {
      const loaded = await multiplayer.loadBattle(sessionKey);
      if (loaded && loaded.version > sharedBattle.version) {
        sharedBattle = loaded;
        combat = normalizeTacticalCombatState(loaded.state);
        combatMessage = mayActMessage(loaded);
      }
    } catch (error) {
      statusMessage = `Sync warning: ${failureText(error)}`;
    } finally {
      polling = false;
    }
  }

  function requestMove(unitId: UnitId, destination: GridPoint): TacticalMovementResult {
    if (!sharedBattle || !mayAct || busy) {
      combatMessage = waitingMessage();
      return Object.freeze({ ok: false, state: combat, reason: 'not-active-turn' });
    }

    const result = moveActiveUnit(combat, unitId, destination);
    if (!result.ok) {
      combatMessage = result.reason === 'movement-already-used'
        ? `${unitName(activeId)} has already spent movement this turn.`
        : result.reason === 'not-active-turn'
          ? waitingMessage()
          : 'That movement cannot be completed.';
      return result;
    }

    combat = result.state;
    combatMessage = `${unitName(unitId)} moved ${result.cost} square${result.cost === 1 ? '' : 's'}. Saving shared state…`;
    void commitState(result.state, `${unitName(unitId)} moved. Movement is spent for this turn.`);
    return result;
  }

  async function undoMovement() {
    if (!mayAct || busy) return;
    const result = undoActiveMovement(combat);
    if (!result.ok) {
      combatMessage = result.reason === 'action-already-used'
        ? 'Movement cannot be undone after the turn action has resolved.'
        : 'There is no movement to undo.';
      return;
    }
    combat = result.state;
    await commitState(result.state, `${unitName(activeId)} returned to the turn-start position.`);
  }

  async function useMove(moveId: string) {
    if (!mayAct || busy) {
      combatMessage = waitingMessage();
      return;
    }
    if (!targetId) {
      combatMessage = 'Choose a valid opposing target first.';
      return;
    }
    const result = resolveMoveAction(combat, { actorId: activeId, targetId, moveId });
    if (!result.ok) {
      combatMessage = moveFailureMessage(result.reason);
      return;
    }
    combat = normalizeTacticalCombatState(result.state);
    const event = result.event;
    const targetName = unitName(event.targetId);
    const message = event.outcome === 'miss'
      ? `${event.moveName} missed ${targetName}. PP ${event.ppAfter}.`
      : `${event.moveName} dealt ${event.damage} damage to ${targetName}${event.critical ? ' — critical hit!' : ''}`;
    await commitState(combat, message);
  }

  async function nextTurn() {
    if (!mayAct || busy) {
      combatMessage = waitingMessage();
      return;
    }
    const next = endTacticalTurn(combat);
    combat = next;
    await commitState(next, `${unitName(activeUnitId(next))}'s turn.`);
  }

  async function commitState(next: TacticalCombatState, successMessage: string) {
    if (!multiplayer || !sharedBattle || busy) return;
    busy = true;
    const expectedVersion = sharedBattle.version;
    try {
      const committed = await multiplayer.commitBattle(sessionKey, expectedVersion, next);
      sharedBattle = Object.freeze({
        ...sharedBattle,
        version: committed.version,
        latestEventSequence: committed.latestEventSequence,
        state: next
      });
      combatMessage = successMessage;
      statusMessage = `Shared battle v${committed.version} saved.`;
    } catch (error) {
      if (error instanceof BattleVersionConflictError) {
        statusMessage = 'Another browser updated the battle first. Reloading the authoritative state.';
      } else {
        statusMessage = `Shared save failed: ${failureText(error)} Reloading authoritative state.`;
      }
      await loadSession(true);
    } finally {
      busy = false;
    }
  }

  function setSessionUrl(key: string) {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('session', key);
    window.history.replaceState({}, '', url);
  }

  function waitingMessage(): string {
    if (!sharedBattle || !participant) return 'Join or create a multiplayer battle first.';
    if (participant.role === 'spectator') return 'Spectators cannot act.';
    return `Waiting for ${unitName(activeId)}'s controller.`;
  }

  function mayActMessage(battle: MultiplayerBattle): string {
    const state = normalizeTacticalCombatState(battle.state);
    const name = state.battle.units.find((unit) => unit.id === activeUnitId(state))?.name ?? activeUnitId(state);
    return canActNow(battle.participant, state)
      ? `${name}'s turn — you control this unit.`
      : `${name}'s turn — waiting for its controller.`;
  }

  function unitName(unitId: UnitId): string {
    return combat.battle.units.find((unit) => unit.id === unitId)?.name ?? unitId;
  }

  function moveFailureMessage(reason: MoveActionFailureReason): string {
    if (reason === 'out-of-range') return 'That target is outside the move’s range.';
    if (reason === 'action-already-used') return 'This unit has already used its action.';
    if (reason === 'no-pp') return 'That move has no PP remaining.';
    if (reason === 'target-fainted') return 'That target has already fainted.';
    if (reason === 'not-active-turn') return waitingMessage();
    return `The move cannot be used (${reason}).`;
  }

  function failureText(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown multiplayer error.';
  }
</script>

<svelte:head>
  <title>Kornia Tactics · Multiplayer Proof</title>
  <meta name="description" content="Phase 6 multiplayer authority proof for Kornia Tactics." />
</svelte:head>

<div class="shell">
  <header class="topbar">
    <div>
      <p class="eyebrow">Kornia Tactics · Phase 6A</p>
      <h1>Two-browser multiplayer proof</h1>
      <p class="lede">Shared battle state, scoped unit ownership, reconnect and version-safe saves.</p>
    </div>
    {#if sharedBattle}
      <div class="badge">v{sharedBattle.version} · {sharedBattle.participant.role}</div>
    {/if}
  </header>

  {#if !sharedBattle}
    <main class="setup">
      <section class="card hero-card">
        <p class="card-label">Start</p>
        <h2>Host a shared vertical-slice battle</h2>
        <p>The DM creates the persistent battle. A scoped player invitation can then control Terratink from another browser.</p>
        <button type="button" on:click={createSharedBattle} disabled={!persistence || !multiplayer || busy}>
          {busy ? 'Creating…' : 'Create shared battle as DM'}
        </button>
        <p class="message">{statusMessage}</p>
      </section>
    </main>
  {:else}
    <main class="workspace">
      <section class="board-panel" aria-label="Battlefield">
        <Battlefield
          battle={combat.battle}
          activeUnitId={activeId}
          movementUsed={combat.turn.movementUsed || !mayAct || busy}
          onMoveRequest={requestMove}
        />
      </section>

      <aside class="sidebar">
        <section class="card identity-card">
          <p class="card-label">Connected as</p>
          <h2>{sharedBattle.participant.displayName}</h2>
          <p>{sharedBattle.participant.role === 'host' ? 'DM / host override' : sharedBattle.participant.role}</p>
          {#if sharedBattle.participant.role === 'player'}
            <small>Controls: {sharedBattle.participant.controlledUnitIds.map(unitName).join(', ') || 'none'}</small>
          {/if}
          <div class="sync-row"><span>Sync</span><strong>{polling ? 'Checking…' : `v${sharedBattle.version}`}</strong></div>
        </section>

        {#if sharedBattle.participant.role === 'host'}
          <section class="card invite-card">
            <p class="card-label">Player invitation</p>
            <p>Create a scoped link that controls Terratink only. Regenerating creates a new player session and reassigns Terratink to it.</p>
            <button type="button" on:click={createTerratinkInvite} disabled={busy}>Create Terratink invite</button>
            {#if inviteUrl}
              <textarea readonly rows="3" value={inviteUrl}></textarea>
              <button type="button" on:click={copyInvite}>Copy invitation</button>
            {/if}
          </section>
        {/if}

        <section class:waiting={!mayAct} class="card active-card">
          <p class="card-label">Active turn</p>
          <h2>{unitName(activeId)}</h2>
          <p>{mayAct ? 'You may act.' : 'Waiting for another controller.'}</p>
          {#if active}
            <p>HP {active.currentHp}/{active.maxHp} · AC {active.armorClass}</p>
            <div class="turn-resources">
              <span>Movement <strong>{combat.turn.movementUsed ? 'Spent' : 'Available'}</strong></span>
              <span>Action <strong>{combat.turn.actionUsed ? 'Spent' : 'Available'}</strong></span>
            </div>
            {#if mayAct && combat.turn.movementUsed}
              <button type="button" on:click={undoMovement} disabled={busy || combat.turn.actionUsed}>Undo movement</button>
            {/if}
            <label>
              <span>Target</span>
              <select bind:value={targetId} disabled={!mayAct || busy}>
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
                  disabled={!mayAct || busy || combat.turn.actionUsed || move.ppCurrent <= 0 || !targetId}
                >
                  <strong>{move.name}</strong>
                  <small>{move.type} · {move.range} · PP {move.ppCurrent}/{move.ppMax}</small>
                </button>
              {/each}
            </div>
            <button class="end-turn" type="button" on:click={nextTurn} disabled={!mayAct || busy}>End turn</button>
          {/if}
          <p class="message">{combatMessage}</p>
        </section>

        <section class="card initiative-card">
          <p class="card-label">Initiative</p>
          <ol>
            {#each combat.turn.initiative as entry, index}
              <li class:current={entry.unitId === activeId}>
                <span>{index + 1}. {unitName(entry.unitId)}</span>
                <strong>{entry.total ?? 'saved order'}</strong>
              </li>
            {/each}
          </ol>
        </section>

        <section class="card log-card">
          <p class="card-label">Battle log</p>
          {#if combat.events.length === 0}
            <p>No attacks resolved yet.</p>
          {:else}
            <ol>
              {#each [...combat.events].reverse().slice(0, 6) as event}
                <li><strong>{unitName(event.actorId)} · {event.moveName}</strong><span>{event.outcome} · {event.damage} damage</span></li>
              {/each}
            </ol>
          {/if}
        </section>

        <section class="card status-card">
          <p class="card-label">Session</p>
          <p>{statusMessage}</p>
          <small>Phase 6A refreshes the authoritative snapshot about every 1.5 seconds. Realtime transport comes next without changing the battle engine.</small>
        </section>
      </aside>
    </main>
  {/if}
</div>

<style>
  :global(*) { box-sizing: border-box; }
  :global(html) { background: #0b100d; }
  :global(body) { margin: 0; min-width: 320px; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #edf2ed; background: #0b100d; }
  .shell { min-height: 100vh; padding: 28px; }
  .topbar { max-width: 1420px; margin: 0 auto 22px; display: flex; justify-content: space-between; align-items: end; gap: 20px; }
  h1 { margin: 4px 0 6px; font-size: clamp(1.8rem, 4vw, 3rem); }
  .lede, .card p, small { color: #9eafa2; }
  .eyebrow, .card-label { margin: 0; color: #b7c9ba; text-transform: uppercase; letter-spacing: .14em; font-size: .72rem; font-weight: 750; }
  .badge { padding: 9px 13px; border: 1px solid rgba(244,233,138,.3); border-radius: 999px; color: #efe8a5; }
  .setup { max-width: 620px; margin: 8vh auto; }
  .workspace { max-width: 1420px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 18px; align-items: start; }
  .board-panel { min-width: 0; }
  .sidebar { display: grid; gap: 12px; }
  .card { padding: 18px; border: 1px solid rgba(214,229,217,.13); border-radius: 16px; background: #151d17; }
  .card h2 { margin: 6px 0; }
  .hero-card { padding: 26px; }
  .active-card { border-color: rgba(244,233,138,.38); }
  .active-card.waiting { border-color: rgba(214,229,217,.13); opacity: .82; }
  button, select, textarea { width: 100%; border: 1px solid rgba(214,229,217,.16); border-radius: 10px; background: #202b22; color: #edf2ed; padding: 10px 11px; }
  button { cursor: pointer; }
  button:disabled, select:disabled { cursor: not-allowed; opacity: .45; }
  textarea { margin: 9px 0; resize: vertical; background: #0f1511; font-size: .74rem; }
  label { display: grid; gap: 5px; margin: 13px 0; color: #b7c9ba; font-size: .8rem; }
  .moves { display: grid; gap: 8px; }
  .moves button { text-align: left; display: grid; gap: 3px; }
  .moves small { display: block; }
  .end-turn { margin-top: 9px; text-align: center; }
  .turn-resources { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
  .turn-resources span, .sync-row { padding: 8px 9px; border-radius: 9px; background: #101713; color: #829187; font-size: .74rem; }
  .turn-resources span { display: grid; gap: 2px; }
  .turn-resources strong, .sync-row strong { color: #dce7de; }
  .sync-row { margin-top: 10px; display: flex; justify-content: space-between; }
  .message { font-size: .86rem; }
  .initiative-card ol, .log-card ol { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 6px; }
  .initiative-card li { display: flex; justify-content: space-between; padding: 7px 8px; border-radius: 8px; background: #101713; font-size: .82rem; }
  .initiative-card li.current { color: #f1e99d; border: 1px solid rgba(244,233,138,.2); }
  .log-card li { display: grid; gap: 2px; font-size: .78rem; color: #9eafa2; }
  .log-card li strong { color: #dce7de; }
  .status-card { background: #111713; }
  @media (max-width: 980px) { .workspace { grid-template-columns: 1fr; } .topbar { align-items: start; flex-direction: column; } }
</style>
