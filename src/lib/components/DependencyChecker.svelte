<script lang="ts">
  import { onMount } from 'svelte';
  import { dependencyResults, dependencyEvaluation, evaluateDependencies } from '../stores/dependencies';

  export let onAllReady: () => void = () => {};

  let isChecking = false;

  onMount(() => {
    // Initial check
    handleRecheck();

    // Re-check when window regains focus
    window.addEventListener('focus', handleRecheck);

    // Check for speech synthesis voices loading
    if (window.speechSynthesis) {
      window.speechSynthesis.addEventListener('voiceschanged', handleRecheck);
    }

    return () => {
      window.removeEventListener('focus', handleRecheck);
      if (window.speechSynthesis) {
        window.speechSynthesis.removeEventListener('voiceschanged', handleRecheck);
      }
    };
  });

  function handleRecheck() {
    isChecking = true;
    evaluateDependencies();
    setTimeout(() => {
      isChecking = false;
    }, 500);
  }

  function handleLaunch() {
    if ($dependencyEvaluation.missing.length < 4) {
      onAllReady();
    }
  }

  $: canLaunch = $dependencyEvaluation.missing.length < 4;
  $: overallState = isChecking ? 'pending' : ($dependencyEvaluation.allMet ? 'pass' : 'warn');
</script>

<div class="landing-overview surface-card">
  <div class="landing-status" role="status" aria-live="polite">
    {#if $dependencyEvaluation.allMet}
      All systems ready!
    {:else if $dependencyEvaluation.missing.length > 0}
      {$dependencyEvaluation.missing.length} item{$dependencyEvaluation.missing.length > 1 ? 's' : ''} need attention
    {:else}
      Checking requirements...
    {/if}
  </div>

  <div class="landing-body">
    <div class="dependency-summary">
      <span
        class="dependency-light"
        data-role="dependency-light"
        data-state={overallState}
        aria-live="polite"
        aria-label={isChecking ? "Checking requirements" : ($dependencyEvaluation.allMet ? "All ready" : "Some requirements need attention")}
      ></span>
      <div class="dependency-summary-text">
        <h2>What the lights mean</h2>
        <p>
          {#if isChecking}
            We're checking right now. Green means your setup is ready. An amber light means we need to fix that part together before Unity can listen.
          {:else if $dependencyEvaluation.allMet}
            Every dependency is satisfied. You're ready to talk to Unity!
          {:else}
            Green means ready. Amber means needs attention before Unity can fully function.
          {/if}
        </p>
      </div>
    </div>

    <ul class="dependency-list">
      {#each $dependencyResults as dep}
        <li
          class="dependency-item"
          data-dependency={dep.id}
          data-state={dep.met ? 'pass' : 'fail'}
        >
          <div class="dependency-header">
            <span class="dependency-name">{dep.name}</span>
            <span class="dependency-status">{dep.met ? dep.passStatus : dep.failStatus}</span>
          </div>
          <p class="dependency-message" data-message-type={dep.met ? 'pass' : 'fail'}>
            {dep.met ? dep.passMessage : dep.failMessage}
          </p>
        </li>
      {/each}
    </ul>
  </div>
</div>

<div class="landing-actions surface-card action-bar">
  <button
    id="launch-app"
    class="primary"
    type="button"
    disabled={!canLaunch}
    on:click={handleLaunch}
    aria-disabled={!canLaunch}
  >
    Talk to Unity
  </button>
  <button
    id="recheck-dependencies"
    class="ghost"
    type="button"
    on:click={handleRecheck}
  >
    Check again
  </button>
</div>
