# DeepSight Chrome Extension

AI-powered YouTube video analysis extension with premium dark mode design.

## Design System

### Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--ds-bg-primary` | `#0a0a0f` | Main background |
| `--ds-bg-secondary` | `#12121a` | Cards, surfaces |
| `--ds-bg-tertiary` | `#1a1a2e` | Elevated surfaces |
| `--ds-border` | `#2a2a3e` | Borders, dividers |
| `--ds-text-primary` | `#e8e8f0` | Body text |
| `--ds-text-secondary` | `#8888a0` | Muted text |
| `--ds-accent-blue` | `#4a9eff` | Primary accent |
| `--ds-accent-purple` | `#8b5cf6` | Secondary accent |
| `--ds-accent-orange` | `#f59e0b` | Tertiary accent |
| `--ds-success` | `#22c55e` | Success states |
| `--ds-error` | `#ef4444` | Error states |

### Gradients

- **Main**: `linear-gradient(135deg, #4a9eff, #8b5cf6, #f59e0b)` — Brand gradient (blue > purple > orange)
- **Blue-Purple**: `linear-gradient(135deg, #4a9eff, #8b5cf6)` — Buttons, headers

### Typography

- **Font**: Inter (system fallback stack)
- **Weights**: 400 (body), 500 (labels), 600 (headings), 700 (display)

### Spacing & Radius

- Spacing: 4px grid (4, 8, 12, 16, 24, 32)
- Radius: 8px (small), 12px (default), 16px (large)

### Animations

| Name | Duration | Usage |
|------|----------|-------|
| `ds-spin` | 2s linear | Logo spinner rotation |
| `ds-pulse-glow` | 3s ease | Logo glow pulsation |
| `ds-shimmer` | 3s ease | Analyze button gradient |
| `ds-fade-in` | 200ms | Popup entrance |
| `ds-slide-up` | 200ms | Toast/view transitions |
| `ds-stagger-in` | 300ms | History item cascade |

All animations use `transform` and `opacity` only for GPU acceleration.

## Component Architecture

```
src/popup/
├── index.tsx              # React entry point
├── App.tsx                # Root component, view routing, toast system
└── components/
    ├── DeepSightLogo.tsx  # SVG compass rose logo (sm/md/lg + text option)
    ├── DeepSightSpinner.tsx # Rotating logo spinner (sm/md/lg + text)
    ├── LoginView.tsx      # Login form + Google OAuth
    ├── MainView.tsx       # Dashboard: header, user bar, analyze, selectors, tabs, history
    ├── HistoryView.tsx    # Analysis history with staggered animations
    └── SettingsView.tsx   # Mode, language, notification settings
```

### Component Props

**DeepSightLogo**: `size: 'sm'|'md'|'lg'`, `showText: boolean`, `className: string`

**DeepSightSpinner**: `size: 'sm'|'md'|'lg'`, `text: string`

**MainView** (new props): `onError: (msg: string) => void` — Triggers toast notification

### Views

- **Loading**: Centered DeepSightSpinner with text
- **Login**: Large logo with glow, gradient title, email/password form, Google sign-in, links
- **Main**: Sticky header (logo + badge), user bar (plan badge + credits + sign out), shimmer analyze button, tier/language selectors, category tabs, recent analyses, quick action cards
- **History**: Cards with thumbnails, staggered animation, "New" badge for recent items, empty state
- **Settings**: Dark cards with custom selects and toggle switch

## Icons

SVG compass rose icons at 4 sizes in `icons/`:
- `icon16.svg` — Toolbar
- `icon32.svg` — Extensions page
- `icon48.svg` — Chrome Web Store
- `icon128.svg` — Detailed view with N/S/E/W labels

Design: Compass rose with gradient (blue > purple > orange) on `#0a0a0f` dark background.

## Styles

| File | Purpose |
|------|---------|
| `src/styles/popup.css` | Popup UI design system (variables, reset, animations, all views) |
| `src/styles/content.css` | YouTube sidebar card (same design tokens, dark-only) |

## Build

```bash
# Install dependencies
npm install

# Development build (with watch)
npm run dev

# Production build
npm run build

# TypeScript check
npm run typecheck
```

Output goes to `dist/`. Load `dist/` as an unpacked extension in Chrome.

## Loading in Chrome

1. `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` folder

## Tech Stack

- **React 18** — UI framework
- **TypeScript** — Type safety
- **Webpack 5** — Bundling
- **MiniCssExtractPlugin** — CSS extraction
- **Chrome Manifest V3** — Extension API
