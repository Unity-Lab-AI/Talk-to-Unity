<script lang="ts">
  import { onMount } from 'svelte';
  import DependencyChecker from './lib/components/DependencyChecker.svelte';
  import VoiceInteraction from './lib/components/VoiceInteraction.svelte';

  let appState: 'landing' | 'running' = 'landing';

  function handleLaunch() {
    appState = 'running';
  }

  onMount(() => {
    document.body.setAttribute('data-app-state', appState);
  });

  $: {
    if (typeof document !== 'undefined') {
      document.body.setAttribute('data-app-state', appState);
    }
  }
</script>

<main>
  {#if appState === 'landing'}
    <section id="landing" class="landing" aria-labelledby="landing-title">
      <div class="landing-grid">
        <div class="landing-hero surface-card accent-card">
          <span class="landing-badge">Unity voice lab check-in</span>
          <h1 id="landing-title">Let's make sure every light is green</h1>
          <p class="landing-lede">
            Before Unity can chat with you, we run a quick readiness scan on your browser. Think of it like making sure
            your helmet is on straight. When a light glows amber, read the friendly tip, fix it, then press "Check again."
          </p>
          <div class="landing-links">
            <a class="landing-link" href="https://unityailab.online" target="_blank" rel="noopener">Back to Unity AI Lab home</a>
            <a class="landing-link" href="https://github.com/Unity-Lab-AI/Talk-to-Unity" target="_blank" rel="noopener">View the project on GitHub</a>
          </div>
        </div>

        <DependencyChecker onAllReady={handleLaunch} />
      </div>

      <div class="landing-instructions surface-card" aria-labelledby="landing-how-to-title">
        <h2 id="landing-how-to-title">How to get every light to glow green</h2>
        <ol class="landing-steps">
          <li>
            <strong>Stay on a secure connection.</strong> Always load <code>https://unityailab.com/Talk-to-Unity/</code> or run the site from
            <code>localhost</code> while developing. If you see <code>http://</code> in the address bar, add the missing "s" or jump back to the
            Unity AI Lab home page and enter from there.
          </li>
          <li>
            <strong>Use a browser that can listen.</strong> We recommend the latest Chrome or Edge. Safari works on macOS.
          </li>
          <li>
            <strong>Give Unity a voice and ears.</strong> Turn your speakers on, set your system output to the right device, and when the browser asks
            for microphone access, click <em>Allow</em>. You can also review these permissions via the lock icon near the URL bar.
          </li>
          <li>
            <strong>Re-run the check.</strong> Once you've made changes, press "Check again." When every status reads "Ready," the "Talk to Unity" button
            will unlock and slide the live lab into view on this page.
          </li>
          <li>
            <strong>Remember the unmute cue.</strong> When the lab loads, <em>Tap or click anywhere to unmute</em> so Unity can hear you and respond.
          </li>
        </ol>
        <p>
          Need help? Refresh the page to start over, or read the tips above each alert. When everything looks good, we'll send you forward
          to the interactive Unity assistant.
        </p>
      </div>
    </section>
  {:else}
    <VoiceInteraction />
  {/if}
</main>
