# Quick Voice Call Mobile V3 — PR3 Native Share Extensions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'utilisateur de partager une vidéo YouTube ou TikTok depuis l'app native (YouTube, TikTok, Safari) → "DeepSight Voice Call" → l'app s'ouvre + l'appel démarre directement, **zéro paste**.

**Architecture:** iOS Share Extension (Swift) + Android Intent Filter (manifeste). Les deux ouvrent l'app via deep link `deepsight://voice-call?url=...&autostart=true`. Le hook `useDeepLinkURL` (livré en PR2) reçoit l'URL et déclenche le flow Voice Call automatiquement.

**Tech Stack:** Expo Config Plugins + Swift (iOS Share Extension target Xcode) + Android Intent Filter (XML manifest). EAS Build natif (plus Expo Go).

**Spec source:** `docs/superpowers/specs/2026-04-27-quick-voice-call-mobile-v3-design.md` § 9.

**Branche:** `feat/quick-voice-call-mobile-v3`. **Dépend de PR2 mergée.**

---

## Stratégie d'approche

Deux options évaluées dans la spec :
1. **Plugin community `expo-share-intent`** — si compat SDK 54, gain ~2 jours
2. **Config plugin custom + target Xcode + Intent Filter** — si l'option 1 ne marche pas

Task 1 teste l'option 1. Si elle fonctionne, on saute à Task 7 (build + smoke test). Sinon, Tasks 2-6 implémentent l'option 2.

---

## File Structure

| Fichier | Type | Responsabilité |
|---|---|---|
| `mobile/package.json` | MODIFY | Ajouter `expo-share-intent` ou supprimer si custom |
| `mobile/app.json` | MODIFY | Plugin config + intentFilters Android + URL scheme `deepsight` |
| `mobile/plugins/withShareExtension.ts` | NEW (option 2) | Config plugin Expo qui injecte le target Xcode iOS |
| `mobile/ios/DeepSightShareExtension/Info.plist` | NEW (option 2) | Déclaration NSExtensionActivationRule (URL types YT + TikTok) |
| `mobile/ios/DeepSightShareExtension/ShareViewController.swift` | NEW (option 2) | Handler Swift → openURL(deepsight://voice-call) |
| `mobile/eas.json` | MODIFY | Confirm `developmentClient: true` |
| `mobile/__tests__/native/sharedURL.smoke.md` | NEW | Checklist E2E manuel |

---

## Task 1: Évaluer expo-share-intent (compat SDK 54)

**Files:** `mobile/package.json`

- [ ] **Step 1.1: Test l'install dans une branche temporaire**

```bash
cd C:/Users/33667/DeepSight-quick-voice-mobile/mobile
git checkout -b chore/test-expo-share-intent
npx expo install expo-share-intent
```

- [ ] **Step 1.2: Configurer plugin dans app.json (test)**

Ajouter à `mobile/app.json` (section `plugins`) :

```json
[
  "expo-share-intent",
  {
    "iosActivationRules": {
      "NSExtensionActivationSupportsWebURLWithMaxCount": 1
    },
    "androidIntentFilters": ["text/plain"]
  }
]
```

- [ ] **Step 1.3: Tenter un prebuild**

```bash
npx expo prebuild --clean
```

Si succès → option 1 marche → checkout main de la branche test, garder install + config dans la vraie branche feat/quick-voice-call-mobile-v3, **passer directement à Task 7**.

Si erreur `unsupported expo SDK` ou `iOS target version mismatch` → Option 1 KO → revert + passer à Task 2.

```bash
git checkout feat/quick-voice-call-mobile-v3
git branch -D chore/test-expo-share-intent
```

- [ ] **Step 1.4: Documenter le verdict dans le plan**

Append au top de ce plan :
```markdown
> **Décision Task 1 (date)** : option 1 expo-share-intent [PASSED/FAILED]. Suite : [Task 7 / Tasks 2-6].
```

Commit :

```bash
git add docs/superpowers/plans/2026-04-27-quick-voice-call-mobile-v3-pr3-native.md mobile/package.json mobile/app.json
git commit -m "chore(mobile): evaluate expo-share-intent — verdict [PASSED|FAILED]"
```

---

## Task 2: Config plugin Expo custom (option 2 — si Task 1 FAILED)

**Files:** `mobile/plugins/withShareExtension.ts`

- [ ] **Step 2.1: Créer le squelette du plugin**

```typescript
// mobile/plugins/withShareExtension.ts
import { ConfigPlugin, withInfoPlist, withXcodeProject, withAppDelegate } from "@expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

const SHARE_EXT_NAME = "DeepSightShareExtension";
const SHARE_EXT_BUNDLE_ID_SUFFIX = "ShareExtension";

const withShareExtension: ConfigPlugin = (config) => {
  config = withInfoPlist(config, (config) => {
    // Add CFBundleURLTypes for deep link scheme
    if (!config.modResults.CFBundleURLTypes) config.modResults.CFBundleURLTypes = [];
    const existing = config.modResults.CFBundleURLTypes.find(
      (e: any) => e.CFBundleURLSchemes?.includes("deepsight")
    );
    if (!existing) {
      config.modResults.CFBundleURLTypes.push({
        CFBundleURLName: "com.deepsight.voicecall",
        CFBundleURLSchemes: ["deepsight"],
      });
    }
    return config;
  });

  config = withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const sourceDir = path.join(projectRoot, "ios", SHARE_EXT_NAME);

    // Copy Swift + Info.plist + Base.lproj from plugin assets to ios/
    const assetsDir = path.join(__dirname, "share-extension-assets");
    if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });
    for (const file of ["ShareViewController.swift", "Info.plist", "MainInterface.storyboard"]) {
      const src = path.join(assetsDir, file);
      const dst = path.join(sourceDir, file);
      if (fs.existsSync(src) && !fs.existsSync(dst)) {
        fs.copyFileSync(src, dst);
      }
    }

    // Add target to Xcode project
    const targetName = SHARE_EXT_NAME;
    const target = proj.pbxTargetByName(targetName);
    if (!target) {
      proj.addTarget(targetName, "app_extension", targetName);
      // Add files to the target
      const group = proj.pbxCreateGroup(targetName, targetName);
      proj.addSourceFile(path.join(SHARE_EXT_NAME, "ShareViewController.swift"), { target: targetName }, group);
      proj.addResourceFile(path.join(SHARE_EXT_NAME, "MainInterface.storyboard"), { target: targetName }, group);
    }
    return config;
  });

  return config;
};

export default withShareExtension;
```

⚠️ Ce code est un squelette. La manipulation de Xcode project (`addTarget`, `addSourceFile`) varie selon la version de `@expo/config-plugins`. Lire la doc `https://docs.expo.dev/config-plugins/plugins-and-mods/` et le source de `expo-share-intent` (open source) pour adapter exactement les appels API. Si trop complexe → vendor (copier) leur plugin source dans `mobile/plugins/`.

- [ ] **Step 2.2: Créer les assets du Share Extension**

Créer `mobile/plugins/share-extension-assets/`:

**ShareViewController.swift** :

```swift
import UIKit
import Social
import MobileCoreServices

class ShareViewController: SLComposeServiceViewController {

    override func isContentValid() -> Bool {
        return true
    }

    override func didSelectPost() {
        guard let extensionContext = self.extensionContext,
              let item = extensionContext.inputItems.first as? NSExtensionItem,
              let attachments = item.attachments else {
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        let urlType = kUTTypeURL as String
        for attachment in attachments {
            if attachment.hasItemConformingToTypeIdentifier(urlType) {
                attachment.loadItem(forTypeIdentifier: urlType, options: nil) { [weak self] (data, error) in
                    DispatchQueue.main.async {
                        guard let self = self, let url = data as? URL else {
                            self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                            return
                        }
                        self.openMainApp(with: url.absoluteString)
                    }
                }
                return
            }
            if attachment.hasItemConformingToTypeIdentifier(kUTTypePlainText as String) {
                attachment.loadItem(forTypeIdentifier: kUTTypePlainText as String, options: nil) { [weak self] (data, error) in
                    DispatchQueue.main.async {
                        guard let self = self, let text = data as? String else {
                            self?.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
                            return
                        }
                        self.openMainApp(with: text)
                    }
                }
                return
            }
        }
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    override func configurationItems() -> [Any]! {
        return []
    }

    private func openMainApp(with rawText: String) {
        // Extract first URL from text (in case YouTube share includes title + URL)
        let pattern = #"https?://[^\s]+"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: rawText, range: NSRange(rawText.startIndex..., in: rawText)),
              let urlRange = Range(match.range, in: rawText) else {
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }
        let url = String(rawText[urlRange])
        guard let encoded = url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }
        let deepLink = "deepsight://voice-call?url=\(encoded)&autostart=true"
        guard let deepLinkURL = URL(string: deepLink) else {
            self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        var responder: UIResponder? = self
        while responder != nil {
            if let app = responder as? UIApplication {
                app.perform(#selector(UIApplication.open(_:options:completionHandler:)),
                            with: deepLinkURL, with: [:])
                break
            }
            responder = responder?.next
        }
        self.extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}
```

**Info.plist** :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDisplayName</key>
    <string>DeepSight Voice Call</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionAttributes</key>
        <dict>
            <key>NSExtensionActivationRule</key>
            <dict>
                <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
                <integer>1</integer>
                <key>NSExtensionActivationSupportsText</key>
                <true/>
            </dict>
        </dict>
        <key>NSExtensionMainStoryboard</key>
        <string>MainInterface</string>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.share-services</string>
    </dict>
</dict>
</plist>
```

**MainInterface.storyboard** : copier un storyboard minimal vide pointant vers `ShareViewController` (peut être un fichier vide pour démarrer ; Xcode le rendra valide au prebuild).

```xml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0">
    <scenes>
        <scene sceneID="ShareScene">
            <objects>
                <viewController storyboardIdentifier="ShareViewController" id="ShareController" customClass="ShareViewController" customModule="DeepSightShareExtension" customModuleProvider="target">
                    <view key="view" contentMode="scaleToFill" id="ShareView">
                        <rect key="frame" x="0" y="0" width="320" height="568"/>
                    </view>
                </viewController>
            </objects>
        </scene>
    </scenes>
</document>
```

- [ ] **Step 2.3: Activer le plugin dans app.json**

Modifier `mobile/app.json`:

```json
{
  "expo": {
    "scheme": "deepsight",
    "plugins": [
      // ... existing plugins
      "./plugins/withShareExtension"
    ]
  }
}
```

- [ ] **Step 2.4: Commit**

```bash
git add mobile/plugins/ mobile/app.json
git commit -m "feat(mobile): custom Expo config plugin for iOS Share Extension (Swift)"
```

---

## Task 3: Android Intent Filter

**Files:** `mobile/app.json`

- [ ] **Step 3.1: Ajouter intentFilters dans app.json**

Modifier `mobile/app.json` section `android`:

```json
{
  "expo": {
    "android": {
      "package": "com.deepsight.app",  // existing — confirm
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            { "scheme": "deepsight", "host": "voice-call" }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        },
        {
          "action": "SEND",
          "data": [
            { "mimeType": "text/plain" }
          ],
          "category": ["DEFAULT"]
        }
      ]
    }
  }
}
```

- [ ] **Step 3.2: Adapter useDeepLinkURL pour le format Android SEND**

Quand Android partage `text/plain`, l'app reçoit l'intent via `Linking.getInitialURL()` retournant un URL fabriqué par Expo OU on peut intercepter l'`Intent.EXTRA_TEXT` directement. Selon la version Expo, `expo-linking` peut ne pas exposer `EXTRA_TEXT`. Solution :

Modifier `mobile/src/hooks/useDeepLinkURL.ts` pour gérer 2 formats :

```typescript
useEffect(() => {
  const handle = (raw: string) => {
    // Format 1 : deep link standard deepsight://voice-call?url=...
    const parsed = Linking.parse(raw);
    if (parsed.path === "voice-call" && parsed.queryParams?.url) {
      const target = String(parsed.queryParams.url);
      const autostart = parsed.queryParams?.autostart === "true";
      if (validateVideoURL(target)) {
        onURL(target, autostart);
        return;
      }
    }

    // Format 2 : Android SEND intent — l'URL est passée brut comme text/plain
    // Expo Linking ne donne pas EXTRA_TEXT directement, mais sur SDK 54 si
    // l'app est ouverte via SEND, getInitialURL() retourne null. On utilise
    // alors expo-share-intent OU un module natif. POUR L'INSTANT (option 2),
    // on dépend du share extension iOS qui forward un deep link bien formé.
    // Android SEND brut nécessite expo-share-intent.
  };
  // ... rest of hook
}, [onURL]);
```

Si Task 1 FAILED (option 2), Android SEND brut nécessite quand même `expo-share-intent` OU un native module Java custom (effort +). Décision pragmatique : **Android utilise expo-share-intent (community) même en option 2 pour iOS**, car Android SEND est trop fastidieux à implémenter à la main.

```bash
cd mobile && npx expo install expo-share-intent
```

Et dans `app.json`, plugin :

```json
[
  "expo-share-intent",
  { "androidOnly": true, "androidIntentFilters": ["text/plain"] }
]
```

Puis dans `useDeepLinkURL.ts` import :

```typescript
import { useShareIntent } from "expo-share-intent";

export function useDeepLinkURL(onURL: OnURL): void {
  // ... existing Linking handler

  // expo-share-intent fallback for Android
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  useEffect(() => {
    if (hasShareIntent && shareIntent?.text) {
      const m = shareIntent.text.match(/https?:\/\/[^\s]+/);
      if (m && validateVideoURL(m[0])) {
        onURL(m[0], true);
        resetShareIntent();
      }
    }
  }, [hasShareIntent, shareIntent, onURL, resetShareIntent]);
}
```

- [ ] **Step 3.3: Update test for useDeepLinkURL**

Add test case for `expo-share-intent` integration. Mock `expo-share-intent`'s `useShareIntent` hook.

- [ ] **Step 3.4: Run tests**

```bash
cd mobile && npm test -- useDeepLinkURL
```

Expected: PASS.

- [ ] **Step 3.5: Commit**

```bash
git add mobile/app.json mobile/src/hooks/useDeepLinkURL.ts mobile/__tests__/hooks/useDeepLinkURL.test.ts mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): Android SEND intent filter + expo-share-intent fallback for Android share"
```

---

## Task 4: EAS Build natif config

**Files:** `mobile/eas.json`

- [ ] **Step 4.1: Vérifier developmentClient en mode dev**

Lire `mobile/eas.json`. Confirmer (ou ajouter) :

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development"
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview"
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  }
}
```

⚠️ Pas d'`Expo Go` mention. Le dev build est nécessaire dès maintenant.

- [ ] **Step 4.2: Documenter dans README mobile**

Ajouter dans `mobile/CLAUDE.md` (section build) :

```markdown
## ⚠️ Quick Voice Call mobile V3 — dev build natif requis

À partir de `feat/quick-voice-call-mobile-v3`, l'app utilise des Share Extensions natives (iOS Swift + Android Intent Filter). Expo Go ne fonctionne PLUS pour ce flow.

Pour développer :
- `npx expo run:ios` ou `npx expo run:android` (build natif local, lent au 1er run)
- OU `eas build --profile development --platform all` (build cloud, ~10-15 min)
- Installer le dev build sur device/simulator → utiliser `npx expo start --dev-client`
```

- [ ] **Step 4.3: Commit**

```bash
git add mobile/eas.json mobile/CLAUDE.md
git commit -m "ops(mobile): EAS dev build natif config + doc Share Extensions requirement"
```

---

## Task 5: Local prebuild + verify Xcode project

**Files:** None (validation step)

- [ ] **Step 5.1: Prebuild local**

```bash
cd mobile && npx expo prebuild --clean --platform ios
```

Expected: succès, `ios/DeepSightShareExtension/` créé avec ShareViewController.swift + Info.plist + storyboard.

```bash
cd mobile && npx expo prebuild --clean --platform android
```

Expected: succès, `android/app/src/main/AndroidManifest.xml` contient les `<intent-filter>` ajoutés.

- [ ] **Step 5.2: Si prebuild iOS échoue**

Erreurs courantes :
- `target already exists` → custom plugin a un bug d'idempotence. Fix : check si target existe avant `addTarget`.
- `MainInterface.storyboard not found` → asset path mal copié. Fix : vérifier `mobile/plugins/share-extension-assets/`.
- `Bundle ID mismatch` → set `PRODUCT_BUNDLE_IDENTIFIER` correctly dans le plugin.

Itérer jusqu'à succès.

- [ ] **Step 5.3: Vérifier compilation iOS (Xcode)**

```bash
cd mobile/ios && open *.xcworkspace
```

Dans Xcode, sélectionner le scheme `DeepSightShareExtension` → Build (Cmd+B).

Expected: build succeeded sans erreur Swift.

- [ ] **Step 5.4: Commit prebuilt artifacts (si nécessaire)**

Normalement `ios/` et `android/` sont gitignorés en mode managed. Si tu passes en mode bare, commit. Sinon, just commit le plugin + assets.

Si déjà committés :

```bash
git add ios/DeepSightShareExtension/ android/app/src/main/AndroidManifest.xml
git commit -m "feat(mobile): prebuilt native projects with Share Extensions"
```

---

## Task 6: EAS Build dev iOS + Android

**Files:** None

- [ ] **Step 6.1: Login EAS**

```bash
cd mobile && eas login
```

(Si déjà loggué, skip.)

- [ ] **Step 6.2: Build iOS dev**

```bash
eas build --profile development --platform ios
```

Attendre ~10-15 min. Récupérer le `.ipa` ou installer via QR code sur device de test.

- [ ] **Step 6.3: Build Android dev**

```bash
eas build --profile development --platform android
```

Attendre ~10-15 min. Récupérer le `.apk` ou installer via QR code.

- [ ] **Step 6.4: Smoke test rapide**

Sur iOS device :
1. Installer le dev build
2. `npx expo start --dev-client` sur le Mac
3. Vérifier que l'app se lance et que Home s'affiche

Sur Android device :
1. Installer le dev build
2. Idem

Si OK → passer à Task 7.

---

## Task 7: Smoke test E2E manuel — Share extension iOS

**Files:** `mobile/__tests__/native/sharedURL.smoke.md` (NEW — checklist)

- [ ] **Step 7.1: Créer la checklist E2E**

```markdown
# E2E Smoke Test — Quick Voice Call mobile V3 Share Extensions

**Build** : eas dev profile, branche `feat/quick-voice-call-mobile-v3`.
**Dépendance backend** : PR1 mergée + déployée Hetzner. Vérifier `https://api.deepsightsynthesis.com/api/voice/context/stream?session_id=ping` → 401.

## iOS — Share depuis YouTube app

1. [ ] Ouvrir l'app YouTube iOS
2. [ ] Choisir une vidéo publique (ex : `https://www.youtube.com/watch?v=dQw4w9WgXcQ`)
3. [ ] Tap "Partager" (icône)
4. [ ] Vérifier que "DeepSight Voice Call" apparaît dans la grille des activités
5. [ ] Tap "DeepSight Voice Call"
6. [ ] L'app DeepSight s'ouvre
7. [ ] **Vérifier** : VoiceScreen modal apparaît AUTOMATIQUEMENT (autostart=true)
8. [ ] **Vérifier** : indicateur "Connecting..." puis "Listening"
9. [ ] **Vérifier** : agent dit "j'écoute la vidéo en même temps que toi" ou similaire
10. [ ] Parler "Donne-moi un résumé"
11. [ ] **Vérifier** : agent répond avec "d'après ce que j'écoute pour l'instant…"
12. [ ] Attendre 30-60s → progress bar atteint 100% + "Contexte vidéo complet"
13. [ ] Re-poser une question
14. [ ] **Vérifier** : agent répond avec "maintenant que j'ai tout le contexte…"
15. [ ] Tap hangup
16. [ ] **Vérifier** : PostCallScreen apparaît avec transcript + 2 CTAs

## iOS — Share depuis TikTok app

Reproduire steps 1-16 avec TikTok app. **Vérifier** que l'extraction transcript TikTok fonctionne (le `transcripts/tiktok.py` existant a ses propres fallbacks).

## iOS — Share depuis Safari (URL collée)

1. [ ] Safari → barre URL → coller `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → Go
2. [ ] Tap "Partager" (icône safari)
3. [ ] Vérifier "DeepSight Voice Call" + tap
4. [ ] Reproduire steps 6-16

## Android — Share depuis YouTube app

Reproduire la procédure iOS sur device Android. L'expérience peut différer :
- "DeepSight Voice Call" apparaît dans la liste de partage Android
- Tap → l'app s'ouvre avec autostart
- Reste du flow identique

## Android — Share depuis TikTok app

Idem.

## Test négatif — URL non supportée

1. [ ] Safari → coller `https://vimeo.com/123` → Go
2. [ ] Partager → DeepSight Voice Call
3. [ ] **Vérifier** : l'app s'ouvre mais l'appel NE démarre PAS (URL filtered out par `validateVideoURL`)
4. [ ] **Vérifier** : optionnel — toast d'erreur "Source non supportée" (TODO si manque)

## Test deep link manuel

1. [ ] Notes app → coller `deepsight://voice-call?url=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ&autostart=true` → tap
2. [ ] **Vérifier** : DeepSight s'ouvre + autostart Voice Call

## Verdict

- [ ] iOS YouTube : PASS / FAIL
- [ ] iOS TikTok : PASS / FAIL
- [ ] iOS Safari : PASS / FAIL
- [ ] Android YouTube : PASS / FAIL
- [ ] Android TikTok : PASS / FAIL
- [ ] URL non supportée filtered : PASS / FAIL
- [ ] Deep link manuel : PASS / FAIL

Tester par : __________ Date : __________
```

- [ ] **Step 7.2: Exécuter la checklist sur device réel**

L'utilisateur (ou un testeur) coche chaque ligne sur device iOS + Android.

- [ ] **Step 7.3: Si bloquants découverts**

- "DeepSight Voice Call" pas dans la liste partage → `Info.plist` `NSExtensionActivationRule` mal config → fix asset.
- App s'ouvre mais autostart ne déclenche pas → `useDeepLinkURL` mal câblé OU `Linking.getInitialURL()` retourne null → debug avec console.log dans le hook + dev build.
- Permission micro refusée → `Info.plist` principal manque `NSMicrophoneUsageDescription` → ajouter.

Fix + rebuild + recommencer Task 6 + 7.

- [ ] **Step 7.4: Commit checklist**

```bash
git add mobile/__tests__/native/sharedURL.smoke.md
git commit -m "test(mobile): add E2E smoke checklist for Share Extensions"
```

---

## Task 8: Open PR3 + soumettre TestFlight / Play Internal

- [ ] **Step 8.1: Vérifier que tout build EAS prod passe**

```bash
cd mobile && eas build --profile production --platform all
```

(Peut être différé si la PR3 est mergée et qu'on fait un release séparé.)

- [ ] **Step 8.2: Ouvrir la PR**

```bash
cd C:/Users/33667/DeepSight-quick-voice-mobile
gh pr create --title "feat(mobile): Quick Voice Call mobile V3 — PR3 native Share Extensions iOS + Android" --body "$(cat <<'EOF'
## Summary

PR3 du Quick Voice Call mobile V3 : Share Extensions natives pour permettre le partage depuis YouTube/TikTok app vers DeepSight Voice Call avec **zéro paste**.

- iOS : Share Extension (Swift) + Info.plist NSExtensionActivationRule + custom Expo config plugin
- Android : intentFilters SEND text/plain + scheme deepsight VIEW
- Mobile : `useDeepLinkURL` étendu pour gérer expo-share-intent (Android SEND fallback)
- EAS Build natif obligatoire (plus Expo Go) — doc mobile/CLAUDE.md updated
- Checklist E2E manuel `mobile/__tests__/native/sharedURL.smoke.md`

Spec: `docs/superpowers/specs/2026-04-27-quick-voice-call-mobile-v3-design.md` § 9
Plan: `docs/superpowers/plans/2026-04-27-quick-voice-call-mobile-v3-pr3-native.md`

⚠️ Dépend de PR1 backend + PR2 mobile UI mergées et déployées.

## Test plan

- [ ] EAS Build dev iOS PASS
- [ ] EAS Build dev Android PASS
- [ ] Smoke test iOS (YouTube + TikTok + Safari) selon checklist
- [ ] Smoke test Android (YouTube + TikTok)
- [ ] Test négatif URL non supportée (Vimeo) → app ne démarre pas l'appel
- [ ] Deep link manuel `deepsight://voice-call?url=...&autostart=true` fonctionne

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 8.3: Soumettre TestFlight (post-merge)**

```bash
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

(Une fois la PR mergée + tag v.X.Y.Z créé.)

---

## Self-Review Checklist (run before merging PR3)

- [ ] Task 1-8 done
- [ ] `npx expo prebuild` passe sur les 2 plateformes
- [ ] Xcode build du target `DeepSightShareExtension` succeeds
- [ ] Android `AndroidManifest.xml` contient `<intent-filter android:label="DeepSight Voice Call">` SEND text/plain
- [ ] iOS `Info.plist` du Share Extension contient `NSExtensionActivationSupportsWebURLWithMaxCount: 1`
- [ ] Smoke test E2E coché sur iOS device
- [ ] Smoke test E2E coché sur Android device
- [ ] Pas de regression sur Expo Go pour les autres flows non-share (Library, Study, Profile)
- [ ] `mobile/CLAUDE.md` mis à jour avec la nouvelle exigence dev build natif

---

## Post-merge — Release & monitoring

- [ ] Tag release `v3.X.Y` (semver mineure pour cette killer feature)
- [ ] EAS submit App Store + Play Store
- [ ] Monitor PostHog metrics (`share_extension_opened_count`, `voice_call_started?source=share_os`)
- [ ] Si > 5% des Voice Calls viennent de Share Extension dans la 1ère semaine → succès du flow viral.

---

## Décisions ouvertes — confirmées en cours d'exécution

| #   | Décision                                          | Action            |
| --- | ------------------------------------------------- | ----------------- |
| 1   | expo-share-intent compat SDK 54                   | Tester en Task 1  |
| 2   | App Group iOS pour partage data extension ↔ app   | Pas nécessaire — deep link suffit (V3.1 si on veut persister state) |
| 3   | Android SEND brut sans expo-share-intent           | Refusé — trop d'effort native module Java. expo-share-intent par défaut. |
| 4   | Toast erreur "Source non supportée"                | Différé V3.1 (TODO documenté dans Home Step 9.2) |
