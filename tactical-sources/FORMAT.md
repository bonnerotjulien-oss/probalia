# Format d’import tactique — PROBALIA

Placer ici des fichiers JSON contenant des **événements que vous êtes autorisé à réutiliser**.
Lancer `node scripts/build-tactics.mjs` pour générer `data/tactics.json`.

```json
{
  "matches": [
    {
      "date": "YYYY-MM-DD",
      "home": "Nom exact de l'équipe à domicile",
      "away": "Nom exact de l'équipe à l'extérieur",
      "events": [
        {"type":{"name":"Shot"},"team":{"name":"Nom exact de l'équipe à domicile"},"play_pattern":{"name":"From Corner"},"shot":{"outcome":{"name":"Saved"},"body_part":{"name":"Head"},"statsbomb_xg":0.10}}
      ]
    }
  ]
}
```

Chaque match doit contenir **tous les événements disponibles** des deux équipes, pas seulement les actions marquantes, pour éviter les biais de sélection. L’exemple ci-dessus sert uniquement à montrer le format, **pas à alimenter le modèle**.

Les fichiers sous licence incompatible, les scraping non autorisés et les données anciennes présentées comme récentes ne doivent pas être utilisés. Les données actuelles 2026–2027 de Ligue 1 ne sont pas fournies par cette archive.
