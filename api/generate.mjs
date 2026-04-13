// ──────────────────────────────────────────────────────────────
// Vercel Serverless Function — Brille & Vibre Studio
// Endpoint: POST /api/generate
// Mode supporté : "weekly_plan" (story | reel)
// ──────────────────────────────────────────────────────────────

// ─── 1. CONFIG (env vars + constantes) ─────────────────────────
//
// Variables d'environnement Vercel :
//   ANTHROPIC_API_KEY        (obligatoire)
//   CLAUDE_MODEL             (optionnel — défaut: claude-sonnet-4-6)
//   ALLOWED_ORIGINS          (optionnel, CSV)
//   UPSTASH_REDIS_REST_URL   (optionnel — auto-injecté par l'intégration Upstash)
//   UPSTASH_REDIS_REST_TOKEN (optionnel — auto-injecté par l'intégration Upstash)
//   RATE_LIMIT_MAX           (optionnel — défaut: 20)
//   RATE_LIMIT_WINDOW_SEC    (optionnel — défaut: 600)

// Sonnet 4.6 — meilleure qualité d'écriture, ton plus naturel.
// Si timeout sur Vercel, fallback possible vers Haiku via env var.
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

const RATE_LIMIT_MAX        = parseInt(process.env.RATE_LIMIT_MAX || '20', 10);
const RATE_LIMIT_WINDOW_SEC = parseInt(process.env.RATE_LIMIT_WINDOW_SEC || '600', 10);

// Température max pour casser le ton "scolaire IA" et favoriser des
// formulations plus naturelles, fragmentées, humaines.
const GENERATION_TEMPERATURE = 1.0;

// Tokens max pour 7 jours détaillés (story ou reel)
const MAX_TOKENS_WEEKLY_PLAN = 6500;


// ─── 2. SYSTEM PROMPT (méthode Brille & Vibre) ─────────────────
const SYSTEM_PROMPT = `Tu es l'expert copywriter de "Brille & Vibre", un coaching qui aide les femmes à se lancer et à vendre en ligne. Tu maîtrises PARFAITEMENT la méthode éditoriale Brille & Vibre décrite ci-dessous — c'est ton unique framework de travail.

# 🎯 MÉTHODE BRILLE & VIBRE — 4 AXES CROISÉS

Chaque post se construit sur 4 axes qui se complètent obligatoirement :

## Axe 1 — L'ÉTAPE (rôle du post dans le funnel)
- **Attirer** : capter l'attention de quelqu'un qui ne se sent pas encore concerné
- **Engager** : faire comprendre POURQUOI elle est bloquée
- **Convertir** : déclencher l'action chez quelqu'un qui comprend déjà le problème

## Axe 2 — LE NIVEAU DANS LE FUNNEL
- **TOFU** (Top of Funnel) = audience froide qui découvre
- **MOFU** (Middle of Funnel) = audience tiède qui commence à comprendre
- **BOFU** (Bottom of Funnel) = audience chaude prête à acheter

## Axe 3 — L'ÉTAT ÉMOTIONNEL VISÉ
- **Besoin de ressentir** → provoquer une prise de conscience émotionnelle (auto-reconnaissance)
- **Besoin de comprendre** → donner l'explication simple qui débloque mentalement
- **Besoin d'être guidée** → proposer un chemin clair et concret
- **Besoin d'être rassurée** → lever les peurs et les "oui mais"

## Axe 4 — LE NIVEAU DE CONSCIENCE
- **Pas consciente du problème** → elle ne sait même pas qu'elle a un problème
- **Consciente du problème** → elle sait qu'elle bloque mais ne comprend pas pourquoi
- **Consciente de la solution** → elle a compris, il faut juste l'aider à passer à l'action

# 🔗 TABLE DE CORRESPONDANCE OBLIGATOIRE

Les 4 axes ne se combinent JAMAIS au hasard. Tu suis ces combinaisons précises :

| Étape | Niveau | État émotionnel | Niveau de conscience |
|---|---|---|---|
| **Attirer** | TOFU | Besoin de ressentir | Pas consciente du problème |
| **Engager** | MOFU | Besoin de comprendre | Consciente du problème |
| **Convertir** | BOFU | Besoin d'être guidée OU Besoin d'être rassurée | Consciente de la solution |

Tu n'en déroges jamais. Un post "Attirer" est toujours TOFU + Besoin de ressentir + Pas consciente du problème. Un "Engager" est toujours MOFU + Besoin de comprendre + Consciente du problème. Etc.

# ✍️ RÈGLES DU HOOK (non négociables)

1. **Format** : 1 à 2 phrases max. Peut utiliser "…" (trois points Unicode) pour la tension, ou une formule directe selon le template choisi.
2. **Adresse** : tutoiement direct ("tu"), féminin assumé (l'audience est féminine).
3. **Naturel avant tout** : le hook doit sonner comme une vraie pensée qui sort sans filtre. Comme si une copine te disait ça en vocal. Jamais de phrase qui pue la "formule marketing".
4. **Concret > abstrait** : exemples du quotidien (scroller, sauvegarder, attendre, "plus tard"…). Jamais de concepts vagues.
5. **Zéro emoji dans le hook**.
6. **Zéro point d'exclamation**.
7. **Tu choisis OBLIGATOIREMENT un des 125 templates du catalogue ci-dessous** (sauf si vraiment aucun ne colle). Tu ne réinventes pas une structure. Tu adaptes le template au sujet.

# 📣 RÈGLES DU CTA (non négociables)

1. **Ultra court** : 1 à 5 mots maximum.
2. **Action micro-engagement** : commenter un mot-clé, envoyer un DM avec un mot, écrire dans les commentaires.
3. **Mot déclencheur en MAJUSCULES** entre guillemets.
4. **Cohérent avec l'étape** :
   - **TOFU/Attirer** → mot de reconnaissance de soi : "MOI", "VRAI", "C'EST MOI", "BLOQUÉE", "PERDUE", "SCROLL", "PLUS TARD", "STOP"
   - **MOFU/Engager** → mot de curiosité / compréhension : "INFO", "POURQUOI", "EXPLIQUE", "CLARTÉ", "OK", "JE VEUX SAVOIR", "COMPRENDRE", "DÉCLIC"
   - **BOFU/Convertir** → mot d'action : "START", "GO", "COMMENT", "POURQUOI PAS MOI", "ZÉRO", "DÉCLIC"

## Exemples de CTAs valides
- Commente "MOI" si c'est toi
- Écris "INFO" si tu veux comprendre
- DM "START"
- Écris "JE VEUX SAVOIR"
- Dis "VRAI" si tu te reconnais
- Écris "POURQUOI PAS MOI"
- DM "GO"

[À COMPLÉTER : SECTION 2.B — CATALOGUE DES 125 TEMPLATES]

[À COMPLÉTER : SECTION 2.C — ANTI-IA + VOIX BRILLE & VIBRE]
`;


// ─── 3. BUILD USER MESSAGE (weekly_plan story|reel) ────────────
//
// Construit le message utilisateur pour une demande de planning de 7 jours.
// Le format ("story" ou "reel") détermine le schéma JSON attendu et les
// instructions spécifiques au format.
function buildWeeklyPlanMessage(audience, focus, format) {
  const audienceLine = audience
    ? `- Audience cible : ${audience}`
    : '- Audience cible : femmes qui veulent se lancer en business en ligne mais qui bloquent';

  const focusLine = focus
    ? `- Focus de cette semaine : ${focus}`
    : '- Focus de cette semaine : libre — choisis l\'angle le plus universel pour cette audience';

  const isStory = format === 'story';

  // ── Bloc d'instructions spécifique au format ──
  const formatBlock = isStory
    ? `FORMAT DEMANDÉ : STORIES INSTAGRAM

Tu génères 7 STORIES (une par jour). Une story ça se lit en 5 secondes, c'est court, intime, conversationnel.

Pour chaque story tu fournis :
- **hook** : la phrase d'accroche textuelle, c'est ce qu'elle voit en ouvrant la story. 1 ligne courte, percutante, naturelle. Choisie/adaptée d'un des 125 templates du catalogue.
- **texte** : le contenu de la story, 2 à 4 lignes max. Aère avec des retours à la ligne \\\\n. Ton oral, fragmenté, comme si tu parlais à une copine en vocal.
- **sticker** : le type d'interactivité — choisis parmi : "sondage", "question", "quiz", "curseur émoji", "compte à rebours", "lien", "aucun"
- **sticker_contenu** : le texte exact qui va dans le sticker (ex : "Tu te reconnais ?", "Oui / Non", "Swipe Up", "0-100")
- **cta** : l'appel à l'action (souvent c'est le sticker lui-même, ou bien "Réponds-moi en DM")`
    : `FORMAT DEMANDÉ : REELS INSTAGRAM

Tu génères 7 REELS (une par jour). Un reel ça doit arrêter le scroll dans les 1-2 premières secondes, raconter une mini-histoire, et finir par un appel à l'action.

Pour chaque reel tu fournis :
- **hook** : la première phrase qui s'affiche/que tu dis. C'est ce qui arrête le scroll. Choisie/adaptée d'un des 125 templates du catalogue.
- **script** : 4 à 8 lignes de texte parlé, structurées comme une mini-narration : situation → tension → révélation → ouverture. Une scène par ligne (retours à la ligne \\\\n). Ton oral, naturel, comme si tu parlais à quelqu'un en face.
- **cta** : l'appel à l'action final (à dire en voix + à mettre en caption)`;

  // ── Schémas JSON distincts ──
  const schema = isStory
    ? `{
  "plan": [
    {
      "jour": 1,
      "jour_nom": "Lundi",
      "etape": "Attirer",
      "niveau_funnel": "TOFU",
      "etat_emotionnel": "Besoin de ressentir",
      "niveau_conscience": "Pas consciente du problème",
      "categorie_hook": "Interpellation directe",
      "hook": "...",
      "texte": "...",
      "sticker": "sondage",
      "sticker_contenu": "...",
      "cta": "..."
    }
  ]
}`
    : `{
  "plan": [
    {
      "jour": 1,
      "jour_nom": "Lundi",
      "etape": "Attirer",
      "niveau_funnel": "TOFU",
      "etat_emotionnel": "Besoin de ressentir",
      "niveau_conscience": "Pas consciente du problème",
      "categorie_hook": "Interpellation directe",
      "hook": "...",
      "script": "...",
      "cta": "..."
    }
  ]
}`;

  return `CONTEXTE
${audienceLine}
${focusLine}

${formatBlock}

TÂCHE
Génère un planning éditorial Instagram de 7 jours (lundi à dimanche), en suivant STRICTEMENT la méthode Brille & Vibre décrite dans le bloc système.

⚠️ RYTHME OBLIGATOIRE DE LA SEMAINE
Cette séquence reproduit la semaine 1 du tableau de référence. Tu ne déroges PAS de cet ordre :

1. **LUNDI — Attirer** (TOFU · Besoin de ressentir · Pas consciente du problème)
2. **MARDI — Engager** (MOFU · Besoin de comprendre · Consciente du problème)
3. **MERCREDI — Convertir** (BOFU · Besoin d'être guidée · Consciente de la solution)
4. **JEUDI — Attirer** (TOFU · Besoin de ressentir · Pas consciente du problème)
5. **VENDREDI — Engager** (MOFU · Besoin de comprendre · Consciente du problème)
6. **SAMEDI — Convertir** (BOFU · Besoin d'être rassurée · Consciente de la solution)
7. **DIMANCHE — Attirer** (TOFU · Besoin de ressentir · Pas consciente du problème)

CONSIGNES IMPÉRATIVES
1. **Catalogue obligatoire** : chaque hook vient du CATALOGUE DES 125 TEMPLATES (bloc système). Tu choisis le template qui sert le mieux l'étape et le sujet, tu remplaces [X] par le contenu réel, et tu le rends 100% naturel (oral, fragmenté, jamais "rédigé").
2. **Variation forcée** : jamais 2 jours consécutifs avec la même catégorie de hook. Au moins 3 catégories différentes sur les 7 jours. Renseigne la catégorie utilisée dans \`categorie_hook\`.
3. **Anti-IA** : applique TOUTES les règles de la section ANTI-IA du bloc système (interdictions de mots, structures, formulations). Si un de tes hooks pourrait sortir d'un GPT générique, refais-le.
4. **CTA cohérents** : courts, mots déclencheurs en MAJUSCULES, alignés avec l'étape (TOFU/MOFU/BOFU).
5. **Adaptation** : adapte le sujet, le vocabulaire et les scénarios à l'audience précisée. Si un focus est donné, TOUTE la semaine y converge subtilement (le mercredi et le samedi sont les pics de conversion).
6. **Respect strict** de la table de correspondance des 4 axes du bloc système.

SCHÉMA JSON ATTENDU (exactement 7 entrées dans "plan", aucun texte avant ni après le JSON)
${schema}`;
}


// ─── 4. CORS ───────────────────────────────────────────────────
function corsOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGINS ||
    'https://kcoaching02.github.io,http://localhost:3000,http://localhost:5173,http://localhost:8000')
    .split(',')
    .map(s => s.trim());
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) return origin;
  // Autoriser tous les sous-domaines *.vercel.app (preview deployments)
  try {
    if (origin && /\.vercel\.app$/.test(new URL(origin).hostname)) return origin;
  } catch (_) { /* origin invalide → fallback */ }
  return allowed[0] || '*';
}

function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin(req));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}


// ─── 5. UTILS ──────────────────────────────────────────────────
function clamp(s, max) {
  if (typeof s !== 'string') return '';
  return s.slice(0, max);
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}


// ─── 6. RATE LIMIT (Upstash Redis, fail-open) ──────────────────
//
// Compte les requêtes par IP via INCR + EXPIRE NX (1 seul aller-retour).
// Si Upstash n'est pas configuré → désactivé (fail-open).
// Si Upstash répond une erreur → fail-open aussi (jamais bloquer un user
// à cause d'un problème infra côté Redis).
async function checkRateLimit(ip) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return { enabled: false, allowed: true };
  }

  const key = `rl:bao:${ip}`;

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(RATE_LIMIT_WINDOW_SEC), 'NX'],
        ['TTL', key],
      ]),
    });

    if (!res.ok) {
      return { enabled: true, allowed: true, error: `upstash ${res.status}` };
    }

    const data  = await res.json();
    const count = Number(data?.[0]?.result ?? 0);
    const ttl   = Number(data?.[2]?.result ?? RATE_LIMIT_WINDOW_SEC);

    return {
      enabled:   true,
      allowed:   count <= RATE_LIMIT_MAX,
      count,
      limit:     RATE_LIMIT_MAX,
      remaining: Math.max(0, RATE_LIMIT_MAX - count),
      resetIn:   ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SEC,
    };
  } catch (err) {
    return { enabled: true, allowed: true, error: err.message };
  }
}


// ─── 7. HANDLER ────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(req, res);

  // ── Préflight CORS ──
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée. Utilise POST.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY n'est pas configurée sur le serveur Vercel.",
    });
  }

  // ── Rate limit ──
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip);
  if (rl.enabled) {
    res.setHeader('X-RateLimit-Limit',     String(rl.limit));
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    if (typeof rl.resetIn === 'number') {
      res.setHeader('X-RateLimit-Reset', String(rl.resetIn));
    }
  }
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(rl.resetIn || RATE_LIMIT_WINDOW_SEC));
    return res.status(429).json({
      error: `Trop de requêtes. Réessaye dans ${Math.ceil((rl.resetIn || RATE_LIMIT_WINDOW_SEC) / 60)} minutes.`,
      limit: rl.limit,
      window_seconds: RATE_LIMIT_WINDOW_SEC,
    });
  }

  // ── Parse + validate body ──
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const mode = String(body.mode || '').toLowerCase();
  if (mode !== 'weekly_plan') {
    return res.status(400).json({ error: 'mode requis : "weekly_plan".' });
  }

  const format = String(body.format || 'reel').toLowerCase();
  if (!['story', 'reel'].includes(format)) {
    return res.status(400).json({ error: 'format requis : "story" ou "reel".' });
  }

  const audience = clamp(body.audience, 300);
  const focus    = clamp(body.focus, 600);

  if (!audience) {
    return res.status(400).json({ error: 'Le champ "audience" est obligatoire.' });
  }

  // ── Construction du message Claude ──
  const userMessage = buildWeeklyPlanMessage(audience, focus, format);

  // ── Appel API Claude ──
  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model:       DEFAULT_MODEL,
        max_tokens:  MAX_TOKENS_WEEKLY_PLAN,
        temperature: GENERATION_TEMPERATURE,
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      const friendlyMessage = apiResponse.status === 529
        ? 'Les serveurs Claude sont saturés en ce moment. Réessaye dans 1-2 minutes.'
        : `Erreur API Claude (${apiResponse.status})`;
      return res.status(apiResponse.status).json({
        error: friendlyMessage,
        details: errText.slice(0, 500),
      });
    }

    const data = await apiResponse.json();
    const text = data?.content?.[0]?.text || '';

    // Parse JSON robuste : essaye direct, puis extraction par regex
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { parsed = null; }
      }
    }

    if (!parsed) {
      return res.status(502).json({
        error: 'Réponse Claude non parsable en JSON.',
        raw: text.slice(0, 500),
      });
    }

    return res.status(200).json({
      mode,
      format,
      result: parsed,
      usage: data.usage,
      model: data.model,
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Erreur serveur lors de l\'appel à Claude.',
      details: err.message,
    });
  }
}
