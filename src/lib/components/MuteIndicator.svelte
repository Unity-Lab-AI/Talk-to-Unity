<script lang="ts">
  import { voiceStore } from '../stores/voiceStore';

  function handleClick() {
    voiceStore.toggleMute();
  }

  $: indicatorText = $voiceStore.isMuted
    ? 'Tap or click anywhere to unmute'
    : 'Microphone active - listening';
</script>

<button
  id="mute-indicator"
  class="mute-indicator"
  data-state={$voiceStore.isMuted ? 'muted' : 'unmuted'}
  type="button"
  on:click={handleClick}
>
  <span class="indicator-text">{indicatorText}</span>
</button>

<style>
  .mute-indicator {
    width: 100%;
    padding: 16px;
    background: rgba(255, 165, 0, 0.9);
    color: white;
    border: none;
    font-size: 16px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.3s ease;
  }

  .mute-indicator[data-state="unmuted"] {
    background: rgba(0, 200, 0, 0.9);
  }

  .mute-indicator:hover {
    background: rgba(255, 140, 0, 1);
  }

  .mute-indicator[data-state="unmuted"]:hover {
    background: rgba(0, 180, 0, 1);
  }

  .indicator-text {
    display: block;
  }
</style>
