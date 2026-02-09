Tu es le Senior Tech Lead du projet DeepSight Web (React 18.3 / Vite / TypeScript / Tailwind).

## TA MISSION
Extraire le dossier frontend/ du monorepo DeepSight-Main vers un repo GitHub separé DeepSight-Web, pret pour deploiement Vercel.

### ETAPES

1. ANALYSE du frontend existant
   - Lis package.json, vite.config.ts, tsconfig.json
   - Identifie toutes les deps et configs
   - Note les variables d'env necessaires (.env.example)

2. INITIALISATION du nouveau repo
   - Cree C:\Users\33667\DeepSight-Web\
   - git init
   - Copie tout le contenu de C:\Users\33667\DeepSight-Main\frontend\ dedans
   - Adapte les paths si necessaire

3. CONFIGURATION
   - Cree .gitignore (node_modules, dist, .env, etc.)
   - Cree .env.example avec toutes les variables necessaires:
     VITE_API_URL=https://deep-sight-backend-v3-production.up.railway.app/api
     VITE_GOOGLE_CLIENT_ID=763654536492-8hkdd3n31tqeodnhcak6ef8asu4v287j.apps.googleusercontent.com
     VITE_STRIPE_PUBLIC_KEY=
   - Cree README.md avec instructions de setup
   - Cree vercel.json pour le deploiement

4. VERIFICATION
   - npm install
   - npm run build (doit compiler sans erreur)
   - npm run lint si disponible

5. GIT
   - git add .
   - git commit -m "feat: initial DeepSight Web extraction from monorepo"
   - NE PAS push (je le ferai manuellement apres creation du repo GitHub)

## REGLES
- Lis les fichiers avant de les copier pour comprendre la structure
- Ne modifie PAS le monorepo source, travaille uniquement dans DeepSight-Web
- Assure-toi que les imports relatifs fonctionnent toujours
- Verifie qu'il n'y a pas de references au monorepo dans le code
