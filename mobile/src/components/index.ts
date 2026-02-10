// UI Components
export * from './ui';
export { VideoCard } from './VideoCard';
export { Header } from './Header';
export { EmptyState } from './EmptyState';

// Smart Input
export { SmartInputBar } from './SmartInputBar';
export { StreamingProgress } from './StreamingProgress';
export { FreshnessIndicator } from './FreshnessIndicator';
export { ReliabilityScore } from './ReliabilityScore';

// Video Player
export { YouTubePlayer, TimestampLink } from './video';

// Study Tools
export * from './study';

// Export & Citation
export { ExportOptions } from './export';
export { CitationExport } from './citation';

// Fact-checking & Enrichment
export { FactCheckButton } from './factcheck';
export { FactCheckDisplay } from './factcheck/FactCheckDisplay';
export { WebEnrichment } from './enrichment';

// Chat
export { FloatingChat, ChatBubble, TypingIndicator, ChatInput, VideoMiniCard } from './chat';

// Tournesol
export { TournesolWidget } from './tournesol';

// Common
export { ErrorBoundary, withErrorBoundary, ErrorFallback } from './common';

// Backgrounds
export { DoodleBackground } from './backgrounds/DoodleBackground';

// Video Discovery
export { VideoDiscoveryModal } from './VideoDiscoveryModal';

// Notes & Tags
export { NotesEditor } from './NotesEditor';
export { TagsEditor } from './TagsEditor';

// NEW: Credit System
export { CreditCounter, CreditAlert } from './credits';

// NEW: Analysis Components
export { StreamingAnalysisDisplay } from './analysis';
export { AnalysisValueDisplay } from './analysis/AnalysisValueDisplay';

// Loading Components
export { AnimatedLogo, DeepSightSpinner } from './loading';

// Suggested Questions
export { SuggestedQuestions } from './chat/SuggestedQuestions';

// NEW: Content Components
export { TimecodeText, TimecodeListItem, formatTimestamp, parseTimestamp } from './content';

// NEW: Concepts Glossary
export { ConceptsGlossary } from './concepts';

// NEW: Upgrade Prompts
export { UpgradePromptModal, FreeTrialLimitModal } from './upgrade';

// NEW: Audio Components
export { TTSPlayer } from './audio/TTSPlayer';

// NEW: Academic Sources
export { PaperCard, AcademicSourcesSection, BibliographyExportModal } from './academic';
