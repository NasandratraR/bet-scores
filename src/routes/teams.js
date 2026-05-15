const router = require('express').Router();
const { pool } = require('../../config/db');

// Équipes d'une ligue
router.get('/leagues/:id/teams', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, level FROM teams WHERE league_id = ? ORDER BY name ASC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/leagues/:id/teams', async (req, res) => {
  const { name, level } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Nom d'équipe requis." });
  if (level && !['fort', 'moyen', 'faible'].includes(level)) {
    return res.status(400).json({ error: 'Niveau invalide.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO teams (league_id, name, level) VALUES (?, ?, ?)',
      [req.params.id, name.trim(), level || null]
    );
    res.status(201).json({ id: result.insertId, name: name.trim(), level: level || null });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Cette équipe existe déjà dans cette ligue.' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/teams/:id', async (req, res) => {
  const { name, level } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom requis.' });
  try {
    await pool.query(
      'UPDATE teams SET name = ?, level = ? WHERE id = ?',
      [name.trim(), level || null, req.params.id]
    );
    res.json({ message: 'Équipe modifiée.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/teams/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM teams WHERE id = ?', [req.params.id]);
    res.json({ message: 'Équipe supprimée.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historique buts d'une équipe
router.get('/teams/:team/goals-history', async (req, res) => {
  const leagueId = req.query.league_id;
  try {
    let sql = `
      SELECT m.saison, m.journee,
        m.score_home + m.score_away AS total_buts,
        MIN(m.created_at) OVER (PARTITION BY m.saison) AS saison_created_at
      FROM matches m
      LEFT JOIN teams th ON th.id = m.team_home_id
      LEFT JOIN teams ta ON ta.id = m.team_away_id
      WHERE (th.name = ? OR ta.name = ?)`;
    const params = [req.params.team, req.params.team];
    if (leagueId) { sql += ' AND m.league_id = ?'; params.push(leagueId); }
    sql += ' ORDER BY saison_created_at ASC, m.journee ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
