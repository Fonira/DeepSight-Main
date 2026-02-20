# Screenshots Specifications

## Required Sizes

### iOS — App Store Connect

| Device | Resolution | Required |
|--------|-----------|----------|
| iPhone 6.7" (iPhone 15 Pro Max) | 1290 x 2796 px | **Yes — minimum 3, recommended 6-10** |
| iPhone 6.5" (iPhone 14 Plus) | 1284 x 2778 px | **Yes** |
| iPhone 5.5" (iPhone 8 Plus) | 1242 x 2208 px | Optional (legacy) |
| iPad 12.9" (iPad Pro 6th gen) | 2048 x 2732 px | Only if iPad supported |

### Android — Google Play Console

| Device | Resolution | Required |
|--------|-----------|----------|
| Phone | 1080 x 1920 px (min) | **Yes — minimum 2, recommended 4-8** |
| 7" Tablet | 1200 x 1920 px | Optional |
| 10" Tablet | 1600 x 2560 px | Optional |

### General Rules
- Format: PNG or JPEG (PNG preferred for quality)
- No transparency (iOS rejects it)
- No device frames in the screenshot itself (App Store adds them)
- Screenshots must reflect actual app content
- Text overlays are allowed and recommended for context

---

## Recommended Screenshots (6 minimum)

### Screenshot 1 — Dashboard / Home
- Show the main dashboard with the URL input field
- Text overlay: "Analyze any YouTube video with AI" / "Analysez n'importe quelle vidéo YouTube"
- Highlight the clean, modern dark UI

### Screenshot 2 — Analysis Summary
- Show a completed analysis with the Bayesian summary
- Text overlay: "Bayesian summaries with certainty levels" / "Résumés bayésiens avec niveaux de certitude"
- Show the epistemic markers (SOLID, PLAUSIBLE, etc.)

### Screenshot 3 — Fact-Check Results
- Show the fact-checking tab with verified claims
- Text overlay: "AI fact-checking with sources" / "Fact-checking IA avec sources"
- Show certainty markers and source links

### Screenshot 4 — Study Tools (Flashcards)
- Show the flashcards or quiz interface
- Text overlay: "Learn with AI flashcards & quizzes" / "Apprenez avec flashcards et quiz IA"
- Show interactive card flip or quiz question

### Screenshot 5 — Contextual Chat
- Show the AI chat interface with a conversation
- Text overlay: "Ask questions about any video" / "Posez vos questions sur la vidéo"
- Show a realistic Q&A exchange

### Screenshot 6 — History / Library
- Show the analysis history screen with multiple entries
- Text overlay: "Your analysis library" / "Votre bibliothèque d'analyses"
- Show video thumbnails and dates

### Bonus Screenshots (optional)

#### Screenshot 7 — Export Options
- Show the export modal (PDF, Markdown, DOCX)
- Text overlay: "Export your analyses" / "Exportez vos analyses"

#### Screenshot 8 — Concept Glossary
- Show the concepts/glossary view
- Text overlay: "Master key concepts" / "Maîtrisez les concepts clés"

#### Screenshot 9 — Settings / Theme
- Show dark mode and light mode side by side
- Text overlay: "Dark & light themes" / "Thème sombre et clair"

#### Screenshot 10 — Onboarding
- Show the onboarding screen
- Text overlay: "Get started in seconds" / "Commencez en quelques secondes"

---

## Screenshot Preparation Checklist

- [ ] Use a real device or high-resolution simulator
- [ ] Ensure the status bar shows realistic time (9:41 for iOS)
- [ ] Remove any debug/dev indicators
- [ ] Use consistent demo data across all screenshots
- [ ] Prepare both FR and EN versions
- [ ] Use dark mode for primary screenshots (brand consistency)
- [ ] Add text overlays using Figma, Sketch, or similar tool
- [ ] Verify all screenshots meet minimum resolution requirements
- [ ] Test that screenshots look good at thumbnail size (store browsing)

---

## Feature Graphic (Android only)

- Size: 1024 x 500 px
- Required for Google Play listing
- Should show app branding + key value proposition
- Suggestion: DeepSight logo + "AI-Powered YouTube Analysis" tagline + abstract video/brain visual

---

## App Icon

Both stores require a high-resolution app icon:
- iOS: 1024 x 1024 px (no transparency, no rounded corners — Apple adds them)
- Android: 512 x 512 px (with adaptive icon support)

Verify the icon is already configured in:
- `mobile/ios/*/Images.xcassets/AppIcon.appiconset/`
- `mobile/android/app/src/main/res/mipmap-*/`
