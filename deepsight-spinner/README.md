# DeepSight Spinner

Spinner animé CSS pur, basé sur ton vrai logo DeepSight. 60fps, zéro vidéo, zéro dépendance externe.

## Fichiers

| Fichier              | Rôle                                                            |
| -------------------- | --------------------------------------------------------------- |
| `deepsight-logo.png` | Logo source traité (1024x1024, vignette radiale, fond noir)     |
| `Spinner.tsx`        | Composant React prêt à importer                                 |
| `Spinner.css`        | Styles + keyframes                                              |
| `spinner-demo.html`  | Démo standalone (ouvre dans navigateur pour voir les 3 tailles) |

## Aperçu visuel

Ouvre `spinner-demo.html` dans un navigateur. Les 3 tailles tournent simultanément.

## Effets magiques (nouveau)

5 couches cumulables via prop `effects` :

| Effet    | Description                                                     |
| -------- | --------------------------------------------------------------- |
| `blades` | Conic-gradient scie qui tourne vite — traînées dorées/violettes |
| `flames` | Blobs flammes orange/rouge orbitant, flicker stroboscopique     |
| `water`  | Mist cyan/bleu en contre-rotation                               |
| `sparks` | Étincelles blanches/dorées qui giclent en rotation rapide       |
| `rings`  | Ondes magiques concentriques qui s'étendent vers l'extérieur    |
| `magic`  | Preset tout-en-un (blades + flames + water + sparks + rings)    |

```tsx
<Spinner size="lg" effects={["magic"]} />
<Spinner size="md" effects={["flames", "water"]} />
<Spinner size="sm" effects={["blades", "sparks"]} />
```

## Intégration frontend DeepSight

```tsx
// 1. Copier les 3 fichiers dans le projet
// frontend/src/components/ui/Spinner.tsx
// frontend/src/components/ui/Spinner.css
// frontend/public/deepsight-logo.png

// 2. Usage
import { Spinner } from '@/components/ui/Spinner';

<Spinner size="lg" />                          // hero landing 520px
<Spinner size="md" />                          // chargement de section 280px
<Spinner size="sm" />                          // loader inline 96px
<Spinner size="md" speed={3} />                // override vitesse
<Spinner size="sm" reverse label="Analyse…" /> // sens inverse + label a11y
```

## Effets appliqués

- **Rotation** : l'image entière (logo + halo aurora d'origine) tourne 360° en boucle
- **Vitesse par taille** : sm 2.2s (loader rapide) / md 4.5s / lg 7s (hero hypnotique)
- **Halo externe** : plasma indigo/orange/violet qui pulse à 3.5s (déborde du cercle)
- **Pulse doré central** : glow warm qui respire à 2.2s (mix-blend screen)
- **Ring** : contour net 1px + shadow violet 30px
- **Mask circulaire** : bords parfaits, pas de coins visibles pendant la rotation

## Accessibilité

- `role="status"` + `aria-live="polite"` + label visible lecteur d'écran
- `prefers-reduced-motion` : toutes les animations s'arrêtent si l'utilisateur a activé "réduire les animations"

## Ports futurs

- **Mobile Expo** : remplacer CSS par `react-native-reanimated` (rotation + pulse identiques)
- **Extension Chrome** : utiliser la même CSS, l'image pèse 800KB — peut être inlinée en base64 si besoin

## Customisation

Dans `Spinner.css`, ajuster :

- Couleurs du halo externe : `.ds-spinner::befor
