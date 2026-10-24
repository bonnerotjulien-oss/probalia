# PROBALIA V2.2 — application web installable (PWA)

Application statique gratuite. L'historique vient d'OpenFootball, les scores récents de Football-Data.co.uk, et le calendrier/horaire officiel de l'API football-data.org. GitHub Actions synchronise les deux flux dans `data/results.json` et `data/fixtures.json` trois fois par jour. **La clé football-data.org est stockée uniquement dans les GitHub Actions Secrets**, jamais dans le HTML ou JavaScript public.

## Activer la synchronisation automatique sur GitHub Pages

1. Publier **tous** les fichiers de cette archive à la racine de `main`, y compris le dossier caché `.github/workflows` et le dossier `scripts` (important). Si la mise à jour de GitHub a été faite via le navigateur et n'a pas importé le dossier caché, modifier manuellement `.github/workflows/sync-results.yml` avec le contenu fourni dans cette archive.
2. Dans **Settings → Secrets and variables → Actions**, créer un secret de dépôt nommé exactement `FOOTBALL_DATA_TOKEN` contenant la clé API gratuite [football-data.org](https://www.football-data.org/client/register). Ne jamais coller la clé dans le dépôt public.
3. Dans le dépôt GitHub, ouvrir **Actions** → **PROBALIA - Synchroniser les résultats** → **Run workflow** → **Run workflow**. Cela génère `data/results.json` ET `data/fixtures.json` puis les publie sur `main` ; attendre le job et le déploiement Pages.
4. Dans **Settings → Actions → General → Workflow permissions**, cocher **Read and write permissions** si la tâche ne peut pas pousser les fichiers de données.
5. Les synchronisations suivantes sont programmées à 06h18, 12h18 et 19h18 UTC, sous réserve de la disponibilité des GitHub Actions (les jobs programmés peuvent être retardés ou désactivés après inactivité prolongée).
6. Si un des deux flux manque ou date de plus de 48 heures, ou si le dernier score déclaré dépasse 10 jours, les pronostics, comparateurs et simulateurs sont suspendus.

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
2. Dans le dossier `probalia-v2`, lancer `python -m http.server 8080` ou tout serveur statique équivalent.
3. Ouvrir `http://localhost:8080` sur l'ordinateur. En ligne, héberger ces fichiers tels quels sur un hébergement statique avec HTTPS.

Un double-clic sur `index.html` peut fonctionner, mais un petit serveur local est recommandé pour les modules JavaScript et les requêtes de données.

## Moteur

- Modèle de taux de buts domicile/extérieur avec lissage des petits échantillons et décroissance temporelle exponentielle.
- Elo dynamique recalculé sur l'historique antérieur à chaque rencontre.
- Matrice de scores de Poisson et correction Dixon-Coles fixe des scores faibles.
- Probabilités 1N2, plus de 2,5 buts, deux équipes marquent, scores exacts.
- Backtest *walk-forward* des dernières 160 rencontres disponibles, sans résultats du jour ni du futur pour prédire une rencontre.
- Log loss multiclasses, score de Brier multiclasses et comparaison à une référence à fréquences historiques.
- Heure du match et jours de repos affichés comme variables descriptives. Prévisions météo Open-Meteo montrées lorsqu'elles sont accessibles (elles n'affectent pas les probabilités faute de validation).
- Cotes 1N2 saisissables manuellement pour comparer l'espérance théorique (EV), sans recommandation automatique.
- Onglet **Profils de risque** : un marché à forte probabilité (Prudent), un marché intermédiaire (Équilibré) et un marché moins probable (Audacieux), sélectionnés parmi les rencontres à venir. Ce classement n'est ni un indice de rentabilité ni une garantie de succès ; les seuils sont déclarés dans le moteur et restent à valider sur l'historique.
- Onglet **Combinés prudents** : propositions à deux ou trois rencontres dans les 7 jours après la première rencontre à venir, avec une seule sélection par match, sans répétition d'équipe et une estimation de probabilité conjointe. Le produit des probabilités suppose l'indépendance entre matchs, approximation pouvant sous-estimer les corrélations. La cote combinée du bookmaker est saisie manuellement pour calculer l'EV théorique ; aucun ticket n'est placé automatiquement.
- **Mes combinés** : constructeur de 2 à 5 rencontres avec choix du marché et saisie des cotes bookmaker, simulation de mise, cote cumulée, retour brut, gain net conditionnel et probabilité estimée. Aucune mise n'est effectuée.
- **Comparateur de cotes** : propositions de marchés à forte probabilité ; saisie des véritables cotes proposées et classement des écarts de rendement *théorique*. Aucune cote de bookmaker n'est collectée automatiquement.

## Limites scientifiques et opérationnelles

Ce n'est **pas** un modèle entraîné et calibré sur tous les paramètres possibles. Les hyperparamètres actuels sont préfixés et doivent être validés sur des périodes de test indépendantes. Le rho Dixon-Coles n'est pas optimisé ; la calibration des probabilités (fiabilité de p=60 %, etc.) reste à implémenter. La comparaison au modèle de référence aide au diagnostic, mais une bonne log loss ne garantit pas une EV positive face au marché.

Les horaires de football-data.org sont des données externes susceptibles de changer et doivent être contrôlés avant le match. Aucun API de blessures, de composition, de xG ou de **cotes bookmaker** n'est branché. Les effets météo, déplacement, calendrier européen, arbitres et enjeu ne sont pas ajustés arbitrairement.

Les données de la seconde source sont synchronisées par GitHub Actions dans le dépôt, avec historique Git. L'historique des prévisions à venir reste stocké **sur l'appareil** ; il n'est pas encore synchronisé entre appareils.

### Suite technique recommandée (sans abonnement)

1. Créer une clé gratuite Football-Data.org (`X-Auth-Token`) pour vérifier résultats, calendriers, horaires et états ; ne jamais l'insérer dans `app.js` côté navigateur.
2. Ajouter un petit proxy Worker/Pages Functions avec secret serveur et cache, sans divulguer la clé.
3. Ajouter une base persistante de snapshots (version du modèle, horodatage, source, p1/pN/p2, compositions connues avant le match, cote observée et source de la cote).
4. Utiliser un job planifié à quota gratuit pour synchroniser les matchs et figer les prévisions avant le coup d'envoi.
5. Calibrer les hyperparamètres sur une période d'entraînement/validation, évaluer sur une troisième période indépendante puis mesurer calibration, dégradation dans le temps et closing line value.

## Données et licence

- [OpenFootball football.json](https://github.com/openfootball/football.json) — données sous domaine public selon le dépôt. Sources `YYYY-YY/fr.1.json`.
- Particularité de cette source : certains vrais 0-0 sont représentés comme `score:[0,0]`, tout comme des affiches futures. Le moteur ne les considère comme terminés que si leur date est strictement antérieure au jour courant ; les matchs du jour restent non résolus tant que le score final n'est pas explicite.
- [Open-Meteo](https://open-meteo.com/) — prévisions indicatives pour usage non commercial soumis à ses conditions.

## Tests

`node test.mjs` (Node.js récent, modules ESM activés avec le `package.json`).

Les cotes et les calculs d'EV ne sont pas une incitation à parier. Fixer un budget et ne pas jouer de sommes que l'on ne peut pas perdre.
