import { writable, derived } from 'svelte/store';
import type { DependencyResult, DependencyEvaluation, DependencyCheck } from '../types/speech';

// Dependency checks configuration
export const dependencyChecks: DependencyCheck[] = [
  {
    id: 'secure-context',
    name: 'Secure connection (HTTPS or localhost)',
    check: () => {
      if (typeof window === 'undefined') return false;
      const LOOPBACK_HOST_PATTERN = /^(?:localhost|127(?:\.\d{1,3}){3}|::1|\[::1\])$/i;
      return window.isSecureContext || LOOPBACK_HOST_PATTERN.test(window.location.hostname);
    },
    passMessage: 'Secure connection detected. Unity can safely access the microphone and speech features.',
    failMessage: 'Open this page with https:// or from localhost, then press "Check again."',
    passStatus: 'Ready — secure and private',
    failStatus: 'Fix: Use HTTPS or localhost',
  },
  {
    id: 'speech-recognition',
    name: 'Web Speech Recognition API',
    check: () => {
      if (typeof window === 'undefined') return false;
      return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    },
    passMessage: 'Speech recognition is available. Unity will understand what you say.',
    failMessage: 'Firefox is supported via the Vosklet fallback library.',
    passStatus: 'Ready — Unity can listen',
    failStatus: 'Ready — Vosklet fallback',
  },
  {
    id: 'speech-synthesis',
    name: 'Speech synthesis voices',
    check: () => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return false;
      const voices = window.speechSynthesis.getVoices();
      return voices.length > 0;
    },
    passMessage: 'Speech voices are ready. Unity can answer out loud through your speakers.',
    failMessage: 'Use Chrome, Edge, or Safari with audio enabled, then press "Check again."',
    passStatus: 'Ready — Unity can speak back',
    failStatus: 'Fix: Enable browser speech voices',
  },
  {
    id: 'microphone',
    name: 'Microphone access',
    check: () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
      return Boolean(navigator.mediaDevices.getUserMedia);
    },
    passMessage: 'Microphone permission granted. Unity can hear your voice input.',
    failMessage: 'Click "Allow" on the microphone prompt or enable it in site settings, then press "Check again."',
    passStatus: 'Ready — Microphone unlocked',
    failStatus: 'Fix: Allow microphone access',
  },
];

// Store for dependency results
export const dependencyResults = writable<DependencyResult[]>([]);

// Derived store for evaluation summary
export const dependencyEvaluation = derived<typeof dependencyResults, DependencyEvaluation>(
  dependencyResults,
  ($results) => {
    const missing = $results.filter(r => !r.met).map(r => r.name);
    return {
      allMet: missing.length === 0,
      missing,
      results: $results,
    };
  }
);

// Function to evaluate all dependencies
export function evaluateDependencies(): void {
  const results: DependencyResult[] = dependencyChecks.map((check) => {
    let met = false;
    try {
      met = Boolean(check.check());
    } catch (error) {
      console.error(`Dependency check failed for ${check.id}:`, error);
    }
    return { ...check, met };
  });

  dependencyResults.set(results);
}
