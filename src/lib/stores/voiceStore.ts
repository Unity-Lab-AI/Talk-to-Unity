/**
 * Voice Store
 * Reactive state for speech recognition and synthesis
 */

import { writable, derived, get } from 'svelte/store';
import { speechRecognition } from '../services/speechRecognitionService';
import { speechSynthesis } from '../services/speechSynthesisService';

export type VoiceState = 'idle' | 'listening' | 'speaking' | 'processing' | 'error';

export interface VoiceStoreState {
  isMuted: boolean;
  hasMicPermission: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  currentTranscript: string;
  error: string | null;
}

function createVoiceStore() {
  const { subscribe, update } = writable<VoiceStoreState>({
    isMuted: true,
    hasMicPermission: false,
    isListening: false,
    isSpeaking: false,
    currentTranscript: '',
    error: null,
  });

  // Derived state for overall voice state
  const voiceState = derived({ subscribe }, ($voice) => {
    if ($voice.error) return 'error' as VoiceState;
    if ($voice.isSpeaking) return 'speaking' as VoiceState;
    if ($voice.isListening) return 'listening' as VoiceState;
    return 'idle' as VoiceState;
  });

  return {
    subscribe,
    voiceState,

    async requestMicPermission(): Promise<boolean> {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());

        update(state => ({ ...state, hasMicPermission: true, error: null }));
        return true;
      } catch (error) {
        console.error('Microphone permission denied:', error);
        update(state => ({ ...state, hasMicPermission: false, error: 'Microphone access denied' }));
        return false;
      }
    },

    async initialize(): Promise<boolean> {
      const hasPermission = await this.requestMicPermission();
      if (!hasPermission) return false;

      const initialized = await speechRecognition.initialize();
      if (!initialized) {
        update(state => ({ ...state, error: 'Failed to initialize speech recognition' }));
        return false;
      }

      // Set up transcript callback
      speechRecognition.onTranscript((transcript, isFinal) => {
        update(state => ({ ...state, currentTranscript: transcript }));

        if (isFinal) {
          // Transcript finalized - trigger event for processing
          window.dispatchEvent(new CustomEvent('voice:transcript', { detail: { transcript } }));
        }
      });

      // Set up error callback
      speechRecognition.onError((error) => {
        update(state => ({ ...state, error }));
      });

      return true;
    },

    async unmute(): Promise<void> {
      const state = get({ subscribe });

      if (!state.hasMicPermission) {
        const granted = await this.requestMicPermission();
        if (!granted) return;
      }

      update(s => ({ ...s, isMuted: false, isListening: true }));
      speechRecognition.start();
    },

    mute(): void {
      update(state => ({ ...state, isMuted: true, isListening: false }));
      speechRecognition.stop();
      speechSynthesis.stop();
    },

    toggleMute(): void {
      const state = get({ subscribe });
      if (state.isMuted) {
        this.unmute();
      } else {
        this.mute();
      }
    },

    speak(text: string, options?: { priority?: boolean }): void {
      update(state => ({ ...state, isSpeaking: true }));

      speechSynthesis.speak(text, options);

      // Update state when done
      setTimeout(() => {
        if (!speechSynthesis.isSpeaking()) {
          update(state => ({ ...state, isSpeaking: false }));
        }
      }, 100);
    },

    stopSpeaking(): void {
      speechSynthesis.stop();
      update(state => ({ ...state, isSpeaking: false }));
    },

    clearError(): void {
      update(state => ({ ...state, error: null }));
    },
  };
}

export const voiceStore = createVoiceStore();
