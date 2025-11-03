<script lang="ts">
  import { onMount } from 'svelte';
  import { voiceStore } from '../stores/voiceStore';
  import { chatStore } from '../stores/chatStore';
  import VoiceCircle from './VoiceCircle.svelte';
  import HeroImage from './HeroImage.svelte';
  import MuteIndicator from './MuteIndicator.svelte';

  onMount(() => {
    // Load system prompt
    chatStore.loadSystemPrompt();

    // Initialize voice
    voiceStore.initialize();

    // Listen for finalized transcripts
    window.addEventListener('voice:transcript', handleTranscript);

    return () => {
      window.removeEventListener('voice:transcript', handleTranscript);
      voiceStore.mute();
    };
  });

  async function handleTranscript(event: Event) {
    const customEvent = event as CustomEvent<{ transcript: string }>;
    const transcript = customEvent.detail.transcript;

    if (!transcript) return;

    // Send to AI
    await chatStore.sendMessage(transcript);
  }

  // Handle click/keydown anywhere to unmute
  function handleClick() {
    if ($voiceStore.isMuted) {
      voiceStore.unmute();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      handleClick();
    }
  }
</script>

<div class="app-shell" on:click={handleClick} on:keydown={handleKeyDown} role="button" tabindex="0">
  <header class="status-banner" role="status" aria-live="polite">
    <MuteIndicator />
  </header>

  <main class="layout" aria-live="polite">
    <HeroImage />

    <section class="voice-stage" role="group" aria-label="Voice activity monitors">
      <VoiceCircle
        role="ai"
        speaking={$voiceStore.isSpeaking}
        label="Unity is {$voiceStore.isSpeaking ? 'speaking' : 'idle'}"
      />
      <VoiceCircle
        role="user"
        listening={$voiceStore.isListening}
        label="Microphone is {$voiceStore.isListening ? 'listening' : 'muted'}"
      />
    </section>

    {#if $voiceStore.currentTranscript}
      <div class="transcript-display">
        <p>{$voiceStore.currentTranscript}</p>
      </div>
    {/if}
  </main>
</div>

<style>
  .app-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .status-banner {
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .layout {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 48px;
    padding: 48px 24px;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
  }

  .voice-stage {
    display: flex;
    gap: 48px;
    justify-content: center;
    align-items: center;
  }

  .transcript-display {
    text-align: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    border: 1px solid rgba(0, 255, 255, 0.3);
  }

  .transcript-display p {
    margin: 0;
    font-size: 18px;
    color: rgba(0, 255, 255, 0.9);
  }
</style>
