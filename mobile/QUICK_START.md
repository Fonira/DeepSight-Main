# DeepSight Mobile V2 - Quick Start Guide

## Installation & Setup

```bash
# Navigate to mobile directory
cd /sessions/bold-kind-einstein/mnt/DeepSight-Main/mobile

# Install dependencies (if not already done)
npm install

# Clear Expo cache (if needed)
npx expo start --clear

# Or use dev client (for native modules)
npm run start:dev-client
```

## Testing the Router

### 1. TypeScript Validation
```bash
npm run typecheck
```
✅ Should pass without errors

### 2. Run in Expo Go

```bash
npm start

# Then in terminal:
# a - Android emulator
# i - iOS simulator
# w - Web
```

### 3. Test Navigation Flow

#### Authentication Flow (No user logged in)
1. App opens → Shows welcome screen (app/(auth)/index.tsx)
2. Click "Se connecter" → Goes to login.tsx
3. Click "Créer un compte" → Goes to register.tsx
4. Can navigate back

#### After Login (Simulated)
1. App would redirect to (tabs) group
2. See 4 tabs: Home, Library, Study, Profile
3. Tab bar shows with custom styling
4. Active tab highlighted in indigo
5. Try tapping different tabs

#### Dynamic Route Test
In one of the tab screens, you could do:
```typescript
import { useRouter } from 'expo-router';
const router = useRouter();
router.push('/(tabs)/analysis/123');
```

### 4. Test Deep Links

```bash
# Terminal (while app is running)
npx expo send-link --url "deepsight://analysis/456"
```

### 5. Verify File Structure

```bash
# List all router files
find app -type f \( -name "*.tsx" -o -name "*.ts" \) | sort

# Expected output:
# app/(auth)/_layout.tsx
# app/(auth)/forgot-password.tsx
# app/(auth)/index.tsx
# app/(auth)/login.tsx
# app/(auth)/register.tsx
# app/(auth)/verify.tsx
# app/(tabs)/CustomTabBar.tsx
# app/(tabs)/_layout.tsx
# app/(tabs)/analysis/[id].tsx
# app/(tabs)/index.tsx
# app/(tabs)/library.tsx
# app/(tabs)/profile.tsx
# app/(tabs)/study.tsx
# app/_404.tsx
# app/_layout.tsx
# app/config/router.config.ts
# app/splash.tsx
# app/types/index.ts
# app/types/navigation.ts
```

## Development Commands

```bash
# Linting
npm run lint

# Type checking
npm run typecheck

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Build dev client (for native modules)
npm run build:dev

# Build for iOS
npm run build:ios

# Build for Android
npm run build:android

# Build preview
npm run build:preview

# Submit to App Store
npm run submit:ios

# Submit to Google Play
npm run submit:android
```

## Project Structure

```
DeepSight-Main/mobile/
├── app/                          ← Expo Router files
│   ├── (auth)/                   ← Auth group
│   │   ├── _layout.tsx           Stack layout
│   │   ├── index.tsx             Welcome
│   │   ├── login.tsx             Login form
│   │   ├── register.tsx          Register form
│   │   ├── verify.tsx            Verify email
│   │   └── forgot-password.tsx   Reset password
│   ├── (tabs)/                   ← Tabs group
│   │   ├── _layout.tsx           Tabs navigator
│   │   ├── CustomTabBar.tsx      Custom tab bar
│   │   ├── index.tsx             Home
│   │   ├── library.tsx           Library
│   │   ├── study.tsx             Study
│   │   ├── profile.tsx           Profile
│   │   └── analysis/
│   │       └── [id].tsx          Detail page
│   ├── config/
│   │   └── router.config.ts      Deep linking config
│   ├── types/
│   │   ├── navigation.ts         Route types
│   │   └── index.ts              Re-exports
│   ├── _layout.tsx               Root layout
│   ├── _404.tsx                  Not found
│   └── splash.tsx                Splash screen
│
├── src/
│   ├── components/               UI components
│   ├── contexts/                 Context providers
│   ├── hooks/                    Custom hooks
│   ├── navigation/
│   │   └── routerHelpers.ts      Nav helpers
│   ├── screens/                  (Legacy, for reference)
│   ├── services/                 API services
│   ├── stores/                   Zustand stores
│   ├── theme/                    Design tokens
│   ├── types/                    TypeScript types
│   ├── utils/
│   │   └── queryClient.ts        React Query config
│   └── i18n/                     Translations
│
├── app.json                      Expo config
├── babel.config.js               Babel config
├── tsconfig.json                 TypeScript config
├── package.json                  Dependencies
│
├── ROUTER.md                     Router architecture
├── ROUTER_EXAMPLES.md            Usage examples
├── ROUTER_SETUP.md               Setup checklist
├── FILES_CREATED.md              Files list
└── QUICK_START.md               This file
```

## Key Technologies

- **Expo Router** v6.0.23 - File-based routing
- **React 19** - UI framework
- **React Native** 0.81.5 - Mobile framework
- **Expo SDK 54** - Native features
- **TypeScript** - Type safety
- **Tailwind CSS** (via code) - Styling
- **React Query** v5 - Data fetching
- **Zustand** - State management
- **Reanimated** 4.1.1 - Animations
- **React Navigation** - Navigation (via Expo Router)

## Important Notes

1. **App Entry Point** : app/_layout.tsx (NOT src/index.tsx)
2. **Exports** : AuthProvider and useAuth from src/contexts/AuthContext
3. **Fonts** : Loaded in root layout, must exist in src/assets/fonts/
4. **Colors** : Use darkColors for consistency
5. **Assets** : Place icons, images in src/assets/
6. **API** : Use services from src/services/api.ts

## Common Issues

### Issue: Fonts not loading
**Solution**: Make sure fonts exist in `src/assets/fonts/` with exact filenames

### Issue: "Cannot find module @/theme"
**Solution**: Check tsconfig.json and babel.config.js have the aliases

### Issue: Navigation not working
**Solution**: Make sure AuthContext is properly initialized in root layout

### Issue: TypeScript errors in CustomTabBar
**Solution**: The `any` types are intentional due to React Navigation's complex typing

### Issue: Expo Go vs Dev Build
**Solution**: Some native modules (Google Sign-In) only work in dev builds, not Expo Go

## Debugging

```bash
# Enable verbose logging
DEBUG=* npm start

# Clear cache
npm start --clear

# Reset watchman (macOS)
watchman watch-del-all

# Kill any running processes
lsof -i :8081  # Metro bundler
lsof -i :19000 # Expo

# Rebuild node_modules
rm -rf node_modules && npm install
```

## Resources

- [Expo Router Docs](https://expo.dev/routing)
- [React Navigation](https://reactnavigation.org/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Reanimated](https://docs.swmansion.com/react-native-reanimated/)
- [TanStack Query Docs](https://tanstack.com/query/latest)

## Next Steps

1. ✅ Router structure created
2. ⏳ Implement auth forms
3. ⏳ Implement tab screens
4. ⏳ Implement analysis detail
5. ⏳ Setup API calls
6. ⏳ Add error handling
7. ⏳ Add analytics
8. ⏳ Test & release

---

**Status**: ✅ Ready for development
**Last Updated**: 2026-02-16
