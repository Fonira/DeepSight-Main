// frontend/src/components/hub/__tests__/HubWorkspaceCanvas.test.tsx
//
// Tests pivot 2026-05-06 : Hub Workspace canvas natif (DebateConvergenceDivergence-inspired).
//
// Couverture :
//   1. canvasData null → fallback MiroBoardEmbed (rétro-compat workspaces pré-pivot)
//   2. canvasData null + status=creating → MiroBoardEmbed skeleton
//   3. canvasData présent + status=ready → 2 sections natives rendues
//   4. shared_concepts vide mais themes présents → seule la section themes rendue
//   5. canvasData empty → empty state
//   6. summaryDetails fournis → titres et thumbnails affichés dans perspectives
//   7. summaryDetails manquants → fallback "Analyse #{id}"

import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { HubWorkspaceCanvas } from "../HubWorkspaceCanvas";
import type { WorkspaceCanvasData } from "../../../services/api";

const VALID_CANVAS: WorkspaceCanvasData = {
  shared_concepts: ["IA française", "Souveraineté donnée"],
  themes: [
    {
      theme: "Confidentialité",
      perspectives: [
        { summary_id: 1, excerpt: "La vidéo 1 insiste sur le RGPD." },
        { summary_id: 2, excerpt: "La vidéo 2 nuance l'argument RGPD." },
      ],
    },
    {
      theme: "Performance",
      perspectives: [
        { summary_id: 1, excerpt: "Vidéo 1 : Mistral est plus rapide." },
        { summary_id: 2, excerpt: "Vidéo 2 : OpenAI conserve l'avance." },
      ],
    },
  ],
};

describe("HubWorkspaceCanvas", () => {
  it("falls back to MiroBoardEmbed when canvasData is null", () => {
    render(
      <HubWorkspaceCanvas
        canvasData={null}
        summaryDetails={{}}
        workspaceName="WS test"
        boardId="abc123"
        viewLink={null}
        status="ready"
      />,
    );
    // MiroBoardEmbed ready card is rendered (rétro-compat workspaces pré-pivot)
    expect(screen.getByTestId("miro-board-embed-ready")).toBeInTheDocument();
    // Le canvas natif n'est PAS rendu
    expect(screen.queryByTestId("hub-workspace-canvas")).toBeNull();
  });

  it("falls back to MiroBoardEmbed skeleton when status=creating", () => {
    render(
      <HubWorkspaceCanvas
        canvasData={VALID_CANVAS}
        summaryDetails={{}}
        workspaceName="WS"
        boardId="abc123"
        viewLink={null}
        status="creating"
      />,
    );
    // Tant que status != ready, on garde le rendu Miro (skeleton)
    expect(screen.getByTestId("miro-board-embed-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("hub-workspace-canvas")).toBeNull();
  });

  it("renders both shared concepts and themes sections when canvasData is present and status=ready", () => {
    render(
      <HubWorkspaceCanvas
        canvasData={VALID_CANVAS}
        summaryDetails={{}}
        workspaceName="WS"
        boardId="abc123"
        viewLink={null}
        status="ready"
      />,
    );
    expect(screen.getByTestId("hub-workspace-canvas")).toBeInTheDocument();
    expect(
      screen.getByTestId("hub-canvas-shared-concepts"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("hub-canvas-themes")).toBeInTheDocument();

    // Les concepts s'affichent
    expect(screen.getByText("IA française")).toBeInTheDocument();
    expect(screen.getByText("Souveraineté donnée")).toBeInTheDocument();

    // Les thèmes s'affichent
    expect(screen.getByText("Confidentialité")).toBeInTheDocument();
    expect(screen.getByText("Performance")).toBeInTheDocument();

    // 2 thèmes rendus
    expect(screen.getByTestId("hub-canvas-theme-0")).toBeInTheDocument();
    expect(screen.getByTestId("hub-canvas-theme-1")).toBeInTheDocument();
  });

  it("uses summaryDetails.title in perspective cards when provided", () => {
    render(
      <HubWorkspaceCanvas
        canvasData={VALID_CANVAS}
        summaryDetails={{
          1: {
            title: "L'IA souveraine",
            channel: "Tech FR",
            thumbnail: "https://example.com/thumb1.jpg",
          },
          2: {
            title: "Mistral vs OpenAI",
            channel: "AI Daily",
          },
        }}
        workspaceName="WS"
        boardId="abc123"
        viewLink={null}
        status="ready"
      />,
    );
    // Les vrais titres apparaissent au moins une fois (présents dans plusieurs thèmes)
    expect(screen.getAllByText("L'IA souveraine").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mistral vs OpenAI").length).toBeGreaterThan(0);
    // Pas de fallback "Analyse #X" quand on a les vrais titres
    expect(screen.queryByText(/Analyse #1/)).toBeNull();
    expect(screen.queryByText(/Analyse #2/)).toBeNull();
  });

  it("falls back to 'Analyse #ID' when summaryDetails entry missing", () => {
    render(
      <HubWorkspaceCanvas
        canvasData={VALID_CANVAS}
        summaryDetails={{}}
        workspaceName="WS"
        boardId="abc123"
        viewLink={null}
        status="ready"
      />,
    );
    // 4 perspectives au total (2 thèmes × 2 perspectives) → fallback partout
    const fallbacks = screen.getAllByText(/Analyse #(1|2)/);
    expect(fallbacks.length).toBe(4);
  });

  it("renders only themes section when shared_concepts is empty", () => {
    const canvas: WorkspaceCanvasData = {
      shared_concepts: [],
      themes: VALID_CANVAS.themes,
    };
    render(
      <HubWorkspaceCanvas
        canvasData={canvas}
        summaryDetails={{}}
        workspaceName="WS"
        boardId="abc123"
        viewLink={null}
        status="ready"
      />,
    );
    expect(screen.queryByTestId("hub-canvas-shared-concepts")).toBeNull();
    expect(screen.getByTestId("hub-canvas-themes")).toBeInTheDocument();
  });

  it("does NOT render synthesis section for v1 canvas (backward compat)", () => {
    render(
      <HubWorkspaceCanvas
        canvasData={VALID_CANVAS}
        summaryDetails={{}}
        workspaceName="WS"
        boardId="abc123"
        viewLink={null}
        status="ready"
      />,
    );
    expect(screen.queryByTestId("hub-canvas-synthesis")).toBeNull();
  });

  it("renders synthesis section when canvasData.synthesis is present (v2)", () => {
    const canvas: WorkspaceCanvasData = {
      ...VALID_CANVAS,
      synthesis:
        "Cette synthèse transversale présente l'ensemble des analyses du workspace. Elle articule les points de convergence et les angles distincts.",
    };
    render(
      <HubWorkspaceCanvas
        canvasData={canvas}
        summaryDetails={{}}
        workspaceName="WS"
        boardId="abc123"
        viewLink={null}
        status="ready"
      />,
    );
    expect(screen.getByTestId("hub-canvas-synthesis")).toBeInTheDocument();
    expect(
      screen.getByText(/Cette synthèse transversale présente/),
    ).toBeInTheDocument();
  });

  it("renders theme.description when present (v2) and omits when absent", () => {
    const canvas: WorkspaceCanvasData = {
      shared_concepts: [],
      themes: [
        {
          theme: "Thème AVEC description",
          description: "Cet enjeu pose une question transversale clé.",
          perspectives: [
            { summary_id: 1, excerpt: "P1" },
            { summary_id: 2, excerpt: "P2" },
          ],
        },
        {
          theme: "Thème SANS description",
          perspectives: [
            { summary_id: 1, excerpt: "P3" },
            { summary_id: 2, excerpt: "P4" },
          ],
        },
      ],
    };
    render(
      <HubWorkspaceCanvas
        canvasData={canvas}
        summaryDetails={{}}
        workspaceName="WS"
        boardId="abc123"
        viewLink={null}
        status="ready"
      />,
    );
    // Theme 0 a une description
    expect(
      screen.getByTestId("hub-canvas-theme-description-0"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cet enjeu pose une question transversale clé."),
    ).toBeInTheDocument();
    // Theme 1 n'a pas de description
    expect(screen.queryByTestId("hub-canvas-theme-description-1")).toBeNull();
  });

  it("renders perspective.key_quote when present (v2) and omits when absent", () => {
    const canvas: WorkspaceCanvasData = {
      shared_concepts: [],
      themes: [
        {
          theme: "Thème quote",
          perspectives: [
            {
              summary_id: 1,
              excerpt: "Argument complet en plusieurs phrases.",
              key_quote: "Citation littérale du contenu.",
            },
            {
              summary_id: 2,
              excerpt: "Argument sans quote.",
            },
          ],
        },
      ],
    };
    render(
      <HubWorkspaceCanvas
        canvasData={canvas}
        summaryDetails={{}}
        workspaceName="WS"
        boardId="abc123"
        viewLink={null}
        status="ready"
      />,
    );
    // P1 a une key_quote
    expect(screen.getByTestId("hub-canvas-key-quote-0-1")).toBeInTheDocument();
    expect(
      screen.getByText("Citation littérale du contenu."),
    ).toBeInTheDocument();
    // P2 n'en a pas
    expect(screen.queryByTestId("hub-canvas-key-quote-0-2")).toBeNull();
  });

  it("renders empty state when canvasData has no concepts and no themes", () => {
    const canvas: WorkspaceCanvasData = {
      shared_concepts: [],
      themes: [],
    };
    render(
      <HubWorkspaceCanvas
        canvasData={canvas}
        summaryDetails={{}}
        workspaceName="WS"
        boardId="abc123"
        viewLink={null}
        status="ready"
      />,
    );
    expect(screen.getByTestId("hub-canvas-empty")).toBeInTheDocument();
    expect(screen.getByText(/Pas de canvas généré/i)).toBeInTheDocument();
  });
});
