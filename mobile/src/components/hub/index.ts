// mobile/src/components/hub/index.ts
//
// Public surface du Hub mobile. Mirror du `frontend/src/components/hub/`.
// Au moment du wire-up backend, les types HubMessage / HubConversation /
// HubSummaryContext seront produits depuis api.ts et la data mock disparaitra.

export { DeepSightLogo } from "./DeepSightLogo";
export { SourcesShelf } from "./SourcesShelf";
export { HubHeader } from "./HubHeader";
export { SummaryCollapsible } from "./SummaryCollapsible";
export { Timeline } from "./Timeline";
export { MessageBubble } from "./MessageBubble";
export { VoiceBubble } from "./VoiceBubble";
export { VoiceWaveformBars } from "./VoiceWaveformBars";
export { InputBar } from "./InputBar";
export { ConversationsDrawer } from "./ConversationsDrawer";
export { VideoPiPPlayer } from "./VideoPiPPlayer";
export { CallModeFullBleed } from "./CallModeFullBleed";

export type {
  HubMessage,
  HubConversation,
  HubSummaryContext,
  HubVoiceState,
} from "./types";

export {
  SAMPLE_VIDEO,
  SAMPLE_CONVERSATIONS,
  SAMPLE_MESSAGES,
  SAMPLE_SUMMARY_CONTEXT,
  SAMPLE_FOLLOWUPS,
  WAVE_BARS_A,
  WAVE_BARS_B,
} from "./sampleData";
