/**
 * Image Store
 * Reactive state for hero image display
 */

import { writable } from 'svelte/store';

export interface ImageStoreState {
  currentImageUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

function createImageStore() {
  const { subscribe, update } = writable<ImageStoreState>({
    currentImageUrl: null,
    isLoading: false,
    error: null,
  });

  return {
    subscribe,

    setImage(url: string): void {
      if (!url) return;

      update(state => ({ ...state, isLoading: true, error: null }));

      // Preload image
      const img = new Image();

      img.onload = () => {
        update(state => ({
          ...state,
          currentImageUrl: url,
          isLoading: false,
        }));
      };

      img.onerror = () => {
        update(state => ({
          ...state,
          isLoading: false,
          error: 'Failed to load image',
        }));
      };

      img.src = url;
    },

    clearImage(): void {
      update(state => ({
        ...state,
        currentImageUrl: null,
        isLoading: false,
        error: null,
      }));
    },

    openInNewTab(): void {
      const state = get({ subscribe });
      if (state.currentImageUrl) {
        window.open(state.currentImageUrl, '_blank', 'noopener,noreferrer');
      }
    },

    async saveImage(): Promise<void> {
      const state = get({ subscribe });
      if (!state.currentImageUrl) return;

      try {
        const response = await fetch(state.currentImageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `unity-generated-${Date.now()}.png`;
        link.click();

        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to save image:', error);
        update(s => ({ ...s, error: 'Failed to save image' }));
      }
    },

    async copyToClipboard(): Promise<void> {
      const state = get({ subscribe });
      if (!state.currentImageUrl) return;

      try {
        const response = await fetch(state.currentImageUrl);
        const blob = await response.blob();

        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
      } catch (error) {
        console.error('Failed to copy image:', error);
        update(s => ({ ...s, error: 'Failed to copy image to clipboard' }));
      }
    },

    clearError(): void {
      update(state => ({ ...state, error: null }));
    },
  };
}

// Helper to get current state
function get<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T {
  let value: T = null as T;
  const unsubscribe = store.subscribe(v => value = v);
  unsubscribe();
  return value;
}

export const imageStore = createImageStore();
