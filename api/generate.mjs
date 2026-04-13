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

1. **Format** : 1 à 2 phrases max. Peut utiliser "…" pour la tension, ou une formule directe, selon le template choisi.
2. **Adresse** : tutoiement direct ("tu"), féminin assumé (l'audience est féminine)
3. **Naturel avant tout** : le hook doit sonner comme une vraie pensée qui sort sans filtre. Jamais de phrase qui pue la "formule marketing".
4. **Concret > abstrait** : exemples du quotidien (scroller, sauvegarder, attendre, "plus tard"…). Jamais de concepts vagues.
5. **Zéro emoji dans le hook**
6. **Zéro jargon marketing** ("mindset", "leverage", "impact", "synergie", "engageant" = interdits sauf si utilisés dans le template lui-même, ex : "Le mindset qui bloque [X]")
7. **Zéro point d'exclamation**

# 📚 CATALOGUE DES 125 TEMPLATES DE HOOKS (à utiliser comme bibliothèque d'inspiration)

Tu disposes de 125 templates répartis en 5 catégories. Chaque template est une structure avec [X] à remplir selon l'audience et le sujet. **Tu t'inspires directement de ces templates** : tu en choisis un et tu l'adaptes au sujet du jour. Alterne entre les catégories pour varier la semaine.

## CATÉGORIE 1 — CASSER LES CROYANCES
*Tu prends un conseil mainstream et tu le démontes. Le cerveau ne peut pas s'empêcher de réagir à la contradiction.*

1. Arrête de croire que [X]
2. Pourquoi [conseil populaire] ne fonctionne pas pour toi
3. Le mythe de [X] qui te bloque
4. Stop aux injonctions sur [X]
5. Le raccourci qui n'existe pas en [X]
6. Pourquoi tu n'as pas besoin de [X] pour réussir
7. La vérité sur [X] que personne n'ose dire
8. Pourquoi [X] n'est pas la solution miracle
9. Le problème avec [conseil mainstream]
10. Mon avis impopulaire sur [X]
11. Pourquoi [X] ne te rendra pas plus [Y]
12. L'approche contre-intuitive de [X]
13. Pourquoi moins c'est plus sur [X]
14. La croyance à déconstruire sur [X]
15. Ce que tu dois désapprendre sur [X]
16. Le piège de [X]
17. Pourquoi comparer [X] est dangereux
18. L'alternative à [X] que personne ne propose
19. Arrête de chercher la perfection sur [X]
20. Pourquoi [X] prend du temps (et c'est normal)
21. Ce que cache vraiment [X]
22. Le secret le moins sexy sur [X]
23. Ce qu'on interprète mal sur [X]
24. Ce que les solutions classiques ne traitent pas dans [X]
25. Pourquoi [X] ne suffit pas

## CATÉGORIE 2 — EXPÉRIENCE PERSONNELLE
*Tu partages un moment vrai de ton parcours. La vulnérabilité authentique crée une connexion instantanée.*

26. Le conseil que j'aurais aimé recevoir quand j'ai commencé
27. Ce qui m'a fait perdre 6 mois sur [X]
28. Ce que [X] m'a appris sur moi
29. Ce que j'ai changé dans ma façon de [X]
30. Mon parcours de [X] en 5 étapes
31. Ce que je referais différemment sur [X]
32. Ce qui m'a débloquée sur [X]
33. L'outil qui a changé ma façon de [X]
34. Le jour où j'ai compris [X]
35. Mon processus pour [X] en toute transparence
36. Mon échec sur [X] et ce que j'en ai tiré
37. Le déclic qui change tout sur [X]
38. Ce que j'ai arrêté de cacher sur [X]
39. J'ai longtemps eu honte de [X]
40. Ce que [X] m'a appris malgré moi
41. Le jour où j'ai craqué sur [X]
42. Ce que j'aurais voulu savoir avant [X]
43. J'ai mis du temps à accepter [X]
44. Ce que j'assume enfin sur [X]
45. J'ai compris [X] trop tard
46. Le moment où [X] n'était plus acceptable
47. J'ai longtemps cru que [X] était normal
48. Ce que [X] m'a coûté en restant tel quel
49. Le jour où j'ai arrêté de minimiser [X]
50. Si c'était à refaire, voilà ce que je changerais sur [X]

## CATÉGORIE 3 — INTERPELLATION DIRECTE
*Tu pointes du doigt un comportement que ta cible reconnaît immédiatement. Les gens partagent ce qui les décrit.*

51. 3 signes que tu es prête à [X]
52. L'erreur n°1 que je vois chez les débutantes en [X]
53. Ce que tu rates si tu ne [X] pas
54. 3 questions pour savoir si tu dois [X]
55. Ce qui t'empêche vraiment de [X]
56. Pourquoi tu bloques sur [X] (et comment avancer)
57. Ce que tu peux arrêter de faire sur [X]
58. Le signal que tu ignores sur [X]
59. Pourquoi tu te compliques la vie sur [X]
60. Ce que [X] dit de toi
61. Ce que tu fais déjà bien sur [X]
62. La permission que tu attends pour [X]
63. Pourquoi [X] te fait peur (et c'est ok)
64. Le mindset qui bloque [X]
65. Pourquoi attendre le bon moment est une erreur
66. Ce que tu dois lâcher pour [X]
67. L'erreur silencieuse sur [X]
68. Ce que tu dois accepter pour [X]
69. Ce que [X] demande vraiment
70. L'obstacle invisible sur [X]
71. Ce que tu dois protéger pour [X]
72. Le truc que tout le monde néglige sur [X]
73. Ce que [X] exige de toi
74. Je te vois galérer avec [X]
75. Tu n'es pas en retard sur [X]

## CATÉGORIE 4 — ÉDUCATION & MÉTHODE
*Tu donnes de la valeur concrète. Tu montres que tu maîtrises ton sujet sans être condescendante.*

76. La base avant de vouloir [X]
77. Les 3 piliers de [X] qu'on oublie toujours
78. La question à te poser avant de [X]
79. 5 ressources gratuites pour [X]
80. Ce qui se passe vraiment quand tu [X]
81. La différence entre [X] et [Y]
82. La méthode simple pour [X]
83. 3 façons de simplifier [X]
84. Ce que tu peux déléguer sur [X]
85. L'habitude qui a tout changé pour [X]
86. Ce qui fait la différence sur [X]
87. Le premier pas pour [X]
88. Ce que tu peux commencer aujourd'hui sur [X]
89. L'ajustement qui change tout sur [X]
90. Le détail qui change tout sur [X]
91. La nuance importante sur [X]
92. Le mécanisme derrière [X]
93. Le préalable à [X] qu'on oublie
94. La condition pour que [X] fonctionne
95. Ce qui doit changer avant [X]
96. Le travail invisible derrière [X]
97. La fondation de [X]
98. Pourquoi [X] sans [Y] ne marche pas
99. L'ordre logique pour [X]
100. Ce que [X] requiert d'abord

## CATÉGORIE 5 — VULNÉRABILITÉ & CONNEXION
*Tu montres les coulisses. Pas du misérabilisme calculé : un aveu vrai qui crée du lien.*

101. Ce qu'on ne dit pas quand on vit [X]
102. Dis-moi que je ne suis pas la seule à [X]
103. Le truc bizarre que je fais pour [X]
104. J'adore [X], mais parfois…
105. On fait toutes [X], personne ne l'avoue
106. Ce moment où [X] devient pesant
107. Je pensais que [X] serait plus simple
108. Ce que ça fait vraiment de [X]
109. Ce qu'on ne te prépare pas pour [X]
110. Je fais semblant que [X] va bien
111. Si tu vis [X], tu vas comprendre
112. On ne parle pas assez de [X]
113. Ce qui m'use dans [X]
114. Je pensais être bizarre à cause de [X]
115. Le poids invisible de [X]
116. Ce que j'aurais aimé qu'on me dise sur [X]
117. On normalise trop [X]
118. Ce que ça coûte de [X]
119. Ce que [X] m'a volé
120. On ne parle jamais de [X] quand tout va bien
121. Ce moment où tu réalises que [X]
122. Ce que [X] révèle sur nous
123. On apprend à vivre avec [X]
124. Ce que personne ne te demande sur [X]
125. Je croyais que [X] passerait

# 🎯 CORRESPONDANCE CATÉGORIES × ÉTAPES

Les catégories peuvent servir chacune des 3 étapes, mais certaines combinaisons sont plus naturelles :
- **Attirer (TOFU)** : Catégories 3 (Interpellation), 5 (Vulnérabilité), 1 (Croyances)
- **Engager (MOFU)** : Catégories 1 (Croyances), 3 (Interpellation), 4 (Éducation)
- **Convertir (BOFU)** : Catégories 2 (Expérience perso), 4 (Éducation), et CTAs forts

**Important** : varie les catégories sur la semaine pour ne jamais sortir 7 hooks avec la même tournure. Par exemple : Lundi catégorie 3, Mardi catégorie 1, Mercredi catégorie 4, etc.

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
   Deux formats possibles : "story" ou "reel"
   Rythme de la semaine (inspiré des 30 jours de référence) :
   Lun Attirer → Mar Engager → Mer Convertir
   → Jeu Attirer → Ven Engager → Sam Convertir → Dim Attirer
   ───────────────────────────────────────── */
function buildWeeklyPlanMessage(audience, focus, format) {
  const audienceLine = audience
    ? `- Audience cible : ${audience}`
    : '- Audience cible : femmes qui veulent se lancer en business en ligne mais qui bloquent';

  const focusLine = focus
    ? `- Focus de cette semaine : ${focus}`
    : '- Focus de cette semaine : libre — Claude choisit l\'angle le plus universel';

  const isStory = format === 'story';

  const formatBlock = isStory
    ? `FORMAT DEMANDÉ : STORIES INSTAGRAM

Tu génères 7 STORIES (une par jour), pas des posts longs.

Pour chaque story, tu fournis :
- **hook** : la phrase d'accroche textuelle (c'est la première chose qu'elle lit en ouvrant la story). 1 ligne max, percutante, naturelle.
- **texte** : 2 à 4 lignes max de contenu (une story ça se lit en 5 secondes). Retours à la ligne \\\\n pour aérer.
- **sticker** : le type d'interactivité suggérée — choisir parmi : "sondage", "question", "quiz", "curseur émoji", "compte à rebours", "lien", "aucun"
- **sticker_contenu** : le texte du sticker (ex : "Tu te reconnais ?", "Oui / Non", "Swipe Up")
- **cta** : l'appel à l'action (souvent le sticker lui-même, ou un "Réponds-moi en DM", etc.)`
    : `FORMAT DEMANDÉ : REELS INSTAGRAM

Tu génères 7 REELS (une par jour), pas des stories.

Pour chaque reel, tu fournis :
- **hook** : la première phrase que tu dis ou qui s'affiche dans les 1-2 premières secondes. C'est critique, elle doit arrêter le scroll. Tu t'inspires d'un des 125 templates.
- **script** : 4 à 8 lignes de texte parlé, structuré en mini-narration. Problème → tension → révélation → ouverture. Utilise des retours à la ligne \\\\n pour indiquer les scènes.
- **cta** : l'appel à l'action final en voix + caption (ex : "Commente MOI si c'est toi")`;

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
      "hook": "la phrase d'accroche principale de la story",
      "texte": "le contenu texte de la story, 2-4 lignes avec retours à la ligne \\\\n",
      "sticker": "sondage | question | quiz | curseur émoji | compte à rebours | lien | aucun",
      "sticker_contenu": "le texte exact du sticker",
      "cta": "l'appel à l'action"
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
      "hook": "la phrase d'accroche (template du catalogue adapté au sujet)",
      "script": "le script du reel, 4-8 lignes avec retours à la ligne \\\\n",
      "cta": "l'appel à l'action"
    }
  ]
}`;

  return `CONTEXTE
${audienceLine}
${focusLine}

${formatBlock}

TÂCHE
Génère un planning éditorial Instagram de 7 jours (lundi à dimanche) qui suit STRICTEMENT la méthode Brille & Vibre décrite dans le bloc système.

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
- Chaque hook vient du CATALOGUE DES 125 TEMPLATES. Tu choisis le template qui convient le mieux à l'étape et au sujet, tu remplaces [X] par le contenu réel, et tu le rends 100% naturel.
- Mentionne dans "categorie_hook" la catégorie du template utilisé (Casser les croyances / Expérience personnelle / Interpellation directe / Éducation & méthode / Vulnérabilité & connexion)
- **Varie les catégories sur la semaine** : jamais 2 jours consécutifs avec la même catégorie. Au moins 3 catégories différentes sur les 7 jours.
- Chaque CTA respecte LES RÈGLES DU CTA (court, mot déclencheur en MAJUSCULES, cohérent avec l'étape).
- Adapte le sujet, le vocabulaire et les scénarios à l'audience précisée.
- Si un focus de semaine est précisé, TOUTE la semaine converge subtilement vers ce focus (le mercredi et le samedi sont les pics de conversion).
- Respecte strictement la table de correspondance des 4 axes du bloc système.

SCHÉMA JSON ATTENDU — exactement 7 entrées dans "plan", aucun texte avant ni après le JSON :
${schema}`;
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
      const weeklyFormat = String(body.format || 'reel').toLowerCase();
      if (!['story', 'reel'].includes(weeklyFormat)) {
        return res.status(400).json({ error: 'format requis pour weekly_plan : "story" ou "reel".' });
      }
      userMessage = buildWeeklyPlanMessage(audience, focus, weeklyFormat);
      maxTokens = 6500;
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
