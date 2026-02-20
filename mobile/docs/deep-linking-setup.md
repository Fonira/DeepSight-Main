# Deep Linking Setup — DeepSight Mobile

## Overview

DeepSight supports three types of deep links:

| Type | Prefix | Example |
|------|--------|---------|
| Custom scheme | `deepsight://` | `deepsight://analysis/abc123` |
| Universal Links (iOS) | `https://deepsight.app/` | `https://deepsight.app/analysis/abc123` |
| App Links (Android) | `https://deepsight.app/` | `https://deepsight.app/analysis/abc123` |
| Legacy web | `https://www.deepsightsynthesis.com/` | `https://www.deepsightsynthesis.com/analysis/abc123` |

## Route Map

| Path | Screen | Parameters |
|------|--------|------------|
| `/analysis/:videoId` | Analysis | `videoId` |
| `/study/:summaryId` | StudyTools | `summaryId` |
| `/playlists/:playlistId` | PlaylistDetail | `playlistId` |
| `/history` | History tab | — |
| `/settings` | Settings | — |
| `/profile` | Profile tab | — |
| `/home` | Dashboard tab | — |
| `/upgrade` | Upgrade | — |
| `/login` | Login | — |
| `/register` | Register | — |
| `/payment/success` | PaymentSuccess | — |
| `/payment/cancel` | PaymentCancel | — |
| `/legal/:type` | Legal | `type` (privacy/terms/legal/about) |
| `/contact` | Contact | — |

## Domain Setup: `deepsight.app`

### iOS — Apple App Site Association (AASA)

Host this JSON at `https://deepsight.app/.well-known/apple-app-site-association`
(no file extension, `Content-Type: application/json`):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["XGPXQ9KQ2G.com.deepsight.app"],
        "paths": [
          "/analysis/*",
          "/study/*",
          "/playlists/*",
          "/history",
          "/settings",
          "/profile",
          "/home",
          "/upgrade",
          "/login",
          "/register",
          "/payment/*",
          "/legal/*",
          "/contact"
        ]
      }
    ]
  }
}
```

**Requirements:**
- Served over HTTPS with valid certificate
- `Content-Type: application/json`
- No redirects on the `.well-known` path itself
- Apple CDN caches this; changes can take 24-48h to propagate

### Android — Digital Asset Links

Host this JSON at `https://deepsight.app/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.deepsight.app",
      "sha256_cert_fingerprints": [
        "YOUR_SIGNING_KEY_SHA256_FINGERPRINT"
      ]
    }
  }
]
```

**Get your SHA-256 fingerprint:**

```bash
# From EAS (production keystore)
eas credentials --platform android
# Look for "SHA-256 Fingerprint" in the output

# Or from local keystore
keytool -list -v -keystore your-keystore.jks -alias your-alias
```

### Legacy domain: `deepsightsynthesis.com`

The same AASA and assetlinks files should also be hosted at:
- `https://www.deepsightsynthesis.com/.well-known/apple-app-site-association`
- `https://www.deepsightsynthesis.com/.well-known/assetlinks.json`

## Fallback for Users Without the App

When sharing `https://deepsight.app/analysis/VIDEO_ID`:
1. If the app is installed → opens directly in the app
2. If not installed → the web server at `deepsight.app` should redirect to:
   - App Store (iOS): `https://apps.apple.com/app/deep-sight/id{APP_ID}`
   - Play Store (Android): `https://play.google.com/store/apps/details?id=com.deepsight.app`
   - Web fallback: `https://www.deepsightsynthesis.com/analysis/VIDEO_ID`

Simple server-side implementation (e.g., Vercel edge function):

```typescript
// deepsight.app/analysis/[videoId]/route.ts
export function GET(request: Request) {
  const ua = request.headers.get('user-agent') || '';
  const videoId = request.url.split('/analysis/')[1];

  if (/iPhone|iPad|iPod/i.test(ua)) {
    return Response.redirect('https://apps.apple.com/app/deep-sight/idXXXXXXXXX');
  }
  if (/Android/i.test(ua)) {
    return Response.redirect('https://play.google.com/store/apps/details?id=com.deepsight.app');
  }
  return Response.redirect(`https://www.deepsightsynthesis.com/analysis/${videoId}`);
}
```

## Testing

### Simulator / Emulator

```bash
# Custom scheme
npx uri-scheme open "deepsight://analysis/test123" --ios
npx uri-scheme open "deepsight://analysis/test123" --android

# Other routes
npx uri-scheme open "deepsight://history" --ios
npx uri-scheme open "deepsight://settings" --android
npx uri-scheme open "deepsight://study/summary456" --ios
```

### Physical device

```bash
# iOS (requires installed build)
xcrun simctl openurl booted "deepsight://analysis/test123"

# Android
adb shell am start -a android.intent.action.VIEW -d "deepsight://analysis/test123" com.deepsight.app
```

### Verify Universal Links

```bash
# Check AASA file
curl -v https://deepsight.app/.well-known/apple-app-site-association

# Check assetlinks
curl -v https://deepsight.app/.well-known/assetlinks.json

# Apple CDN validator
# https://app-site-association.cdn-apple.com/a/v1/deepsight.app
```
