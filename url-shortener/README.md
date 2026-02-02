# Massive Medias URL Shortener

Un raccourcisseur d'URL avec statistiques, propulsé par Cloudflare Workers.

## Fonctionnalités

- ✂️ Raccourcir des URLs longues
- 📊 Statistiques de clics (compteur, pays, user-agent, referer)
- 🔗 Codes personnalisés ou auto-générés
- ⚡ Ultra rapide (Cloudflare Edge)
- 🆓 Gratuit (100,000 requêtes/jour)

## API

### Créer un lien court
```bash
POST /api/shorten
Headers: X-API-Key: massive-secret-key-2024
Body: { "longUrl": "https://example.com/long-url", "customCode": "promo" }
```

### Obtenir les stats
```bash
GET /api/stats/:code
```

### Lister tous les liens
```bash
GET /api/links
Headers: X-API-Key: massive-secret-key-2024
```

### Supprimer un lien
```bash
DELETE /api/links/:code
Headers: X-API-Key: massive-secret-key-2024
```

## Installation

Voir les instructions dans Cloudflare Dashboard.
