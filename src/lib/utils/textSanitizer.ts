/**
 * Text Sanitization Utilities
 * Clean text for speech synthesis and display
 */

/**
 * Check if a segment looks like a URL
 */
function isLikelyUrlSegment(segment: string): boolean {
  if (!segment || typeof segment !== 'string') return false;

  const cleaned = segment.trim().replace(/[.,;!?'"]+$/, '');
  if (cleaned.length === 0) return false;

  const normalized = cleaned.toLowerCase();

  // Check for common URL patterns
  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('www.') ||
    normalized.includes('://') ||
    /\.[a-z]{2,}(\/|$)/i.test(normalized)
  ) {
    return true;
  }

  return false;
}

/**
 * Remove markdown link targets
 */
function removeMarkdownLinkTargets(value: string): string {
  if (!value) return '';
  return value.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/**
 * Remove command artifacts from text
 */
function removeCommandArtifacts(value: string): string {
  if (!value) return '';

  const patterns = [
    /(?:^|\n)\s*(?:commands?|actions?)\s*:?\s*\n(?:\s*[-*•]?\s*[a-z0-9_\-]+\s*(?:\(\))?\s*\n?)+/gi,
    /(?:^|\s)\/\s*(?:open_image|save_image|copy_image|mute_microphone|unmute_microphone|stop_speaking|shutup|set_model_\w+|clear_chat_history|theme_\w+)\b/gi,
  ];

  let sanitized = value;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, '');
  }

  return sanitized.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Sanitize text for speech synthesis
 */
export function sanitizeForSpeech(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // Remove Pollinations URLs
  let sanitized = text.replace(/https?:\/\/[^\s]*pollinations\.ai[^\s]*/gi, '');

  // Remove markdown targets and commands
  sanitized = removeMarkdownLinkTargets(sanitized);
  sanitized = removeCommandArtifacts(sanitized);

  // Split by whitespace and filter out URLs
  const parts = sanitized.split(/(\s+)/);
  const sanitizedParts = parts.map((part) => {
    if (/^\s+$/.test(part)) return part;
    return isLikelyUrlSegment(part) ? '' : part;
  });

  // Join and clean up spacing
  sanitized = sanitizedParts.join('').replace(/\s{2,}/g, ' ').trim();

  // Remove empty markdown links
  sanitized = sanitized.replace(/\[\s*\]/g, '');

  // Normalize whitespace
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  return sanitized;
}

/**
 * Clean fallback image prompt
 */
export function cleanFallbackPrompt(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(/[<>]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Sanitize image URL
 */
export function sanitizeImageUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';

  let url = rawUrl.trim();

  // Remove markdown syntax
  url = url.replace(/^!\[.*?\]\(/, '').replace(/\)$/, '');

  // Ensure proper encoding
  try {
    const parsed = new URL(url);
    return parsed.toString();
  } catch {
    return url;
  }
}
