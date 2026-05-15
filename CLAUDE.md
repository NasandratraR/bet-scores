# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Migration base de données

Pour une **installation existante** (avant la version multi-ligues) :
```bash
mysql -u root -p bet_scores < sql/migrate_v4.sql
```

Pour une **installation fraîche** :
```bash
mysql -u root -p < sql/schema.sql
```

## Commands

```bash
# Démarrer le serveur (production)
npm start
# ou
make start

# Démarrer en mode développement (rechargement auto)
npm run dev
```

Prérequis : copier `.env.example` en `.env` et renseigner les identifiants MySQL, puis initialiser la base via :
```bash
mysql -u root -p < sql/schema.sql
```

## Architecture multi-ligues

Outil de saisie de scores de paris sportifs, support multi-ligues. Chaque ligue a ses propres équipes et saisons.

**Flux de navigation** : `index.html` (sélection ligue) → `saisie.html` (saisie + stats) / autres pages. Chaque page JS vérifie `localStorage.current_league_id` et redirige vers `index.html` si absent.

**Backend** — `server.js` : serveur Express unique, sans routeur externe. MySQL via `mysql2/promise` (pool). Routes REST :
- `GET/POST /api/leagues` · `PUT/DELETE /api/leagues/:id` — CRUD ligues
- `GET /api/leagues/:id/teams` · `POST /api/leagues/:id/teams` — équipes par ligue
- `PUT/DELETE /api/teams/:id` — modification/suppression équipe
- `GET/POST /api/matches?league_id=X` · `PUT/DELETE /api/matches/:id` — matchs filtrés par ligue
- `GET /api/saisons?league_id=X` · `GET /api/saisons/:saison/matches?league_id=X` — saisons filtrées
- `DELETE /api/matches/saison/:saison?league_id=X` · `GET /api/teams/:team/goals-history?league_id=X`

**Base de données** — 3 tables : `leagues` (id, name), `teams` (id, league_id, name, level), `matches` (id, league_id, saison, journee, team_home, score_home, score_away, team_away, created_at).

**Frontend** — fichiers statiques depuis `public/`. Chaque page est autonome :

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

**Équipes** — chargées dynamiquement depuis `GET /api/leagues/:id/teams` dans chaque page JS. Plus de tableaux codés en dur.

**Lien externe** — `server.js` sert `/bet` depuis `/home/nasandratra/Documents/BET` (chemin absolu en dur).
