/**
 * Command Parser
 * Extract and parse AI commands from response text
 */

export type AICommand =
  | 'open_image'
  | 'save_image'
  | 'copy_image'
  | 'mute_microphone'
  | 'unmute_microphone'
  | 'stop_speaking'
  | 'shutup'
  | 'set_model_flux'
  | 'set_model_turbo'
  | 'set_model_kontext'
  | 'clear_chat_history'
  | 'theme_light'
  | 'theme_dark';

function normalizeCommandValue(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

/**
 * Parse AI directives from response text
 */
export function parseAiDirectives(responseText: string): {
  cleanedText: string;
  commands: AICommand[];
} {
  if (!responseText) {
    return { cleanedText: '', commands: [] };
  }

  let workingText = responseText;
  const commands: string[] = [];

  // Pattern 1: Backtick commands (e.g., `save_image`)
  const backtickRegex = /`([a-z0-9_\-]+)`/gi;
  let match;
  while ((match = backtickRegex.exec(responseText)) !== null) {
    const commandValue = match[1];
    if (commandValue) {
      const normalized = normalizeCommandValue(commandValue);
      if (normalized) {
        commands.push(normalized);
        workingText = workingText.replace(match[0], '');
      }
    }
  }

  // Pattern 2: Slash commands (e.g., / open_image)
  const slashCommandRegex =
    /(?:^|\s)\/ (open_image|save_image|copy_image|mute_microphone|unmute_microphone|stop_speaking|shutup|set_model_flux|set_model_turbo|set_model_kontext|clear_chat_history|theme_light|theme_dark)\b/gi;
  while ((match = slashCommandRegex.exec(responseText)) !== null) {
    const commandValue = match[1];
    if (commandValue) {
      const normalized = normalizeCommandValue(commandValue);
      commands.push(normalized);
      workingText = workingText.replace(match[0], '');
    }
  }

  // Pattern 3: Directive blocks (e.g., Commands: - save_image - open_image)
  const directiveBlockRegex =
    /(?:^|\n)\s*(?:commands?|actions?)\s*:?\s*(?:\n|$ )((?:\s*[-*•]?\s*[a-z0-9_\-]+\s*(?:\(\))?\s*(?:\n|$))+)/gi;
  while ((match = directiveBlockRegex.exec(responseText)) !== null) {
    const block = match[1];
    if (block) {
      const lines = block.split(/\n/).filter((line) => line.trim());
      for (const line of lines) {
        const trimmed = line.trim().replace(/^[-*•]\s*/, '');
        if (trimmed) {
          const normalized = normalizeCommandValue(trimmed.replace(/\(\)/g, ''));
          if (normalized) {
            commands.push(normalized);
          }
        }
      }
      workingText = workingText.replace(match[0], '');
    }
  }

  // Clean up the text
  const cleanedText = workingText.replace(/\n{3,}/g, '\n\n').trim();
  const uniqueCommands = [...new Set(commands)] as AICommand[];

  return { cleanedText, commands: uniqueCommands };
}

/**
 * Extract image URL from text
 */
export function extractImageUrl(text: string): string | null {
  if (!text || typeof text !== 'string') return null;

  // Try markdown image syntax first
  const markdownMatch = text.match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch?.[1]) {
    return markdownMatch[1];
  }

  // Try plain URL
  const urlMatch = text.match(/https?:\/\/[^)\s]+/i);
  if (urlMatch?.[0]) {
    return urlMatch[0];
  }

  return null;
}

/**
 * Remove image references from text
 */
export function removeImageReferences(text: string, imageUrl: string): string {
  if (!text || !imageUrl) return text;

  const escapedUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Remove markdown images
  let cleaned = text.replace(new RegExp(`!\\[[^\\]]*\\]\\(${escapedUrl}\\)`, 'gi'), '');

  // Remove markdown links
  cleaned = cleaned.replace(new RegExp(`\\[[^\\]]*\\]\\(${escapedUrl}\\)`, 'gi'), '');

  // Remove raw URLs
  cleaned = cleaned.replace(new RegExp(escapedUrl, 'gi'), '');

  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}
