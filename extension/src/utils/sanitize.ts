/**
 * Escapes HTML special characters to prevent XSS.
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Converts basic markdown-like syntax to safe HTML.
 * Only handles bold, italic, and newlines.
 * The input MUST be escaped first with escapeHtml.
 */
export function markdownToSafeHtml(escaped: string): string {
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

/**
 * Converts full markdown to safe HTML for detailed view rendering.
 * Handles headings, lists, bold, italic, code, blockquotes, and horizontal rules.
 * The input MUST be escaped first with escapeHtml.
 */
export function markdownToFullHtml(escaped: string): string {
  const lines = escaped.split('\n');
  const htmlLines: string[] = [];
  let inList = false;
  let inOrderedList = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Horizontal rule
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      if (inOrderedList) { htmlLines.push('</ol>'); inOrderedList = false; }
      htmlLines.push('<hr class="ds-md-hr">');
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      if (inOrderedList) { htmlLines.push('</ol>'); inOrderedList = false; }
      const level = headingMatch[1].length;
      const text = inlineFormat(headingMatch[2]);
      htmlLines.push(`<h${level} class="ds-md-h${level}">${text}</h${level}>`);
      continue;
    }

    // Blockquote
    if (line.startsWith('&gt; ') || line === '&gt;') {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      if (inOrderedList) { htmlLines.push('</ol>'); inOrderedList = false; }
      const text = inlineFormat(line.replace(/^&gt;\s?/, ''));
      htmlLines.push(`<blockquote class="ds-md-blockquote">${text}</blockquote>`);
      continue;
    }

    // Unordered list item
    const ulMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (ulMatch) {
      if (inOrderedList) { htmlLines.push('</ol>'); inOrderedList = false; }
      if (!inList) { htmlLines.push('<ul class="ds-md-ul">'); inList = true; }
      htmlLines.push(`<li>${inlineFormat(ulMatch[2])}</li>`);
      continue;
    }

    // Ordered list item
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inList) { htmlLines.push('</ul>'); inList = false; }
      if (!inOrderedList) { htmlLines.push('<ol class="ds-md-ol">'); inOrderedList = true; }
      htmlLines.push(`<li>${inlineFormat(olMatch[2])}</li>`);
      continue;
    }

    // Close open lists on non-list lines
    if (inList) { htmlLines.push('</ul>'); inList = false; }
    if (inOrderedList) { htmlLines.push('</ol>'); inOrderedList = false; }

    // Empty line = paragraph break
    if (line.trim() === '') {
      htmlLines.push('<div class="ds-md-spacer"></div>');
      continue;
    }

    // Regular paragraph
    htmlLines.push(`<p class="ds-md-p">${inlineFormat(line)}</p>`);
  }

  if (inList) htmlLines.push('</ul>');
  if (inOrderedList) htmlLines.push('</ol>');

  return htmlLines.join('\n');
}

/** Inline formatting: bold, italic, inline code, links */
function inlineFormat(text: string): string {
  return text
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="ds-md-code">$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Epistemic markers highlighting
    .replace(/\b(SOLIDE|SOLID)\b/g, '<span class="ds-marker ds-marker-solid">$1</span>')
    .replace(/\b(PLAUSIBLE)\b/g, '<span class="ds-marker ds-marker-plausible">$1</span>')
    .replace(/\b(INCERTAIN|UNCERTAIN)\b/g, '<span class="ds-marker ds-marker-uncertain">$1</span>')
    .replace(/\b(A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK)\b/g, '<span class="ds-marker ds-marker-weak">$1</span>');
}

// ── Analysis Summary Parser ──

export interface AnalysisSummary {
  verdict: string;
  keyPoints: KeyPoint[];
  tags: string[];
}

export interface KeyPoint {
  type: 'solid' | 'weak' | 'insight';
  text: string;
}

/**
 * Parses markdown analysis content into structured summary data.
 * Extracts verdict, key points by epistemic marker, and thematic tags.
 */
export function parseAnalysisToSummary(markdown: string): AnalysisSummary {
  const verdict = extractVerdict(markdown);
  const keyPoints = extractKeyPoints(markdown);
  const tags = extractTags(markdown);

  return { verdict, keyPoints, tags };
}

/** Extract verdict from Conclusion section or last substantial paragraph */
function extractVerdict(md: string): string {
  // Try to find a Conclusion/Verdict/Summary section
  const conclusionPatterns = [
    /#+\s*(?:Conclusion|Verdict|Synthèse|Résumé|Summary|En résumé|Final Assessment|Overall Assessment)[^\n]*\n([\s\S]*?)(?=\n#|\n---|\n\*{3,}|$)/i,
    /\*\*(?:Conclusion|Verdict|Synthèse|En résumé|Summary)\*\*[:\s]*([\s\S]*?)(?=\n\n|\n#|\n---|\n\*{3,}|$)/i,
  ];

  for (const pattern of conclusionPatterns) {
    const match = md.match(pattern);
    if (match && match[1]) {
      const text = cleanMarkdownText(match[1]).trim();
      if (text.length > 20) {
        return truncateText(text, 200);
      }
    }
  }

  // Fallback: take the last non-empty paragraph that isn't a heading or list
  const paragraphs = md.split(/\n\n+/).filter(p => {
    const trimmed = p.trim();
    return trimmed.length > 30 && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('*');
  });

  if (paragraphs.length > 0) {
    const last = cleanMarkdownText(paragraphs[paragraphs.length - 1]);
    return truncateText(last, 200);
  }

  return 'Analysis complete. See detailed view for full results.';
}

/** Extract key points from epistemic markers */
function extractKeyPoints(md: string): KeyPoint[] {
  const points: KeyPoint[] = [];
  const lines = md.split('\n');

  // Patterns for epistemic markers
  const solidPatterns = [/\b(?:SOLIDE|SOLID)\b/i, /\u2705\s*\*\*/, /\u2705/];
  const weakPatterns = [/\b(?:A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK|INCERTAIN|UNCERTAIN)\b/i, /\u26A0\uFE0F\s*\*\*/, /\u2753/, /\u26A0/];
  const insightPatterns = [/\b(?:PLAUSIBLE)\b/i, /\uD83D\uDCA1/];

  for (const line of lines) {
    const trimmed = line.replace(/^[\s\-*]+/, '').trim();
    if (trimmed.length < 10) continue;

    let type: KeyPoint['type'] | null = null;

    if (solidPatterns.some(p => p.test(line))) {
      type = 'solid';
    } else if (weakPatterns.some(p => p.test(line))) {
      type = 'weak';
    } else if (insightPatterns.some(p => p.test(line))) {
      type = 'insight';
    }

    if (type && points.filter(p => p.type === type).length < 2) {
      const cleanText = cleanMarkdownText(trimmed)
        .replace(/\b(?:SOLIDE|SOLID|PLAUSIBLE|INCERTAIN|UNCERTAIN|A VERIFIER|TO VERIFY|QUESTIONABLE|WEAK)\b\s*[:—\-–]?\s*/gi, '')
        .replace(/^[✅⚠️❓💡🔍🔬]\s*/u, '')
        .trim();

      if (cleanText.length > 10) {
        points.push({ type, text: truncateText(cleanText, 120) });
      }
    }

    if (points.length >= 4) break;
  }

  // If we found fewer than 2 points, try extracting from list items in key sections
  if (points.length < 2) {
    const sectionPattern = /#+\s*(?:Points?\s+(?:forts?|clés?|faibles?)|Key\s+(?:Points?|Findings?|Takeaways?)|Strengths?|Weaknesses?|Main\s+Points?)[^\n]*\n([\s\S]*?)(?=\n#|$)/gi;
    let sectionMatch;
    while ((sectionMatch = sectionPattern.exec(md)) !== null && points.length < 4) {
      const sectionContent = sectionMatch[1];
      const items = sectionContent.match(/^[\s]*[-*]\s+(.+)$/gm);
      if (items) {
        for (const item of items.slice(0, 4 - points.length)) {
          const text = cleanMarkdownText(item.replace(/^[\s]*[-*]\s+/, ''));
          if (text.length > 10 && !points.some(p => p.text === truncateText(text, 120))) {
            points.push({ type: 'insight', text: truncateText(text, 120) });
          }
        }
      }
    }
  }

  return points.slice(0, 4);
}

/** Extract thematic tags from the content */
function extractTags(md: string): string[] {
  const tags: string[] = [];

  // Look for explicit tags/themes section
  const tagsMatch = md.match(/#+\s*(?:Tags?|Thèmes?|Themes?|Topics?|Catégories?|Categories?)[^\n]*\n([\s\S]*?)(?=\n#|$)/i);
  if (tagsMatch) {
    const tagItems = tagsMatch[1].match(/[-*]\s+(.+)/g);
    if (tagItems) {
      for (const item of tagItems.slice(0, 3)) {
        const text = cleanMarkdownText(item.replace(/^[-*]\s+/, '')).trim();
        if (text.length > 0 && text.length < 30) {
          tags.push(text);
        }
      }
    }
  }

  // Fallback: extract from headings if no explicit tags found
  if (tags.length === 0) {
    const headings = md.match(/^#{2,3}\s+(.+)$/gm);
    if (headings) {
      const skipWords = /^(?:Conclusion|Summary|Résumé|Synthèse|Introduction|Verdict|Analysis|Points?\s+(?:clés?|forts?|faibles?)|Key\s+(?:Points?|Findings?)|Strengths?|Weaknesses?|Overview)/i;
      for (const h of headings) {
        const text = cleanMarkdownText(h.replace(/^#{2,3}\s+/, '')).trim();
        if (text.length > 2 && text.length < 35 && !skipWords.test(text)) {
          tags.push(text);
          if (tags.length >= 3) break;
        }
      }
    }
  }

  return tags.slice(0, 3);
}

/** Remove markdown formatting characters */
function cleanMarkdownText(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
}

/** Truncate text at word boundary */
function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.6 ? truncated.substring(0, lastSpace) : truncated) + '...';
}
