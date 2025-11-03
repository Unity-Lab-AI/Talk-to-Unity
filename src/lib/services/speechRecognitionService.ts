/**
 * Speech Recognition Service
 * Handles speech-to-text with browser API or Firefox fallback
 */

type RecognitionCallback = (transcript: string, isFinal: boolean) => void;
type ErrorCallback = (error: string) => void;

export class SpeechRecognitionService {
  private recognition: SpeechRecognition | null = null;
  private isFirefox: boolean;
  private restartTimeout: number | null = null;
  private onTranscriptCallback: RecognitionCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;

  constructor() {
    this.isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
  }

  async initialize(): Promise<boolean> {
    try {
      if (this.isFirefox) {
        // Firefox: load Vosklet fallback
        await this.loadVosklet();
      }

      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionAPI) {
        throw new Error('Speech Recognition API not available');
      }

      this.recognition = new SpeechRecognitionAPI();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;

      this.setupEventHandlers();

      return true;
    } catch (error) {
      console.error('Failed to initialize speech recognition:', error);
      return false;
    }
  }

  private async loadVosklet(): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('./vosklet-adapter.js', window.location.href).toString();
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Vosklet'));
      document.head.appendChild(script);
    });
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const lastResult = event.results[event.results.length - 1];
      if (!lastResult) return;

      const transcript = lastResult[0]?.transcript.trim();
      const isFinal = lastResult.isFinal;

      if (transcript && this.onTranscriptCallback) {
        this.onTranscriptCallback(transcript, isFinal);
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      if (this.onErrorCallback) {
        this.onErrorCallback(event.error);
      }

      // Auto-restart on certain errors
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        this.scheduleRestart();
      }
    };

    this.recognition.onend = () => {
      // Auto-restart if not explicitly stopped
      this.scheduleRestart();
    };
  }

  private scheduleRestart(): void {
    if (this.restartTimeout) {
      window.clearTimeout(this.restartTimeout);
    }

    this.restartTimeout = window.setTimeout(() => {
      if (this.recognition) {
        try {
          this.recognition.start();
        } catch (error) {
          // Ignore errors if already started
          console.warn('Speech recognition restart failed:', error);
        }
      }
    }, 1000);
  }

  start(): void {
    if (!this.recognition) {
      console.warn('Speech recognition not initialized');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.warn('Speech recognition already started:', error);
    }
  }

  stop(): void {
    if (this.restartTimeout) {
      window.clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition) {
      this.recognition.stop();
    }
  }

  onTranscript(callback: RecognitionCallback): void {
    this.onTranscriptCallback = callback;
  }

  onError(callback: ErrorCallback): void {
    this.onErrorCallback = callback;
  }
}

// Singleton instance
export const speechRecognition = new SpeechRecognitionService();
