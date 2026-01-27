/**
 * Input Sanitization Utilities
 *
 * Client-side sanitization for display purposes and basic security.
 * Backend should still validate all inputs.
 */

// HTML entity encoding for XSS prevention
const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML entities to prevent XSS when rendering text
 */
export const escapeHtml = (text: string): string => {
  if (!text) return '';
  return text.replace(/[&<>"'`=/]/g, (char) => htmlEntities[char] || char);
};

/**
 * Sanitize user text input
 * - Removes control characters
 * - Trims whitespace
 * - Normalizes Unicode
 */
export const sanitizeTextInput = (input: string): string => {
  if (!input) return '';

  return input
    // Normalize Unicode (NFC form)
    .normalize('NFC')
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Trim leading/trailing whitespace
    .trim();
};

/**
 * Sanitize URL input
 * - Trims whitespace
 * - Removes dangerous protocols
 */
export const sanitizeUrlInput = (url: string): string => {
  if (!url) return '';

  const trimmed = url.trim();

  // Block javascript:, data:, vbscript: protocols
  const dangerousProtocols = /^(javascript|data|vbscript):/i;
  if (dangerousProtocols.test(trimmed)) {
    return '';
  }

  return trimmed;
};

/**
 * Sanitize search query
 * - Removes potentially dangerous characters
 * - Limits length
 */
export const sanitizeSearchQuery = (query: string, maxLength: number = 500): string => {
  if (!query) return '';

  return query
    .normalize('NFC')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Trim
    .trim()
    // Limit length
    .substring(0, maxLength);
};

/**
 * Check if text contains potential XSS patterns
 */
export const containsXSSPatterns = (text: string): boolean => {
  if (!text) return false;

  const xssPatterns = [
    /<script\b/i,
    /javascript:/i,
    /on\w+\s*=/i, // onclick=, onerror=, etc.
    /data:\s*text\/html/i,
  ];

  return xssPatterns.some((pattern) => pattern.test(text));
};

export default {
  escapeHtml,
  sanitizeTextInput,
  sanitizeUrlInput,
  sanitizeSearchQuery,
  containsXSSPatterns,
};
