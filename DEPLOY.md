# Déploiement Vercel — Brille & Vibre

Guide rapide pour déployer le générateur de contenu Instagram.

## 1 · Pré-requis

- Un compte GitHub (déjà fait, ce repo y est)
- Un compte Vercel gratuit → https://vercel.com/signup (login avec GitHub recommandé)
- Une clé API Anthropic → https://console.anthropic.com/settings/keys

## 2 · Importer le repo dans Vercel

1. Va sur https://vercel.com/new
2. Clique sur **Import Git Repository**
3. Sélectionne `kcoaching02/bao_hook`
4. **Framework Preset** : laisse sur *Other* (c'est un site statique + une fonction Node)
5. **Root Directory** : laisse vide (racine du repo)
6. Ne touche à rien d'autre — clique **Deploy**

Vercel détecte automatiquement :
- Les fichiers `.html` à la racine (servis statiquement)
- Le dossier `api/` qui contient les serverless functions

## 3 · Configurer la clé API

Une fois le premier deploy fait :

1. Va dans **Project Settings → Environment Variables**
2. Ajoute :

| Name | Value | Environments |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (ta clé) | Production, Preview, Development |

3. (Optionnel) Tu peux aussi ajouter :
   - `CLAUDE_MODEL` → `claude-sonnet-4-6` (défaut) ou `claude-opus-4-6` pour la qualité max
   - `ALLOWED_ORIGINS` → liste d'URLs séparées par virgules autorisées à appeler l'API. Défaut : `https://kcoaching02.github.io,http://localhost:3000,http://localhost:5173,http://localhost:8000`

4. **Important** : après avoir ajouté la clé, redéploie le projet (Deployments → ... → Redeploy) sinon la fonction n'aura pas accès à la variable.

## 4 · Tester

Ouvre l'URL Vercel donnée (ex : `https://bao-hook.vercel.app/content-generator.html`) et lance une génération.

## 5 · (Optionnel) Garder GitHub Pages comme front

Si tu veux **garder ton site sur GitHub Pages** mais utiliser Vercel uniquement comme backend API :

1. Dans `content-generator.html`, modifie la constante en haut du `<script>` :

```js
const API_BASE = 'https://bao-hook.vercel.app'; // ton URL Vercel
```

2. Push sur GitHub. GitHub Pages servira la page, Vercel servira l'API.

## 6 · Auto-redeploy

À chaque `git push` sur la branche `main` (ou la branche que tu connectes à Vercel), Vercel redéploie automatiquement. Pas besoin de toucher au dashboard.

---

## Architecture

```
bao_hook/
├── index.html                   ← outil hooks (statique)
├── content-generator.html       ← générateur IA (statique)
├── api/
│   └── generate.js              ← serverless function (Node, runtime Vercel)
├── vercel.json                  ← config Vercel
└── package.json                 ← métadonnées + type:module
```

## Coût estimé

- **Vercel** : gratuit (Hobby plan suffit largement — 100 GB-h de fonctions/mois)
- **Anthropic API** : ~0,003 € à 0,015 € par génération avec `claude-sonnet-4-6` selon la longueur. Le prompt caching activé sur le system prompt réduit le coût des appels suivants de ~90 %.

## Sécurité

- La clé API n'est JAMAIS exposée au navigateur — elle reste dans `process.env` côté serverless
- CORS limité par `ALLOWED_ORIGINS` (modifiable via env var)
- Limite de taille sur les inputs utilisateur (anti-abuse de base)

Pour aller plus loin (rate limiting par IP, auth utilisateur, logs), on pourra ajouter Upstash Redis + un middleware. Suffit de demander.
