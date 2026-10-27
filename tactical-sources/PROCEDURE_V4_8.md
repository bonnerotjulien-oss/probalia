# Intelligence tactique V4.8 — protocole fiable

Le système conserve un constat daté et sa preuve, mais ne prend pas une supposition d'article pour une statistique exhaustive.

## Collecte conseillée, saison 2026-27 (ou 2025-26)

1. Consulter des contenus accessibles et réutilisables suivant les conditions de leur auteur : Opta Analyst (statistiques publiquement lisibles), articles officiels de la Ligue 1, autres analyses tactiques datées.
2. Noter l'équipe, la date de publication, la saison analysée, la période ou le nombre de matchs, l'éventuel entraîneur concerné et l'URL source.
3. Distinguer les chiffres vérifiables (`measured`), l'analyse journalistique (`reported`) et l'hypothèse (`hypothesis`).
4. Associer le fait à une catégorie : pressing, setPiece, aerial, transition, buildUp, wide, defence.
5. Indiquer `strength`, `weakness` ou `style`, **uniquement si l'article le démontre**. Ne pas qualifier une faiblesse en déduisant l'opposé d'une force offensive.
6. Ajouter l'entrée dans `observations.json` avec un identifiant unique, `reviewed:true` seulement après vérification du lien et du fait.
7. Lancer `node scripts/build-intelligence.mjs` et `npm test` ; publier les fichiers modifiés sur GitHub. Le workflow planifié reconstruit la mémoire et découvre les titres RSS, il ne prétend pas lire ni comprendre les articles entiers.

## Règles de sûreté des prédictions

- Une source de 2025-26 peut éclairer un match de 2026-27, mais pas un match de 2027-28.
- Les observations de plus de 270 jours sont retirées des confrontations : un nouvel entraîneur ou des transferts peuvent rendre une analyse bien plus rapidement obsolète.
- Les notes rattachées à `coach` ne seront affichées que lorsque l'entraîneur actuel est explicitement connu et concorde.
- Un même article peut sourcer plusieurs chiffres mais ne compte qu'**une** source indépendante.
- Le score documentaire sur 100 mesure couverture, fraîcheur et proportions chiffrées ; **ce n'est jamais la probabilité d'un pari**.
- Les forces/faiblesses sourcées peuvent être affichées face à face ; elles **ne modifient pas** les chances 1N2 tant qu'une méthode n'a pas amélioré le logloss et le Brier sur un jeu chronologique indépendant.
- Un scénario séduisant sans preuve doit être présenté comme non renseigné, pas comme un avantage.

## Pour un vrai apprentissage tactique chiffré

Il faut un **flux de données événementielles match par match couvrant toute la Ligue 1 actuelle** (tirs, séquences de passes, pressing, zones, coups de pied arrêtés, corps du tir, entraîneurs) avec droit de réutilisation. Les données historiques d'autres saisons ne sont pas un substitut valide. Avec ce flux, on peut calculer des facteurs tactiques *pré-match* et les tester en walk-forward contre le modèle V4.5. Sans flux, la mémoire d'articles reste descriptive et honnête.

## Références de départ

- https://theanalyst.com/competition/ligue-1/stats
- https://theanalyst.com/articles/lens-making-ligue-1-title-race-interesting
- https://ligue1.com/en/articles/l1_article_4683-
- https://www.football-data.co.uk/francem.php (résultats, tirs agrégés et cotes historiques, **pas** événements détaillés)

Les chiffres intégrés sur les phases arrêtées se rapportent à une **photographie du 26 mars 2026, après 26 journées**, et ne prétendent pas décrire l'ensemble de la saison 2026-27.
