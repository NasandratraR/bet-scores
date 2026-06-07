# BET-SCORES

Outil de saisie et d'analyse de scores de paris sportifs, avec support multi-ligues. Chaque ligue dispose de ses propres équipes et saisons.

## Prérequis

- Node.js
- MySQL

## Installation

1. Installer les dépendances :
   ```bash
   npm install
   ```

2. Copier `.env.example` en `.env` et renseigner les identifiants MySQL :
   ```bash
   cp .env.example .env
   ```

3. Initialiser la base de données.

   Pour une **installation fraîche** :
   ```bash
   mysql -u root -p < sql/schema.sql
   ```

   Pour une **installation existante** (avant la version multi-ligues) :
   ```bash
   mysql -u root -p bet_scores < sql/migrate_v4.sql
   ```

## Démarrage

```bash
# Production
npm start
# ou
make start

# Développement (rechargement auto)
npm run dev
```

## Architecture

**Flux de navigation** : `index.html` (sélection ligue) → `saisie.html` (saisie + stats) / autres pages. Chaque page JS vérifie `localStorage.current_league_id` et redirige vers `index.html` si absent.

### Backend

`server.js` — serveur Express unique, sans routeur externe. MySQL via `mysql2/promise` (pool).

Routes REST :
- `GET/POST /api/leagues` · `PUT/DELETE /api/leagues/:id` — CRUD ligues
- `GET /api/leagues/:id/teams` · `POST /api/leagues/:id/teams` — équipes par ligue
- `PUT/DELETE /api/teams/:id` — modification/suppression équipe
- `GET/POST /api/matches?league_id=X` · `PUT/DELETE /api/matches/:id` — matchs filtrés par ligue
- `GET /api/saisons?league_id=X` · `GET /api/saisons/:saison/matches?league_id=X` — saisons filtrées
- `DELETE /api/matches/saison/:saison?league_id=X` · `GET /api/teams/:team/goals-history?league_id=X`

### Base de données

3 tables :
- `leagues` (id, name)
- `teams` (id, league_id, name, level)
- `matches` (id, league_id, saison, journee, team_home, score_home, score_away, team_away, created_at)

### Frontend

Fichiers statiques servis depuis `public/`. Chaque page est autonome :

| Page | HTML | JS | Rôle |
|---|---|---|---|
| Sélection ligue | `index.html` | `leagues.js` | Créer/gérer ligues et équipes |
| Saisie | `saisie.html` | `app.js` | Formulaire de saisie, stats buts, grille |
| Historique | `historique.html` | `historique.js` | Tableau multi-saisons |
| Répartition | `repartition.html` | `repartition.js` | Grille buts par saison |
| Vue tableau | `vue-tableau.html` | `vue-tableau.js` | Vue croisée journées × buts |
| Buts équipes | `buts-equipes.html` | `buts-equipes.js` | Stats buts par équipe adverse |

**État frontend** — clés `localStorage` toutes préfixées par `league_id` :
- `current_league_id` / `current_league_name` — ligue sélectionnée
- `saison_courante_${leagueId}` — saison active
- `team_ref_${leagueId}` — équipe de référence
- `vt_goals_${leagueId}`, `vt_seasons_${leagueId}`, `vt_teams_${leagueId}` — filtres vue-tableau

Les équipes sont chargées dynamiquement depuis `GET /api/leagues/:id/teams` dans chaque page JS.

## Lien externe

`server.js` sert `/bet` depuis `/home/nasandratra/Documents/BET` (chemin absolu en dur).
