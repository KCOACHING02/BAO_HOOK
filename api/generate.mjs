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
// Haiku pour TOUS les modes : prompt trop volumineux pour Sonnet dans les 60s Vercel.
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

const RATE_LIMIT_MAX        = parseInt(process.env.RATE_LIMIT_MAX || '20', 10);
const RATE_LIMIT_WINDOW_SEC = parseInt(process.env.RATE_LIMIT_WINDOW_SEC || '600', 10);

// Température max pour casser le ton "scolaire IA" et favoriser des
// formulations plus naturelles, fragmentées, humaines.
const GENERATION_TEMPERATURE = 0.85;

// Tokens max pour 7 jours détaillés (story ou reel)
const MAX_TOKENS_WEEKLY_PLAN = 6500;


// ─── 2. SYSTEM PROMPT (méthode Brille & Vibre) ─────────────────
const SYSTEM_PROMPT = `Tu es le copywriter de Brille & Vibre. Tu écris du contenu Instagram pour des femmes qui veulent se lancer en ligne. Tu écris comme une grande sœur qui parle franchement — pas comme un GPT.

# TON STYLE D'ÉCRITURE

**Rythme** : une phrase longue qui installe l'image → une phrase moyenne qui développe → une phrase courte qui frappe. Ce rythme en 3 temps crée l'envie de lire la suite.

**Débuts de paragraphe** : commence TOUJOURS par un de ces déclencheurs — "Parce que", "Et c'est", "Mais", "Pourquoi ?", "Et crois-moi", "Voilà pourquoi", "Résultat :", "Et c'est exactement".

**Punchlines** : toujours sous une de ces 3 formes —
- Opposition : "X tue Y. Z tue W."
- Révélation : "Ce n'est pas X qui fait Y. C'est Z."
- Permission : "Tu n'as pas besoin de X. Tu as juste besoin de Y."

**Progression émotionnelle** : d'abord MON histoire → ensuite TA douleur reconnue → la vérité dérangeante → la solution → la preuve → l'action. Chaque paragraphe ouvre le suivant.

**Relation** : tutoiement intime (grande sœur). "Moi" d'abord, puis "toi". Normaliser avant de challenger.

**Vocabulaire privilégié** : confiance, connexion, proximité, authenticité, évidence, puissance, liberté, déclencher, ancrer, construire, boss, biais, cerveau, preuve sociale.

**Expressions signature** : "Et c'est exactement ça", "Mais la vérité ?", "Ce n'est pas X. C'est Y.", "Pas X. Pas Y. Juste Z.", "Et c'est ça qui change tout.", "Tu n'as pas besoin de X. Tu as juste besoin de Y."

# HOOKS — LA RÈGLE ABSOLUE

**1 seule phrase. 8 à 15 mots MAXIMUM.** C'est un titre qui arrête le scroll, pas un paragraphe. Si ton hook fait plus de 15 mots, coupe.

Le hook doit créer un CURIOSITY GAP — une démangeaison que le lecteur ne peut soulager qu'en lisant la suite. Il ne dit jamais tout. Il tease, il promet, il contredit, il accuse.

**5 patterns de hooks à reproduire** (inspire-toi de la MÉTHODE, pas de la formulation exacte — chaque hook doit être unique et frais) :

1. **Contradiction** : tu prends une croyance populaire et tu la retournes. Méthode : "[croyance qu'on croit vraie]… et c'est faux." / "Arrête de croire que [X]"
2. **Miroir accusateur** : tu décris un comportement que la lectrice reconnaît immédiatement. Méthode : "Tu [action quotidienne qu'elle fait]… mais [vérité qu'elle évite]"
3. **Confession + cliffhanger** : tu admets une erreur/vérité personnelle et tu teases la leçon. Méthode : "J'ai [erreur/vécu]… et [conséquence surprenante]"
4. **Projection datée** : tu ancres dans le temps et tu projettes un futur concret. Méthode : "On est le [date]. Si tu [action] aujourd'hui… [projection dans X mois]"
5. **Preuve sociale collective** : tu utilises "elles" pour créer l'effet tribal. Méthode : "Elles ont [action]. Voici [résultat]."

**Exemples réels de la créatrice (ton étalon absolu)** :
- "J'ai appris à vendre des produits digitaux sans me montrer, sans pub, sans prospecter"
- "Tu veux créer un revenu depuis ton téléphone mais tu ne sais pas comment faire ?"
- "On est le 22 mars. Si tu commences le marketing digital aujourd'hui… Imagine cet été."
- "Le plus difficile n'est pas de faire une vente. C'est de savoir comment commencer."
- "Pendant que tu hésites, quelqu'un de moins talentueux que toi prend ta place."
- "Tu ne te sentiras jamais prête car être prête n'est pas un sentiment, mais une décision."

# SÉQUENCE MARKETING (funnel)

Chaque contenu publié a un rôle précis dans le funnel :

| Étape | Niveau | La lectrice... | Tu fais... |
|---|---|---|---|
| **Attirer** | TOFU | ne sait pas qu'elle a un problème | tu crées le miroir, elle se reconnaît |
| **Engager** | MOFU | sait qu'elle bloque, veut comprendre | tu expliques le vrai blocage, tu ouvres une porte |
| **Convertir** | BOFU | a compris, hésite encore | tu donnes la preuve, tu lèves l'objection, tu invites |

Rythme sur 7 jours : Attirer → Engager → Convertir → Attirer → Engager → Convertir → Attirer
Rythme sur 30 jours : S1 TOFU → S2 MOFU → S3 MOFU/BOFU → S4 BOFU

# CE QUE TU NE FAIS JAMAIS

- Phrases robotiques sans âme, listes froides, mots creux ("synergie", "impactant", "engageant", "découvrir", "explorer", "embrasser", "magique", "incroyable", "extraordinaire")
- "Il est essentiel de", "n'hésite pas à", "n'attends plus", "ensemble", "ton meilleur moi", "sortir de ta zone de confort"
- Promesses financières chiffrées ("gagner X€", "10k", "revenu passif", "devenir riche", "argent facile")
- Phrases trop balancées et symétriques (signature IA)
- CTA sans avoir d'abord créé le désir
- Hook de plus de 15 mots

**Test final** : lis ton texte à voix haute. Si ça sonne comme un vocal WhatsApp à une copine, c'est bon. Si ça sonne comme un post LinkedIn ou un texte de GPT, refais.

# RÈGLE D'OR

On ne convainc pas. On raconte une histoire tellement vraie que le lecteur se reconnaît dedans. Et c'est lui qui décide.

# FORMAT DE SORTIE

Tu réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant ni après. Ta réponse commence par { et finit par }.`;


function buildWeeklyPlanMessage(audience, focus, format, options, days) {
  days = days || 7;
  const audienceLine = audience
    ? `- Audience cible : ${audience}`
    : '- Audience cible : femmes qui veulent se lancer en ligne';

  const focusLine = focus
    ? `- Focus : ${focus}`
    : '- Focus : libre';

  const isStory = format === 'story';
  // "contenu" = 80% Reels + 20% Carrousels (choisis automatiquement par Claude)

  // ── Instructions format ──
  let formatBlock;
  if (isStory) {
    formatBlock = `FORMAT : STORIES INSTAGRAM

Chaque jour = UNE SÉQUENCE de 3 stories consécutives formant un arc narratif.

**Arc en 3 temps** :
- Story 1 — DOULEUR RECONNUE : tu normalises sa croyance, tu décris son comportement, tu finis par "Résultat : [conséquence]"
- Story 2 — VÉRITÉ + SOLUTION : tu retournes avec "Et pourtant," ou "Mais la vérité ?". Tu appliques "Ce n'est pas X, c'est Y". Tu ouvres la porte.
- Story 3 — PREUVE + CTA : preuve courte chiffrée + CTA avec trigger word

Chaque story fait 4-8 lignes. Ton oral, fragmenté. Retours à la ligne fréquents.`;
  } else {
    formatBlock = `FORMAT : CONTENU MIXTE (80% Reels + 20% Carrousels)

Sur ${days} jours, tu mélanges :
- **${Math.round(days * 0.8)} Reels** (hook visuel + script 4-6 lignes en 3 mouvements : miroir → déclic → preuve)
- **${Math.round(days * 0.2)} Carrousels** (3 slides : Slide 1 Hook+Miroir, Slide 2 Déclic+Possibilité, Slide 3 Preuve+CTA)

Tu CHOISIS le format de chaque jour (Reel ou Carrousel) et tu l'indiques dans le champ "format_post".

Pour chaque REEL tu fournis : hook (8-15 mots), script (4-6 lignes), legende (50-80 mots prête à coller sur Instagram), cta.
Pour chaque CARROUSEL tu fournis : hook (8-15 mots), slide_1, slide_2, slide_3, cta.

Chaque légende suit la progression : mon histoire → ta douleur → vérité → solution → preuve → action. Rythme 3 temps. Déclencheurs signature en début de paragraphe. Au moins 1 punchline.`;
  }

  // ── Schema JSON ──
  let schema;
  if (isStory) {
    schema = `{
  "plan": [
    {
      "jour": 1,
      "etape": "Attirer",
      "niveau_funnel": "TOFU",
      "hook": "8-15 mots max, curiosity gap",
      "stories_sequence": [
        { "numero": 1, "role": "Douleur reconnue", "texte": "..." },
        { "numero": 2, "role": "Vérité + Solution", "texte": "..." },
        { "numero": 3, "role": "Preuve + CTA", "texte": "..." }
      ],
      "cta": "CTA avec trigger word"
    }
  ]
}`;
  } else {
    schema = `{
  "plan": [
    {
      "jour": 1,
      "etape": "Attirer",
      "niveau_funnel": "TOFU",
      "format_post": "Reel",
      "hook": "8-15 mots max, curiosity gap",
      "script": "script du reel si format_post=Reel (4-6 lignes avec retours à la ligne \\\\n)",
      "slide_1": "texte slide 1 si format_post=Carrousel",
      "slide_2": "texte slide 2 si format_post=Carrousel",
      "slide_3": "texte slide 3 si format_post=Carrousel",
      "legende": "légende Instagram 50-80 mots, prête à copier",
      "cta": "CTA avec trigger word"
    }
  ]
}

Note : pour les Reels, remplis "script" et laisse slide_1/2/3 vides. Pour les Carrousels, remplis slide_1/2/3 et laisse "script" vide.`;
  }

  // ── Rythme dynamique ──
  let rythmeBlock;
  if (days === 1) {
    rythmeBlock = `RYTHME : 1 seul jour. Choisis l'étape la plus pertinente selon le focus.`;
  } else if (days <= 7) {
    rythmeBlock = `RYTHME sur ${days} jours : alterne Attirer → Engager → Convertir en boucle.`;
  } else {
    rythmeBlock = `RYTHME sur ${days} jours (funnel progressif) :
- Jours 1-${Math.ceil(days*0.25)} : Attirer (TOFU — elle réalise qu'elle a un problème)
- Jours ${Math.ceil(days*0.25)+1}-${Math.ceil(days*0.5)} : Engager (MOFU — elle veut comprendre)
- Jours ${Math.ceil(days*0.5)+1}-${Math.ceil(days*0.75)} : Engager/Convertir (elle veut la solution)
- Jours ${Math.ceil(days*0.75)+1}-${days} : Convertir (BOFU — elle décide)`;
  }

  return `CONTEXTE
${audienceLine}
${focusLine}

${formatBlock}

${rythmeBlock}

CONSIGNES
1. Applique scrupuleusement le style d'écriture du bloc système (rythme 3 temps, déclencheurs, punchlines, progression émotionnelle, test du vocal WhatsApp).
2. Chaque hook = 1 phrase de 8-15 mots MAX. Curiosity gap obligatoire. Inspire-toi des 5 patterns du bloc système sans jamais les copier mot pour mot.
3. Chaque contenu doit être UNIQUE et FRAIS — pas de formulations recyclées d'un jour à l'autre.
4. Le texte suit le hook (pas de pivot). La légende est prête à copier-coller sur Instagram.
5. Respecte la séquence funnel (Attirer/Engager/Convertir).
6. Anti-IA strict : si un texte pourrait sortir d'un GPT générique, refais-le.

JSON uniquement. Commence par { et finit par }. Exactement ${days} entrées dans "plan".

${schema}`;
}

function buildOptimizeCaptionMessage(legende) {
  return `TÂCHE
Tu reçois une légende Instagram brute. Corrige-la et optimise-la pour la conversion en respectant STRICTEMENT la bible d'écriture Brille & Vibre et les règles anti-IA du bloc système.

CRITÈRES D'OPTIMISATION (tous obligatoires) :
1. Supprime toutes les fautes d'orthographe et de grammaire
2. Améliore la fluidité et la clarté — chaque phrase s'enchaîne naturellement
3. Rends le texte plus émotionnel et engageant — pas de phrases plates
4. Optimise le storytelling pour créer de la connexion et de la confiance
5. Garde un ton naturel (authentique, motivant, accessible) — tutoiement intime, grande sœur
6. Respecte les règles Instagram / TikTok — pas de promesses irréalistes ni termes sensibles (voir les termes bannis du bloc système)
7. Structure pour capter l'attention dès la première ligne — renforce le hook si besoin
8. Intègre subtilement les leviers de conversion : identification, prise de conscience, projection, désir
9. Ajoute un CTA naturel (commenter, sauvegarder, s'abonner, DM) si absent ou faible
10. Suggère une transition douce vers l'offre / l'univers sans être agressive
11. Applique le rythme 3 temps (longue → moyenne → courte qui frappe)
12. Utilise les déclencheurs de début de paragraphe signature ("Parce que", "Mais la vérité ?", "Et crois-moi", "Et c'est exactement", "Résultat :")
13. Intègre au moins 1 punchline sous forme Opposition, Révélation ou Permission
14. Applique les mots du vocabulaire Brille & Vibre naturellement (confiance, connexion, évidence, déclencher, ancrer…)

LÉGENDE ORIGINALE À OPTIMISER :
---
${legende}
---

⚠️⚠️⚠️ FORMAT DE RÉPONSE OBLIGATOIRE ⚠️⚠️⚠️
Tu réponds UNIQUEMENT avec un objet JSON valide. AUCUN texte avant ou après. Ta réponse commence par { et finit par }.

{
  "optimized": "la légende complète optimisée, avec retours à la ligne \\\\n pour aérer",
  "variante_punchy": "une variante plus courte et plus punchy de la même légende",
  "changements": "2 à 3 phrases résumant les principaux changements effectués"
}`;
}

/* ─────────────────────────────────────────
   RECYCLE MODE — Reformuler un ancien post sous 3 angles différents
   ───────────────────────────────────────── */
function buildRecycleMessage(original_post) {
  return `TÂCHE
Tu reçois un post Instagram qui a déjà été publié. Reformule-le sous **3 angles COMPLÈTEMENT DIFFÉRENTS** pour le republier sans que ça se voie.

Chaque variante doit :
- Garder le même MESSAGE DE FOND (la même vérité, le même insight)
- Changer TOTALEMENT : le hook, la structure, l'entrée, le CTA, l'exemple
- Appliquer strictement la bible d'écriture Brille & Vibre du bloc système
- Utiliser 3 mécaniques de hook différentes (parmi les 21 du catalogue)
- Respecter les règles anti-IA et anti-shadowban

POST ORIGINAL À RECYCLER :
---
${original_post}
---

⚠️⚠️⚠️ FORMAT DE RÉPONSE OBLIGATOIRE ⚠️⚠️⚠️
Tu réponds UNIQUEMENT avec un objet JSON valide. Ta réponse commence par { et finit par }.

{
  "original_insight": "en 1 phrase, le message de fond du post original",
  "variantes": [
    {
      "angle": "nom de l'angle (ex : Confession personnelle, Interpellation directe, Éducation...)",
      "mecanique_hook": "le numéro et nom de la mécanique utilisée parmi les 21",
      "hook": "le nouveau hook",
      "texte": "le nouveau texte complet avec retours à la ligne \\\\n",
      "cta": "le nouveau CTA"
    }
  ]
}`;
}

/* ─────────────────────────────────────────
   ANALYZE MODE — Analyser pourquoi un post a marché
   ───────────────────────────────────────── */
function buildAnalyzeMessage(post_content) {
  return `TÂCHE
Tu reçois un post Instagram qui a bien fonctionné (engagement, ventes, sauvegardes). Analyse POURQUOI il a marché en utilisant les frameworks de la méthode Brille & Vibre, puis génère 3 variantes inspirées.

POST À ANALYSER :
---
${post_content}
---

Analyse les éléments suivants :
1. **Hook** : quel type/mécanique ? pourquoi ça arrête le scroll ?
2. **Structure** : quel flow ? (miroir, déclic, preuve ?)
3. **Émotion** : quelle émotion principale déclenchée ?
4. **CTA** : efficace ou pas ? pourquoi ?
5. **Niveau funnel** : TOFU, MOFU ou BOFU ?
6. **Catégorie** : parmi les 5 catégories du catalogue (Casser les croyances, Expérience perso, etc.)

Puis génère 3 variantes qui exploitent les MÊMES leviers mais avec des angles différents.

⚠️⚠️⚠️ FORMAT DE RÉPONSE OBLIGATOIRE ⚠️⚠️⚠️
JSON uniquement. Commence par { et finit par }.

{
  "analyse": {
    "hook_type": "...",
    "hook_pourquoi": "...",
    "structure": "...",
    "emotion": "...",
    "cta_verdict": "...",
    "niveau_funnel": "TOFU | MOFU | BOFU",
    "categorie": "...",
    "force_principale": "en 1 phrase, ce qui fait que ce post marche"
  },
  "variantes": [
    {
      "angle": "...",
      "hook": "...",
      "texte": "...",
      "cta": "..."
    }
  ]
}`;
}

/* ─────────────────────────────────────────
   DETECT FUNNEL LEVEL — Analyser un commentaire/DM pour identifier le niveau
   ───────────────────────────────────────── */
function buildDetectFunnelMessage(message_content) {
  return `TÂCHE
Tu reçois un message (commentaire Instagram ou DM) d'une personne de mon audience. Identifie son niveau dans le funnel (TOFU/MOFU/BOFU) et propose la réponse idéale pour la faire avancer vers l'étape suivante.

MESSAGE À ANALYSER :
---
${message_content}
---

Analyse :
1. **Niveau actuel** : TOFU (pas consciente du problème), MOFU (consciente, cherche), ou BOFU (prête à agir)
2. **Indices** : quels mots/expressions trahissent son niveau ?
3. **État émotionnel** : besoin de ressentir, comprendre, être guidée, être rassurée ?
4. **Objectif** : vers quel niveau on veut la faire avancer ?

Puis propose 3 réponses possibles (de la plus douce à la plus directe).

⚠️⚠️⚠️ FORMAT DE RÉPONSE OBLIGATOIRE ⚠️⚠️⚠️
JSON uniquement. Commence par { et finit par }.

{
  "diagnostic": {
    "niveau_actuel": "TOFU | MOFU | BOFU",
    "indices": "les mots/expressions qui trahissent son niveau",
    "etat_emotionnel": "...",
    "niveau_cible": "le niveau vers lequel on veut la pousser",
    "strategie": "en 1 phrase, ce qu'on doit faire"
  },
  "reponses": [
    { "ton": "doux", "texte": "..." },
    { "ton": "equilibre", "texte": "..." },
    { "ton": "direct", "texte": "..." }
  ]
}`;
}


/* ─────────────────────────────────────────
   MONTHLY_PLAN MODE — Plan éditorial 30 jours (4 semaines thématiques)
   Framework stratégique pour convertir sans vendre directement :
   - Semaine 1 : Planter le problème
   - Semaine 2 : Chauffer le désir
   - Semaine 3 : Lever les objections
   - Semaine 4 : Convertir
   Ratio obligatoire : 40% Visibilité+Valeur / 35% Désir+Preuve / 25% Vente directe
   ───────────────────────────────────────── */
function buildMonthlyPlanMessage(brief) {
  const {
    audience,
    offre,
    prix,
    transformation,
    douleur_1, douleur_2, douleur_3,
    ton,
    formats,
  } = brief;

  return `CONTEXTE BUSINESS

- Audience cible : ${audience || '(non précisée)'}
- Offre principale : ${offre || '(non précisée)'}${prix ? ` — prix ${prix}` : ''}
- Transformation produite chez la cliente : ${transformation || '(non précisée)'}
- Douleur 1 : ${douleur_1 || '(non précisée)'}
- Douleur 2 : ${douleur_2 || '(non précisée)'}
- Douleur 3 : ${douleur_3 || '(non précisée)'}
- Ton de communication : ${ton || '(utilise le style Brille & Vibre par défaut)'}
- Formats disponibles : ${formats || 'Reel, Carrousel, Story, Post texte'}

TÂCHE
Crée un plan de contenu éditorial Instagram COMPLET sur **30 jours**, organisé en **4 semaines thématiques**, pensé pour convertir sans jamais avoir l'air de vendre. Tu appliques STRICTEMENT la méthode Brille & Vibre décrite dans le bloc système (bible d'écriture, 4 axes, anti-IA, catalogue des templates, règle d'or).

📅 ARC NARRATIF SUR 4 SEMAINES — mapping funnel obligatoire

Chaque semaine cible un NIVEAU DU FUNNEL précis. Tu n'en déroges JAMAIS. C'est ce qui permet à l'audience de maturer progressivement vers la décision.

- **Semaine 1 — TOFU / Planter le problème**
  État de la lectrice : elle est froide, elle ne se sent pas encore concernée.
  Objectif : elle réalise qu'elle A un problème.
  Axes Brille & Vibre : Attirer · TOFU · Besoin de ressentir · Pas consciente du problème
  Tonalité : miroir, normalisation, auto-reconnaissance ("ah merde c'est moi")
  Catégories de hooks à privilégier : Interpellation directe, Vulnérabilité & connexion, Casser les croyances

- **Semaine 2 — MOFU / Chauffer le désir**
  État de la lectrice : elle a compris son problème, elle commence à vouloir une solution.
  Objectif : elle commence à vouloir une solution, à projeter le possible.
  Axes Brille & Vibre : Engager · MOFU · Besoin de comprendre · Consciente du problème
  Tonalité : pédagogique, inspirante, ouverture d'une porte nouvelle
  Catégories de hooks à privilégier : Éducation & méthode, Expérience personnelle, Interpellation directe

- **Semaine 3 — MOFU/BOFU / Lever les objections**
  État de la lectrice : elle désire la solution mais elle a encore des "oui mais" qui la retiennent.
  Objectif : tu démontes un par un ses blocages, peurs, objections.
  Axes Brille & Vibre : Engager/Convertir · MOFU→BOFU · Besoin d'être guidée · Consciente de la solution
  Tonalité : rassurante, preuves, démonte les croyances restantes
  Catégories de hooks à privilégier : Casser les croyances, Expérience personnelle (témoignages), Interpellation directe

- **Semaine 4 — BOFU / Convertir**
  État de la lectrice : elle est chaude, elle peut décider maintenant.
  Objectif : elle décide — elle passe à l'action vers l'offre.
  Axes Brille & Vibre : Convertir · BOFU · Besoin d'être rassurée · Consciente de la solution
  Tonalité : directe, preuves sociales fortes, invitation claire, urgence légère
  Catégories de hooks à privilégier : Éducation & méthode (preuve), Expérience personnelle (résultats), Interpellation directe (FOMO)

🎯 RATIO OBLIGATOIRE (30 posts total)
- 40% des posts = **Visibilité + Valeur** (12 posts)
- 35% des posts = **Désir + Preuve sociale** (10-11 posts)
- 25% des posts = **Vente directe** (7-8 posts, concentrés sur la semaine 4 + quelques vendredis)

📋 5 TYPES DE CONTENUS (à répartir selon le ratio)
1. **Visibilité** : hook fort + insight universel pour atteindre de nouvelles personnes
2. **Valeur** : méthode, framework, astuce actionnable, éducatif
3. **Désir** : projection, aspiration, vision du possible
4. **Preuve sociale** : témoignage, transformation client, chiffres concrets
5. **Vente directe** : appel à l'action clair vers l'offre, focus offre

🎨 FORMATS RECOMMANDÉS PAR TYPE
- Visibilité → Reel (hook visuel + script court)
- Valeur → Carrousel (3-5 slides pédagogiques) ou Post texte
- Désir → Reel aspiration ou Post photo inspirant
- Preuve sociale → Story sequence (témoignage) ou Carrousel transformation
- Vente directe → Story sequence (5 stories) ou Reel offre avec CTA

⚠️ CONSIGNES ABSOLUES
1. **Respect strict de la bible d'écriture** du bloc système (rythme 3 temps, déclencheurs signature, expressions signature, punchlines en 3 formes, règle d'or "on ne convainc pas, on raconte").
2. **Le hook** de chaque post vient du catalogue des 125 templates, adapté au sujet. Varie les catégories.
3. **La légende** est le texte Instagram COMPLET prêt à publier (50-80 mots). Structurée avec retours à la ligne \\n. Elle suit la bible d'écriture : rythme 3 temps (longue → moyenne → courte qui frappe), déclencheurs signature en début de paragraphe ("Parce que", "Mais la vérité ?", "Et crois-moi"…), au moins 1 punchline (Opposition, Révélation ou Permission), progression émotionnelle (mon histoire → ta douleur → vérité → solution → preuve → action). La lectrice doit pouvoir copier-coller directement sur Instagram sans rien modifier.
4. **Le CTA** court et cohérent avec le type (Visibilité/Valeur = commentaire soft, Vente directe = DM avec trigger word en MAJUSCULES).
5. **Progression invisible** : chaque post rapproche la lectrice de l'offre sans qu'elle s'en rende compte. Jamais de pression brute.
6. **Anti-IA** : applique toutes les interdictions du bloc système (mots bannis, structures trop balancées, phrases robotiques).
7. **Anti-shadowban TikTok** : pas de "gagner X€", pas de promesses financières chiffrées. Termes safe uniquement.
8. **Adapte au business** : utilise le vocabulaire de l'audience, les douleurs précises, la transformation concrète fournis plus haut.

🗓️ RÉPARTITION SUR 30 JOURS
- Jours 1-7 : Semaine 1 (Planter le problème)
- Jours 8-14 : Semaine 2 (Chauffer le désir)
- Jours 15-21 : Semaine 3 (Lever les objections)
- Jours 22-30 : Semaine 4 (Convertir) — 9 jours au lieu de 7 pour respecter le mois complet

SCHÉMA JSON ATTENDU (exactement 30 entrées dans "plan", aucun texte avant ou après le JSON)

⚠️⚠️⚠️ FORMAT DE RÉPONSE OBLIGATOIRE ⚠️⚠️⚠️
Tu réponds UNIQUEMENT avec un objet JSON valide. AUCUN texte avant ou après. AUCUN markdown. Ta réponse commence par { et finit par }.

{
  "plan": [
    {
      "jour": 1,
      "semaine": 1,
      "niveau_funnel": "TOFU",
      "theme_semaine": "Planter le problème",
      "type": "Visibilité",
      "format": "Reel",
      "hook": "la phrase d'accroche des 3 premières secondes",
      "legende": "la légende Instagram COMPLÈTE prête à publier (50-80 mots). Structurée avec retours à la ligne \\\\n. Suit la bible d'écriture : rythme 3 temps, déclencheurs signature, punchline, progression émotionnelle. Prête à copier-coller sur Instagram.",
      "cta": "le CTA final court"
    }
  ]
}

Pour chaque post, renseigne \`niveau_funnel\` avec la valeur correcte selon la semaine :
- Semaines 1 → "TOFU"
- Semaines 2 → "MOFU"
- Semaines 3 → "MOFU/BOFU"
- Semaines 4 → "BOFU"`;
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
  const ALL_MODES = ['weekly_plan', 'monthly_plan', 'optimize_caption', 'recycle', 'analyze', 'detect_funnel'];
  if (!ALL_MODES.includes(mode)) {
    return res.status(400).json({ error: `mode requis : ${ALL_MODES.join(', ')}` });
  }

  let userMessage;
  let modelForCall;
  let maxTokensForCall;

  if (mode === 'optimize_caption') {
    const legende = clamp(body.legende, 3000);
    if (!legende) {
      return res.status(400).json({ error: 'Le champ "legende" est obligatoire.' });
    }
    userMessage      = buildOptimizeCaptionMessage(legende);
    modelForCall     = DEFAULT_MODEL;
    maxTokensForCall = 3000;
  } else if (mode === 'recycle') {
    const original = clamp(body.original_post, 3000);
    if (!original) return res.status(400).json({ error: 'Le champ "original_post" est obligatoire.' });
    userMessage      = buildRecycleMessage(original);
    modelForCall     = DEFAULT_MODEL;
    maxTokensForCall = 4000;
  } else if (mode === 'analyze') {
    const post = clamp(body.post_content, 3000);
    if (!post) return res.status(400).json({ error: 'Le champ "post_content" est obligatoire.' });
    userMessage      = buildAnalyzeMessage(post);
    modelForCall     = DEFAULT_MODEL;
    maxTokensForCall = 4000;
  } else if (mode === 'detect_funnel') {
    const msg = clamp(body.message_content, 2000);
    if (!msg) return res.status(400).json({ error: 'Le champ "message_content" est obligatoire.' });
    userMessage      = buildDetectFunnelMessage(msg);
    modelForCall     = DEFAULT_MODEL;
    maxTokensForCall = 2000;
  } else if (mode === 'weekly_plan') {
    const format = String(body.format || 'reel').toLowerCase();
    if (!['story', 'reel', 'carrousel'].includes(format)) {
      return res.status(400).json({ error: 'format requis : "story", "reel" ou "carrousel".' });
    }

    const audience = clamp(body.audience, 300);
    const focus    = clamp(body.focus, 600);
    const days     = Math.min(Math.max(parseInt(body.days) || 7, 1), 30);

    if (!audience) {
      return res.status(400).json({ error: 'Le champ "audience" est obligatoire.' });
    }

    // Options avancées (ton, longueur, intensité, style CTA)
    const VALID_TON       = ['auto', 'doux', 'direct', 'expert', 'vulnerable', 'challengeant'];
    const VALID_LONGUEUR  = ['court', 'moyen', 'long'];
    const VALID_INTENSITE = ['soft', 'equilibre', 'intense'];
    const VALID_CTA       = ['mixte', 'formel', 'soft'];

    const rawOpts = (body.options && typeof body.options === 'object') ? body.options : {};
    const options = {
      ton:       VALID_TON.includes(rawOpts.ton)             ? rawOpts.ton       : 'auto',
      longueur:  VALID_LONGUEUR.includes(rawOpts.longueur)   ? rawOpts.longueur  : 'moyen',
      intensite: VALID_INTENSITE.includes(rawOpts.intensite) ? rawOpts.intensite : 'equilibre',
      cta_style: VALID_CTA.includes(rawOpts.cta_style)       ? rawOpts.cta_style : 'mixte',
    };

    userMessage      = buildWeeklyPlanMessage(audience, focus, format, options, days);
    modelForCall     = DEFAULT_MODEL;
    // Adapter le token budget au nombre de jours
    maxTokensForCall = days <= 1 ? 2000 : days <= 7 ? MAX_TOKENS_WEEKLY_PLAN : 10000;
    maxTokensForCall = MAX_TOKENS_WEEKLY_PLAN;     // 6500
  } else {
    // mode === 'monthly_plan'
    const audience       = clamp(body.audience, 300);
    const offre          = clamp(body.offre, 200);
    const prix           = clamp(body.prix, 50);
    const transformation = clamp(body.transformation, 400);
    const douleur_1      = clamp(body.douleur_1, 250);
    const douleur_2      = clamp(body.douleur_2, 250);
    const douleur_3      = clamp(body.douleur_3, 250);
    const ton            = clamp(body.ton, 100);
    const formats        = clamp(body.formats, 200);

    if (!audience) {
      return res.status(400).json({ error: 'Le champ "audience" est obligatoire.' });
    }
    if (!offre) {
      return res.status(400).json({ error: 'Le champ "offre" est obligatoire pour un plan 30 jours.' });
    }

    userMessage = buildMonthlyPlanMessage({
      audience, offre, prix, transformation,
      douleur_1, douleur_2, douleur_3,
      ton, formats,
    });
    // Haiku pour 30 posts : plus rapide (3x) → tient dans le timeout Vercel 60s
    modelForCall     = 'claude-haiku-4-5-20251001';
    maxTokensForCall = 10000; // marge pour 30 posts avec légende complète + hook + cta
  }

  // ── Appel API avec retry sur surcharge (529/503/502/504/429) ──
  const requestBody = JSON.stringify({
    model:       modelForCall,
    max_tokens:  maxTokensForCall,
    temperature: GENERATION_TEMPERATURE,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      { role: 'user', content: userMessage },
    ],
  });

  const doAnthropicCall = () => fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: requestBody,
  });

  const RETRYABLE = [429, 502, 503, 504, 529];
  const RETRY_DELAY_MS = 3000;

  try {
    let apiResponse = await doAnthropicCall();

    // Retry une seule fois sur erreur de surcharge transitoire
    if (!apiResponse.ok && RETRYABLE.includes(apiResponse.status)) {
      console.log(`[retry] Anthropic ${apiResponse.status}, waiting ${RETRY_DELAY_MS}ms`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      apiResponse = await doAnthropicCall();
    }

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      const friendlyMessage = apiResponse.status === 529
        ? 'Les serveurs sont saturés en ce moment. Réessaye dans 1-2 minutes.'
        : `Erreur API (${apiResponse.status})`;
      return res.status(apiResponse.status).json({
        error: friendlyMessage,
        details: errText.slice(0, 500),
      });
    }

    const data = await apiResponse.json();
    const text = data?.content?.[0]?.text || '';

    // Parse JSON robuste : essaye direct, puis extraction par les délimiteurs { }
    // Strip d'éventuelles fences markdown (\`\`\`json ... \`\`\`) au passage.
    let parsed;

    // 1) Strip markdown code fences si présentes
    let cleaned = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    // 2) Tentative directe
    try {
      parsed = JSON.parse(cleaned);
    } catch { /* continue */ }

    // 3) Extraction entre le PREMIER '{' et le DERNIER '}' (gère les préambules + commentaires)
    if (!parsed) {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const candidate = cleaned.slice(firstBrace, lastBrace + 1);
        try { parsed = JSON.parse(candidate); } catch { /* continue */ }
      }
    }

    // 4) Dernier recours : regex greedy
    if (!parsed) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* abandon */ }
      }
    }

    if (!parsed) {
      return res.status(502).json({
        error: 'Réponse non parsable en JSON.',
        raw: text.slice(0, 800),
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
      error: 'Erreur serveur lors de la génération.',
      details: err.message,
    });
  }
}
