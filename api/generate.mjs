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

# HOOKS — LE STYLE EXACT À REPRODUIRE

Les hooks doivent être DIRECTS, SPÉCIFIQUES, PROVOCANTS. Avec des chiffres concrets, des mini-histoires, des affirmations qui arrêtent le scroll.

**EXEMPLES À REPRODUIRE (c'est CE style, cette énergie, ce niveau de précision) :**

ATTIRER :
- "Cette technique m'a généré 47 leads en 2h pendant ma pause déjeuner"
- "Pourquoi je planifie mes contenus le dimanche soir en 30 minutes chrono"
- "Mon boss pense que je fais des heures sup alors que j'automatise tout"
- "J'ai appris à vendre des produits digitaux sans me montrer, sans pub, sans prospecter"

CHAUFFER :
- "Arrêtez de créer du contenu, 90% des influenceurs marketing se plantent"
- "La productivité c'est de la manipulation pour vous faire bosser plus"
- "Votre patron vous ment sur l'entrepreneuriat et je vais vous dire pourquoi"
- "Le plus difficile n'est pas de faire une vente. C'est de savoir comment commencer."

VENDRE :
- "Elle gagnait 2800€, maintenant elle facture 8K par mois depuis son canapé"
- "Comment Marc a quitté son CDI toxique grâce à une story Instagram"
- "Mes clients me disent tous la même chose après 30 jours"
- "Tu ne te sentiras jamais prête car être prête n'est pas un sentiment, mais une décision."

**CE QUI FAIT QUE CES HOOKS MARCHENT :**
- Des CHIFFRES spécifiques (47 leads, 2h, 30 minutes, 2800€, 8K, 30 jours)
- Des AFFIRMATIONS provocantes (ment, manipulation, se plantent)
- Des MINI-HISTOIRES (Elle gagnait X, maintenant Y / Comment [prénom] a [résultat])
- Du CONCRET (pause déjeuner, dimanche soir, CDI toxique, canapé)
- JAMAIS vague, JAMAIS générique, TOUJOURS un fait précis ou une histoire


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

// ─── 100 HOOK TEMPLATES CATALOG (Code Liberté) ────────────────
// A chaque génération, on en pioche 15 au hasard pour varier
const HOOK_TEMPLATES = [
  "Les meilleures méthodes pour atteindre [objectif de rêve]",
  "9 personnes sur 10 se trompent sur ce point précis",
  "Si je devais tout recommencer à zéro, voici ce que je ferais en premier",
  "Ne crois pas ceux qui te disent que...",
  "C'est la solution à tous tes [problèmes idéaux du client]",
  "Voici [X] petites astuces pour t'aider à [action/résultat]",
  "J'ai essayé, et voici ce qui s'est passé",
  "Comment [résultat désiré] avec un minimum d'effort",
  "C'est la seule manière de [action importante]",
  "Des difficultés avec [sujet] ? Parlons solutions",
  "Transforme ton [business] avec cette seule chose",
  "Imagine [bénéfice ou résultat]. Voilà comment y arriver",
  "Une technique méconnue pour booster ton [résultat]",
  "Suis-je le seul à ne pas avoir su que [information] ?",
  "Si tu veux [objectif], tu dois absolument connaître [concept]",
  "Les choses que je ne referais jamais après avoir appris [leçon]",
  "Comment atteindre [résultat désiré] 10 fois plus vite",
  "Tu me croirais si je te disais que [fait surprenant] ?",
  "Tu ne sais pas comment [faire quelque chose] ? Fais ça",
  "Pas de secret gardé : voilà exactement comment je fais [action]",
  "3 astuces simples pour [résultat]",
  "Je ne sais pas qui a besoin d'entendre ça, mais... [vérité importante]",
  "La vérité sur [sujet] que tu regretteras de ne pas avoir su avant",
  "Les erreurs que je vois trop souvent quand on essaie de [objectif]",
  "Ce qui te manque vraiment pour [résultat]",
  "STOP ! Tu dois absolument entendre parler de [sujet crucial]",
  "Voici exactement comment tu vas ____ sans ____",
  "Les étapes exactes que j'ai suivies pour ____ en [nombre de jours]",
  "J'ai arrêté de faire [une stratégie] et j'ai [résultat]",
  "Comment faire plus de ____ en faisant moins de ____",
  "J'ai enfin percé le secret de ____",
  "Dis adieu à [problème] grâce à cette méthode éprouvée",
  "3 outils que j'utilise chaque jour pour résoudre ____",
  "Voici ce qui se passe quand ____",
  "Voici ce que personne ne te dit sur ____ en 2024",
  "Tu veux doubler ton/tes ____ ? Voici comment",
  "Tu ne croiras pas ce qui se passe quand j'utilise ____",
  "Révélation sur ____",
  "Voici la vraie chose qui m'a aidé(e) à ____",
  "____ est la pire chose à faire pour ton/tes ____",
  "Tu veux connaître le secret de ____ ? Laisse-moi te dire",
  "Clarifions quelques idées fausses sur ____",
  "Fatigué(e) de ____ ? Essaie ça à la place",
  "Je parie que tu ne savais pas que ____",
  "Comment faire ____ en 60 secondes ou moins",
  "Une chose que j'aurais aimé savoir avant de commencer ____",
  "Si tu as peur de ____, regarde ça",
  "POV : Tu viens de trouver le meilleur ____",
  "Moi, j'applique ____ parce que ma plus grande peur est ____",
  "N'utilise pas ____ à moins que tu veuilles ____",
  "3 signes que tu dois abandonner ton/ta ____",
  "Ce que personne ne te dit à propos de ____",
  "Si tu ne fais pas ____, tu passes à côté de ____",
  "Les erreurs que je vois les gens commettre quand ils essaient de ____",
  "Il m'a fallu X années pour réaliser ____",
  "La vérité sur ____ que tu aurais aimé connaître plus tôt",
  "Cette erreur peut te coûter [argent, temps, santé]",
  "Voilà pourquoi tu as besoin de X et non de Y",
  "Imagine si tu pouvais ____",
  "Cela va changer ta façon d'utiliser ____",
  "Si tu souffres de [problème], arrête de faire défiler",
  "POV : Tu as pris ____ au sérieux, et voici ce qui s'est passé",
  "Juste un petit rappel pour te dire que ____",
  "J'ai passé des années à perfectionner ____, mais je vais te l'expliquer en quelques minutes",
  "____ est le plus grand défi que tu affrontes réellement, voici pourquoi",
  "Si tu aimes ____, alors tu vas aussi adorer ça",
  "5 choses que j'aurais aimé savoir plus tôt à propos de ____",
  "Moi, en train de résister à l'envie de te dire ____",
  "Si ton objectif est de ____, tu dois [nouvelle stratégie]",
  "Submergé(e) par [problème courant] ? Voici ce que tu dois faire",
];

function getRandomTemplates(n) {
  const shuffled = [...HOOK_TEMPLATES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}



function buildWeeklyPlanMessage(audience, focus, format, options, days) {
  days = days || 7;
  const audienceLine = audience
    ? `- Audience cible : ${audience}`
    : '- Audience cible : femmes qui veulent se lancer en ligne';

  const focusLine = focus
    ? `- Focus : ${focus}`
    : '- Focus : libre';

  const isStory = format === 'story';
  const isDrole = options && options.ton === 'drole';

  // ── Instructions format ──
  let formatBlock;

  // Override TOTAL en mode drôle
  if (isDrole) {
    if (isStory) {
      formatBlock = `FORMAT : STORIES DRÔLES

Chaque jour = 3 stories qui font RIRE. Pas d'arc narratif sérieux.

- Story 1 : une situation absurde du quotidien décrite avec exagération
- Story 2 : la suite encore plus absurde, on en rajoute une couche
- Story 3 : la chute + CTA décalé

Ton 100% humour. Auto-dérision. Pas de leçon. Pas de "Mais la vérité ?". Juste du rire.`;
    } else {
      formatBlock = `FORMAT : CONTENU DRÔLE (80% Reels + 20% Carrousels)

Sur ${days} jours : ${Math.round(days * 0.8)} Reels drôles + ${Math.round(days * 0.2)} Carrousels drôles.

REELS DRÔLES : hook "Quand tu..." + légende qui CONTINUE dans l'humour (pas de switch sérieux). La légende raconte la suite de la blague, développe l'absurdité, ajoute des détails marrants du quotidien.

CARROUSELS DRÔLES : PAS de "miroir → déclic → preuve". À la place :
- Slide 1 : un titre accrocheur drôle (ex: "3 trucs qu'on fait tous mais qu'on avoue jamais")
- Slide 2 : la suite (encore plus drôle)
- Slide 3 : la chute qui fait mourir de rire
Les slides doivent faire SOURIRE, pas éduquer.

CTA décalés partout : "Dis-moi que c'est pas que moi 😭", "Tag quelqu'un qui fait pareil 💀", "Commente si t'es dans ce mood"`;
    }
  } else if (isStory) {
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
- **${Math.round(days * 0.8)} Reels** — PAS de face cam, PAS de script parlé. Le reel utilise un texte en overlay sur une vidéo/image. Tu fournis : le hook (texte affiché en overlay, 8-15 mots) + la légende Instagram complète.
- **${Math.round(days * 0.2)} Carrousels** — 3 slides avec texte. Tu fournis : le hook (titre slide 1) + slide_1, slide_2, slide_3.

Pour chaque jour tu fournis TOUJOURS une **légende Instagram complète** (50-80 mots) qui suit la bible d'écriture : rythme 3 temps, déclencheurs signature, au moins 1 punchline, progression émotionnelle.

⚠️ LE HOOK N'EST PAS UN TITRE DE BLOG. C'est la phrase qu'on VOIT en premier sur le reel/la slide 1. Il doit :
- Faire 8 à 15 mots MAXIMUM
- Créer un curiosity gap immédiat (la personne DOIT lire la légende)
- S'inspirer des exemples de la créatrice dans le bloc système :
  "J'ai appris à vendre des produits digitaux sans me montrer, sans pub, sans prospecter"
  "Le plus difficile n'est pas de faire une vente. C'est de savoir comment commencer."
  "Tu ne te sentiras jamais prête car être prête n'est pas un sentiment, mais une décision."
  "En 2026 tu peux prendre un 2e job ou créer un revenu avec ton téléphone"
- JAMAIS générique, JAMAIS passe-partout, TOUJOURS spécifique et percutant`;
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
    // Adapter le niveau de détail au nombre de jours
    if (days > 10) {
      // 30 jours : ULTRA-LIGHT (juste hook + cta, pas de légende)
      schema = `{
  "plan": [
    { "jour": 1, "etape": "Attirer", "format_post": "Reel", "hook": "8-15 mots", "cta": "CTA court" }
  ]
}

IMPORTANT pour 30 jours : CHAQUE entrée tient sur UNE SEULE LIGNE JSON. Pas de retour à la ligne dans les valeurs. Hook = 8-15 mots. CTA = 3-5 mots. C'est tout. Pas de légende, pas de script.`;
    } else {
      schema = `{
  "plan": [
    {
      "jour": 1,
      "etape": "Attirer",
      "niveau_funnel": "TOFU",
      "format_post": "Reel",
      "hook": "le texte overlay du reel OU le titre de la slide 1 (8-15 mots, curiosity gap)",
      "slide_1": "texte slide 1 SI format_post=Carrousel (sinon vide)",
      "slide_2": "texte slide 2 SI format_post=Carrousel (sinon vide)",
      "slide_3": "texte slide 3 SI format_post=Carrousel (sinon vide)",
      "legende": "légende Instagram complète 50-80 mots. Suit la bible : rythme 3 temps, déclencheurs, punchline.",
      "cta": "CTA court"
    }
  ]
}

Pour les Reels : remplis hook + legende + cta. Laisse slide_1/2/3 vides.
Pour les Carrousels : remplis hook + slide_1 + slide_2 + slide_3 + legende + cta.`;
    }
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

  // ── Ton / style override basé sur les options avancées ──
  const opts = options || {};
  let tonBlock = '';
  if (opts.ton === 'drole') {
    tonBlock = `⚠️⚠️⚠️ TON 100% HUMOUR — CETTE CONSIGNE ÉCRASE TOUTES LES AUTRES ⚠️⚠️⚠️

IGNORE la progression émotionnelle sérieuse. IGNORE les déclencheurs "Parce que", "Mais la vérité ?". IGNORE le rythme 3 temps grave.

TOUS les hooks de la semaine = format "Quand tu [situation absurde mais 100% vraie du quotidien]..."
C'est le format viral TikTok. Chaque hook doit faire RIRE ou sourire. Exagération, auto-dérision, ironie.

Exemples de hooks drôles :
- "Quand tu changes ton alarme en applaudissements pour enfin avoir la reconnaissance que tu mérites"
- "Quand tu dis 'je vais me lancer' pour la 47ème fois ce mois-ci"
- "Quand t'as passé 3h à regarder des tutos au lieu de bosser et que t'appelles ça de la formation"
- "Quand ton plan business c'est de scroller jusqu'à trouver l'idée parfaite"
- "Quand tu te motives à 23h pour tout changer dans ta vie et que le lendemain t'as déjà oublié"
- "Quand tu calcules combien tu gagnerais si tu postais autant que tu scroll"

Les LÉGENDES aussi doivent être DRÔLES et légères. Pas de leçon de morale. Pas de ton grave. Humour du début à la fin. Tu peux glisser UN message utile à la toute fin mais toujours avec le sourire.

CTA décalés : "Dis-moi que c'est pas que moi 😭", "Tag quelqu'un qui fait pareil", "Commente si t'es dans ce mood 💀", "Partage à ta pote qui fait ça aussi"`;
  } else if (opts.ton === 'doux') {
    tonBlock = 'TON IMPOSÉ : DOUX ET BIENVEILLANT. Jamais de reproche. Ton de "Rappel du jour :" et d\'amie qui rassure.';
  } else if (opts.ton === 'direct') {
    tonBlock = 'TON IMPOSÉ : DIRECT ET CASH. Aucun détour. Tac au tac. Va droit au but.';
  } else if (opts.ton === 'expert') {
    tonBlock = 'TON IMPOSÉ : EXPERT / PÉDAGOGIQUE. Valeur concrète avec autorité mais sans condescendance.';
  } else if (opts.ton === 'vulnerable') {
    tonBlock = 'TON IMPOSÉ : VULNÉRABLE ET INTIME. Partage tes failles, tes doutes. "Je" obligatoire.';
  } else if (opts.ton === 'challengeant') {
    tonBlock = 'TON IMPOSÉ : CHALLENGEANT. Provoque gentiment, accuse avec tendresse, réveille.';
  } else {
    tonBlock = 'Varie les tons. Inclus AU MOINS 2 hooks format "Quand tu [situation absurde]..." dans la semaine pour aérer.';
  }

  return `CONTEXTE
${audienceLine}
${focusLine}

${tonBlock}

${formatBlock}

${rythmeBlock}

STRUCTURES DE HOOKS À UTILISER COMME INSPIRATION (piochées au hasard parmi 100) :
${getRandomTemplates(15).map((t, i) => '- ' + t).join('\n')}

Adapte ces structures à l'audience et au sujet. Ne les copie pas mot pour mot — inspire-toi de leur ÉNERGIE et STRUCTURE pour créer des hooks uniques et frais.

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
/* ─────────────────────────────────────────
   REFINE_HOOK — Génère 3 variantes d'un hook
   ───────────────────────────────────────── */
function buildRefineHookMessage(hook, audience, bestPosts) {
  const postsRef = bestPosts && bestPosts.length
    ? `\n\nEXEMPLES DE POSTS QUI MARCHENT CHEZ CETTE CRÉATRICE (imite leur ÉNERGIE) :\n${bestPosts.slice(0, 5).map(p => `- "${p}"`).join('\n')}`
    : '';

  return `TÂCHE : génère 3 variantes COMPLÈTEMENT DIFFÉRENTES de ce hook. Même message de fond, mais angles, structures et formulations totalement différents.

HOOK ORIGINAL : "${hook}"
AUDIENCE : ${audience || 'généraliste'}
${postsRef}

Chaque variante doit :
- Garder le MÊME message de fond
- Utiliser une STRUCTURE différente (contradiction, confession, projection datée, miroir accusateur, humour, question rhétorique...)
- Faire 8-15 mots MAX
- Créer un curiosity gap
- Sonner naturel (test du vocal WhatsApp)

JSON uniquement. { "variantes": ["hook 1", "hook 2", "hook 3"] }`;
}

/* ─────────────────────────────────────────
   HUMANIZE — Rendre un contenu plus naturel / moins IA
   ───────────────────────────────────────── */
function buildHumanizeMessage(content, bestPosts) {
  const postsRef = bestPosts && bestPosts.length
    ? `\n\nVOICI LE STYLE RÉEL DE CETTE CRÉATRICE (copie cette énergie) :\n${bestPosts.slice(0, 3).map(p => `"${p}"`).join('\n\n')}`
    : '';

  return `TÂCHE : réécris ce contenu pour qu'il sonne 100% HUMAIN et NATUREL. Comme si une vraie personne l'avait écrit sur son téléphone en 30 secondes.

CONTENU À HUMANISER :
---
${content}
---
${postsRef}

RÈGLES :
- Enlève tout ce qui sonne "rédigé", "copywrité", "GPT"
- Phrases fragmentées, orales, imparfaites
- Comme un vocal WhatsApp à une copine
- Garde le même message mais change les tournures trop propres
- Pas de "Mais la vérité ?", "Résultat :", sauf si ça sonne vraiment naturel dans le contexte
- Ajoute des imperfections volontaires : phrases coupées, "genre", "bref", "enfin tu vois"

JSON uniquement. { "humanized": "le texte réécrit" }`;
}

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
  const ALL_MODES = ['weekly_plan', 'monthly_plan', 'optimize_caption', 'recycle', 'analyze', 'detect_funnel', 'refine_hook', 'humanize'];
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
  } else if (mode === 'refine_hook') {
    const hook = clamp(body.hook, 500);
    if (!hook) return res.status(400).json({ error: 'Le champ "hook" est obligatoire.' });
    const bestPosts = Array.isArray(body.best_posts) ? body.best_posts.map(p => clamp(p, 300)) : [];
    userMessage      = buildRefineHookMessage(hook, clamp(body.audience, 200), bestPosts);
    modelForCall     = DEFAULT_MODEL;
    maxTokensForCall = 500;
  } else if (mode === 'humanize') {
    const cont = clamp(body.content, 2000);
    if (!cont) return res.status(400).json({ error: 'Le champ "content" est obligatoire.' });
    const bestPosts = Array.isArray(body.best_posts) ? body.best_posts.map(p => clamp(p, 300)) : [];
    userMessage      = buildHumanizeMessage(cont, bestPosts);
    modelForCall     = DEFAULT_MODEL;
    maxTokensForCall = 1500;
  } else if (mode === 'weekly_plan') {
    const format = String(body.format || 'reel').toLowerCase();
    if (!['story', 'contenu'].includes(format)) {
      return res.status(400).json({ error: 'format requis : "story" ou "contenu".' });
    }

    const audience = clamp(body.audience, 300);
    const focus    = clamp(body.focus, 600);
    const days = 7;

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
    // Sonnet pour le mode drôle (Haiku est mauvais en humour, et le prompt humor est court → Sonnet tient dans 60s)
    modelForCall     = DEFAULT_MODEL;
    // Adapter le token budget au nombre de jours
    maxTokensForCall = MAX_TOKENS_WEEKLY_PLAN;
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
    temperature: (body && body.options && body.options.ton === 'drole') ? 1.0 : GENERATION_TEMPERATURE,
    system: [
      {
        type: 'text',
        text: (body && body.options && body.options.ton === 'drole')
          ? `Tu es une HUMORISTE de TikTok/Instagram. Ton SEUL but : faire RIRE. Pas coacher. Pas motiver. Pas éduquer. RIRE.

Tu écris comme une meilleure pote qui balance des vérités absurdes dans un groupe WhatsApp à 1h du mat.

TOUS tes hooks commencent par "Quand tu..." et parlent de LA VIE QUOTIDIENNE PURE. PAS du marketing. PAS du business. PAS de produits digitaux. De la VRAIE VIE : le réveil, le café, la procrastination, Netflix, les to-do lists, les excuses, les lundi motivation.

15 EXEMPLES DU NIVEAU ATTENDU :
- "Quand tu changes ton alarme en applaudissements pour enfin avoir la reconnaissance que tu mérites pour te lever à 6h30"
- "Quand tu fais une to-do list de 47 trucs et que t'en fais 2 puis tu rajoutes 'faire la to-do list' pour cocher quelque chose"
- "Quand tu ouvres Instagram pour poster et que 45 min plus tard t'as rien posté mais tu connais la vie de 200 inconnus"
- "Quand tu te dis 'je mange healthy à partir de lundi' alors qu'on est mardi"
- "Quand ta motivation arrive à 23h47 pile au moment où t'es en pyjama"
- "Quand tu réponds 'je réfléchis' mais en vrai t'as déjà oublié de quoi on parlait"
- "Quand t'as 47 onglets ouverts et que t'appelles ça du multitasking"
- "Quand tu dis 'j'ai pas le temps' mais que tu peux réciter les 3 dernières saisons de ta série par cœur"
- "Quand ton plan B c'est de gagner au loto"
- "Quand tu procrastines tellement que tu ranges ta chambre pour éviter de bosser"
- "Quand tu lis '5 min de méditation changent ta vie' et que tu passes 20 min à chercher la bonne appli"
- "Quand t'as tellement de projets en tête que le seul qui avance c'est ta liste Netflix"
- "Quand tu te compares à quelqu'un qui a commencé y a 3 ans et tu te demandes pourquoi t'es pas au même niveau après 3 jours"
- "Quand tu dis 'cette semaine je m'y mets' tous les dimanches soirs depuis 2019"
- "Quand tu scroll pendant 3h en te disant que t'es en train de faire de la veille"

LÉGENDES : drôles aussi. Continue le délire du hook. PAS de coaching. PAS de "Mais la vérité ?". Juste de l'auto-dérision et des situations que tout le monde vit.

Exemple de bonne légende : "Sérieusement. 23h47. Tu te dis 'demain je change tout'. Tu ouvres YouTube. 14 vidéos plus tard tu maîtrises la théorie mais t'as toujours rien fait. Le lendemain ? T'as oublié. Mais t'as liké 142 posts de motivation. Et ça compte, non ? ...non ? 😭"

CTA décalés : "Dis-moi que c'est pas que moi 😭", "Tag quelqu'un qui fait ça 💀", "Avoue en commentaire 🫣", "Like si t'as fait ça aujourd'hui"

JSON uniquement. Commence par { finit par }.`
          : SYSTEM_PROMPT,
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
