/**
 * HighlightedText — Wrapper Text qui surligne les passages matchés.
 *
 * Approche V1 mobile : on prend les `WithinMatchItem` du provider et on cherche
 * une présence du `text` (passage) dans le children. Si trouvé, on split et
 * on rend la portion en jaune avec onPress → ouvre PassageActionSheet.
 *
 * Limitations connues V1 :
 *   - Match exact uniquement (pas de fuzzy)
 *   - Si plusieurs occurrences du même text, seule la 1ère est highlightée
 *   Trade-off acceptable mobile (medium tier).
 */

import React, { useCallback } from "react";
import { Text, type TextProps } from "react-native";
import { palette } from "@/theme/colors";
import { useSemanticHighlighter } from "./SemanticHighlighter";
import type { WithinMatchItem } from "@/services/api";

interface HighlightedTextProps extends TextProps {
  children: string;
  tab: WithinMatchItem["tab"];
  onTapMatch?: (match: WithinMatchItem) => void;
}

export const HighlightedText: React.FC<HighlightedTextProps> = ({
  children,
  tab,
  onTapMatch,
  style,
  ...rest
}) => {
  const ctx = useSemanticHighlighter();

  const handleTap = useCallback(
    (m: WithinMatchItem) => {
      ctx?.setActivePassageId(m.passage_id);
      onTapMatch?.(m);
    },
    [ctx, onTapMatch],
  );

  if (!ctx || ctx.matches.length === 0) {
    return (
      <Text style={style} {...rest}>
        {children}
      </Text>
    );
  }

  // Filtrer par tab
  const tabMatches = ctx.matches.filter((m) => m.tab === tab);
  if (tabMatches.length === 0) {
    return (
      <Text style={style} {...rest}>
        {children}
      </Text>
    );
  }

  // Construire les segments en cherchant chaque `m.text` dans children.
  // Approche naïve : on consomme le texte sur le 1er match trouvé pour chaque
  // entrée des tabMatches. V1.1 : multi-match overlap detection.
  let remaining = children;
  const segments: Array<{ text: string; match: WithinMatchItem | null }> = [];

  for (const m of tabMatches) {
    if (!m.text) continue;
    const idx = remaining.indexOf(m.text);
    if (idx === -1) continue;
    if (idx > 0) segments.push({ text: remaining.slice(0, idx), match: null });
    segments.push({ text: m.text, match: m });
    remaining = remaining.slice(idx + m.text.length);
  }
  if (remaining) segments.push({ text: remaining, match: null });

  if (segments.length === 0 || segments.every((s) => !s.match)) {
    return (
      <Text style={style} {...rest}>
        {children}
      </Text>
    );
  }

  return (
    <Text style={style} {...rest}>
      {segments.map((seg, i) =>
        seg.match ? (
          <Text
            key={`m-${i}-${seg.match.passage_id}`}
            onPress={() => seg.match && handleTap(seg.match)}
            style={{
              backgroundColor:
                ctx.activePassageId === seg.match.passage_id
                  ? palette.gold + "60"
                  : palette.gold + "35",
              color: palette.gold,
            }}
            accessibilityRole="button"
            accessibilityLabel={`Passage correspondant : ${seg.match.text.slice(0, 60)}`}
          >
            {seg.text}
          </Text>
        ) : (
          <Text key={`p-${i}`}>{seg.text}</Text>
        ),
      )}
    </Text>
  );
};
