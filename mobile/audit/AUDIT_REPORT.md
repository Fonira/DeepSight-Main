# DeepSight Mobile - Complete Audit Report

**Date:** 2026-01-26
**Version:** 1.0.0
**Platform:** Expo SDK 54 + React Native 0.81.5

---

## 1. SCREENS INVENTORY (18 Screens)

### Authentication Screens (5)
| Screen | File | Description |
|--------|------|-------------|
| LandingScreen | `src/screens/LandingScreen.tsx` | App welcome/onboarding |
| LoginScreen | `src/screens/LoginScreen.tsx` | Email/password + Google OAuth login |
| RegisterScreen | `src/screens/RegisterScreen.tsx` | User registration form |
| ForgotPasswordScreen | `src/screens/ForgotPasswordScreen.tsx` | Password reset request |
| VerifyEmailScreen | `src/screens/VerifyEmailScreen.tsx` | Email verification code entry |

### Main Tab Screens (4)
| Screen | File | Description |
|--------|------|-------------|
| DashboardScreen | `src/screens/DashboardScreen.tsx` | Home with SmartInputBar, credits, recent analyses |
| HistoryScreen | `src/screens/HistoryScreen.tsx` | Analysis history with search/filters |
| PlaylistsScreen | `src/screens/PlaylistsScreen.tsx` | Playlist management |
| ProfileScreen | `src/screens/ProfileScreen.tsx` | User profile, settings shortcuts |

### Feature Screens (9)
| Screen | File | Description |
|--------|------|-------------|
| AnalysisScreen | `src/screens/AnalysisScreen.tsx` | Most complex - 4 tabs (Summary, Concepts, Chat, Tools) |
| PlaylistDetailScreen | `src/screens/PlaylistDetailScreen.tsx` | Individual playlist view |
| SettingsScreen | `src/screens/SettingsScreen.tsx` | App preferences |
| AccountScreen | `src/screens/AccountScreen.tsx` | Account management |
| UpgradeScreen | `src/screens/UpgradeScreen.tsx` | Plan upgrade/billing |
| UsageScreen | `src/screens/UsageScreen.tsx` | Credit usage statistics |
| PaymentSuccessScreen | `src/screens/PaymentSuccessScreen.tsx` | Stripe checkout success |
| PaymentCancelScreen | `src/screens/PaymentCancelScreen.tsx` | Stripe checkout cancelled |
| LegalScreen | `src/screens/LegalScreen.tsx` | Terms, Privacy Policy |

---

## 2. COMPONENTS INVENTORY (50+ Components)

### UI Components (`src/components/ui/`)
| Component | File | Props/Inputs |
|-----------|------|--------------|
| Button | `Button.tsx` | onPress, title, variant, loading, disabled |
| Input | `Input.tsx` | label, error, hint, leftIcon, rightIcon, secureTextEntry |
| Card | `Card.tsx` | variant, style |
| Badge | `Badge.tsx` | label, variant, size |
| Avatar | `Avatar.tsx` | uri, name, size |
| Toast | `Toast.tsx` | message, type, visible |
| GlassCard | `GlassCard.tsx` | style |
| CreditDisplay | `CreditDisplay.tsx` | variant |
| LanguageToggle | `LanguageToggle.tsx` | compact |

### Common Components
| Component | File | Purpose |
|-----------|------|---------|
| Header | `Header.tsx` | Navigation header with back/actions |
| EmptyState | `EmptyState.tsx` | Empty list placeholder |
| ErrorBoundary | `common/ErrorBoundary.tsx` | Error catching wrapper |

### Input Components
| Component | File | User Inputs |
|-----------|------|-------------|
| SmartInputBar | `SmartInputBar.tsx` | TextInput (URL/text/search), category chips, mode selector, language selector |
| NotesEditor | `NotesEditor.tsx` | TextInput for personal notes |
| TagsEditor | `TagsEditor.tsx` | TextInput for adding tags |
| VideoDiscoveryModal | `VideoDiscoveryModal.tsx` | Search/selection modal |

### Chat Components
| Component | File | User Inputs |
|-----------|------|-------------|
| FloatingChat | `chat/FloatingChat.tsx` | TextInput for messages, web search toggle |

### Study Components
| Component | File | User Interactions |
|-----------|------|-------------------|
| FlashcardsComponent | `study/FlashcardsComponent.tsx` | Card flip, navigation |
| QuizComponent | `study/QuizComponent.tsx` | Option selection, retry |
| MindMapComponent | `study/MindMapComponent.tsx` | Interactive mindmap |

### Video Components
| Component | File | Purpose |
|-----------|------|---------|
| YouTubePlayer | `video/YouTubePlayer.tsx` | Embedded video player |
| VideoCard | `VideoCard.tsx` | Video thumbnail + info card |
| StreamingProgress | `StreamingProgress.tsx` | Analysis progress indicator |

### Feature Components
| Component | File | Purpose |
|-----------|------|---------|
| FactCheckButton | `factcheck/FactCheckButton.tsx` | Trigger fact-check |
| FactCheckDisplay | `factcheck/FactCheckDisplay.tsx` | Display results |
| WebEnrichment | `enrichment/WebEnrichment.tsx` | Web search enrichment |
| ExportOptions | `export/ExportOptions.tsx` | PDF/MD/TXT export modal |
| CitationExport | `citation/CitationExport.tsx` | Citation format export |
| TournesolWidget | `tournesol/TournesolWidget.tsx` | Video quality score |
| ReliabilityScore | `ReliabilityScore.tsx` | Source reliability display |
| FreshnessIndicator | `FreshnessIndicator.tsx` | Content freshness |
| CreditCounter | `credits/CreditCounter.tsx` | Credit display |
| CreditAlert | `credits/CreditAlert.tsx` | Low credit warning |
| UpgradePromptModal | `upgrade/UpgradePromptModal.tsx` | Upgrade CTA modal |
| ConceptsGlossary | `concepts/ConceptsGlossary.tsx` | Concept definitions |

---

## 3. USER INPUTS DETAILED

### TextInput Fields
| Location | Input | Type | Validation Needed |
|----------|-------|------|-------------------|
| LoginScreen | Email | email-address | Email format, non-empty |
| LoginScreen | Password | password | Min 8 chars |
| RegisterScreen | Username | text | Min 3 chars, non-empty |
| RegisterScreen | Email | email-address | Email format, non-empty |
| RegisterScreen | Password | password | Min 8 chars |
| RegisterScreen | ConfirmPassword | password | Must match password |
| ForgotPasswordScreen | Email | email-address | Email format |
| VerifyEmailScreen | Code | text | 6 digits |
| SmartInputBar | URL/Text/Search | url/text | URL format or text length |
| SmartInputBar | Title (text mode) | text | Optional |
| SmartInputBar | Source (text mode) | text | Optional |
| HistoryScreen | Search | text | Any string |
| AnalysisScreen | Chat input | text | Max 1000 chars |
| AnalysisScreen | Notes | multiline | Any text |
| AnalysisScreen | Tags | text | Tag format |
| FloatingChat | Message | text | Max 500 chars |
| SettingsScreen | N/A (uses Alert pickers) | - | - |

### TouchableOpacity Interactions
| Location | Action | API Call |
|----------|--------|----------|
| LoginScreen | Login button | authApi.login |
| LoginScreen | Google login | authApi.googleTokenLogin |
| RegisterScreen | Register button | authApi.register |
| ForgotPasswordScreen | Reset button | authApi.forgotPassword |
| VerifyEmailScreen | Verify button | authApi.verifyEmail |
| VerifyEmailScreen | Resend button | authApi.resendVerification |
| DashboardScreen | Analyze button | videoApi.analyze |
| HistoryScreen | Video card | navigation |
| HistoryScreen | Favorite toggle | historyApi.toggleFavorite |
| HistoryScreen | Delete (long press) | historyApi.deleteSummary |
| AnalysisScreen | Send chat | chatApi.sendMessage |
| AnalysisScreen | Generate flashcards | studyApi.generateFlashcards |
| AnalysisScreen | Generate quiz | studyApi.generateQuiz |
| AnalysisScreen | Generate mindmap | studyApi.generateMindmap |
| AnalysisScreen | Fact check | videoApi.factCheck |
| AnalysisScreen | Export | exportApi.exportSummary |
| AnalysisScreen | Save notes | videoApi.updateNotes |
| AnalysisScreen | Add/remove tags | videoApi.updateTags |
| ProfileScreen | Logout | authApi.logout |
| SettingsScreen | Mode/Model/Language selectors | userApi.updatePreferences |
| UpgradeScreen | Subscribe | billingApi.createCheckout |

---

## 4. API CALLS INVENTORY

### Authentication API (`authApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| register | POST /api/auth/register | No |
| login | POST /api/auth/login | No |
| verifyEmail | POST /api/auth/verify-email | No |
| googleTokenLogin | POST /api/auth/google/token | No |
| getMe | GET /api/auth/me | Yes |
| getQuota | GET /api/auth/quota | Yes |
| logout | POST /api/auth/logout | Yes |
| forgotPassword | POST /api/auth/forgot-password | No |
| resetPassword | POST /api/auth/reset-password | No |
| resendVerification | POST /api/auth/resend-verification | No |
| deleteAccount | DELETE /api/auth/account | Yes |

### User API (`userApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| updateProfile | PUT /api/auth/profile | Yes |
| updatePreferences | PUT /api/auth/preferences | Yes |
| changePassword | POST /api/auth/change-password | Yes |
| uploadAvatar | POST /api/profile/avatar | Yes |

### Video API (`videoApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| analyze | POST /api/videos/analyze/hybrid | Yes |
| getStatus | GET /api/videos/status/:taskId | Yes |
| getSummary | GET /api/videos/summary/:summaryId | Yes |
| getConcepts | GET /api/videos/concepts/:summaryId | Yes |
| getEnrichedConcepts | GET /api/videos/concepts/:summaryId/enriched | Yes |
| discover | POST /api/videos/discover | Yes |
| discoverBest | POST /api/videos/discover/best | Yes |
| factCheck | POST /api/videos/summary/:summaryId/fact-check | Yes |
| webEnrich | POST /api/videos/summary/:summaryId/web-enrich | Yes |
| getTranscript | GET /api/videos/transcript/:videoId | Yes |
| getReliability | GET /api/videos/reliability/:summaryId | Yes |
| analyzeReliability | POST /api/videos/reliability/analyze | Yes |
| getFreshness | GET /api/videos/freshness/:summaryId | Yes |
| updateNotes | PUT /api/videos/summary/:summaryId/notes | Yes |
| updateTags | PUT /api/videos/summary/:summaryId/tags | Yes |
| getCategories | GET /api/videos/categories | Yes |
| estimateCredits | POST /api/videos/estimate-credits | Yes |
| deleteSummary | DELETE /api/videos/summary/:summaryId | Yes |
| getStats | GET /api/videos/stats | Yes |

### History API (`historyApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| getHistory | GET /api/history/videos | Yes |
| toggleFavorite | POST /api/history/videos/:summaryId/favorite | Yes |
| deleteSummary | DELETE /api/history/videos/:summaryId | Yes |
| getStats | GET /api/history/stats | Yes |
| getPlaylistHistory | GET /api/history/playlists | Yes |
| searchHistory | GET /api/history/search | Yes |
| semanticSearch | POST /api/history/search/semantic | Yes |

### Chat API (`chatApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| sendMessage | POST /api/chat/ask | Yes |
| getHistory | GET /api/chat/history/:summaryId | Yes |
| getQuota | GET /api/chat/:summaryId/quota | Yes |
| clearHistory | DELETE /api/chat/history/:summaryId | Yes |

### Playlist API (`playlistApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| getPlaylists | GET /api/playlists | Yes |
| createPlaylist | POST /api/playlists | Yes |
| getPlaylist | GET /api/playlists/:id | Yes |
| updatePlaylist | PUT /api/playlists/:id | Yes |
| deletePlaylist | DELETE /api/playlists/:id | Yes |
| analyzePlaylist | POST /api/playlists/analyze | Yes |
| analyzeCorpus | POST /api/playlists/analyze-corpus | Yes |
| getTaskStatus | GET /api/playlists/task/:taskId | Yes |
| getPlaylistDetails | GET /api/playlists/:id/details | Yes |
| generateCorpusSummary | POST /api/playlists/:playlistId/corpus-summary | Yes |

### Billing API (`billingApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| getPlans | GET /api/billing/plans | No |
| createCheckout | POST /api/billing/create-checkout | Yes |
| getTrialEligibility | GET /api/billing/trial-eligibility | Yes |
| startProTrial | POST /api/billing/start-pro-trial | Yes |
| getPortalUrl | GET /api/billing/portal | Yes |
| getSubscriptionStatus | GET /api/billing/subscription-status | Yes |
| changePlan | POST /api/billing/change-plan | Yes |
| cancelSubscription | POST /api/billing/cancel | Yes |
| getTransactions | GET /api/billing/transactions | Yes |
| reactivateSubscription | POST /api/billing/reactivate | Yes |
| confirmCheckout | POST /api/billing/confirm-checkout | Yes |
| getApiKeyStatus | GET /api/billing/api-key/status | Yes |
| generateApiKey | POST /api/billing/api-key/generate | Yes |
| regenerateApiKey | POST /api/billing/api-key/regenerate | Yes |
| revokeApiKey | DELETE /api/billing/api-key | Yes |

### Study Tools API (`studyApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| generateQuiz | POST /api/study/quiz/:summaryId | Yes |
| generateMindmap | POST /api/study/mindmap/:summaryId | Yes |
| generateFlashcards | POST /api/study/flashcards/:summaryId | Yes |

### Export API (`exportApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| exportSummary | GET /api/exports/:format/:summaryId | Yes |

### Usage API (`usageApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| getStats | GET /api/usage/stats | Yes |
| getDetailedUsage | GET /api/usage/detailed | Yes |

### Tournesol API (`tournesolApi`)
| Method | Endpoint | Auth Required |
|--------|----------|---------------|
| getVideoScore | GET /api/tournesol/video/:videoId | Yes |
| searchRecommendations | POST /api/tournesol/search | Yes |
| getRecommendations | GET /api/tournesol/recommendations | Yes |

---

## 5. CONTEXTS & STATE MANAGEMENT

### AuthContext (`src/contexts/AuthContext.tsx`)
- User state, authentication status
- Login/logout/register functions
- Google OAuth integration
- Token refresh handling

### ThemeContext (`src/contexts/ThemeContext.tsx`)
- Dark/light mode toggle
- Color scheme management

### LanguageContext (`src/contexts/LanguageContext.tsx`)
- French/English language toggle
- Translation strings

### Hooks
- `useAnalysisStream` - SSE streaming for analysis
- `useNotifications` - Push notification handling

---

## 6. STORAGE USAGE

### Secure Storage (`expo-secure-store`)
- Access token
- Refresh token

### Async Storage (`@react-native-async-storage/async-storage`)
- User data cache
- App preferences (theme, language)
- Default analysis settings

---

## 7. IDENTIFIED ISSUES

### Critical
1. No test files exist in the codebase
2. No input sanitization for XSS/injection attacks
3. Missing error boundaries on some screens

### High
1. No offline mode handling
2. Missing input length validation on some fields
3. Token refresh race condition potential

### Medium
1. No keyboard avoiding view on some screens
2. Missing loading states on some actions
3. FlatList optimization needed (keyExtractor, getItemLayout)

### Low
1. Hardcoded strings in some components
2. Missing memo() on some pure components
3. Console.log statements in production code

---

## 8. DEPENDENCIES

### Core
- expo: ^54.0.32
- react: 19.1.0
- react-native: 0.81.5
- typescript: ~5.9.2

### Navigation
- @react-navigation/native: ^6.1.18
- @react-navigation/native-stack: ^6.11.0
- @react-navigation/bottom-tabs: ^6.6.1

### State Management
- zustand: ^4.5.0
- @tanstack/react-query: ^5.17.0

### UI
- @expo/vector-icons: ^15.0.3
- expo-linear-gradient: ~15.0.8
- react-native-reanimated: ~3.16.0
- expo-haptics: ~15.0.8

### Auth
- @react-native-google-signin/google-signin: ^13.0.0
- expo-auth-session: ~7.0.10
- expo-secure-store: ~15.0.8

### Testing (Missing!)
- No jest configuration
- No @testing-library/react-native
- No MSW for API mocking

---

*Generated by QA Automation Agent*
