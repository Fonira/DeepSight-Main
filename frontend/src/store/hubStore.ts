import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  HubConversation,
  HubMessage,
  HubSummaryContext,
  HubVoiceState,
  TabId,
} from "../components/hub/types";
import type {
  Summary,
  EnrichedConcept,
  ReliabilityResult,
} from "../services/api";

interface HubState {
  conversations: HubConversation[];
  activeConvId: number | null;
  messages: HubMessage[];
  summaryContext: HubSummaryContext | null;
  /**
   * Full Summary object hydrated from videoApi.getSummary (used by AnalysisHub
   * embed below the SummaryCollapsible). Distinct from `summaryContext` which
   * is a lighter projection used by the SummaryCollapsible header.
   */
  fullSummary: Summary | null;
  /** Concepts enrichis fetchés depuis videoApi.getEnrichedConcepts. */
  concepts: EnrichedConcept[];
  /** Résultat fiabilité fetché depuis reliabilityApi.getReliability. */
  reliability: ReliabilityResult | null;
  /** True pendant le fetch de la fiabilité. */
  reliabilityLoading: boolean;
  drawerOpen: boolean;
  summaryExpanded: boolean;
  pipExpanded: boolean;
  voiceCallOpen: boolean;
  voiceState: HubVoiceState;
  /** Modal "Nouvelle conversation" (paste URL → analyze) ouverte ou non. */
  newConvModalOpen: boolean;
  /** task_id de l'analyse en cours déclenchée depuis la modal (pour debug/cleanup). */
  analyzingTaskId: string | null;
  /** Onglet actuellement actif dans la HubTabBar globale. */
  activeTab: TabId;
  /**
   * Position de scroll mémorisée par onglet (scrollTop). Réutilisée
   * lorsque l'utilisateur revient sur un onglet déjà visité (F15). Live
   * pendant la session — pas persistée.
   */
  tabScrollPositions: Record<TabId, number>;

  setConversations: (convs: HubConversation[]) => void;
  setActiveConv: (id: number | null) => void;
  setMessages: (msgs: HubMessage[]) => void;
  appendMessage: (msg: HubMessage) => void;
  setSummaryContext: (ctx: HubSummaryContext | null) => void;
  setFullSummary: (s: Summary | null) => void;
  setConcepts: (concepts: EnrichedConcept[]) => void;
  setReliability: (r: ReliabilityResult | null) => void;
  setReliabilityLoading: (v: boolean) => void;
  toggleDrawer: () => void;
  toggleSummary: () => void;
  setPipExpanded: (v: boolean) => void;
  setVoiceCallOpen: (v: boolean) => void;
  setVoiceState: (s: HubVoiceState) => void;
  setNewConvModalOpen: (open: boolean) => void;
  setAnalyzingTaskId: (taskId: string | null) => void;
  setActiveTab: (tab: TabId) => void;
  setTabScrollPosition: (tab: TabId, scrollTop: number) => void;
  reset: () => void;
}

const INITIAL: Pick<
  HubState,
  | "conversations"
  | "activeConvId"
  | "messages"
  | "summaryContext"
  | "fullSummary"
  | "concepts"
  | "reliability"
  | "reliabilityLoading"
  | "drawerOpen"
  | "summaryExpanded"
  | "pipExpanded"
  | "voiceCallOpen"
  | "voiceState"
  | "newConvModalOpen"
  | "analyzingTaskId"
  | "activeTab"
  | "tabScrollPositions"
> = {
  conversations: [],
  activeConvId: null,
  messages: [],
  summaryContext: null,
  fullSummary: null,
  concepts: [],
  reliability: null,
  reliabilityLoading: false,
  drawerOpen: false,
  summaryExpanded: false,
  pipExpanded: false,
  voiceCallOpen: false,
  voiceState: "idle",
  newConvModalOpen: false,
  analyzingTaskId: null,
  activeTab: "synthesis",
  tabScrollPositions: {
    synthesis: 0,
    quiz: 0,
    flashcards: 0,
    reliability: 0,
    geo: 0,
    chat: 0,
  },
};

export const useHubStore = create<HubState>()(
  immer((set) => ({
    ...INITIAL,
    setConversations: (convs) =>
      set((s) => {
        s.conversations = convs;
      }),
    setActiveConv: (id) =>
      set((s) => {
        s.activeConvId = id;
        s.messages = [];
      }),
    setMessages: (msgs) =>
      set((s) => {
        s.messages = msgs;
      }),
    appendMessage: (msg) =>
      set((s) => {
        s.messages.push(msg);
      }),
    setSummaryContext: (ctx) =>
      set((s) => {
        s.summaryContext = ctx;
      }),
    setFullSummary: (full) =>
      set((s) => {
        s.fullSummary = full;
      }),
    setConcepts: (concepts) =>
      set((s) => {
        s.concepts = concepts;
      }),
    setReliability: (r) =>
      set((s) => {
        s.reliability = r;
      }),
    setReliabilityLoading: (v) =>
      set((s) => {
        s.reliabilityLoading = v;
      }),
    toggleDrawer: () =>
      set((s) => {
        s.drawerOpen = !s.drawerOpen;
      }),
    toggleSummary: () =>
      set((s) => {
        s.summaryExpanded = !s.summaryExpanded;
      }),
    setPipExpanded: (v) =>
      set((s) => {
        s.pipExpanded = v;
      }),
    setVoiceCallOpen: (v) =>
      set((s) => {
        s.voiceCallOpen = v;
      }),
    setVoiceState: (st) =>
      set((s) => {
        s.voiceState = st;
      }),
    setNewConvModalOpen: (open) =>
      set((s) => {
        s.newConvModalOpen = open;
      }),
    setAnalyzingTaskId: (taskId) =>
      set((s) => {
        s.analyzingTaskId = taskId;
      }),
    setActiveTab: (tab) =>
      set((s) => {
        s.activeTab = tab;
      }),
    setTabScrollPosition: (tab, scrollTop) =>
      set((s) => {
        s.tabScrollPositions[tab] = scrollTop;
      }),
    reset: () =>
      set((s) => {
        Object.assign(s, INITIAL);
      }),
  })),
);
