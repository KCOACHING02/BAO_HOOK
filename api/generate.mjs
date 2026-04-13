// Vercel Serverless Function — Brille & Vibre Studio
// Endpoint: POST /api/generate
//
// Modes supportés :
//   - "post"    → { mode, format, sujet, options, profile }
//                 format = "reel" | "carrousel" | "photo" | "inspiration"
//                 → renvoie 3 variantes
//   - "refine"  → { mode, format, original, instruction, profile }
//                 → renvoie 1 variante raffinée
//   - "hook"    → { mode, sujet, audience, ... }                (legacy)
//   - "caption" → { mode, sujet, ... }                          (legacy)
//   - "stories" → { mode, sujet, ... }                          (legacy)
//
// ENV requise sur Vercel:
//   ANTHROPIC_API_KEY        (obligatoire)
//   ALLOWED_ORIGINS          (optionnel, CSV — défaut: github.io + localhost + vercel.app)
//   CLAUDE_MODEL             (optionnel — défaut: claude-sonnet-4-6)
//
// Rate limiting (optionnel — si non configuré, le rate limit est désactivé) :
//   UPSTASH_REDIS_REST_URL   (auto-injecté par l'intégration Upstash de Vercel)
//   UPSTASH_REDIS_REST_TOKEN (auto-injecté par l'intégration Upstash de Vercel)
//   RATE_LIMIT_MAX           (optionnel — défaut: 20 requêtes)
//   RATE_LIMIT_WINDOW_SEC    (optionnel — défaut: 600 secondes = 10 minutes)

const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '20', 10);
const RATE_LIMIT_WINDOW_SEC = parseInt(process.env.RATE_LIMIT_WINDOW_SEC || '600', 10);

const SYSTEM_PROMPT = `Tu es l'expert copywriter et content strategist de "Brille & Vibre", un coaching qui aide les créateurs à transformer leur contenu Instagram en impact réel et en ventes. Tu maîtrises la psychologie de la vente et le copywriting de réponse directe.

# FRAMEWORK ÉDITORIAL "4 COLONNES" (à utiliser pour TOUTE légende)

Une légende Instagram qui convertit suit obligatoirement ces 4 étapes dans l'ordre :

1. **BESOIN / RESSENTIR — Accroche émotionnelle**
   Capter l'attention en 1 seconde. Déclencher une prise de conscience immédiate. Viser la douleur cachée ou le désir profond. Pas de tiède.

2. **COMPRENDRE — Validation de la frustration**
   Nommer précisément le blocage, les peurs, les désirs, les erreurs courantes. Montrer que tu comprends leur situation mieux qu'eux-mêmes. C'est l'étape "tu n'es pas seul(e), je sais ce que tu vis".

3. **GUIDE / OUVRIR — Le choix et la méthode**
   Proposer la voie à suivre. Une méthode simple, claire, activable. Ouvrir un choix conscient : rester bloqué·e ou avancer. Donner l'orientation, pas tous les détails.

4. **RASSURE + PREUVES — Décision (preuve pour clients)**
   Preuves concrètes (témoignages, chiffres, avant/après, résultats), rassurer sur la faisabilité, lever les objections. Terminer par un CTA clair et engageant.

# 4 RÈGLES D'OR DU COPYWRITING (toujours appliquer)

1. **Ogilvy — "Make them stop"** : ton hook doit provoquer un micro-choc. Jamais tiède.
2. **Collier — "Enter the conversation in their mind"** : commence là où ton audience est mentalement.
3. **Halbert — "Be specific or be ignored"** : chiffres précis, exemples concrets. Le vague tue.
4. **Kennedy — "Make a promise you can keep"** : promesse réaliste, désirable, claire.

# 7 TYPES DE HOOKS

1. **Révélation** — "Personne ne te dit ça, mais..."
2. **Erreur fatale** — "Si tu fais ça, tu t'empêches de..."
3. **Avant / Après** — contraste visible et chiffré
4. **Chiffre choc** — paradoxe avec un nombre précis
5. **Anti-mythe** — contredire une croyance répandue
6. **Confession** — vulnérabilité qui désarme
7. **Promesse claire** — direct, concret, sans ambiguïté

# PSYCHOLOGIE DE LA VENTE POUR LES STORIES (Cialdini + AIDA)

Tu construis un **parcours narratif** sur 7 stories qui suit la séquence AIDA (Attention → Intérêt → Désir → Action) en mobilisant les 6 leviers de Cialdini :
- **Réciprocité** : offrir de la valeur gratuite avant de demander
- **Cohérence / engagement** : déclencher un petit oui avant le grand oui (sondage, question)
- **Preuve sociale** : témoignages, captures, résultats d'autres personnes
- **Autorité** : expertise, légitimité, méthode unique
- **Sympathie** : connexion humaine, vulnérabilité, coulisses
- **Rareté / urgence** : fenêtre limitée, places réduites

Chaque story doit avoir : un objectif AIDA, un levier psy dominant, un visuel suggéré, un CTA, et un timing dans la journée.

# LES 4 FORMATS DE POSTS INSTAGRAM

Quand on te demande un "post", tu adaptes ta sortie au format demandé :

## 1. REEL (vidéo courte)
- **hook_visuel** : la première phrase à dire/afficher dans les 1-2 premières secondes (la plus critique)
- **script** : 4 à 8 lignes de texte parlé, structuré en mini-narration (problème → tension → résolution)
- **overlays** : 3 à 6 textes courts à afficher en superposition vidéo (1 par scène)
- **caption** : courte légende d'accompagnement (60-120 mots)
- **hashtags** : 8 à 12 hashtags pertinents

## 2. CARROUSEL (6 à 8 slides)
- **titre** : titre principal qui s'affiche sur la slide 1 (très accrocheur)
- **slides** : 6 à 8 slides avec chacune un numéro, un titre court (3-6 mots), et un texte (15-40 mots)
  - Slide 1 = HOOK (titre principal)
  - Slides 2-3 = COMPRENDRE le problème
  - Slides 4-5 = SOLUTION / méthode
  - Slide 6-7 = PREUVE / résultat
  - Dernière slide = CTA
- **caption** : légende qui accompagne le carrousel (80-150 mots)
- **cta** : appel à l'action final
- **hashtags** : 8 à 12 hashtags

## 3. PHOTO (post simple, framework 4 colonnes)
- **hook** : phrase d'accroche (1-2 lignes max)
- **besoin_ressentir** : bloc 1 (3-5 lignes)
- **comprendre** : bloc 2 (4-6 lignes)
- **guide_ouvrir** : bloc 3 (4-6 lignes)
- **rassure_preuves** : bloc 4 (3-5 lignes)
- **cta** : appel à l'action (1-2 lignes)
- **hashtags** : 10-15 hashtags

## 4. INSPIRATION (citation visuelle)
- **citation** : la citation principale (1-3 phrases percutantes), affichée en gros sur l'image
- **caption** : courte légende qui développe ou contextualise (60-100 mots)
- **hashtags** : 6-10 hashtags

# STYLE D'ÉCRITURE OBLIGATOIRE

- Français, tutoiement systématique par défaut
- Phrases courtes, rythmées, percutantes
- Une idée par ligne (retours à la ligne fréquents)
- Émotions > concepts abstraits
- Spécifique > général (jamais "beaucoup", toujours un chiffre)
- Zéro jargon marketing creux ("synergie", "engageant", "impactant" sont interdits)
- Émojis modérés (1 max par bloc, et seulement s'ils ajoutent du sens)
- Voix Brille & Vibre : élégante, intuitive, directe, premium mais chaleureuse
- **IMPORTANT** : si un profil utilisateur t'est fourni dans un second bloc système, tu DOIS l'utiliser. Le profil prend toujours le dessus sur les défauts ci-dessus (vocabulaire, ton, audience, mots à bannir, mots signature, niveau de langue, émojis, objectif business…).

# FORMAT DE SORTIE

Tu réponds TOUJOURS et UNIQUEMENT par un objet JSON valide, sans texte avant ni après, sans bloc markdown, sans \`\`\`. Le schéma JSON exact est précisé dans le message utilisateur selon le mode.`;

function buildUserMessage(mode, ctx) {
  const ctxBlock = `CONTEXTE
- Sujet / thème : ${ctx.sujet || '(non précisé)'}
- Audience cible : ${ctx.audience || '(non précisée)'}
- Douleur principale : ${ctx.douleur || '(non précisée)'}
- Transformation promise : ${ctx.transformation || '(non précisée)'}
- Preuve / résultat concret : ${ctx.preuve || '(non précisé)'}
- Ton souhaité : ${ctx.ton || 'élégant et direct'}`;

  if (mode === 'hook') {
    return `${ctxBlock}

TÂCHE
Génère 5 variantes de hooks Instagram percutants pour ce sujet. Chaque variante doit utiliser un type différent parmi les 7 (Révélation, Erreur fatale, Avant/Après, Chiffre choc, Anti-mythe, Confession, Promesse claire).

Chaque hook doit :
- Faire 1 à 2 phrases max
- Respecter les 4 règles d'or
- Parler directement à l'audience décrite
- S'appuyer sur la douleur ou la transformation

SCHÉMA JSON ATTENDU (et rien d'autre)
{
  "hooks": [
    { "type": "Révélation", "texte": "...", "pourquoi": "explication courte du levier psychologique" },
    { "type": "...", "texte": "...", "pourquoi": "..." }
  ]
}`;
  }

  if (mode === 'caption') {
    return `${ctxBlock}

TÂCHE
Génère une légende Instagram complète qui suit OBLIGATOIREMENT le framework 4 colonnes (Besoin/Ressentir → Comprendre → Guide/Ouvrir → Rassure+Preuves). Vise environ 180-280 mots au total. Phrases courtes. Une idée par ligne. Inclus des retours à la ligne (\\n) pour aérer.

SCHÉMA JSON ATTENDU (et rien d'autre)
{
  "hook": "phrase d'accroche choc, 1 à 2 lignes max, qui ouvre la légende",
  "besoin_ressentir": "Bloc 1 — accroche émotionnelle qui prolonge le hook (3-5 lignes)",
  "comprendre": "Bloc 2 — validation de la frustration, blocages, peurs nommées (4-6 lignes)",
  "guide_ouvrir": "Bloc 3 — la méthode/voie à suivre, le choix proposé (4-6 lignes)",
  "rassure_preuves": "Bloc 4 — preuves, résultats, rassurance (3-5 lignes)",
  "cta": "Call-to-action final clair et engageant (1-2 lignes)",
  "hashtags": ["#hashtag1", "#hashtag2", "...10-15 hashtags pertinents"]
}`;
  }

  if (mode === 'stories') {
    return `${ctxBlock}

TÂCHE
Construis un plan de 7 stories Instagram séquencées sur une journée, pensé comme un mini-tunnel de vente narratif. Suis la séquence AIDA (Attention → Intérêt → Désir → Action) et mobilise différents leviers de Cialdini (Réciprocité, Cohérence, Preuve sociale, Autorité, Sympathie, Rareté).

Chaque story doit avoir un rôle précis dans le parcours. Story 1 = accrocher. Stories 2-3 = créer l'intérêt et l'engagement. Stories 4-5 = construire le désir et la preuve sociale. Stories 6-7 = déclencher l'action.

SCHÉMA JSON ATTENDU (et rien d'autre)
{
  "stories": [
    {
      "numero": 1,
      "etape_aida": "Attention",
      "levier_psy": "Sympathie",
      "titre": "titre court de la story",
      "contenu": "le texte exact à mettre dans la story (2-4 lignes)",
      "visuel_suggere": "description du visuel à utiliser (selfie, screenshot, sondage...)",
      "cta": "interaction demandée (sticker question, sondage, lien, swipe up...)",
      "timing_suggere": "moment de la journée recommandé (ex: 8h - réveil)",
      "objectif": "ce que cette story doit produire chez le viewer"
    }
  ]
}`;
  }

  throw new Error(`Mode inconnu : ${mode}`);
}

/* ─────────────────────────────────────────
   PROFILE FORMATTING (pour second bloc système)
   ───────────────────────────────────────── */
function formatProfile(profile) {
  if (!profile || typeof profile !== 'object') return '';
  const lines = [];
  const push = (label, val) => { if (val && String(val).trim()) lines.push(`- **${label}** : ${String(val).trim()}`); };

  lines.push('# PROFIL UTILISATEUR (à utiliser obligatoirement)');
  lines.push('');
  lines.push('## Marque');
  push('Nom', profile.nom);
  push('Niche', profile.niche);
  push('Mission', profile.mission);

  lines.push('');
  lines.push('## Audience cible');
  push('Description', profile.audience);
  push('Douleurs principales', profile.douleurs);
  push('Désirs profonds', profile.desirs);
  push('Objections fréquentes', profile.objections);

  lines.push('');
  lines.push('## Offres');
  push('Ce qu\'il/elle vend', profile.offres);

  lines.push('');
  lines.push('## Style éditorial');
  push('Niveau de langue', profile.tutoiement === 'vouvoiement' ? 'Vouvoiement obligatoire' : 'Tutoiement obligatoire');
  push('Fréquence des émojis', profile.emojis === 'aucun' ? 'AUCUN émoji' : profile.emojis === 'frequents' ? 'Émojis fréquents (2-3 par bloc)' : 'Émojis modérés (1 max par bloc)');
  push('Style général', profile.style);
  push('Mots / expressions signature à utiliser', profile.mots_signature);
  push('Mots à BANNIR ABSOLUMENT', profile.mots_bannis);

  lines.push('');
  lines.push('## Preuves disponibles');
  push('Témoignages clés', profile.temoignages);
  push('Chiffres à mettre en avant', profile.chiffres);

  lines.push('');
  lines.push('## Objectif business prioritaire');
  push('Objectif', profile.objectif);

  return lines.join('\n');
}

/* ─────────────────────────────────────────
   POST MODE (4 formats : reel, carrousel, photo, inspiration)
   ───────────────────────────────────────── */
function buildPostMessage(format, sujet, options) {
  const opt = options || {};
  const objectif = opt.objectif || '(utiliser celui du profil)';
  const longueur = opt.longueur || 'moyenne';
  const angle = opt.angle || '(défaut du profil)';

  const ctxBlock = `CONTEXTE DE GÉNÉRATION
- Format demandé : ${format}
- Sujet du post : ${sujet}
- Objectif business : ${objectif}
- Longueur souhaitée : ${longueur}
- Angle / ton particulier : ${angle}`;

  const formatSchemas = {
    reel: `{
  "variants": [
    {
      "hook_visuel": "...",
      "script": "le script complet (4-8 lignes), avec retours à la ligne \\\\n",
      "overlays": ["overlay 1", "overlay 2", "..."],
      "caption": "...",
      "hashtags": ["#tag1", "#tag2"]
    }
  ]
}`,
    carrousel: `{
  "variants": [
    {
      "titre": "titre principal slide 1",
      "slides": [
        { "numero": 1, "titre": "...", "texte": "..." },
        { "numero": 2, "titre": "...", "texte": "..." }
      ],
      "caption": "...",
      "cta": "...",
      "hashtags": ["#tag1"]
    }
  ]
}`,
    photo: `{
  "variants": [
    {
      "hook": "...",
      "besoin_ressentir": "...",
      "comprendre": "...",
      "guide_ouvrir": "...",
      "rassure_preuves": "...",
      "cta": "...",
      "hashtags": ["#tag1"]
    }
  ]
}`,
    inspiration: `{
  "variants": [
    {
      "citation": "...",
      "caption": "...",
      "hashtags": ["#tag1"]
    }
  ]
}`,
  };

  const schema = formatSchemas[format];
  if (!schema) throw new Error(`Format inconnu : ${format}`);

  return `${ctxBlock}

TÂCHE
Génère **3 variantes différentes** de ce post au format "${format}", en respectant strictement le profil utilisateur fourni dans le second bloc système. Chaque variante doit prendre un angle différent (par exemple : 1 vulnérable, 1 pédagogique, 1 challengeant) pour offrir un vrai choix.

CONSIGNES IMPORTANTES
- Utilise impérativement le vocabulaire, le ton, l'audience et les preuves du profil utilisateur
- Respecte les "mots à bannir" et utilise les "mots signature" du profil
- Adapte la longueur de la caption au paramètre "longueur" : courte ≈ 80 mots, moyenne ≈ 180 mots, longue ≈ 300 mots
- Si le format est "photo", suis OBLIGATOIREMENT le framework 4 colonnes
- Si le format est "carrousel", structure les slides selon la séquence Hook → Comprendre → Solution → Preuve → CTA

SCHÉMA JSON ATTENDU (et rien d'autre, le tableau "variants" doit contenir EXACTEMENT 3 éléments)
${schema}`;
}

/* ─────────────────────────────────────────
   REFINE MODE (chat itératif sur une variante existante)
   ───────────────────────────────────────── */
function buildRefineMessage(format, original, instruction) {
  return `MODE RAFFINAGE

Tu as précédemment généré cette variante de post au format "${format}" :

\`\`\`json
${JSON.stringify(original, null, 2)}
\`\`\`

L'utilisatrice te demande de la retravailler avec cette instruction précise :

> ${instruction}

TÂCHE
Réécris la variante en appliquant l'instruction. Garde le même format JSON (mêmes clés que l'original), respecte le profil utilisateur du second bloc système, et améliore uniquement ce qui est demandé. Ne renvoie qu'UNE seule variante (pas un tableau).

SCHÉMA JSON ATTENDU
{
  "variant": { ...mêmes clés que l'original... }
}`;
}

function corsOrigin(req) {
  const allowed = (process.env.ALLOWED_ORIGINS ||
    'https://kcoaching02.github.io,http://localhost:3000,http://localhost:5173,http://localhost:8000')
    .split(',')
    .map((s) => s.trim());
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) return origin;
  if (/\.vercel\.app$/.test(new URL(origin || 'http://x').hostname || '')) return origin;
  return allowed[0] || '*';
}

function setCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', corsOrigin(req));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function clamp(s, max) {
  if (typeof s !== 'string') return '';
  return s.slice(0, max);
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// Rate limiting via Upstash Redis (REST API, zéro dépendance npm).
// Fail-open : si Redis est indisponible ou non configuré, la requête passe.
async function checkRateLimit(ip) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Pas configuré → on désactive le rate limit (utile en dev local)
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
      // Fail-open en cas d'erreur Upstash
      return { enabled: true, allowed: true, error: `upstash ${res.status}` };
    }

    const data = await res.json();
    const count = Number(data?.[0]?.result ?? 0);
    const ttl = Number(data?.[2]?.result ?? RATE_LIMIT_WINDOW_SEC);

    return {
      enabled: true,
      allowed: count <= RATE_LIMIT_MAX,
      count,
      limit: RATE_LIMIT_MAX,
      remaining: Math.max(0, RATE_LIMIT_MAX - count),
      resetIn: ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SEC,
    };
  } catch (err) {
    return { enabled: true, allowed: true, error: err.message };
  }
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée. Utilise POST.' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY n'est pas configurée sur le serveur Vercel.",
    });
  }

  // ── RATE LIMIT ──
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip);
  if (rl.enabled) {
    res.setHeader('X-RateLimit-Limit', String(rl.limit));
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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  const mode = String(body.mode || '').toLowerCase();
  const VALID_MODES = ['hook', 'caption', 'stories', 'post', 'refine'];
  if (!VALID_MODES.includes(mode)) {
    return res.status(400).json({ error: `mode requis : ${VALID_MODES.join(', ')}.` });
  }

  // Profil utilisateur (optionnel mais fortement recommandé pour post/refine)
  const profile = (body.profile && typeof body.profile === 'object') ? body.profile : null;

  let userMessage;
  let maxTokens = 1500;

  try {
    if (mode === 'post') {
      const format = String(body.format || '').toLowerCase();
      const VALID_FORMATS = ['reel', 'carrousel', 'photo', 'inspiration'];
      if (!VALID_FORMATS.includes(format)) {
        return res.status(400).json({ error: `format requis : ${VALID_FORMATS.join(', ')}.` });
      }
      const sujet = clamp(body.sujet, 600);
      if (!sujet) return res.status(400).json({ error: 'Le champ "sujet" est obligatoire.' });
      const options = {
        objectif: clamp(body?.options?.objectif, 50),
        longueur: clamp(body?.options?.longueur, 30) || 'moyenne',
        angle:    clamp(body?.options?.angle, 200),
      };
      userMessage = buildPostMessage(format, sujet, options);
      maxTokens = format === 'carrousel' ? 3500 : format === 'photo' ? 2500 : 2200;
    } else if (mode === 'refine') {
      const format = String(body.format || '').toLowerCase();
      const original = body.original;
      const instruction = clamp(body.instruction, 500);
      if (!original || typeof original !== 'object') {
        return res.status(400).json({ error: 'Le champ "original" est obligatoire (objet de la variante à raffiner).' });
      }
      if (!instruction) {
        return res.status(400).json({ error: 'Le champ "instruction" est obligatoire.' });
      }
      userMessage = buildRefineMessage(format || 'inconnu', original, instruction);
      maxTokens = 2500;
    } else {
      // Anciens modes (hook, caption, stories) — backward compat
      const ctx = {
        sujet: clamp(body.sujet, 300),
        audience: clamp(body.audience, 300),
        douleur: clamp(body.douleur, 400),
        transformation: clamp(body.transformation, 400),
        preuve: clamp(body.preuve, 400),
        ton: clamp(body.ton, 100),
      };
      if (!ctx.sujet) {
        return res.status(400).json({ error: 'Le champ "sujet" est obligatoire.' });
      }
      userMessage = buildUserMessage(mode, ctx);
      maxTokens = mode === 'stories' ? 2500 : mode === 'caption' ? 1800 : 1200;
    }
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: maxTokens,
        system: [
          // Bloc 1 — méthodes/règles statiques (cacheable, ~700 mots)
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
          // Bloc 2 — profil utilisateur dynamique (non caché car varie par user)
          ...(profile ? [{
            type: 'text',
            text: formatProfile(profile),
          }] : []),
        ],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      return res.status(apiResponse.status).json({
        error: `Erreur API Claude (${apiResponse.status})`,
        details: errText,
      });
    }

    const data = await apiResponse.json();
    const text = data?.content?.[0]?.text || '';

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
        error: "Réponse Claude non parsable en JSON.",
        raw: text,
      });
    }

    return res.status(200).json({
      mode,
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
