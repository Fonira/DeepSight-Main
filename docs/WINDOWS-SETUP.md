# Windows Setup — Terminal recommandé

Guide rapide pour configurer un environnement Windows confortable pour développer sur DeepSight.

---

## Pourquoi pas la console PowerShell par défaut ?

La fenêtre `powershell.exe` historique (conhost) souffre de :

- Rendu CPU lent, pas de ligatures
- Pas d'onglets ni de splits
- Configuration limitée (couleurs, police)
- Mauvaise gestion de l'Unicode et des séquences ANSI modernes

PowerShell **reste un excellent shell** — c'est juste l'émulateur de terminal qui est dépassé.

---

## Recommandation : Windows Terminal

**Windows Terminal** (Microsoft, open source) est le meilleur émulateur de terminal pour Windows :

- Rendu GPU (rapide même avec gros logs)
- Onglets, splits horizontaux/verticaux
- Support natif PowerShell, cmd, WSL, SSH
- Thèmes, polices custom, ligatures
- Compatibilité parfaite avec `npm`, `expo`, `git`, `ssh` — workflows DeepSight

> WezTerm est plus puissant mais peut poser des soucis avec Expo/npm (encodage, raw mode). Windows Terminal = compatibilité sans friction.

---

## Installation

```powershell
winget install --id Microsoft.WindowsTerminal -e
```

Alternative Microsoft Store : `ms-windows-store://pdp/?productid=9N0DX20HK701`

### Bonus — PowerShell 7 (recommandé)

PowerShell 7 est nettement plus rapide que le 5.1 livré avec Windows :

```powershell
winget install --id Microsoft.PowerShell -e
```

---

## Configuration recommandée pour DeepSight

Ouvrir Windows Terminal puis `Ctrl+,` pour les paramètres.

### Démarrage

- **Profil par défaut** : PowerShell (PS 7+ — pas "Windows PowerShell")
- **Répertoire de démarrage** : `C:\Users\33667\DeepSight-Main`

### Apparence

- **Thème** : `One Half Dark` ou `Campbell Powerline`
- **Police** : `Cascadia Code` (incluse, ligatures supportées)
- **Acrylique** : activé, opacité ~85%

### Raccourcis utiles

| Raccourci      | Action               |
| -------------- | -------------------- |
| `Ctrl+Shift+T` | Nouvel onglet        |
| `Alt+Shift+D`  | Split panneau        |
| `Ctrl+Shift+W` | Fermer onglet/split  |
| `Ctrl+,`       | Ouvrir paramètres    |
| `Ctrl+Tab`     | Onglet suivant       |
| `Alt+Flèches`  | Naviguer entre splits|

---

## Rappel — Syntaxe PowerShell pour DeepSight

PowerShell 5.1 et 7 **n'ont pas l'opérateur `&&`** pour chaîner les commandes.

- ❌ `cd C:\Users\33667\DeepSight-Main && git pull`
- ✅ `cd C:\Users\33667\DeepSight-Main ; git pull`

Pour exécution conditionnelle (équivalent `&&` bash) en PowerShell 7+ :

```powershell
cd C:\Users\33667\DeepSight-Main; if ($?) { git pull }
```

Voir aussi la skill `windows-terminal` dans `.claude/` pour les règles complètes.

---

## Vérification post-installation

Tester que les workflows critiques DeepSight passent bien :

```powershell
cd C:\Users\33667\DeepSight-Main
npm --version
git status
ssh -i $HOME\.ssh\id_hetzner root@89.167.23.214 "echo OK"
```

Côté mobile :

```powershell
cd mobile
npx expo --version
```

Si tout répond sans erreur d'encodage ou de raw mode → setup OK.

---

## Alternative "wow effect" : Tabby

Si tu veux le terminal **le plus joli visuellement** (effet blur prononcé, onglets reorderable, command palette type VS Code, plugins), **Tabby** est une excellente alternative à Windows Terminal.

### Installation

```powershell
winget install --id Eugeny.Tabby -e
```

### Pourquoi Tabby plutôt que Windows Terminal ?

| Critère                | Windows Terminal | Tabby                          |
| ---------------------- | ---------------- | ------------------------------ |
| Rendu                  | GPU natif        | Electron (un peu plus lourd)   |
| Esthétique             | Sobre            | Très moderne, animations       |
| Profils SSH intégrés   | Manuel via JSON  | Interface graphique complète   |
| Command palette        | Limitée          | Full (`Ctrl+Shift+P`)          |
| Plugins                | Aucun            | Marketplace intégré            |
| Sync paramètres        | Non              | Oui (compte Tabby Sync)        |
| Compatibilité Claude Code CLI | ✅        | ✅                             |

### Config recommandée pour DeepSight

Au premier lancement de Tabby :

1. **Settings → Profiles & connections** : ajouter PowerShell 7 comme profil par défaut
2. **Working directory** : `C:\Users\33667\DeepSight-Main`
3. **Settings → Appearance** :
   - Theme : `Hyper` ou `Material Dark`
   - Font : `Cascadia Code` ou `JetBrains Mono`
   - Background : `Fluent` (effet acrylique Windows 11)
4. **Settings → SSH** : ajouter le profil `root@89.167.23.214` avec la clé `~/.ssh/id_hetzner` (gain de temps énorme — 1 clic = connexion VPS)

### Raccourcis Tabby utiles

| Raccourci         | Action                  |
| ----------------- | ----------------------- |
| `Ctrl+Shift+T`    | Nouvel onglet           |
| `Ctrl+Shift+D`    | Dupliquer onglet        |
| `Ctrl+Shift+P`    | Command palette         |
| `Ctrl+Shift+S`    | Split horizontal        |
| `Ctrl+Shift+E`    | Split vertical          |
| `Ctrl+Tab`        | Onglet suivant          |
| `F11`             | Plein écran             |

### Limitations à connaître

- Plus lourd en RAM que Windows Terminal (~150 MB vs ~50 MB)
- Démarrage légèrement plus lent (1-2s vs instantané)
- Quelques bugs occasionnels avec les sessions SSH longues (rares)

→ Si DeepSight tourne lourd (Expo + Vite + Docker), reste sur **Windows Terminal**. Si tu veux l'expérience la plus polie pour des sessions de code longues, **Tabby**.
