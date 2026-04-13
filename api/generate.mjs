// Vercel Serverless Function — Brille & Vibre Studio
// Endpoint: POST /api/generate
//
// Modes supportés :
//   - "weekly_plan" → { mode, audience, focus }
//                     → renvoie un planning éditorial de 7 jours stratégique
//   - "post"        → { mode, format, sujet, options, profile }   (legacy)
//   - "refine"      → { mode, format, original, instruction, profile } (legacy)
//   - "hook"        → { mode, sujet, audience, ... }              (legacy)
//   - "caption"     → { mode, sujet, ... }                        (legacy)
//   - "stories"     → { mode, sujet, ... }                        (legacy)
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

// Par défaut : Haiku 4.5 — rapide (5-10s), moins saturé, parfait pour la
// génération structurée de planning. Override possible via env var CLAUDE_MODEL.
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '20', 10);
const RATE_LIMIT_WINDOW_SEC = parseInt(process.env.RATE_LIMIT_WINDOW_SEC || '600', 10);

const SYSTEM_PROMPT = `Tu es l'expert copywriter de "Brille & Vibre", un coaching qui aide les femmes à se lancer et à vendre en ligne. Tu maîtrises PARFAITEMENT la méthode éditoriale Brille & Vibre décrite ci-dessous — c'est ton unique framework de travail.

# 🎯 MÉTHODE BRILLE & VIBRE — 4 AXES CROISÉS

Chaque post se construit sur 4 axes qui se complètent obligatoirement :

## Axe 1 — L'ÉTAPE (rôle du post dans le funnel)
- **Attirer** : capter l'attention de quelqu'un qui ne se sent pas encore concerné
- **Engager** : faire comprendre à quelqu'un POURQUOI il est bloqué
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
- **Pas consciente du problème** → le lectrice ne sait même pas qu'elle a un problème
- **Consciente du problème** → elle sait qu'elle bloque mais ne comprend pas pourquoi
- **Consciente de la solution** → elle a compris, il faut juste l'aider à passer à l'action

# 🔗 TABLE DE CORRESPONDANCE OBLIGATOIRE

Les 4 axes ne se combinent pas au hasard. Ils suivent des combinaisons précises :

| Étape | Niveau | État émotionnel possible | Niveau de conscience |
|---|---|---|---|
| **Attirer** | TOFU | Besoin de ressentir | Pas consciente du problème |
| **Engager** | MOFU | Besoin de comprendre | Consciente du problème |
| **Convertir** | BOFU | Besoin d'être guidée OU d'être rassurée | Consciente de la solution |

Tu n'en déroges jamais. Un post "Attirer" est toujours TOFU + Besoin de ressentir + Pas consciente du problème. Un post "Engager" est toujours MOFU + Besoin de comprendre + Consciente du problème. Etc.

# ✍️ RÈGLES DU HOOK (absolument non négociables)

1. **Format** : 1 à 2 phrases maximum, séparées par "…" (trois points Unicode) pour créer la tension
2. **Adresse** : tutoiement direct ("tu"), féminin assumé (l'audience est féminine)
3. **Structure classique** : "[situation vraie qu'elle vit tous les jours]… mais [vérité cachée qu'elle n'avait jamais vue]"
4. **Pattern interrupt** : contredire une croyance, révéler une cause cachée, forcer l'auto-reconnaissance
5. **Concret > abstrait** : exemples du quotidien (scroller des vidéos, sauvegarder des posts, attendre d'être prête, "plus tard"…). Jamais de concepts vagues.
6. **Zéro emoji dans le hook**
7. **Zéro jargon marketing** ("mindset", "leverage", "impact", "synergie" = interdits)
8. **Zéro point d'exclamation**

## Exemples de hooks qui respectent la méthode (few-shot)

- (Attirer) "Tu regardes des vidéos sur le business en ligne tous les jours… mais tu n'as toujours rien commencé, et tu ne comprends même pas pourquoi"
- (Attirer) "Tu sauvegardes du contenu tous les jours pour 'plus tard'… mais ce moment ne vient jamais"
- (Attirer) "Tu dis que tu veux changer de vie… mais concrètement, tes journées sont exactement les mêmes qu'il y a 3 mois"
- (Attirer) "Tu attends d'être prête… mais tu sais au fond que ce moment n'arrive jamais"
- (Engager) "Si tu bloques au moment de te lancer, ce n'est pas un manque de motivation… c'est que tu n'as jamais eu une explication simple"
- (Engager) "Plus tu consommes de contenu sur le business en ligne… plus tu t'éloignes du moment où tu vas vraiment commencer"
- (Engager) "Tu penses que tu procrastines… mais en réalité tu bloques pour une raison bien plus précise"
- (Engager) "Le problème, ce n'est pas toi… c'est que tu fais tout à l'envers sans t'en rendre compte"
- (Convertir) "Tu peux commencer même si tu ne te sens pas prête, même si tu doutes, et même si tu n'y connais rien"
- (Convertir) "Elles ne comprenaient rien, n'avaient jamais vendu, et pourtant elles ont réussi à se lancer"
- (Convertir) "Dans 3 mois, soit rien ne change… soit tu as déjà commencé quelque chose de concret"
- (Convertir) "Le vrai risque, ce n'est pas d'échouer… c'est de rester exactement là où tu es"

**Tu t'inspires de la STRUCTURE et du STYLE de ces exemples, pas du sujet. Tu adaptes toujours le sujet à l'audience et au focus fournis par l'utilisateur.**

# 📣 RÈGLES DU CTA (absolument non négociables)

1. **Ultra court** : 1 à 5 mots maximum
2. **Action micro-engagement** : commenter un mot-clé, envoyer un DM avec un mot, écrire dans les commentaires
3. **Mot déclencheur en MAJUSCULES** entre guillemets
4. **Cohérent avec l'étape** :
   - **TOFU/Attirer** → mot de reconnaissance de soi : "MOI", "VRAI", "C'EST MOI", "BLOQUÉE", "PERDUE", "SCROLL", "PLUS TARD", "STOP"
   - **MOFU/Engager** → mot de curiosité/compréhension : "INFO", "POURQUOI", "EXPLIQUE", "CLARTÉ", "OK", "JE VEUX SAVOIR", "COMPRENDRE", "DÉCLIC"
   - **BOFU/Convertir** → mot d'action : "START", "GO", "COMMENT", "POURQUOI PAS MOI", "ZÉRO", "DÉCLIC"

## Exemples de CTAs qui respectent la méthode

- Commente "MOI" si c'est toi
- Écris "INFO" si tu veux comprendre
- DM "START"
- Écris "JE VEUX SAVOIR"
- Dis "VRAI" si tu te reconnais
- Écris "POURQUOI PAS MOI"
- DM "GO"

# 🎨 RESTES DE LA VOIX BRILLE & VIBRE

- Français, tutoiement obligatoire, féminin assumé
- Phrases courtes, rythmées
- Émotions concrètes > concepts abstraits
- Aucun jargon marketing
- Aucun emoji dans le hook (mais tu peux en mettre dans les étiquettes "Étape" si besoin)
- Ton direct, sans condescendance, sans moralisation

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

/* ─────────────────────────────────────────
   WEEKLY_PLAN MODE — Planning éditorial 7 jours
   Applique la méthode Brille & Vibre (4 axes croisés).
   Rythme de la semaine (inspiré des 30 jours de référence) :
   Lun Attirer → Mar Engager → Mer Convertir
   → Jeu Attirer → Ven Engager → Sam Convertir → Dim Attirer
   ───────────────────────────────────────── */
function buildWeeklyPlanMessage(audience, focus) {
  const audienceLine = audience
    ? `- Audience cible : ${audience}`
    : '- Audience cible : femmes qui veulent se lancer en business en ligne mais qui bloquent';

  const focusLine = focus
    ? `- Focus de cette semaine : ${focus}`
    : '- Focus de cette semaine : libre — Claude choisit l\'angle le plus universel';

  return `CONTEXTE
${audienceLine}
${focusLine}

TÂCHE
Génère un planning éditorial Instagram de 7 jours (lundi à dimanche) qui suit STRICTEMENT la méthode Brille & Vibre décrite dans le bloc système. Chaque jour = 1 post prêt à tourner, avec hook complet et CTA adapté.

⚠️ RYTHME DE LA SEMAINE (séquence obligatoire)
Cette séquence reproduit la semaine 1 du tableau de référence Brille & Vibre :

1. **LUNDI — Attirer** (TOFU · Besoin de ressentir · Pas consciente du problème)
2. **MARDI — Engager** (MOFU · Besoin de comprendre · Consciente du problème)
3. **MERCREDI — Convertir** (BOFU · Besoin d'être guidée · Consciente de la solution)
4. **JEUDI — Attirer** (TOFU · Besoin de ressentir · Pas consciente du problème)
5. **VENDREDI — Engager** (MOFU · Besoin de comprendre · Consciente du problème)
6. **SAMEDI — Convertir** (BOFU · Besoin d'être rassurée · Consciente de la solution)
7. **DIMANCHE — Attirer** (TOFU · Besoin de ressentir · Pas consciente du problème)

CONSIGNES IMPÉRATIVES
- Chaque hook doit respecter LES RÈGLES DU HOOK du bloc système (structure "situation… mais vérité cachée", tutoiement féminin, concret, zéro emoji, zéro jargon, zéro exclamation).
- Chaque CTA doit respecter LES RÈGLES DU CTA (court, mot déclencheur en MAJUSCULES, cohérent avec l'étape).
- **Varie les angles sur la semaine** : jamais 2 hooks avec la même ouverture ou le même exemple. Change de situation du quotidien à chaque fois.
- Adapte le sujet, le vocabulaire et les scénarios à l'audience précisée.
- Si un focus de semaine est précisé, TOUTE la semaine converge subtilement vers ce focus (le mercredi et le samedi sont les pics de conversion).
- N'invente pas de nouveaux axes ou états : respecte la table de correspondance du bloc système.

SCHÉMA JSON ATTENDU — exactement 7 entrées dans "plan", aucun texte avant ni après le JSON :
{
  "plan": [
    {
      "jour": 1,
      "jour_nom": "Lundi",
      "etape": "Attirer",
      "niveau_funnel": "TOFU",
      "etat_emotionnel": "Besoin de ressentir",
      "niveau_conscience": "Pas consciente du problème",
      "hook": "la phrase d'accroche complète (1 à 2 phrases, avec '…' pour la tension)",
      "cta": "l'appel à l'action court, ex : Commente 'MOI' si c'est toi"
    }
  ]
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
  const VALID_MODES = ['weekly_plan', 'hook', 'caption', 'stories', 'post', 'refine'];
  if (!VALID_MODES.includes(mode)) {
    return res.status(400).json({ error: `mode requis : ${VALID_MODES.join(', ')}.` });
  }

  // Profil utilisateur (optionnel mais fortement recommandé pour post/refine)
  const profile = (body.profile && typeof body.profile === 'object') ? body.profile : null;

  let userMessage;
  let maxTokens = 1500;

  try {
    if (mode === 'weekly_plan') {
      const audience = clamp(body.audience, 300);
      const focus = clamp(body.focus, 600);
      userMessage = buildWeeklyPlanMessage(audience, focus);
      maxTokens = 6500; // Suffisant pour 7 jours détaillés
    } else if (mode === 'post') {
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
    const buildBody = (model) => JSON.stringify({
      model,
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
    });

    // Stratégie simple et robuste : Haiku 4.5 uniquement (5-10s par appel).
    // Optionnel : si tu veux Sonnet pour plus de qualité, ajoute-le dans la liste.
    const MODELS_TO_TRY = [
      DEFAULT_MODEL,                  // claude-haiku-4-5-20251001 par défaut
    ];
    const RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504, 529];

    let apiResponse;
    let lastError;
    let modelUsed;

    for (const model of MODELS_TO_TRY) {
      try {
        apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: buildBody(model),
        });

        if (apiResponse.ok) {
          modelUsed = model;
          break;
        }

        // Erreur retryable → on essaie le modèle suivant
        if (RETRYABLE_STATUSES.includes(apiResponse.status)) {
          console.log(`[fallback] ${model} → HTTP ${apiResponse.status}, on essaie le modèle suivant`);
          continue;
        }

        // Erreur non retryable (4xx auth/validation) → on sort
        break;
      } catch (fetchErr) {
        console.log(`[fetch error] ${model} → ${fetchErr.message}`);
        lastError = fetchErr;
        // On essaie le modèle suivant
        continue;
      }
    }

    if (!apiResponse) {
      throw lastError || new Error('Aucun modèle Claude n\'a répondu.');
    }

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      const friendlyMessage = apiResponse.status === 529
        ? 'Les serveurs Claude sont saturés en ce moment. Réessaye dans 2-3 minutes.'
        : `Erreur API Claude (${apiResponse.status})`;
      return res.status(apiResponse.status).json({
        error: friendlyMessage,
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
