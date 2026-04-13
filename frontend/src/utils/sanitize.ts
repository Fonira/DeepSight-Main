/**
 * DEEP SIGHT — Sanitization utilities
 * Strip HTML/SVG tags and XSS payloads from user-generated content (video titles, channels, etc.)
 */

/**
 * Supprime les balises HTML/SVG et les attributs d'événement JavaScript
 * des chaînes de texte (titres vidéo, noms de chaînes, etc.)
 * React échappe automatiquement le JSX mais les titres bruts restent visuellement laids.
 */
export function sanitizeTitle(title: string): string {
  if (!title) return title;

  return (
    title
      // Supprime toutes les balises HTML/SVG (ouvrantes, fermantes, auto-fermantes)
      .replace(/<\/?[^>]+(>|$)/g, "")
      // Supprime les patterns d'événements JS courants (même sans balises)
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, "")
      // Supprime les attributs style inline
      .replace(/style\s*=\s*["'][^"']*["']/gi, "")
      // Supprime javascript: URLs
      .replace(/javascript\s*:/gi, "")
      // Normalise les espaces multiples
      .replace(/\s{2,}/g, " ")
      .trim()
  );
}
