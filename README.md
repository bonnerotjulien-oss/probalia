# PROBALIA V4.7 — Tactical Intelligence, veille et mémoire sourcée (PWA)

## Nouveauté V4.7 : mémoire tactique contemporaine

L'application associe désormais aux équipes une **mémoire éditoriale structurée** (faits mesurés, analyses rapportées et hypothèses). Chaque entrée précise l'équipe, la catégorie tactique, le rôle (force / fragilité / style), la saison, la date, une formulation courte et un lien vers sa source. Elle accepte seulement les saisons **en cours ou précédente** et refuse les observations postérieures au match concerné.

Les observations validées sont préparées par `scripts/build-intelligence.mjs` depuis `tactical-sources/observations.json`, puis disponibles via `data/intelligence.json`. Un exemple limité et sourcé concernant Lens en 2025-2026 est intégré ; il ne prétend pas représenter tous les clubs et doit être réévalué en 2026-2027.

### Veille automatique des titres

Le nouveau workflow `.github/workflows/sync-intelligence.yml` est planifié **une fois par jour**. `scripts/sync-tactical-news.mjs` relève uniquement les **titres, liens, dates et sources** d'un flux RSS public de Ligue 1. Il les conserve dans `data/tactical-news.json` durant 90 jours, avec le statut **« À vérifier »**.

**Cette veille ne lit pas automatiquement le corps intégral des articles, ne recopie pas leur contenu et ne transforme jamais un titre en statistique.** Aucun scraping automatisé d'Opta Analyst ou du site officiel de Ligue 1 n'est installé : publication visible ne signifie pas licence de rediffusion/collecte en masse. Pour ajouter des faits d'Opta, on vérifie ponctuellement l'article et consigne une observation synthétique avec un lien, sans reproduire les tableaux complets.

### Mise en ligne V4.7

1. Copier tous les fichiers de cette archive dans le dépôt, en **préservant `data/` et les secrets GitHub existants**.
2. S'assurer que `.github/workflows/sync-intelligence.yml`, `intelligence.js`, `intelligence-ui.js`, `intelligence.css`, `scripts/build-intelligence.mjs`, `scripts/sync-tactical-news.mjs` et `tactical-sources/observations.json` sont présents.
3. Dans **Actions → PROBALIA - Veille tactique et mémoire sourcée → Run workflow**, déclencher une première synchronisation.
4. Vérifier les fichiers `data/intelligence.json` et, si le flux RSS répond, `data/tactical-news.json`.
5. Ouvrir PROBALIA, section Analyse tactique. Les observations sourcées et les titres à examiner apparaîtront si le flux fonctionne. En l'absence de données, un message clair reste affiché.

### Suite indispensable

Pour un système qui **lit et résume automatiquement les articles complets**, il faudrait une source proposant cette utilisation ou une autorisation explicite, et un moteur d'extraction sémantique (souvent une API IA avec coût et secret serveur). Le dépistage d'un titre est aujourd'hui automatisé ; sa vérification et sa conversion en observation tactique ne le sont pas. Les caractéristiques d'entraîneurs exigent une confirmation du coach actuel : un fait lié à un coach précis n'est pas activé tant que son identité actuelle n'est pas connue. Les probabilités restent inchangées jusqu'à validation historique d'un modèle tactique.

## Nouveau : analyse tactique événementielle (V4.6)

Cette version ajoute une rubrique **Analyse tactique** et un moteur d'analyse de matchs basé sur les événements de football, avec quatre familles de situations :

1. Tirs après corners et coups francs (phases arrêtées).
2. Tirs de la tête et du jeu aérien hors phases arrêtées.
3. Tirs en contre-attaque / transition.
4. Tirs dans le jeu placé.

Pour chaque équipe, il comptabilise les tirs, buts, xG *lorsqu'ils existent dans les événements*, et les tirs/buts concédés. Pour un match donné, le tableau croise la répartition offensive d'une équipe et les tirs concédés de l'autre. La base ne retient que les événements datant de moins de **120 jours**, et les matchs doivent être antérieurs à la prédiction. Un minimum de huit rencontres documentées par équipe et de trente tirs permet de limiter les affichages trompeurs.

**Attention : aucune couverture événementielle actuelle de Ligue 1 n'est fournie dans cette archive.** Aucun flux gratuit, complet et actualisé de 2026–2027 dont les droits autorisent cette intégration n'a été identifié. Si les données manquent, le site affiche « données indisponibles » ; il ne fabrique pas de profil. La base événementielle gratuite Wyscout documentée couvre 2017–2018, et la base ouverte StatsBomb présente certaines anciennes saisons de Ligue 1, non assimilables à la saison en cours.

### Comment importer des événements légalement obtenus

- Voir `tactical-sources/FORMAT.md` pour le format JSON attendu, avec événements de type StatsBomb et identification des deux clubs.
- Ajouter les fichiers JSON complets de match dans `tactical-sources/` uniquement si tu disposes des droits de réutilisation. Ne pas intégrer les exemples du manuel comme données réelles.
- Exécuter `node scripts/build-tactics.mjs` ou laisser le workflow **Résultats 2 fois par semaine** le faire. Il créera `data/tactics.json`, affiché automatiquement dans l'app.
- Les données doivent être réellement récentes pour apparaître dans l'analyse des matchs à venir. Des matchs historiques peuvent servir à développer et valider le moteur, mais ne donnent pas le style des effectifs actuels.

### Influence sur le calcul des probabilités

**Aucune correction tactique n'est appliquée aux probabilités 1/N/2 ou au score exact dans V4.6.** Il serait statistiquement injustifié de transformer arbitrairement « beaucoup de buts sur corner » en +5 % de victoire. Une prochaine étape nécessite un jeu récent d'événements, le rapprochement des équipes et joueurs, un modèle de correction des buts attendus, puis une validation hors échantillon contre V4.5. Tant que ce test n'est pas positif, la couche tactique doit rester descriptive.

## Nouveauté V4.5 : apprentissage statistique automatique

- Le script `scripts/train-model.mjs` évalue **neuf configurations préétablies** du moteur Poisson / Elo / Dixon-Coles à partir des matchs historiquement terminés.
- Il choisit une variante sur **200 matchs d'entraînement**, puis la compare au modèle de référence sur **90 autres matchs plus récents**. Les prévisions sont calculées chronologiquement, sans voir les scores du jour ou les résultats à venir.
- Le nouveau réglage n'est adopté que s'il améliore suffisamment la **log loss** sur le test indépendant, sans dégrader significativement le **score de Brier**. Dans le cas contraire, PROBALIA conserve ses paramètres de référence.
- La décision et les résultats du test sont publiés dans `data/model-settings.json`, puis lus par l'interface iPhone et le moteur de prévisions automatique. Le tableau de performance indique si un réglage est actif ou si la référence est conservée.
- L'entraînement se déroule automatiquement **les lundis et jeudis**, juste après la mise à jour des scores, sans nouveau fournisseur de données ni secret supplémentaire.

**Limites :** ce mécanisme est une sélection automatique parmi quelques configurations, pas une IA tactique autonome. Les performances historiques peuvent être instables et ne garantissent aucun profit. Les périodes de validation sont réévaluées à chaque synchronisation : pour des conclusions solides, il faudra aussi suivre les prévisions réelles prospectivement sur plusieurs mois, grâce au journal V4.4.

### Installer V4.5 depuis V4.4

Copier tous les fichiers à la racine du dépôt, en particulier `learning.js`, `scripts/train-model.mjs`, `model.js`, `app.js`, `calibration.js` et `performance.js`. Remplacer également `.github/workflows/sync-results.yml` : il entraîne désormais le modèle avant de mettre à jour le journal. Lancer ensuite **GitHub → Actions → PROBALIA - Résultats 2 fois par semaine → Run workflow**. Vérifier que `data/model-settings.json` a été créé. Les secrets API ne changent pas.

## Nouveauté V4.4 : historique vérifiable et partagé

- La rubrique **Bilan des prévisions** affiche `data/predictions.json` : mêmes indicateurs sur iPhone et ordinateur.
- GitHub Actions fige la **première prévision disponible dans les 7 jours avant chaque match**, au moins 15 minutes avant le coup d'envoi. Cette prévision n'est jamais modifiée rétroactivement.
- Dès que les scores finaux sont vérifiés, le bilan calcule la précision 1/N/2, la précision des scores exacts, le Brier, la log loss et la calibration. Les petits échantillons restent peu significatifs.
- Les cotes ne sont mémorisées **que si un prix réel a été observé avant le match**. Les profits associés sont des simulations sur une unité fictive par pari, et non des gains réels.
- Le nouveau workflow `.github/workflows/sync-forecast.yml` actualise calendriers, cotes et journal trois fois par jour ; `.github/workflows/sync-results.yml` actualise les résultats historiques **lundi et jeudi** pour limiter les téléchargements.
- La V4.4 introduit le journal de prévisions ; la V4.5 ajoute une sélection statistique automatique validée hors échantillon. Les données tactiques (xG, types de buts, compositions) restent à intégrer séparément. Aucune donnée Opta payante n'a été intégrée.

### Installer la mise à jour V4.4 sur GitHub

1. Copier le contenu de l'archive à la racine du dépôt, dont `ledger.js`, `performance.js`, `performance.css` et `scripts/sync-predictions.mjs`.
2. Copier aussi les **deux workflows** dans le dossier caché `.github/workflows` : `sync-forecast.yml` (nouveau) et `sync-results.yml` (remplacé). Cette étape est essentielle pour que le journal se remplisse sans ouvrir le site.
3. Conserver les secrets existants `FOOTBALL_DATA_TOKEN` et `ODDS_API_KEY` dans les paramètres GitHub, jamais dans le code.
4. Dans **Actions**, lancer **PROBALIA - Calendrier, cotes et prévisions**, puis **PROBALIA - Résultats 2 fois par semaine** ; vérifier l'apparition de `data/predictions.json`. Le bilan ne contiendra des scores qu'après l'issue de matchs archivés.
5. Si l'écriture échoue, activer **Settings → Actions → General → Workflow permissions → Read and write permissions**. Recharger le site et l'application installée pour renouveler le cache.

Attention : Football-Data.co.uk réserve ses données gratuites à un usage personnel ou académique et limite les téléchargements automatisés. Ne pas redistribuer ces données ni les utiliser pour un produit commercial sans droits adaptés.

## Nouveauté V4.3.1 : interface plus intuitive

- Palette ivoire, vert sauge et touches terracotta, inspirée des interfaces iOS claires.
- Parcours de navigation en trois étapes : matchs, probabilités, combinés.
- Cartes claires et lisibles, onglets de calendrier et boutons tactiles adaptés à l'iPhone.
- Icône et couleurs de l'application installée harmonisées avec le nouveau thème.
- Aucun changement dans le moteur statistique ou les sources de données.

## Nouveauté V4.3 : calendrier interactif

- Calendrier du vendredi au lundi sur la page d'accueil, avec onglets par jour.
- Un clic sur une rencontre affiche les probabilités 1/N/2, le score exact modal, trois autres scores, +2,5 buts et les deux équipes marquent.
- Accès à la fiche statistique complète, accessible dans les outils avancés.
- Si les sources sportives sont périmées, la consultation du calendrier reste possible mais les probabilités sont suspendues.
- Calculs réutilisés du moteur existant : aucun score ou taux inventé par le calendrier.

## Nouveauté V4.2 : accueil épuré

L'accueil affiche directement **le Top 3 du week-end** à probabilité estimée ≥ 85 % et les **combinés prudents** avec leur probabilité conjointe. La période sportive retenue va du vendredi au lundi (matchs encore à venir uniquement) et avance automatiquement dans le calendrier. Chaque carte affiche la probabilité, le marché, l'heure et la cote équitable théorique ; le simulateur s'ouvre à la demande. La mise initiale est de **0,50 €** par sélection ou par ticket. Le bouton *Personnaliser ce ticket* recopie les rencontres et les marchés choisis dans le créateur de combinés, sans passer de pari. Tous les outils scientifiques ou de comparaison restent disponibles en dépliant **Explorer les outils avancés**. La validation du modèle et les flux API restent ceux de V4.1.

La probabilité conjointe d'un combiné est inférieure à chacune de ses sélections ; le libellé « prudent » ne garantit pas un taux de réussite de 85 %. Les cotes utilisées pour estimer un gain doivent être saisies depuis une offre réelle de bookmaker pour ces marchés, car le flux automatique ne couvre que le 1N2.

Application statique gratuite. L'historique vient d'OpenFootball, les scores récents de Football-Data.co.uk, et le calendrier/horaire officiel de l'API football-data.org. Les cotes 1N2 européennes viennent de The Odds API. GitHub Actions synchronise calendrier et cotes trois fois par jour, les résultats lundi et jeudi, et conserve les prévisions dans `data/predictions.json`. **Les clés API sont stockées uniquement dans les GitHub Actions Secrets**, jamais dans le HTML ou JavaScript public. La saison de Ligue 1 est détectée automatiquement et les cinq saisons les plus récentes sont utilisées.

## Activer la synchronisation automatique sur GitHub Pages

1. Publier **tous** les fichiers de cette archive à la racine de `main`, y compris le dossier caché `.github/workflows` et le dossier `scripts` (important). Si la mise à jour de GitHub a été faite via le navigateur et n'a pas importé le dossier caché, modifier manuellement `.github/workflows/sync-results.yml` avec le contenu fourni dans cette archive.
2. Dans **Settings → Secrets and variables → Actions**, créer un secret de dépôt nommé exactement `FOOTBALL_DATA_TOKEN` contenant la clé API gratuite [football-data.org](https://www.football-data.org/client/register). Ne jamais coller la clé dans le dépôt public.
3. Créer un deuxième secret `ODDS_API_KEY` avec une clé [The Odds API](https://the-odds-api.com/) gratuite (500 crédits/mois au moment de l'intégration). La tâche utilise uniquement `h2h` et la région `eu` — soit normalement 1 crédit par appel effectif, environ 90/mois à 3 appels par jour. Les headers de réponse consignent les crédits restants dans le fichier de synthèse. Les données ne sont pas en temps réel.
4. Dans le dépôt GitHub, ouvrir **Actions** et lancer **PROBALIA - Calendrier, cotes et prévisions**, puis **PROBALIA - Résultats 2 fois par semaine** via **Run workflow**. Ces tâches génèrent les fichiers de données et le journal `data/predictions.json` ; attendre le déploiement Pages.
5. Dans **Settings → Actions → General → Workflow permissions**, cocher **Read and write permissions** si la tâche ne peut pas pousser les fichiers de données.
6. Calendriers, cotes et journal : 06h18, 12h18 et 19h18 UTC. Résultats : lundi et jeudi à 07h18 UTC. Ces horaires peuvent être retardés, ou désactivés après inactivité GitHub prolongée.
7. Si calendrier ou cotes sont périmés, les informations associées sont suspendues. Les résultats vérifiés acceptent jusqu'à 100 heures entre synchronisations, afin de permettre les deux téléchargements hebdomadaires. Si seul le flux de bookmaker échoue, les simulations fondées sur les résultats historiques peuvent rester disponibles ; les prix trop anciens sont masqués.

Le CSV Football-Data fournit uniquement les scores terminés ; le calendrier actuel vient de l'API football-data.org. Seuls les matchs `TIMED` (heure annoncée) sont proposés dans les analyses, avec conversion Europe/Paris. Les matchs simplement `SCHEDULED` (date provisoire), en cours ou reportés sont exclus des scénarios : vérifier malgré tout auprès de la LFP avant usage.

## Installer comme application sur un iPhone

**Il faut d'abord héberger le contenu en HTTPS** (ex. hébergement statique Infomaniak, GitHub Pages ou Cloudflare Pages). Le ZIP seul n'est ni un IPA iOS ni une application distribuée sur l'App Store.

1. Ouvrir l'URL HTTPS de PROBALIA dans Safari.
2. Toucher **Partager** puis **Sur l'écran d'accueil** (selon la version iOS, l'option peut apparaître dans le menu de la page).
3. Confirmer l'ajout ; une icône PROBALIA apparaît sur l'écran d'accueil.
4. Ouvrir cette icône pour accéder au tableau de bord en mode application.

Sur Android et certains navigateurs sur ordinateur, le bouton « Installer l'appli » peut déclencher la boîte d'installation native.

Le service worker met en cache l'interface, les feuilles de style, le moteur et l'icône. Les données sportives sont récupérées au chargement et sauvegardées localement en cas de panne de connexion ; leur fraîcheur n'est pas garantie hors ligne. Les sessions ne sont pas synchronisées entre appareils et aucune notification push n'est activée.

## Démarrer

1. Décompresser l'archive.
2. Dans le dossier extrait, lancer `python -m http.server 8080` ou tout serveur statique équivalent.
3. Ouvrir `http://localhost:8080` sur l'ordinateur. En ligne, héberger ces fichiers tels quels sur un hébergement statique avec HTTPS.

Un double-clic sur `index.html` peut fonctionner, mais un petit serveur local est recommandé pour les modules JavaScript et les requêtes de données.

## Moteur

- Modèle de taux de buts domicile/extérieur avec lissage des petits échantillons et décroissance temporelle exponentielle.
- Elo dynamique recalculé sur l'historique antérieur à chaque rencontre.
- Matrice de scores de Poisson et correction Dixon-Coles fixe des scores faibles.
- Probabilités 1N2, plus de 2,5 buts, deux équipes marquent, scores exacts.
- Backtest *walk-forward* des rencontres historiques, sans résultats du jour ni du futur pour prédire une rencontre ; le dernier ~22 % des pronostics est mis de côté comme test chronologique indépendant (au moins 60 prédictions).
- Correction à deux paramètres (température des probabilités et biais pour les nuls) ajustée sur les prédictions d'entraînement. Elle n'est activée **que** si elle améliore la log loss et ne dégrade pas substantiellement le Brier sur la période de test, tout en faisant mieux que la fréquence naïve historique. Dans le cas contraire, le modèle initial reste inchangé.
- Les marchés dérivés du score (buts, BTTS, double chance) sont recalculés à partir d'une distribution de scores repondérée après calibration, préservant leur cohérence.
- Log loss multiclasses, score de Brier multiclasses et comparaison à une référence à fréquences historiques.
- Heure du match et jours de repos affichés comme variables descriptives. Prévisions météo Open-Meteo montrées lorsqu'elles sont accessibles (elles n'affectent pas les probabilités faute de validation).
- Cotes 1N2 saisissables manuellement pour comparer l'espérance théorique (EV), sans recommandation automatique.
- Onglet **Profils de risque** : un marché à forte probabilité (Prudent), un marché intermédiaire (Équilibré) et un marché moins probable (Audacieux), sélectionnés parmi les rencontres à venir. Ce classement n'est ni un indice de rentabilité ni une garantie de succès ; les seuils sont déclarés dans le moteur et restent à valider sur l'historique.
- Onglet **Combinés prudents** : propositions à deux ou trois rencontres dans les 7 jours après la première rencontre à venir, avec une seule sélection par match, sans répétition d'équipe et une estimation de probabilité conjointe. Le produit des probabilités suppose l'indépendance entre matchs, approximation pouvant sous-estimer les corrélations. La cote combinée du bookmaker est saisie manuellement pour calculer l'EV théorique ; aucun ticket n'est placé automatiquement.
- **Mes combinés** : constructeur de 2 à 5 rencontres avec choix du marché et saisie des cotes bookmaker, simulation de mise, cote cumulée, retour brut, gain net conditionnel et probabilité estimée. Aucune mise n'est effectuée.
- **Comparateur de cotes** : propositions de marchés à forte probabilité ; saisie des véritables cotes proposées et classement des écarts de rendement *théorique*. Aucune cote de bookmaker n'est collectée automatiquement.
- **Radar de cotes 1N2 automatisé** : rapproche les rencontres de l'API football-data.org avec les cotes de The Odds API, conserve la meilleure cote par résultat et calcule l'écart **théorique** `EV = P_modèle × cote − 1`. Si au moins trois opérateurs offrent un marché 1N2 complet, le script calcule aussi un consensus *sans marge* à partir des cotes médianes. Un désaccord de plus de 8 points entre modèle et marché est signalé.
- **Combinés automatisés** : calcul de tickets à 2 et 3 rencontres sur résultats 1N2, seulement lorsque le modèle bat une référence naïve en période de test et que les autres critères sont satisfaits. Interdit les équipes répétées. Simule le gain brut/net sans placement de pari. Une bonne log loss ne prouve **jamais** un rendement aux cotes des bookmakers.
- **Top 3 ≥ 85 %** : jusqu'à trois sélections simples sur des clubs distincts durant la période du week-end (vendredi à lundi), avec probabilité du modèle ≥ 85 % et au moins 14 rencontres historiques par équipe. Les marchés sont choisis de préférence autour de 88 % pour éviter les cotes équitables minuscules. Chaque carte calcule le gain brut, le bénéfice conditionnel et l'écart théorique à la cote saisie, avec 0,50 € de mise par pari par défaut. Seuls les prix du marché 1N2 peuvent être préremplis par l'API actuelle ; les marchés double chance ou buts requièrent une saisie de cote. Si aucun marché ne satisfait les critères, aucun Top 3 fictif n'est produit. **Trois sélections individuelles à 85 % ne signifient pas qu'un combiné triple possède 85 % de chances.**

## Limites scientifiques et opérationnelles

Ce n'est **pas** un modèle entraîné et calibré sur tous les paramètres possibles. Une grille limitée de paramètres Poisson/Elo et Dixon-Coles est maintenant comparée automatiquement, avec rejet possible sur la période de test ; la correction des probabilités 1N2 peut elle aussi être rejetée. Aucun de ces contrôles ne prouve la rentabilité ou la validité hors des périodes observées. Sans historique des cotes réellement disponibles avant les matchs, il n'existe pas de backtest fiable de rendement (ROI).

Les horaires de football-data.org sont susceptibles de changer ; les cotes de The Odds API sont également des instantanés susceptibles de changer. Seul le marché **1N2** (victoire/nul/défaite) est relié à des cotes automatiques ; les autres marchés restent manuels. Aucune API de blessures, de composition ou de xG n'est branchée. Les effets météo, déplacement, calendrier européen, arbitres et enjeu ne sont pas ajustés arbitrairement.

Le script ne publie qu'une synthèse de la meilleure cote par résultat et un consensus agrégé, pas le flux bookmaker complet. Vérifier les [conditions de The Odds API](https://the-odds-api.com/terms-and-conditions.html) avant une distribution publique plus large. **Le flux européen peut inclure des opérateurs non agréés en France** : vérifier l'autorisation de l'opérateur et la disponibilité des cotes avant toute décision.

Les données de la seconde source et le journal des prévisions sont synchronisés par GitHub Actions dans le dépôt, avec historique Git. Les **prévisions archivées** sont communes à tous les appareils ; les combinés créés personnellement restent stockés localement dans le navigateur.

### Suite technique recommandée (sans abonnement)

1. Créer une clé gratuite Football-Data.org (`X-Auth-Token`) pour vérifier résultats, calendriers, horaires et états ; ne jamais l'insérer dans `app.js` côté navigateur.
2. Ajouter un petit proxy Worker/Pages Functions avec secret serveur et cache, sans divulguer la clé.
3. Ajouter une base persistante de snapshots (version du modèle, horodatage, source, p1/pN/p2, compositions connues avant le match, cote observée et source de la cote).
4. Utiliser un job planifié à quota gratuit pour synchroniser les matchs et figer les prévisions avant le coup d'envoi.
5. Suivre la calibration dans le temps, tester d'autres hyperparamètres sur des fenêtres glissantes, et comparer à des cotes historiques d'ouverture/fermeture pour calculer la closing line value et le rendement net vérifié.

## Données et licence

- [OpenFootball football.json](https://github.com/openfootball/football.json) — données sous domaine public selon le dépôt. Sources `YYYY-YY/fr.1.json`.
- Particularité de cette source : certains vrais 0-0 sont représentés comme `score:[0,0]`, tout comme des affiches futures. Le moteur ne les considère comme terminés que si leur date est strictement antérieure au jour courant ; les matchs du jour restent non résolus tant que le score final n'est pas explicite.
- [Open-Meteo](https://open-meteo.com/) — prévisions indicatives pour usage non commercial soumis à ses conditions.

## Tests

`node test.mjs` (Node.js récent, modules ESM activés avec le `package.json`).

Les cotes et les calculs d'EV ne sont pas une incitation à parier. Fixer un budget et ne pas jouer de sommes que l'on ne peut pas perdre.
# V4.8 — Analyse tactique approfondie

- Huit observations vérifiées de 2025-26, avec chiffres/URL quand disponibles ; Opta Analyst et Ligue 1.
- Comparaison des forces et fragilités **effectivement documentées**, et identification des forces communes (sans inventer de fragilités).
- Indicateur **de couverture documentaire**, et non de succès du pronostic : distinct des probabilités 1N2.
- Saisons courante et précédente seulement ; exclusion des observations de plus de 270 jours ; restriction aux entraîneurs connus pour les notes attribuées à un coach.
- Veille RSS automatisée sur les **titres** ; ces titres ne sont pas automatiquement convertis en faits.
- Procédure détaillée dans `tactical-sources/PROCEDURE_V4_8.md`.

**Limite fondamentale :** aucun abonnement ni API d'événements Opta n'est inclus. L'intelligence éditoriale ne modifie pas les probabilités tant qu'un effet prédictif tactique n'a pas réussi un test hors échantillon.

# V4.9 — Statistiques d'équipes synchronisées automatiquement

Cette version ajoute le collecteur `scripts/sync-team-stats.mjs` et une nouvelle section de l'application : **Statistiques récentes par équipe**.

## Ce qui est automatisé

- Un workflow GitHub Actions `PROBALIA - Statistiques de match Ligue 1` se lance chaque matin (ou manuellement dans Actions > Run workflow).
- Il télécharge les CSV de Football-Data pour la saison en cours et la précédente, si disponibles, puis génère `data/team-stats.json`.
- L'interface affiche des moyennes récentes de **tirs, tirs cadrés et corners**, créés par une équipe et concédés par son adversaire, si ces colonnes existent.
- Pour chaque match analysé, les calculs utilisent uniquement les résultats antérieurs à son coup d'envoi ; fenêtre 150 jours, maximum 12 rencontres, minimum quatre.
- Les données absentes restent `null` : elles ne se transforment jamais en zéro ou en chiffres inventés.
- En cas d'échec de la collecte, le programme conserve l'ancien fichier et son horodatage ; il ne prétend pas être à jour.

## Mise en ligne

1. Transférer **tous les fichiers** du ZIP à la racine du dépôt GitHub, ainsi que les sous-dossiers `.github`, `scripts`, `tactical-sources`, `data` et `icons`.
2. Dans **Actions**, sélectionner `PROBALIA - Statistiques de match Ligue 1`, puis **Run workflow**.
3. Confirmer une exécution verte avec la ligne `Statistiques équipe : ... matchs publiés` et l'existence de `data/team-stats.json`.
4. Actualiser l'application une fois le déploiement GitHub Pages terminé. Si les colonnes de tirs/corners ne sont pas fournies par la source, l'application affiche cette limite explicitement.

## Limites

Football-Data publie des statistiques de **match agrégées**, pas une chronologie événementielle détaillée. Les corners obtenus ne sont pas nécessairement des buts sur corner. Le volume de tirs ne démontre pas qu'une équipe sait contrer un pressing. Les données Opta Analyst restent une couche éditoriale sourcée ; aucune ingestion sous licence ni extraction automatique d'articles complets n'est incluse.

Les nouvelles moyennes **n'ajustent pas** les probabilités ou les tickets. Leur valeur prédictive doit d'abord être testée chronologiquement sur des saisons et journées conservées hors entraînement (logloss, Brier et calibration).

