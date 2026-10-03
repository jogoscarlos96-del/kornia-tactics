<script lang="ts">
  import Battlefield from '$lib/components/Battlefield.svelte';
  import { verticalSliceBattle } from '$lib/core';
</script>

<svelte:head>
  <title>Kornia Tactics</title>
  <meta
    name="description"
    content="A tactical battle companion for the Kornia Poke5e campaign."
  />
</svelte:head>

<div class="shell">
  <header class="topbar">
    <div>
      <p class="eyebrow">Kornia Tactics · Phase 2</p>
      <h1>{verticalSliceBattle.name}</h1>
      <p class="lede">Interactive movement prototype. Rules and pathfinding remain independent from the renderer.</p>
    </div>
    <div class="badge">20 × 20</div>
  </header>

  <main class="workspace">
    <section class="board-panel" aria-label="Battlefield">
      <Battlefield battle={verticalSliceBattle} />
    </section>

    <aside class="sidebar">
      <section class="card">
        <p class="card-label">Vertical slice</p>
        <h2>Nico + Terratink</h2>
        <p>vs two manually controlled Pecrow.</p>
      </section>

      <section class="card">
        <p class="card-label">Units</p>
        <ul>
          {#each verticalSliceBattle.units as unit}
            <li>
              <span>{unit.name}</span>
              <small>{unit.controller}</small>
            </li>
          {/each}
        </ul>
      </section>

      <section class="card muted">
        <p class="card-label">Phase 2 scope</p>
        <p>Select any unit, preview reachable squares and paths, then click a destination to move. Turns and combat remain deferred.</p>
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
    background:
      radial-gradient(circle at 15% 0%, rgba(73, 113, 81, 0.16), transparent 34rem),
      #0b100d;
  }

  .shell { min-height: 100vh; padding: 28px; }
  .topbar {
    max-width: 1320px;
    margin: 0 auto 22px;
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 24px;
  }
  h1 { margin: 2px 0 6px; font-size: clamp(1.8rem, 4vw, 3.2rem); line-height: 1; }
  .eyebrow, .card-label {
    margin: 0;
    color: #b7c9ba;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    font-size: 0.72rem;
    font-weight: 750;
  }
  .lede { margin: 0; color: #9eb0a2; }
  .badge {
    border: 1px solid rgba(223, 235, 225, 0.2);
    border-radius: 999px;
    padding: 10px 14px;
    color: #cbd8cd;
    white-space: nowrap;
  }
  .workspace {
    max-width: 1320px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 270px;
    gap: 18px;
    align-items: start;
  }
  .board-panel { min-width: 0; }
  .sidebar { display: grid; gap: 12px; }
  .card {
    padding: 18px;
    border-radius: 16px;
    background: #151d17;
    border: 1px solid rgba(214, 229, 217, 0.12);
  }
  .card h2 { margin: 6px 0; font-size: 1.05rem; }
  .card p:last-child { margin-bottom: 0; color: #a9b7ac; line-height: 1.5; }
  .card.muted { background: #111713; }
  ul { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 7px; }
  li { display: flex; justify-content: space-between; gap: 12px; }
  small { color: #829187; }

  @media (max-width: 900px) {
    .shell { padding: 18px; }
    .workspace { grid-template-columns: 1fr; }
    .sidebar { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
  }
</style>
