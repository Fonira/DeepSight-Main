// mobile/src/components/hub/index.ts
//
// Public surface du Hub mobile. Mirror du `frontend/src/components/hub/`.
// Apres le sprint Hub Tab Unified (mai 2026), les composants mock initiaux
// (Timeline, MessageBubble, VoiceBubble, VoiceWaveformBars, InputBar,
// CallModeFullBleed, sampleData) ont ete remplaces par leurs equivalents
// dans `mobile/src/components/conversation/*`.
// `DeepSightLogo` reste utilise par HubHeader.

export { DeepSightLogo } from "./DeepSightLogo";
export { SourcesShelf } from "./SourcesShelf";
export { HubHeader } from "./HubHeader";
export { SummaryCollapsible } from "./SummaryCollapsible";
export { ConversationsDrawer } from "./ConversationsDrawer";
export { VideoPiPPlayer } from "./VideoPiPPlayer";
export { HubEmptyState } from "./HubEmptyState";

export type { HubConversation, HubSummaryContext } from "./types";
