require('dotenv').config();

const express = require('express');
const mysql   = require('mysql2/promise');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/bet', express.static('/home/nasandratra/Documents/BET'));

const dbConfig = {
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'bet_scores',
};

let pool;

async function initDb() {
  pool = mysql.createPool(dbConfig);
  await pool.query('SELECT 1');
  console.log('Connecté à MySQL');
}

// GET /api/saisons — liste les saisons avec stats
app.get('/api/saisons', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        saison,
        COUNT(*)                                          AS total,
        SUM(score_home + score_away)                      AS total_buts,
        SUM(CASE WHEN score_home > score_away THEN 1 ELSE 0 END) AS domicile,
        SUM(CASE WHEN score_home < score_away THEN 1 ELSE 0 END) AS exterieur,
        SUM(CASE WHEN score_home = score_away THEN 1 ELSE 0 END) AS nul,
        MIN(journee) AS j_min,
        MAX(journee) AS j_max
      FROM matches
      GROUP BY saison
      ORDER BY MIN(created_at) DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/saisons/:saison/matches — tous les matchs d'une saison
app.get('/api/saisons/:saison/matches', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM matches WHERE saison = ? ORDER BY journee ASC, created_at ASC',
      [req.params.saison]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET  /api/matches  — liste tous les matchs
app.get('/api/matches', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM matches ORDER BY journee DESC, created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/matches  — insère un match
app.post('/api/matches', async (req, res) => {
  const { saison, journee, team_home, score_home, score_away, team_away } = req.body;

  if (!team_home || !team_away || score_home == null || score_away == null) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }
  if (team_home.trim() === team_away.trim()) {
    return res.status(400).json({ error: 'Les deux équipes ne peuvent pas être identiques.' });
  }
  if (!Number.isInteger(Number(score_home)) || !Number.isInteger(Number(score_away))) {
    return res.status(400).json({ error: 'Les scores doivent être des entiers.' });
  }

  try {
    // Vérifier qu'une des deux équipes ne joue pas déjà cette journée/saison
    if (journee) {
      const [existing] = await pool.query(
        `SELECT id, team_home, team_away FROM matches
         WHERE saison <=> ? AND journee = ?
         AND (team_home = ? OR team_away = ? OR team_home = ? OR team_away = ?)`,
        [saison || null, Number(journee), team_home.trim(), team_home.trim(), team_away.trim(), team_away.trim()]
      );
      if (existing.length > 0) {
        const match = existing[0];
        const teamInConflict = [match.team_home, match.team_away]
          .find(t => t === team_home.trim() || t === team_away.trim());
        return res.status(409).json({
          error: `"${teamInConflict}" joue déjà lors de la journée ${journee}${saison ? ` (saison ${saison})` : ''}.`
        });
      }
    }

    const [result] = await pool.query(
      'INSERT INTO matches (saison, journee, team_home, score_home, score_away, team_away) VALUES (?, ?, ?, ?, ?, ?)',
      [saison || null, journee ? Number(journee) : null, team_home.trim(), Number(score_home), Number(score_away), team_away.trim()]
    );
    res.status(201).json({ id: result.insertId, message: 'Match enregistré.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/matches/:id  — modifie un match
app.put('/api/matches/:id', async (req, res) => {
  const { journee, team_home, score_home, score_away, team_away } = req.body;
  if (!team_home || !team_away || score_home == null || score_away == null) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }
  try {
    await pool.query(
      'UPDATE matches SET journee=?, team_home=?, score_home=?, score_away=?, team_away=? WHERE id=?',
      [journee ? Number(journee) : null, team_home.trim(), Number(score_home), Number(score_away), team_away.trim(), req.params.id]
    );
    res.json({ message: 'Match modifié.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/teams/:team/goals-history — buts par match (individuel) par saison
app.get('/api/teams/:team/goals-history', async (req, res) => {
  try {
    const team = req.params.team;
    const [rows] = await pool.query(`
      SELECT saison, journee,
        score_home + score_away AS total_buts,
        MIN(created_at) OVER (PARTITION BY saison) AS saison_created_at
      FROM matches
      WHERE team_home = ? OR team_away = ?
      ORDER BY saison_created_at ASC, journee ASC
    `, [team, team]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/matches/saison/:saison  — supprime tous les matchs d'une saison
app.delete('/api/matches/saison/:saison', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM matches WHERE saison = ?', [req.params.saison]);
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/matches/:id  — supprime un match
app.delete('/api/matches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM matches WHERE id = ?', [req.params.id]);
    res.json({ message: 'Match supprimé.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initDb()
  .then(() => app.listen(PORT, () => console.log(`Serveur : http://localhost:${PORT}`)))
  .catch(err => { console.error('Erreur BDD :', err.message); process.exit(1); });
