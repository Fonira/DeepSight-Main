import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type {
  HubConversation,
  HubMessage,
  HubSummaryContext,
  HubVoiceState,
} from "../components/hub/types";

interface HubState {
  conversations: HubConversation[];
  activeConvId: number | null;
  messages: HubMessage[];
  summaryContext: HubSummaryContext | null;
  drawerOpen: boolean;
  summaryExpanded: boolean;
  pipExpanded: boolean;
  voiceCallOpen: boolean;
  voiceState: HubVoiceState;
  /** Modal "Nouvelle conversation" (paste URL → analyze) ouverte ou non. */
  newConvModalOpen: boolean;
  /** task_id de l'analyse en cours déclenchée depuis la modal (pour debug/cleanup). */
  analyzingTaskId: string | null;

  setConversations: (convs: HubConversation[]) => void;
  setActiveConv: (id: number | null) => void;
  setMessages: (msgs: HubMessage[]) => void;
  appendMessage: (msg: HubMessage) => void;
  setSummaryContext: (ctx: HubSummaryContext | null) => void;
  toggleDrawer: () => void;
  toggleSummary: () => void;
  setPipExpanded: (v: boolean) => void;
  setVoiceCallOpen: (v: boolean) => void;
  setVoiceState: (s: HubVoiceState) => void;
  setNewConvModalOpen: (open: boolean) => void;
  setAnalyzingTaskId: (taskId: string | null) => void;
  reset: () => void;
}

const INITIAL: Pick<
  HubState,
  | "conversations"
  | "activeConvId"
  | "messages"
  | "summaryContext"
  | "drawerOpen"
  | "summaryExpanded"
  | "pipExpanded"
  | "voiceCallOpen"
  | "voiceState"
  | "newConvModalOpen"
  | "analyzingTaskId"
> = {
  conversations: [],
  activeConvId: null,
  messages: [],
  summaryContext: null,
  drawerOpen: false,
  summaryExpanded: false,
  pipExpanded: false,
  voiceCallOpen: false,
  voiceState: "idle",
  newConvModalOpen: false,
  analyzingTaskId: null,
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
    reset: () =>
      set((s) => {
        Object.assign(s, INITIAL);
      }),
  })),
);
