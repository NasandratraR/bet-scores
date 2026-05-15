const router = require('express').Router();
const { pool } = require('../../config/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT l.id, l.name, l.ref_team, l.nb_journees, l.created_at,
        COUNT(DISTINCT t.id) AS team_count,
        COUNT(DISTINCT m.id) AS match_count
      FROM leagues l
      LEFT JOIN teams   t ON t.league_id = l.id
      LEFT JOIN matches m ON m.league_id = l.id
      GROUP BY l.id
      ORDER BY l.created_at ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT id, name, ref_team, current_saison, nb_journees FROM leagues WHERE id = ?',
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Ligue introuvable.' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, nb_journees } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Nom de ligue requis.' });
  const nbJ = Number(nb_journees) || 38;
  try {
    const [result] = await pool.query(
      'INSERT INTO leagues (name, nb_journees) VALUES (?, ?)',
      [name.trim(), nbJ]
    );
    res.status(201).json({ id: result.insertId, name: name.trim(), nb_journees: nbJ });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Une ligue avec ce nom existe déjà.' });
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, ref_team, nb_journees, current_saison } = req.body;
  if (name !== undefined && !name?.trim()) return res.status(400).json({ error: 'Nom requis.' });
  try {
    const fields = [], values = [];
    if (name            !== undefined) { fields.push('name = ?');           values.push(name.trim()); }
    if (ref_team        !== undefined) { fields.push('ref_team = ?');       values.push(ref_team || null); }
    if (nb_journees     !== undefined) { fields.push('nb_journees = ?');    values.push(Number(nb_journees)); }
    if (current_saison  !== undefined) { fields.push('current_saison = ?'); values.push(current_saison || null); }
    if (fields.length) {
      values.push(req.params.id);
      await pool.query(`UPDATE leagues SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    res.json({ message: 'Ligue modifiée.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ce nom est déjà utilisé.' });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM leagues WHERE id = ?', [req.params.id]);
    res.json({ message: 'Ligue supprimée.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── SETTINGS ──

router.get('/:id/settings', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT setting_key, value FROM settings WHERE league_id = ?',
      [req.params.id]
    );
    const result = {};
    rows.forEach(r => { result[r.setting_key] = JSON.parse(r.value ?? 'null'); });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/settings/:key', async (req, res) => {
  try {
    const json = JSON.stringify(req.body.value ?? null);
    await pool.query(
      `INSERT INTO settings (league_id, setting_key, value) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`,
      [req.params.id, req.params.key, json]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
