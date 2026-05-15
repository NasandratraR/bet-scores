const router = require('express').Router();
const { pool, MATCH_SELECT, getTeamId } = require('../../config/db');

// ── SAISONS ──

router.get('/saisons', async (req, res) => {
  const leagueId = req.query.league_id;
  try {
    let sql = `
      SELECT saison,
        COUNT(*)                                                   AS total,
        SUM(score_home + score_away)                               AS total_buts,
        SUM(CASE WHEN score_home > score_away THEN 1 ELSE 0 END)  AS domicile,
        SUM(CASE WHEN score_home < score_away THEN 1 ELSE 0 END)  AS exterieur,
        SUM(CASE WHEN score_home = score_away THEN 1 ELSE 0 END)  AS nul,
        MIN(journee) AS j_min,
        MAX(journee) AS j_max
      FROM matches`;
    const params = [];
    if (leagueId) { sql += ' WHERE league_id = ?'; params.push(leagueId); }
    sql += ' GROUP BY saison ORDER BY MIN(created_at) DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/saisons/:saison', async (req, res) => {
  const { new_saison } = req.body;
  const leagueId = req.query.league_id;
  if (!new_saison?.trim()) return res.status(400).json({ error: 'Nouveau nom requis.' });
  try {
    let sql = 'UPDATE matches SET saison = ? WHERE saison = ?';
    const params = [new_saison.trim(), req.params.saison];
    if (leagueId) { sql += ' AND league_id = ?'; params.push(leagueId); }
    const [result] = await pool.query(sql, params);
    res.json({ updated: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/saisons/:saison/matches', async (req, res) => {
  const leagueId = req.query.league_id;
  try {
    let sql = `${MATCH_SELECT} WHERE m.saison = ?`;
    const params = [req.params.saison];
    if (leagueId) { sql += ' AND m.league_id = ?'; params.push(leagueId); }
    sql += ' ORDER BY m.journee ASC, m.created_at ASC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MATCHES ──

router.get('/matches', async (req, res) => {
  const leagueId = req.query.league_id;
  try {
    let sql = MATCH_SELECT;
    const params = [];
    if (leagueId) { sql += ' WHERE m.league_id = ?'; params.push(leagueId); }
    sql += ' ORDER BY m.journee DESC, m.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/matches', async (req, res) => {
  const { league_id, saison, journee, team_home, score_home, score_away, team_away } = req.body;

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
    const homeId = await getTeamId(team_home, league_id);
    const awayId = await getTeamId(team_away, league_id);
    if (!homeId) return res.status(400).json({ error: `Équipe "${team_home}" introuvable dans cette ligue.` });
    if (!awayId) return res.status(400).json({ error: `Équipe "${team_away}" introuvable dans cette ligue.` });

    if (journee) {
      const [existing] = await pool.query(
        `SELECT id, team_home_id, team_away_id FROM matches
         WHERE league_id <=> ? AND saison <=> ? AND journee = ?
         AND (team_home_id = ? OR team_away_id = ? OR team_home_id = ? OR team_away_id = ?)`,
        [league_id || null, saison || null, Number(journee),
         homeId, homeId, awayId, awayId]
      );
      if (existing.length > 0) {
        const m = existing[0];
        const conflictName = (m.team_home_id === homeId || m.team_away_id === homeId)
          ? team_home.trim() : team_away.trim();
        return res.status(409).json({
          error: `"${conflictName}" joue déjà lors de la journée ${journee}${saison ? ` (saison ${saison})` : ''}.`
        });
      }
    }

    const [result] = await pool.query(
      'INSERT INTO matches (league_id, saison, journee, team_home_id, score_home, score_away, team_away_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [league_id || null, saison || null, journee ? Number(journee) : null,
       homeId, Number(score_home), Number(score_away), awayId]
    );
    res.status(201).json({ id: result.insertId, message: 'Match enregistré.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/matches/:id', async (req, res) => {
  const { journee, team_home, score_home, score_away, team_away } = req.body;
  if (!team_home || !team_away || score_home == null || score_away == null) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }
  try {
    const [[match]] = await pool.query('SELECT league_id FROM matches WHERE id = ?', [req.params.id]);
    if (!match) return res.status(404).json({ error: 'Match introuvable.' });

    const homeId = await getTeamId(team_home, match.league_id);
    const awayId = await getTeamId(team_away, match.league_id);
    if (!homeId) return res.status(400).json({ error: `Équipe "${team_home}" introuvable.` });
    if (!awayId) return res.status(400).json({ error: `Équipe "${team_away}" introuvable.` });

    await pool.query(
      'UPDATE matches SET journee=?, team_home_id=?, score_home=?, score_away=?, team_away_id=? WHERE id=?',
      [journee ? Number(journee) : null, homeId, Number(score_home), Number(score_away), awayId, req.params.id]
    );
    res.json({ message: 'Match modifié.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Suppression multiple — doit être avant /matches/:id
router.delete('/matches', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'IDs requis.' });
  }
  try {
    const placeholders = ids.map(() => '?').join(', ');
    const [result] = await pool.query(
      `DELETE FROM matches WHERE id IN (${placeholders})`,
      ids
    );
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE par saison doit être avant DELETE par :id (sinon "saison" est capturé comme :id)
router.delete('/matches/saison/:saison', async (req, res) => {
  const leagueId = req.query.league_id;
  try {
    let sql = 'DELETE FROM matches WHERE saison = ?';
    const params = [req.params.saison];
    if (leagueId) { sql += ' AND league_id = ?'; params.push(leagueId); }
    const [result] = await pool.query(sql, params);
    res.json({ deleted: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/matches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM matches WHERE id = ?', [req.params.id]);
    res.json({ message: 'Match supprimé.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
