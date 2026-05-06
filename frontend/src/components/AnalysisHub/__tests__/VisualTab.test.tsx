// frontend/src/components/AnalysisHub/__tests__/VisualTab.test.tsx
//
// Smoke tests pour le tab "Visuel" de l'AnalysisHub. Couvre :
//   - Empty state quand visualAnalysis est null/undefined.
//   - Rendu complet avec un payload Mistral Vision typique.
//   - Format MM:SS / H:MM:SS pour les timestamps.
//   - Indicateurs SEO (qualitatifs + booléens) avec valeurs absentes.
//
// Pas de mock — le composant est pur (props in / DOM out), pas d'API.

import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { VisualTab } from "../VisualTab";
import type { VisualAnalysis } from "../../../types/analysis";

const fullPayload: VisualAnalysis = {
  visual_hook:
    "Ouverture sur un gros plan du présentateur avec un titre rouge incrusté.",
  visual_structure: "talking_head",
  key_moments: [
    {
      timestamp_s: 0,
      description: "Title card avec le sujet de la vidéo",
      type: "title_card",
    },
    {
      timestamp_s: 95,
      description: "Insertion d'une infographie animée",
      type: "infographic",
    },
    {
      timestamp_s: 3725,
      description: "CTA d'abonnement en fin de vidéo",
      type: "cta",
    },
  ],
  visible_text: "Abonnez-vous • Lien en description",
  visual_seo_indicators: {
    hook_brightness: "high",
    face_visible_in_hook: true,
    burned_in_subtitles: false,
    high_motion_intro: false,
    thumbnail_quality_proxy: "medium",
  },
  summary_visual:
    "La vidéo alterne talking head et b-roll avec des incrustations textuelles fréquentes.",
  model_used: "pixtral-12b-2409",
  frames_analyzed: 24,
  frames_downsampled: false,
};

describe("VisualTab", () => {
  afterEach(() => cleanup());

  it("affiche un empty state quand visualAnalysis est null", () => {
    render(<VisualTab visualAnalysis={null} language="fr" />);
    expect(
      screen.getByText(/Analyse visuelle non disponible/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Réanalyser avec le visuel/i),
    ).toBeInTheDocument();
  });

  it("affiche un empty state quand visualAnalysis est undefined", () => {
    render(<VisualTab visualAnalysis={undefined} language="fr" />);
    expect(
      screen.getByText(/Analyse visuelle non disponible/i),
    ).toBeInTheDocument();
  });

  it("rend le hook visuel et la structure", () => {
    render(<VisualTab visualAnalysis={fullPayload} language="fr" />);
    expect(screen.getByText(fullPayload.visual_hook)).toBeInTheDocument();
    // talking_head → "Talking head" (label FR)
    expect(screen.getByText("Talking head")).toBeInTheDocument();
  });

  it("formate les timestamps en MM:SS et H:MM:SS", () => {
    render(<VisualTab visualAnalysis={fullPayload} language="fr" />);
    // 0s → "00:00"
    expect(screen.getByText("00:00")).toBeInTheDocument();
    // 95s → "01:35"
    expect(screen.getByText("01:35")).toBeInTheDocument();
    // 3725s → "1:02:05"
    expect(screen.getByText("1:02:05")).toBeInTheDocument();
  });

  it("affiche les descriptions des moments clés", () => {
    render(<VisualTab visualAnalysis={fullPayload} language="fr" />);
    expect(
      screen.getByText("Title card avec le sujet de la vidéo"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Insertion d'une infographie animée"),
    ).toBeInTheDocument();
  });

  it("affiche le texte visible quand présent", () => {
    render(<VisualTab visualAnalysis={fullPayload} language="fr" />);
    expect(
      screen.getByText("Abonnez-vous • Lien en description"),
    ).toBeInTheDocument();
  });

  it("affiche un message italique quand visible_text est vide", () => {
    const noText: VisualAnalysis = { ...fullPayload, visible_text: "" };
    render(<VisualTab visualAnalysis={noText} language="fr" />);
    expect(screen.getByText(/Aucun texte détecté/i)).toBeInTheDocument();
  });

  it("affiche les indicateurs SEO en français", () => {
    render(<VisualTab visualAnalysis={fullPayload} language="fr" />);
    expect(screen.getByText(/Luminosité du hook/i)).toBeInTheDocument();
    expect(screen.getByText(/Visage dans le hook/i)).toBeInTheDocument();
  });

  it("affiche des badges Oui/Non pour les indicateurs booléens", () => {
    render(<VisualTab visualAnalysis={fullPayload} language="fr" />);
    // face_visible_in_hook = true → au moins un "Oui"
    expect(screen.getAllByText("Oui").length).toBeGreaterThan(0);
    // burned_in_subtitles = false → au moins un "Non"
    expect(screen.getAllByText("Non").length).toBeGreaterThan(0);
  });

  it("affiche le résumé visuel et les métadonnées model_used / frames_analyzed", () => {
    render(<VisualTab visualAnalysis={fullPayload} language="fr" />);
    expect(screen.getByText(fullPayload.summary_visual)).toBeInTheDocument();
    expect(screen.getByText(fullPayload.model_used)).toBeInTheDocument();
    expect(
      screen.getByText(String(fullPayload.frames_analyzed)),
    ).toBeInTheDocument();
  });

  it("affiche le badge 'Échantillonné' quand frames_downsampled=true", () => {
    const downsampled: VisualAnalysis = {
      ...fullPayload,
      frames_downsampled: true,
    };
    render(<VisualTab visualAnalysis={downsampled} language="fr" />);
    expect(screen.getByText(/Échantillonné/i)).toBeInTheDocument();
  });

  it("rend en anglais quand language='en'", () => {
    render(<VisualTab visualAnalysis={fullPayload} language="en" />);
    expect(screen.getByText(/Visual hook/i)).toBeInTheDocument();
    expect(screen.getByText(/Key moments/i)).toBeInTheDocument();
    expect(screen.getByText(/On-screen text/i)).toBeInTheDocument();
  });

  it("affiche un dash pour les indicateurs absents", () => {
    const partial: VisualAnalysis = {
      ...fullPayload,
      visual_seo_indicators: {
        hook_brightness: "high",
        // les autres champs absents
      },
    };
    render(<VisualTab visualAnalysis={partial} language="fr" />);
    // Présence d'au moins un "—" pour les indicateurs absents
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
