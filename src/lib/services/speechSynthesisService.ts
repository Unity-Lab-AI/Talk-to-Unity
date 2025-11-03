/**
 * Speech Synthesis Service
 * Handles text-to-speech with voice selection
 */

import { sanitizeForSpeech } from '../utils/textSanitizer';

export class SpeechSynthesisService {
  private synth: SpeechSynthesis;

  constructor() {
    this.synth = window.speechSynthesis;
  }

  speak(text: string, options: { priority?: boolean } = {}): void {
    if (!text.trim()) return;

    // Stop current speech if priority
    if (options.priority && this.isSpeaking()) {
      this.stop();
    }

    const sanitizedText = sanitizeForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(sanitizedText);

    // Select UK female voice if available
    const voices = this.synth.getVoices();
    const ukFemaleVoice = voices.find((voice) =>
      voice.lang.startsWith('en-GB') && voice.name.toLowerCase().includes('female')
    );

    if (ukFemaleVoice) {
      utterance.voice = ukFemaleVoice;
    }

    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onerror = (error) => {
      console.error('Speech synthesis error:', error);
    };

    this.synth.speak(utterance);
  }

  stop(): void {
    this.synth.cancel();
  }

  isSpeaking(): boolean {
    return this.synth.speaking;
  }

  pause(): void {
    if (this.isSpeaking()) {
      this.synth.pause();
    }
  }

  resume(): void {
    if (this.synth.paused) {
      this.synth.resume();
    }
  }
}

// Singleton instance
export const speechSynthesis = new SpeechSynthesisService();
