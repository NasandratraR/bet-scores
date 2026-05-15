const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'bet_scores',
});

const MATCH_SELECT = `
  SELECT m.id, m.league_id, m.saison, m.journee,
    m.team_home_id, COALESCE(th.name, '?') AS team_home,
    m.score_home, m.score_away,
    m.team_away_id, COALESCE(ta.name, '?') AS team_away,
    m.created_at
  FROM matches m
  LEFT JOIN teams th ON th.id = m.team_home_id
  LEFT JOIN teams ta ON ta.id = m.team_away_id`;

async function getTeamId(name, leagueId) {
  const [[row]] = await pool.query(
    'SELECT id FROM teams WHERE name = ? AND league_id = ?',
    [name.trim(), leagueId]
  );
  return row ? row.id : null;
}

async function initDb() {
  await pool.query('SELECT 1');
  console.log('Connecté à MySQL');
}

module.exports = { pool, MATCH_SELECT, getTeamId, initDb };
