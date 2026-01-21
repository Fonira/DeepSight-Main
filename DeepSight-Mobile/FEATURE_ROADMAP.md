# DeepSight Mobile - Feature Roadmap

## Current Status: Phase 2 Complete

### Legend
- ✅ Implemented
- 🔄 Partial/In Progress
- ⏳ Pending
- ❌ Not Started

---

## Feature Parity Checklist (Mobile vs Web)

### 1. Authentication (Priority: CRITICAL)
| Feature | Status | Notes |
|---------|--------|-------|
| Email/Password Login | ✅ | Implemented |
| Email Registration | ✅ | With verification |
| Google OAuth | ✅ | Code flow implemented |
| Forgot Password | ✅ | Implemented |
| Token Refresh | ✅ | Auto-refresh |
| Session Persistence | ✅ | SecureStore |

### 2. Core Analysis (Priority: HIGH)
| Feature | Status | Notes |
|---------|--------|-------|
| URL Video Analysis | ✅ | Hybrid mode |
| Analysis Progress | ✅ | Polling with progress |
| Summary Display | ✅ | Full content |
| Concepts Extraction | ✅ | Enriched concepts |
| Chat with Summary | ✅ | Real-time |
| Copy/Share | ✅ | Native share |

### 3. Study Tools (Priority: HIGH)
| Feature | Status | Notes |
|---------|--------|-------|
| Flashcards | ✅ | Basic flip cards |
| Quiz | ❌ | Need to implement |
| Mind Map | ❌ | Need SVG renderer |

### 4. History & Favorites (Priority: MEDIUM)
| Feature | Status | Notes |
|---------|--------|-------|
| History List | ✅ | Paginated |
| Search History | ✅ | By title |
| Filter by Mode | ⏳ | UI exists |
| Toggle Favorite | ✅ | Working |
| Delete Summary | ✅ | With confirm |

### 5. Playlists (Priority: MEDIUM)
| Feature | Status | Notes |
|---------|--------|-------|
| List Playlists | ❌ | Stub only |
| Create Playlist | ❌ | Not implemented |
| Analyze Playlist | ❌ | Not implemented |
| Corpus Analysis | ❌ | Not implemented |

### 6. Export (Priority: LOW)
| Feature | Status | Notes |
|---------|--------|-------|
| Share Text | ✅ | Native share |
| Export PDF | ❌ | Need implementation |
| Export Markdown | ❌ | Need implementation |

### 7. TTS / Audio (Priority: LOW)
| Feature | Status | Notes |
|---------|--------|-------|
| Generate Audio | ❌ | Need expo-av |
| Voice Selection | ❌ | Not implemented |
| Audio Player | ❌ | Not implemented |

### 8. Fact-Checking (Priority: LOW)
| Feature | Status | Notes |
|---------|--------|-------|
| Fact-check Button | ❌ | Not implemented |
| Display Results | ❌ | Not implemented |

### 9. User Profile (Priority: MEDIUM)
| Feature | Status | Notes |
|---------|--------|-------|
| Profile Display | ✅ | User info |
| Quota Display | ✅ | Credits |
| Settings | ✅ | Theme, etc |
| Upgrade Screen | ✅ | Plan info |

### 10. UI/UX (Priority: HIGH)
| Feature | Status | Notes |
|---------|--------|-------|
| Landing Screen | ✅ | NEW |
| Dark/Light Theme | ✅ | Working |
| Custom Fonts | ✅ | Phase 1 |
| Glass Effects | ✅ | GlassCard |
| Animations | ✅ | DoodleBackground |

---

## Implementation Priority Order

### Phase 3: Study Tools Enhancement
1. **Quiz Implementation** - Generate quiz from API, display questions, track score
2. **Mind Map** - SVG-based visualization using react-native-svg

### Phase 4: Playlists
3. **Playlist API Integration** - Connect to backend
4. **Playlist UI** - Create, edit, view playlists
5. **Corpus Analysis** - Multi-video analysis

### Phase 5: Export & TTS
6. **Export Options** - PDF and Markdown download
7. **TTS Audio** - Generate and play audio summaries

### Phase 6: Polish
8. **Fact-checking UI** - Display verification results
9. **Web Enrichment** - Show additional context
10. **Performance Optimization** - Reduce bundle size, improve loading

---

## API Endpoints Used

| Feature | Endpoint | Status |
|---------|----------|--------|
| Login | POST /api/auth/login | ✅ |
| Google OAuth URL | POST /api/auth/google/login | ✅ |
| Google Callback | POST /api/auth/google/callback | ✅ |
| Register | POST /api/auth/register | ✅ |
| Analyze | POST /api/videos/analyze/hybrid | ✅ |
| Get Status | GET /api/videos/status/{id} | ✅ |
| Get Summary | GET /api/videos/summary/{id} | ✅ |
| Get Concepts | GET /api/videos/concepts/{id}/enriched | ✅ |
| Chat | POST /api/chat/ask | ✅ |
| Generate Quiz | POST /api/study/quiz/{id} | ⏳ |
| Generate Mindmap | POST /api/study/mindmap/{id} | ⏳ |
| Generate Flashcards | POST /api/study/flashcards/{id} | ✅ |
| Generate TTS | POST /api/tts/generate | ⏳ |
| Fact-check | POST /api/videos/summary/{id}/fact-check | ⏳ |
| Export | GET /api/exports/{format}/{id} | ⏳ |
| Playlists | GET /api/playlists | ⏳ |

---

## Files to Create/Modify

### Phase 3 Files
- `src/components/study/QuizComponent.tsx` - Quiz display
- `src/components/study/MindMapComponent.tsx` - Mind map SVG
- `src/screens/AnalysisScreen.tsx` - Add quiz/mindmap to tools tab

### Phase 4 Files
- `src/screens/PlaylistsScreen.tsx` - Full implementation
- `src/screens/PlaylistDetailScreen.tsx` - New screen
- `src/components/playlist/PlaylistCard.tsx` - Playlist item

### Phase 5 Files
- `src/components/ExportOptions.tsx` - Export modal
- `src/components/AudioPlayer.tsx` - TTS player
- `src/hooks/useAudioPlayer.ts` - Audio logic

---

## Testing Checklist

Before each commit:
1. [ ] Run `npm run typecheck` - No errors
2. [ ] Test on iOS simulator
3. [ ] Test on Android emulator
4. [ ] Verify dark/light theme
5. [ ] Check offline behavior
6. [ ] Run FeatureValidator

---

*Last updated: 21 January 2026*
