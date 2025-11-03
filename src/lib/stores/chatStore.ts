/**
 * Chat Store
 * Reactive state for AI chat history and interactions
 */

import { writable } from 'svelte/store';
import { aiService, type ChatMessage, type ImageModel } from '../services/aiService';
import { voiceStore } from './voiceStore';
import { imageStore } from './imageStore';
import type { AICommand } from '../utils/commandParser';

export interface ChatStoreState {
  messages: ChatMessage[];
  isProcessing: boolean;
  error: string | null;
  systemPrompt: string;
  currentModel: ImageModel;
}

function createChatStore() {
  const { subscribe, update } = writable<ChatStoreState>({
    messages: [],
    isProcessing: false,
    error: null,
    systemPrompt: '',
    currentModel: 'flux',
  });

  return {
    subscribe,

    async loadSystemPrompt(): Promise<void> {
      try {
        const response = await fetch('/ai-instruct.txt');
        if (!response.ok) throw new Error('Failed to load system prompt');

        const systemPrompt = await response.text();
        aiService.setSystemPrompt(systemPrompt);

        update(state => ({ ...state, systemPrompt }));
      } catch (error) {
        console.error('Failed to load system prompt:', error);
        update(state => ({ ...state, error: 'Failed to load AI instructions' }));
      }
    },

    async sendMessage(userInput: string): Promise<void> {
      if (!userInput.trim()) return;

      update(state => ({ ...state, isProcessing: true, error: null }));

      try {
        const response = await aiService.getResponse(userInput);

        // Update chat history
        update(state => ({
          ...state,
          messages: aiService.getChatHistory(),
          isProcessing: false,
        }));

        // Handle image if present
        if (response.imageUrl) {
          imageStore.setImage(response.imageUrl);
        }

        // Execute commands
        await this.executeCommands(response.commands);

        // Speak response (unless suppressed by commands)
        const shouldSuppressSpeech = response.commands.includes('shutup') || response.commands.includes('stop_speaking');
        if (!shouldSuppressSpeech && response.text) {
          voiceStore.speak(response.text);
        }

      } catch (error) {
        console.error('Chat error:', error);
        update(state => ({
          ...state,
          isProcessing: false,
          error: error instanceof Error ? error.message : 'Failed to get AI response',
        }));
      }
    },

    async executeCommands(commands: AICommand[]): Promise<void> {
      for (const command of commands) {
        switch (command) {
          case 'mute_microphone':
            voiceStore.mute();
            break;

          case 'unmute_microphone':
            await voiceStore.unmute();
            break;

          case 'stop_speaking':
          case 'shutup':
            voiceStore.stopSpeaking();
            break;

          case 'open_image':
            imageStore.openInNewTab();
            break;

          case 'save_image':
            await imageStore.saveImage();
            break;

          case 'copy_image':
            await imageStore.copyToClipboard();
            break;

          case 'set_model_flux':
            this.setImageModel('flux');
            break;

          case 'set_model_turbo':
            this.setImageModel('turbo');
            break;

          case 'set_model_kontext':
            this.setImageModel('kontext');
            break;

          case 'clear_chat_history':
            this.clearHistory();
            break;

          case 'theme_light':
            document.body.setAttribute('data-theme', 'light');
            break;

          case 'theme_dark':
            document.body.setAttribute('data-theme', 'dark');
            break;
        }
      }
    },

    setImageModel(model: ImageModel): void {
      aiService.setImageModel(model);
      update(state => ({ ...state, currentModel: model }));
    },

    clearHistory(): void {
      aiService.clearChatHistory();
      update(state => ({ ...state, messages: [] }));
    },

    clearError(): void {
      update(state => ({ ...state, error: null }));
    },
  };
}

export const chatStore = createChatStore();
