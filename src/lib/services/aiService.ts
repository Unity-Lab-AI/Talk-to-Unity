/**
 * AI Service
 * Handles communication with Pollinations AI API
 */

import { parseAiDirectives, extractImageUrl, removeImageReferences, type AICommand } from '../utils/commandParser';
import { cleanFallbackPrompt } from '../utils/textSanitizer';

const POLLINATIONS_TEXT_URL = 'https://text.pollinations.ai/openai';
const POLLINATIONS_IMAGE_URL = 'https://image.pollinations.ai/prompt';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  text: string;
  imageUrl: string | null;
  commands: AICommand[];
}

export type ImageModel = 'flux' | 'turbo' | 'kontext';

export class AIService {
  private chatHistory: ChatMessage[] = [];
  private systemPrompt: string = '';
  private currentImageModel: ImageModel = 'flux';

  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  clearChatHistory(): void {
    this.chatHistory = [];
  }

  setImageModel(model: ImageModel): void {
    this.currentImageModel = model;
  }

  getImageModel(): ImageModel {
    return this.currentImageModel;
  }

  async getResponse(userInput: string): Promise<AIResponse> {
    // Add user message to history
    this.chatHistory.push({
      role: 'user',
      content: userInput,
    });

    // Build messages array
    const messages: ChatMessage[] = [];

    if (this.systemPrompt) {
      messages.push({
        role: 'system',
        content: this.systemPrompt,
      });
    }

    messages.push(...this.chatHistory);

    try {
      // Call Pollinations text API
      const response = await fetch(POLLINATIONS_TEXT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          model: 'openai',
          seed: Date.now(),
        }),
      });

      if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
      }

      const data = await response.json();
      const aiText = data?.choices?.[0]?.message?.content || data?.message?.content || '';

      // Parse commands and clean text
      const { cleanedText, commands } = parseAiDirectives(aiText);

      // Extract image URL if present
      let imageUrl = extractImageUrl(aiText);

      // Remove image references from the text
      let finalText = cleanedText;
      if (imageUrl) {
        finalText = removeImageReferences(cleanedText, imageUrl);
      }

      // Check if we should generate a fallback image
      if (!imageUrl && this.shouldGenerateImage(userInput, finalText)) {
        imageUrl = this.buildImageUrl(this.buildImagePrompt(userInput, finalText));
      }

      // Add assistant message to history
      this.chatHistory.push({
        role: 'assistant',
        content: finalText,
      });

      return {
        text: finalText,
        imageUrl: imageUrl ? this.cutImageUrl(imageUrl) : null,
        commands,
      };
    } catch (error) {
      console.error('AI service error:', error);
      throw error;
    }
  }

  private shouldGenerateImage(userInput: string, assistantMessage: string): boolean {
    const combined = `${userInput} ${assistantMessage}`.toLowerCase();

    // Image request keywords
    const keywords = [
      'image', 'picture', 'photo', 'visual', 'illustration', 'draw', 'create',
      'generate', 'show me', 'display', 'render', 'depict', 'portray',
    ];

    return keywords.some((keyword) => combined.includes(keyword));
  }

  private buildImagePrompt(userInput: string, assistantMessage: string): string {
    const source = `${userInput} ${assistantMessage}`;

    // Look for explicit prompt
    const explicitMatch = source.match(/(?:image\s+prompt|prompt)\s*[:=]\s*"?([^"\n]+)"?/i);
    if (explicitMatch?.[1]) {
      return cleanFallbackPrompt(explicitMatch[1]);
    }

    // Extract descriptive content
    const cleaned = cleanFallbackPrompt(
      source
        .replace(/(?:here\s+(?:is|'s)|displaying|showing)\s+(?:an?\s+)?(?:image|picture|photo)/gi, '')
        .replace(/(?:image|picture|photo)\s+of\s+/gi, '')
    );

    return cleaned || 'abstract digital art';
  }

  buildImageUrl(prompt: string, model?: ImageModel): string {
    const imageModel = model || this.currentImageModel;
    const sanitized = cleanFallbackPrompt(prompt);

    const params = new URLSearchParams({
      model: imageModel,
      width: '1024',
      height: '1024',
      seed: String(Date.now()),
      nologo: 'true',
    });

    const encodedPrompt = encodeURIComponent(sanitized);
    return `${POLLINATIONS_IMAGE_URL}/${encodedPrompt}?${params.toString()}`;
  }

  private cutImageUrl(url: string): string {
    if (!url) return '';
    // Remove query parameters for cleaner URLs
    const parts = url.split('?');
    return parts[0] || url;
  }
}

// Singleton instance
export const aiService = new AIService();
