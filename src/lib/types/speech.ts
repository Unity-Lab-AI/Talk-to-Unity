// Web Speech API types (enhanced from DOM types)
// Note: SpeechRecognition types from window will be defined below
export type SpeechRecognitionType = unknown;

export interface DependencyCheck {
  id: string;
  name: string;
  check: () => boolean;
  passMessage: string;
  failMessage: string;
  passStatus: string;
  failStatus: string;
}

export interface DependencyResult extends DependencyCheck {
  met: boolean;
}

export interface DependencyEvaluation {
  allMet: boolean;
  missing: string[];
  results: DependencyResult[];
}

export type AppState = 'landing' | 'checking' | 'ready' | 'running';

export type DependencyState = 'pending' | 'pass' | 'fail';

declare global {
  interface Window {
    SpeechRecognition?: typeof window.webkitSpeechRecognition;
    webkitSpeechRecognition?: {
      new(): SpeechRecognition;
      prototype: SpeechRecognition;
    };
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
    onend: ((this: SpeechRecognition, ev: Event) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }

  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    readonly isFinal: boolean;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }
}
