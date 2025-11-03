<script lang="ts">
  export let role: 'user' | 'ai' = 'user';
  export let speaking = false;
  export let listening = false;
  export let error = false;
  export let label = '';

  $: state = error ? 'error' : (speaking ? 'speaking' : (listening ? 'listening' : 'idle'));
  $: ariaLabel = label || (role === 'ai' ? 'Unity' : 'You') + ' - ' + state;
</script>

<article
  class="voice-circle {role}"
  data-role={role}
  data-state={state}
  class:speaking
  class:listening
  class:error
  aria-label={ariaLabel}
>
  <div class="pulse-ring"></div>
  <span class="sr-only">{role === 'ai' ? 'Unity' : 'You'}</span>
</article>

<style>
  .voice-circle {
    position: relative;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(0, 255, 255, 0.1), rgba(0, 0, 0, 0.2));
    border: 2px solid rgba(0, 255, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }

  .voice-circle.ai {
    background: radial-gradient(circle, rgba(138, 43, 226, 0.1), rgba(0, 0, 0, 0.2));
    border-color: rgba(138, 43, 226, 0.3);
  }

  .voice-circle.speaking {
    border-color: rgba(0, 255, 255, 1);
    box-shadow: 0 0 20px rgba(0, 255, 255, 0.5);
  }

  .voice-circle.ai.speaking {
    border-color: rgba(138, 43, 226, 1);
    box-shadow: 0 0 20px rgba(138, 43, 226, 0.5);
  }

  .voice-circle.listening {
    border-color: rgba(255, 215, 0, 0.8);
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
  }

  .voice-circle.error {
    border-color: rgba(255, 0, 0, 0.8);
    box-shadow: 0 0 15px rgba(255, 0, 0, 0.3);
  }

  .pulse-ring {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid currentColor;
    opacity: 0;
  }

  .speaking .pulse-ring {
    animation: pulse 1.5s ease-out infinite;
  }

  .listening .pulse-ring {
    animation: pulse 2s ease-out infinite;
  }

  @keyframes pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(1.5);
      opacity: 0;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
