<script lang="ts">
  import { onMount } from 'svelte';
  import type { BattleView } from '$lib/core';
  import { PixiBattlefieldRenderer } from '$lib/rendering/PixiBattlefieldRenderer';

  let { battle }: { battle: BattleView } = $props();
  let host: HTMLDivElement;

  onMount(() => {
    const renderer = new PixiBattlefieldRenderer();
    void renderer.mount(host, battle);

    return () => renderer.destroy();
  });
</script>

<div class="viewport" bind:this={host}></div>

<style>
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
