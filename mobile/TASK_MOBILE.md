# TASK: Mobile App Feature Completion
# Priority: HIGH | Estimated: 4h
# Working directory: C:\Users\33667\DeepSight-Main\mobile

## CONTEXT
DeepSight mobile app (Expo SDK 54, React Native 0.81.5, TypeScript).
Backend: https://deep-sight-backend-v3-production.up.railway.app

## EXISTING API CLIENT (src/services/api.ts)
All API modules are already implemented:
- playlistApi: getPlaylists, createPlaylist, analyzePlaylist
- studyApi: generateQuiz, generateMindmap, generateFlashcards  
- exportApi: exportSummary (PDF/Markdown/Text)
- ttsApi: generateAudio, getVoices

## TASKS (in priority order)

### TASK 1: Playlists Screen (src/screens/PlaylistsScreen.tsx)
Current state: UI stub only, no functionality.
Required:
- List all user playlists (playlistApi.getPlaylists)
- Create new playlist modal (title + description)
- Add videos to playlist
- Playlist detail view with video list
- Analyze entire playlist (playlistApi.analyzePlaylist)
- Delete playlist with confirmation
- Pull-to-refresh
- Empty state illustration
- Loading skeletons

### TASK 2: Fact-Checking Tab (in AnalysisResultScreen.tsx)
Current state: Analysis results show 4 tabs but no fact-checking.
Required:
- Add 5th tab "Fact-Check" to the analysis results TabView
- Call videoApi.factCheck(summaryId) when tab is selected
- Display claims with verification status (verified/disputed/unverified)
- Show sources with clickable links (Linking.openURL)
- Reliability score badge (green/orange/red)
- Loading state while checking

### TASK 3: Export Feature (from AnalysisResultScreen.tsx)
Current state: Not implemented.
Required:
- Add export button (share icon) in header
- Bottom sheet with format options: PDF, Markdown, Plain Text
- Call exportApi.exportSummary(summaryId, format)
- Use expo-sharing to share the file
- Use expo-file-system to save temporarily
- Install: npx expo install expo-sharing expo-file-system

### TASK 4: Mind Map (new component)
Current state: Not implemented.
Required:
- Create src/components/MindMap.tsx
- Call studyApi.generateMindmap(summaryId) 
- Render interactive SVG mind map using react-native-svg
- Pan & zoom with react-native-gesture-handler
- Node tap to expand/collapse
- Color-coded by topic depth
- Install: npx expo install react-native-svg

### TASK 5: TTS Audio Player
Current state: Not implemented.
Required:
- Create src/components/AudioPlayer.tsx
- Call ttsApi.getVoices() for voice selection
- Call ttsApi.generateAudio(summaryId, voiceId)
- Use expo-av for audio playback
- Play/pause/seek controls
- Speed adjustment (0.5x, 1x, 1.5x, 2x)
- Background playback support
- Install: npx expo install expo-av

## DESIGN GUIDELINES
- Use existing theme from ThemeContext (colors.primary, colors.background, etc.)
- Follow existing component patterns (src/components/ui/)
- Use DoodleBackground where appropriate
- Consistent error handling with Alert.alert()
- All text in French by default
- Match existing screen patterns (header, safe area, etc.)

## TESTING
After each task, ensure:
- TypeScript compiles: npx tsc --noEmit
- No import errors
- Consistent with existing navigation (AppNavigator.tsx)
