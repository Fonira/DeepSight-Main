// mobile/src/components/hub/sampleData.ts
//
// Donnees mock pour le proto Hub mobile.
// Aligne avec hub-shared-gold.jsx (SAMPLE_VIDEO + SAMPLE_CONVERSATIONS).
// Sera remplace par fetch reel via videoApi.getHistory + chatApi.getHistory dans une PR ulterieure.

import type { HubConversation, HubMessage, HubSummaryContext } from "./types";

export const SAMPLE_VIDEO = {
  title: "Lex Fridman & David Chalmers · La conscience",
  source: "YouTube" as const,
  duration: "18:32",
  analyzed: "il y a 12 min",
  summary:
    "Trois niveaux discutes : phenomenale, fonctionnelle, et le hard problem de Chalmers. Position personnelle : ouverte mais sceptique sur les LLMs comme conscients.",
};

const now = Date.now();
const day = 86_400_000;

export const SAMPLE_CONVERSATIONS: HubConversation[] = [
  {
    id: 1,
    summary_id: 1,
    title: "Lex Fridman · conscience",
    video_source: "youtube",
    video_thumbnail_url: null,
    last_snippet: "3 niveaux de conscience…",
    updated_at: new Date(now - 12 * 60_000).toISOString(),
  },
  {
    id: 2,
    summary_id: 2,
    title: "Naval · le levier des medias",
    video_source: "youtube",
    video_thumbnail_url: null,
    last_snippet: "Permissionless leverage…",
    updated_at: new Date(now - 1 * day).toISOString(),
  },
  {
    id: 3,
    summary_id: 3,
    title: "Andrej Karpathy · LLM intuition",
    video_source: "youtube",
    video_thumbnail_url: null,
    last_snippet: "Pre-training vs alignment",
    updated_at: new Date(now - 3 * day).toISOString(),
  },
  {
    id: 4,
    summary_id: 4,
    title: "Tim Ferriss x Hubermann",
    video_source: "youtube",
    video_thumbnail_url: null,
    last_snippet: "Protocoles de recuperation",
    updated_at: new Date(now - 6 * day).toISOString(),
  },
  {
    id: 5,
    summary_id: 5,
    title: "TikTok analyse politique 2026",
    video_source: "tiktok",
    video_thumbnail_url: null,
    last_snippet: "Cadrage et angle implicite",
    updated_at: new Date(now - 12 * day).toISOString(),
  },
];

export const SAMPLE_SUMMARY_CONTEXT: HubSummaryContext = {
  summary_id: 1,
  video_title: SAMPLE_VIDEO.title,
  video_channel: "Lex Fridman Podcast",
  video_duration_secs: 18 * 60 + 32,
  video_source: "youtube",
  video_thumbnail_url: null,
  short_summary: "Lex distingue 3 niveaux de conscience…",
  citations: [
    { ts: 134, label: "phenomenale" },
    { ts: 468, label: "fonctionnelle" },
    { ts: 862, label: "hard problem" },
    { ts: 665, label: "LLMs sceptique" },
    { ts: 760, label: "chambre chinoise" },
  ],
};

export const SAMPLE_MESSAGES: HubMessage[] = [
  {
    id: "m-1",
    role: "user",
    content: "Quels sont les 3 niveaux qu'il distingue exactement ?",
    source: "text",
    timestamp: now - 60_000 * 11,
  },
  {
    id: "m-2",
    role: "assistant",
    content:
      "Lex articule trois niveaux dans la premiere moitie de l'episode :\n\n1. Conscience phenomenale - le « quale », l'experience subjective brute (02:14). C'est ce que Nagel appelle « what it is like to be ».\n\n2. Conscience fonctionnelle - la capacite a integrer de l'information, prendre des decisions, rapporter ses etats (07:48). Mesurable, operationnelle.\n\n3. Le hard problem - le saut explicatif entre les deux, formule par Chalmers (14:22). Lex le considere comme « la vraie question ouverte ».",
    source: "text",
    timestamp: now - 60_000 * 10,
  },
  {
    id: "m-3",
    role: "user",
    content:
      "Et sa position personnelle sur les LLMs comme systemes possiblement conscients aujourd'hui ?",
    source: "voice_user",
    voice_session_id: "vs-demo-1",
    audio_duration_secs: 8,
    timestamp: now - 60_000 * 8,
  },
  {
    id: "m-4",
    role: "assistant",
    content:
      "Bonne question. Sur les LLMs, Lex est explicitement agnostique mais sceptique (11:05). Il pense qu'ils manipulent des representations fonctionnelles sans necessairement avoir de phenomenologie. Il cite l'argument de la chambre chinoise (12:40).",
    source: "voice_agent",
    voice_session_id: "vs-demo-1",
    time_in_call_secs: 24,
    timestamp: now - 60_000 * 7,
  },
];

/** Hauteurs preechantillonnees pour les waveforms - rendent la voice bubble realistic. */
export const WAVE_BARS_A = [
  6, 14, 9, 20, 11, 16, 8, 18, 12, 22, 9, 15, 7, 19, 11, 14, 8, 17, 10, 13, 6,
  21, 9, 12, 15, 8, 17, 10,
];

export const WAVE_BARS_B = [
  5, 12, 8, 17, 10, 14, 7, 16, 11, 19, 8, 13, 6, 17, 10, 12, 15, 9, 20, 11, 14,
];

export const SAMPLE_FOLLOWUPS = [
  "Sa position sur les LLMs ?",
  "Pourquoi le hard problem ?",
  "Compare avec Hofstadter",
];
