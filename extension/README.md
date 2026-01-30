# DeepSight Chrome Extension

> 🎬 AI-Powered Video Analysis for YouTube

Analyze any YouTube video directly from the YouTube page with DeepSight's powerful AI. Get summaries, key concepts, timestamps, and chat with videos.

![DeepSight Extension](https://deepsight.vercel.app/og-image.png)

## ✨ Features

### 🎯 Analyze Button
- **Seamless integration** - Analysis button appears on every YouTube video page
- **One-click analysis** - Start analyzing with a single click
- **Progress tracking** - Real-time progress updates during analysis

### 📋 Smart Summaries
- **Multiple modes** - Accessible, Standard, or Expert analysis
- **Category detection** - Automatic categorization (Tech, Science, News, etc.)
- **Reliability scoring** - Know how trustworthy the content is
- **Clickable timestamps** - Jump to any moment in the video

### 💬 Chat with Videos
- **Ask questions** - Get answers about any part of the video
- **Context-aware** - AI understands the full video content
- **Web enrichment** - Optional web search for additional context (Pro/Expert)

### 🎨 Native Integration
- **YouTube theming** - Automatically matches YouTube's light/dark mode
- **Responsive panel** - Sleek side panel that doesn't disrupt viewing
- **SPA compatible** - Works seamlessly with YouTube's single-page navigation

## 📦 Installation

### From Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Search for "DeepSight"
3. Click "Add to Chrome"

### Manual Installation (Development)

1. **Clone the repository**
   ```bash
   cd /path/to/DeepSight-Main/extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate icons** (optional, uses SVG fallback)
   ```bash
   npm install sharp --save-dev
   node scripts/generate-icons.js
   ```

4. **Build the extension**
   ```bash
   npm run build
   ```

5. **Load in Chrome**
   - Open `chrome://extensions/`
   - Enable "Developer mode" (top right)
   - Click "Load unpacked"
   - Select the `dist` folder

## 🔧 Development

### Project Structure

```
extension/
├── manifest.json          # Chrome extension manifest (V3)
├── src/
│   ├── background/        # Service worker for background tasks
│   │   └── index.ts
│   ├── content/           # YouTube page injection
│   │   ├── index.ts
│   │   └── styles.css
│   ├── popup/             # Extension popup UI
│   │   ├── index.tsx
│   │   ├── PopupApp.tsx
│   │   └── popup.css
│   ├── components/        # Reusable React components
│   ├── services/          # API & storage services
│   │   ├── api.ts
│   │   └── storage.ts
│   └── styles/           # Global styles
├── public/
│   └── icons/            # Extension icons
├── scripts/              # Build scripts
├── package.json
├── webpack.config.js
├── tsconfig.json
└── tailwind.config.js
```

### Commands

```bash
# Development build with watch
npm run dev

# Production build
npm run build

# Development build (one-time)
npm run build:dev

# Clean dist folder
npm run clean
```

### Tech Stack

- **TypeScript** - Type-safe code
- **React 18** - Popup UI components
- **Webpack 5** - Module bundling
- **Tailwind CSS** - Utility-first styling
- **Chrome APIs** - Storage, tabs, messaging

## 🔐 Authentication

The extension connects to your DeepSight account:

1. Click the DeepSight icon in your browser toolbar
2. Sign in with your email/password or Google
3. Your credits and settings sync automatically

## 📡 API Integration

The extension communicates with the DeepSight backend:

- **Base URL**: `https://deepsight-production.up.railway.app/api`
- **Auth**: JWT tokens stored in `chrome.storage.local`
- **Endpoints used**:
  - `POST /auth/login` - User authentication
  - `POST /videos/analyze` - Start video analysis
  - `GET /videos/status/{task_id}` - Poll analysis progress
  - `GET /videos/summary/{id}` - Fetch completed summary
  - `POST /chat/{summary_id}` - Chat with video

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is part of DeepSight - see the main repository for license information.

## 🔗 Links

- [DeepSight Web App](https://deepsight.vercel.app)
- [API Documentation](https://deepsight-production.up.railway.app/docs)
- [Report Issues](https://github.com/your-username/DeepSight-Main/issues)

---

Made with ❤️ by the DeepSight team
