function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function main() {
  const params   = new URLSearchParams(location.search);
  const leagueId = params.get('league');
  if (!leagueId) { location.href = 'index.html'; return; }

  // Chargement des données de la ligue et des équipes
  const [teamsRes, leagueRes] = await Promise.all([
    fetch(`/api/leagues/${leagueId}/teams`),
    fetch(`/api/leagues/${leagueId}`),
  ]);
  const teamsData  = await teamsRes.json();
  const leagueData = await leagueRes.json();

  const TEAMS       = teamsData.map(t => t.name).sort();
  const NB_JOURNEES = leagueData.nb_journees || 38;
  const HALF        = Math.floor(NB_JOURNEES / 2);
  let   colorMode   = false;
  const teamLevelMap = {};
  teamsData.forEach(t => { if (t.level) teamLevelMap[t.name] = t.level; });

  let currentSaison = leagueData.current_saison || '';
  let currentRefTeam = leagueData.ref_team || (TEAMS[0] || '');

  // Header
  document.querySelector('.header-sub').innerHTML =
    `<a href="index.html" class="league-back-link">← Ligues</a> <span class="header-sep">|</span> ${escHtml(leagueData.name)} — Saisie`;

  // Nav links avec le paramètre league
  document.querySelectorAll('a.nav-link[href]').forEach(a => {
    const url = new URL(a.href, location.href);
    if (!url.pathname.endsWith('index.html')) {
      url.searchParams.set('league', leagueId);
      a.href = url.pathname + url.search;
    }
  });

  async function saveLeague(fields) {
    await fetch(`/api/leagues/${leagueId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    });
  }

  const LEVEL_META = {
    fort:   { label: '● Fort',   cls: 'level-fort'   },
    moyen:  { label: '● Moyen',  cls: 'level-moyen'  },
    faible: { label: '● Faible', cls: 'level-faible' },
  };

  function getTeamLevel(name) { return teamLevelMap[name] || null; }

  function updateLevelBadge(teamSelectId, badgeId) {
    const team  = document.getElementById(teamSelectId).value;
    const badge = document.getElementById(badgeId);
    const lvl   = getTeamLevel(team);
    if (!lvl || !team) { badge.className = 'level-badge hidden'; return; }
    const meta = LEVEL_META[lvl];
    badge.textContent = meta.label;
    badge.className   = `level-badge ${meta.cls}`;
  }

  // ── SAISON ──
  function initSaison() {
    const input    = document.getElementById('saison');
    const btnEdit  = document.getElementById('btnEditSaison');
    const btnFinir = document.getElementById('btnFinirSaison');

    function lockSaison(val) {
      input.readOnly = true;
      btnEdit.classList.remove('hidden');
      btnFinir.classList.remove('hidden');
      updateSaisonLabel(val);
    }
    function unlockSaison() {
      input.readOnly = false;
      btnEdit.classList.add('hidden');
      btnFinir.classList.add('hidden');
      input.focus();
      input.select();
    }

    if (currentSaison) { input.value = currentSaison; lockSaison(currentSaison); }

    input.addEventListener('change', async () => {
      const val = input.value.trim();
      if (!val) return;
      currentSaison = val;
      await saveLeague({ current_saison: val });
      lockSaison(val);
    });

    btnEdit.addEventListener('click', unlockSaison);

    btnFinir.addEventListener('click', async () => {
      if (!confirm('Confirmer la fin de la saison ? Le formulaire sera réinitialisé.')) return;
      currentSaison = '';
      await saveLeague({ current_saison: null });
      input.value = '';
      unlockSaison();
      updateSaisonLabel('');
      journeeReady = false;
      cachedMatches = [];
      document.getElementById('journee').value    = '1';
      document.getElementById('score_home').value = '0';
      document.getElementById('score_away').value = '0';
      document.getElementById('firstLegInfo').classList.add('hidden');
      document.getElementById('levelHome').className = 'level-badge hidden';
      document.getElementById('levelAway').className = 'level-badge hidden';
      resetTeams();
      loadMatches();
    });
  }

  function resetTeams() {
    const ref = document.getElementById('team_ref').value;
    document.getElementById('team_home').value = ref;
    document.getElementById('team_away').value = ref;
  }

  function getExhaustedTeams(matches, refTeam) {
    if (!refTeam) return new Set();
    const counts = {};
    matches.forEach(m => {
      if (m.team_home === refTeam || m.team_away === refTeam) {
        const opponent = m.team_home === refTeam ? m.team_away : m.team_home;
        counts[opponent] = (counts[opponent] || 0) + 1;
      }
    });
    return new Set(Object.entries(counts).filter(([, c]) => c >= 2).map(([t]) => t));
  }

  function checkFirstLeg() {
    const home = document.getElementById('team_home').value;
    const away = document.getElementById('team_away').value;
    const info = document.getElementById('firstLegInfo');
    if (!home || !away || home === away) { info.classList.add('hidden'); return; }
    const firstLeg = cachedMatches.find(m =>
      (m.team_home === home && m.team_away === away) ||
      (m.team_home === away && m.team_away === home)
    );
    if (firstLeg) {
      info.innerHTML = `⚽ Match aller — <strong>${escHtml(firstLeg.team_home)} ${firstLeg.score_home} – ${firstLeg.score_away} ${escHtml(firstLeg.team_away)}</strong>`;
      info.classList.remove('hidden');
    } else {
      info.classList.add('hidden');
    }
  }

  function updateAvailableTeams(matches) {
    const ref       = document.getElementById('team_ref').value;
    const exhausted = getExhaustedTeams(matches, ref);
    ['team_home', 'team_away'].forEach(id => {
      const sel = document.getElementById(id);
      Array.from(sel.options).forEach(opt => {
        if (!opt.value || opt.value === ref) return;
        opt.disabled = exhausted.has(opt.value);
      });
      if (exhausted.has(sel.value)) sel.value = ref;
    });
  }

  function resetForm() {
    resetTeams();
    document.getElementById('score_home').value = '0';
    document.getElementById('score_away').value = '0';
    updateLevelBadge('team_home', 'levelHome');
    updateLevelBadge('team_away', 'levelAway');
    const sel  = document.getElementById('journee');
    const next = Math.min(Number(sel.value) + 1, NB_JOURNEES);
    sel.value  = String(next);
  }

  function fillSelects() {
    ['score_home', 'score_away'].forEach(id => {
      const sel = document.getElementById(id);
      for (let i = 0; i <= 6; i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = i;
        sel.appendChild(opt);
      }
      sel.value = '0';
    });

    const journeeSel = document.getElementById('journee');
    for (let j = 1; j <= NB_JOURNEES; j++) {
      const opt = document.createElement('option');
      opt.value = j; opt.textContent = `Journée ${j}`;
      journeeSel.appendChild(opt);
    }

    ['team_ref', 'team_home', 'team_away'].forEach(id => {
      const sel = document.getElementById(id);
      TEAMS.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; opt.textContent = name;
        sel.appendChild(opt);
      });
    });

    const refSel = document.getElementById('team_ref');
    refSel.value = (currentRefTeam && TEAMS.includes(currentRefTeam)) ? currentRefTeam : (TEAMS[0] || '');
    resetTeams();

    refSel.addEventListener('change', async () => {
      currentRefTeam = refSel.value;
      await saveLeague({ ref_team: refSel.value });
      resetTeams();
      renderGoalsGrid(cachedMatches);
      updateAvailableTeams(cachedMatches);
      checkFirstLeg();
      document.getElementById('teamHistoryCard').classList.add('hidden');
      currentHistoryTeam = null;
    });

    document.getElementById('team_home').addEventListener('change', () => {
      checkFirstLeg(); updateLevelBadge('team_home', 'levelHome'); updateHistoryForNonRefTeam();
    });
    document.getElementById('team_away').addEventListener('change', () => {
      checkFirstLeg(); updateLevelBadge('team_away', 'levelAway'); updateHistoryForNonRefTeam();
    });
  }

  let journeeReady  = false;
  let cachedMatches = [];

  function updateSaisonLabel(val) {
    const label = document.getElementById('saisonLabel');
    if (val) { label.textContent = val; label.classList.remove('hidden'); }
    else     { label.classList.add('hidden'); }
  }

  const form       = document.getElementById('matchForm');
  const formMsg    = document.getElementById('formMsg');
  const matchBody  = document.getElementById('matchBody');
  const matchCount = document.getElementById('matchCount');
  const emptyMsg   = document.getElementById('emptyMsg');

  function showMsg(text, type) {
    formMsg.textContent = text;
    formMsg.className   = `msg ${type}`;
    setTimeout(() => { formMsg.className = 'msg hidden'; }, 3500);
  }

  function resultLabel(m) {
    const ref = document.getElementById('team_ref').value;
    const sh = m.score_home, sa = m.score_away;
    if (sh === sa) return '<span class="result-badge draw">Nul</span>';
    if (ref && (m.team_home === ref || m.team_away === ref)) {
      const refWins = (m.team_home === ref && sh > sa) || (m.team_away === ref && sa > sh);
      return refWins ? '<span class="result-badge win">Gagné</span>' : '<span class="result-badge loss">Perdu</span>';
    }
    return sh > sa ? '<span class="result-badge win">Domicile</span>' : '<span class="result-badge loss">Extérieur</span>';
  }

  function renderRow(m) {
    return `
      <tr data-id="${m.id}">
        <td class="td-check"><input type="checkbox" class="match-check" data-id="${m.id}" /></td>
        <td class="td-journee">J${m.journee || '—'}</td>
        <td><strong>${escHtml(m.team_home)}</strong></td>
        <td class="score-display">${m.score_home} – ${m.score_away}</td>
        <td><strong>${escHtml(m.team_away)}</strong></td>
        <td>${resultLabel(m)}</td>
        <td class="td-buts">${Number(m.score_home) + Number(m.score_away)}</td>
        <td class="td-actions">
          <button class="btn-edit-row" data-match='${JSON.stringify(m)}'>✏️</button>
          <button class="btn-del" data-id="${m.id}">🗑</button>
        </td>
      </tr>`;
  }

  const btnDelSelected = document.getElementById('btnDelSelected');
  const checkAll       = document.getElementById('checkAll');

  function updateSelectionUI() {
    const checked = matchBody.querySelectorAll('.match-check:checked');
    const total   = matchBody.querySelectorAll('.match-check');
    if (checked.length > 0) {
      btnDelSelected.textContent = `🗑 Supprimer la sélection (${checked.length})`;
      btnDelSelected.classList.remove('hidden');
    } else {
      btnDelSelected.classList.add('hidden');
    }
    checkAll.checked       = total.length > 0 && checked.length === total.length;
    checkAll.indeterminate = checked.length > 0 && checked.length < total.length;
  }

  async function loadMatches() {
    const res  = await fetch(`/api/matches?league_id=${leagueId}`);
    const all  = await res.json();
    const data = currentSaison ? all.filter(m => m.saison === currentSaison) : [];
    matchCount.textContent = data.length;
    checkAll.checked = false;
    checkAll.indeterminate = false;
    btnDelSelected.classList.add('hidden');
    if (data.length === 0) {
      matchBody.innerHTML    = '';
      emptyMsg.style.display = 'block';
      setDefaultJournee(data);
      renderStats(data);
      renderGoalsGrid(data);
      updateAvailableTeams(data);
      return;
    }
    emptyMsg.style.display = 'none';
    matchBody.innerHTML = data.map(renderRow).join('');
    setDefaultJournee(data);
    cachedMatches = data;
    renderStats(data);
    renderGoalsGrid(data);
    updateAvailableTeams(data);
  }

  function renderStats(matches) {
    const container = document.getElementById('statsGoals');
    if (matches.length === 0) { container.innerHTML = '<p class="stats-empty">Aucune donnée disponible.</p>'; return; }
    const nextJournee = Number(document.getElementById('journee').value) || 1;
    const counts = {}, lastSeen = {};
    matches.forEach(m => {
      const total = Number(m.score_home) + Number(m.score_away);
      counts[total] = (counts[total] || 0) + 1;
      const j = Number(m.journee) || 0;
      if (!lastSeen[total] || j > lastSeen[total]) lastSeen[total] = j;
    });
    const rows = [];
    for (let i = 0; i <= 6; i++) {
      const count = counts[i] || 0;
      const pct   = Math.round((count / matches.length) * 100);
      const last  = lastSeen[i];
      rows.push({ goals: i, count, pct, interval: last != null ? nextJournee - last - 1 : null });
    }
    const sort = document.getElementById('statSort').value;
    if (sort === 'interval') rows.sort((a, b) => { if (a.interval === null) return 1; if (b.interval === null) return -1; return b.interval - a.interval; });
    else if (sort === 'goals') rows.sort((a, b) => b.count - a.count);
    container.innerHTML = rows.map(r => `
      <div class="stat-row">
        <span class="stat-label">${r.goals}</span>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${r.pct}%">${r.pct > 0 ? `<span class="stat-pct-in">${r.pct}%</span>` : ''}</div></div>
        <span class="stat-count">${r.count} match${r.count > 1 ? 's' : ''}</span>
        <span class="stat-interval">${r.interval !== null ? `(il y a ${r.interval} inter.)` : '—'}</span>
      </div>`).join('');
  }

  function renderGoalsGrid(matches) {
    const container = document.getElementById('goalsGrid');
    if (matches.length === 0) { container.innerHTML = '<p class="stats-empty">Aucune donnée disponible.</p>'; return; }
    const groups = {};
    for (let i = 0; i <= 6; i++) groups[i] = [];
    matches.forEach(m => { const t = Number(m.score_home) + Number(m.score_away); if (t <= 6 && m.journee) groups[t].push(Number(m.journee)); });
    for (let i = 0; i <= 6; i++) groups[i].sort((a, b) => a - b);
    const maxRows    = Math.max(...Object.values(groups).map(g => g.length));
    const teamName   = document.getElementById('team_ref').value || 'Équipe';
    const maxJournee = Math.max(...matches.map(m => Number(m.journee) || 0));
    let html = `<table class="goals-grid-table"><thead>
      <tr><th colspan="7" class="goals-grid-title">${escHtml(teamName)}</th></tr>
      <tr>${[0,1,2,3,4,5,6].map(i => `<th class="goals-grid-col">${i}</th>`).join('')}</tr>
      </thead><tbody>`;
    for (let r = 0; r < maxRows; r++) {
      html += '<tr>';
      for (let c = 0; c <= 6; c++) {
        const val      = groups[c][r];
        const dcls     = val == null ? '' : val <= 9 ? ' jd-1' : val <= 19 ? ' jd-2' : val <= 29 ? ' jd-3' : ' jd-4';
        const halfCls  = (colorMode && val != null) ? (val <= HALF ? ' cell-aller' : ' cell-retour') : '';
        html += `<td class="goals-grid-cell${dcls}${val === maxJournee ? ' goals-grid-last' : ''}${halfCls}">${val != null ? val : ''}</td>`;
      }
      html += '</tr>';
    }
    container.innerHTML = html + '</tbody></table>';
  }

  function setDefaultJournee(matches) {
    if (journeeReady) return;
    journeeReady = true;
    const sel = document.getElementById('journee');
    if (matches.length === 0) { sel.value = '1'; return; }
    const max = Math.max(...matches.map(m => m.journee || 0));
    sel.value = String(Math.min((max > 0 ? max : 0) + 1, NB_JOURNEES));
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const team_home = document.getElementById('team_home').value;
    const team_away = document.getElementById('team_away').value;
    if (team_home === team_away) { showMsg('Les deux équipes ne peuvent pas être identiques.', 'error'); return; }
    if (currentRefTeam && team_home !== currentRefTeam && team_away !== currentRefTeam) {
      showMsg(`L'équipe de référence "${currentRefTeam}" doit participer au match.`, 'error');
      return;
    }
    const body = {
      league_id: Number(leagueId), saison: currentSaison || null,
      journee: document.getElementById('journee').value, team_home,
      score_home: document.getElementById('score_home').value,
      score_away: document.getElementById('score_away').value, team_away,
    };
    try {
      const res  = await fetch('/api/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { showMsg(data.error, 'error'); return; }
      showMsg('Match enregistré avec succès !', 'success');
      resetForm();
      document.getElementById('firstLegInfo').classList.add('hidden');
      loadMatches();
    } catch { showMsg('Erreur de connexion au serveur.', 'error'); }
  });

  matchBody.addEventListener('click', async e => {
    const btnDel = e.target.closest('.btn-del');
    if (btnDel) {
      if (!confirm('Supprimer ce match ?')) return;
      await fetch(`/api/matches/${btnDel.dataset.id}`, { method: 'DELETE' });
      loadMatches(); return;
    }
    const btnEdit = e.target.closest('.btn-edit-row');
    if (btnEdit) openEditModal(JSON.parse(btnEdit.dataset.match));
  });

  matchBody.addEventListener('change', e => {
    if (e.target.classList.contains('match-check')) updateSelectionUI();
  });

  checkAll.addEventListener('change', () => {
    matchBody.querySelectorAll('.match-check').forEach(cb => cb.checked = checkAll.checked);
    updateSelectionUI();
  });

  btnDelSelected.addEventListener('click', async () => {
    const checked = [...matchBody.querySelectorAll('.match-check:checked')];
    if (checked.length === 0) return;
    if (!confirm(`Supprimer ${checked.length} match${checked.length > 1 ? 's' : ''} ?`)) return;
    const ids = checked.map(cb => Number(cb.dataset.id));
    await fetch('/api/matches', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ids }),
    });
    loadMatches();
  });

  // ── MODALE ÉDITION ──
  function fillModalSelects() {
    ['editScoreHome', 'editScoreAway'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel.options.length > 1) return;
      for (let i = 0; i <= 6; i++) { const o = document.createElement('option'); o.value = i; o.textContent = i; sel.appendChild(o); }
    });
    ['editTeamHome', 'editTeamAway'].forEach(id => {
      const sel = document.getElementById(id);
      if (sel.options.length > 1) return;
      TEAMS.forEach(name => { const o = document.createElement('option'); o.value = name; o.textContent = name; sel.appendChild(o); });
    });
    const jSel = document.getElementById('editJournee');
    if (jSel.options.length <= 1) {
      for (let j = 1; j <= NB_JOURNEES; j++) { const o = document.createElement('option'); o.value = j; o.textContent = `Journée ${j}`; jSel.appendChild(o); }
    }
  }

  function openEditModal(m) {
    fillModalSelects();
    document.getElementById('editId').value        = m.id;
    document.getElementById('editJournee').value   = m.journee || '';
    document.getElementById('editTeamHome').value  = m.team_home;
    document.getElementById('editScoreHome').value = m.score_home;
    document.getElementById('editScoreAway').value = m.score_away;
    document.getElementById('editTeamAway').value  = m.team_away;
    document.getElementById('editMsg').className   = 'msg hidden';
    document.getElementById('editModal').classList.remove('hidden');
  }
  function closeEditModal() { document.getElementById('editModal').classList.add('hidden'); }
  document.getElementById('modalClose').addEventListener('click', closeEditModal);
  document.getElementById('editModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeEditModal(); });

  document.getElementById('editForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id        = document.getElementById('editId').value;
    const team_home = document.getElementById('editTeamHome').value;
    const team_away = document.getElementById('editTeamAway').value;
    const editMsg   = document.getElementById('editMsg');

    if (currentRefTeam && team_home !== currentRefTeam && team_away !== currentRefTeam) {
      editMsg.textContent = `L'équipe de référence "${currentRefTeam}" doit participer au match.`;
      editMsg.className   = 'msg error';
      return;
    }

    const body = {
      journee:    document.getElementById('editJournee').value,
      team_home,
      score_home: document.getElementById('editScoreHome').value,
      score_away: document.getElementById('editScoreAway').value,
      team_away,
    };
    const res  = await fetch(`/api/matches/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) { editMsg.textContent = data.error; editMsg.className = 'msg error'; return; }
    closeEditModal(); loadMatches();
  });

  document.getElementById('btnDelJournee').addEventListener('click', async () => {
    if (!currentSaison) { alert('Aucune saison en cours définie.'); return; }
    if (!confirm(`Supprimer TOUS les matchs de la saison "${currentSaison}" ?`)) return;
    const res  = await fetch(`/api/matches/saison/${encodeURIComponent(currentSaison)}?league_id=${leagueId}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) loadMatches(); else alert(data.error);
  });

  // ── MODALES BUTS / RÉSUMÉ ──
  function levelTag(name, compact = false) {
    const lvl = getTeamLevel(name);
    if (!lvl) return '';
    const map = { fort: ['level-fort', compact ? 'Ft' : 'Fort'], moyen: ['level-moyen', compact ? 'Mo' : 'Moy.'], faible: ['level-faible', compact ? 'Fb' : 'Faible'] };
    const [cls, label] = map[lvl];
    return `<span class="level-badge ${cls}" style="font-size:.6rem;padding:.05rem .3rem">${label}</span>`;
  }

  document.getElementById('btnButsEquipes').addEventListener('click', () => {
    const ref = document.getElementById('team_ref').value;
    if (!ref) { alert('Sélectionnez une équipe de référence.'); return; }
    const groups = {};
    for (let i = 0; i <= 6; i++) groups[i] = [];
    cachedMatches.forEach(m => {
      if (m.team_home !== ref && m.team_away !== ref) return;
      const total = Number(m.score_home) + Number(m.score_away);
      const opponent = m.team_home === ref ? m.team_away : m.team_home;
      if (total <= 6) groups[total].push({ opponent, leg: m.team_home === ref ? 'Dom.' : 'Ext.', journee: m.journee });
    });
    const cols = [0,1,2,3,4,5,6].map(i => `
      <div class="buts-col">
        <div class="buts-col-header">${i} but${i>1?'s':''} <span class="buts-count">${groups[i].length}</span></div>
        ${groups[i].length === 0 ? '<p class="resume-empty">—</p>' : groups[i].map(e => `
          <div class="buts-row"><span class="buts-team">${escHtml(e.opponent)} ${levelTag(e.opponent, true)}</span>
          <span class="buts-leg">${e.leg}</span><span class="resume-j">J${e.journee||'?'}</span></div>`).join('')}
      </div>`).join('');
    document.getElementById('butsTitle').textContent = `Buts par équipe — ${ref}`;
    document.getElementById('butsBody').innerHTML = `<div class="buts-cols">${cols}</div>`;
    document.getElementById('butsModal').classList.remove('hidden');
  });
  document.getElementById('butsClose').addEventListener('click', () => document.getElementById('butsModal').classList.add('hidden'));
  document.getElementById('butsModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });

  document.getElementById('btnResume').addEventListener('click', () => {
    const ref = document.getElementById('team_ref').value;
    if (!ref) { alert('Sélectionnez une équipe de référence.'); return; }
    const gagnes = [], nuls = [], perdus = [];
    cachedMatches.forEach(m => {
      if (m.team_home !== ref && m.team_away !== ref) return;
      const opponent = m.team_home === ref ? m.team_away : m.team_home;
      const sh = Number(m.score_home), sa = Number(m.score_away);
      const entry = { opponent, score: `${sh}–${sa}`, leg: m.team_home === ref ? 'Domicile' : 'Extérieur', journee: m.journee };
      if (sh === sa) nuls.push(entry);
      else if ((m.team_home === ref && sh > sa) || (m.team_away === ref && sa > sh)) gagnes.push(entry);
      else perdus.push(entry);
    });
    const renderGroup = list => list.length === 0 ? '<p class="resume-empty">Aucun</p>'
      : list.map(e => `<div class="resume-row"><span class="resume-team">${escHtml(e.opponent)} ${levelTag(e.opponent)}</span>
        <span class="resume-score">${e.score}</span><span class="resume-leg">${e.leg}</span><span class="resume-j">J${e.journee||'?'}</span></div>`).join('');
    document.getElementById('resumeTitle').textContent = `Résumé — ${ref}`;
    document.getElementById('resumeBody').innerHTML = `
      <div class="resume-cols">
        <div class="resume-section resume-win"><div class="resume-section-title">✔ Victoires (${gagnes.length})</div>${renderGroup(gagnes)}</div>
        <div class="resume-section resume-draw"><div class="resume-section-title">— Nuls (${nuls.length})</div>${renderGroup(nuls)}</div>
        <div class="resume-section resume-loss"><div class="resume-section-title">✘ Défaites (${perdus.length})</div>${renderGroup(perdus)}</div>
      </div>`;
    document.getElementById('resumeModal').classList.remove('hidden');
  });
  document.getElementById('resumeClose').addEventListener('click', () => document.getElementById('resumeModal').classList.add('hidden'));
  document.getElementById('resumeModal').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });

  // ── HISTORIQUE BUTS ÉQUIPE NON-RÉFÉRENTE ──
  let currentHistoryTeam = null;

  async function loadTeamHistory(teamName) {
    const card = document.getElementById('teamHistoryCard');
    if (!teamName) { card.classList.add('hidden'); currentHistoryTeam = null; return; }
    currentHistoryTeam = teamName;
    document.getElementById('teamHistoryName').textContent = teamName;
    card.classList.remove('hidden');
    const container = document.getElementById('teamHistoryGoals');
    container.innerHTML = '<p class="stats-empty">Chargement…</p>';
    try {
      const res  = await fetch(`/api/teams/${encodeURIComponent(teamName)}/goals-history?league_id=${leagueId}`);
      const data = await res.json();
      if (data.length === 0) { container.innerHTML = '<p class="stats-empty">Aucun historique.</p>'; return; }
      const bySaison = {};
      data.forEach(r => {
        const key = r.saison || 'N/A';
        if (!bySaison[key]) bySaison[key] = { buts: [], date: r.saison_created_at };
        bySaison[key].buts.push(r.total_buts);
      });
      const entries = Object.entries(bySaison).reverse();
      container.innerHTML = entries.map(([saison, { buts, date }], idx) => {
        const isCurrent = saison === currentSaison;
        const dateStr   = date ? new Date(date).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
        let sep = '';
        if (idx > 0) {
          const prev = entries[idx-1][1].date, curr = date;
          if ((prev ? new Date(prev).toDateString() : null) !== (curr ? new Date(curr).toDateString() : null)) sep = '<hr class="th-separator">';
        }
        return `${sep}<div class="th-row${isCurrent?' th-row-current':''}">
          <span class="th-saison">${escHtml(saison)} <em class="th-date">(${dateStr})</em>${isCurrent?' <span class="th-current-tag">en cours</span>':''}</span>
          <div class="th-buts-list">${buts.map(b=>`<span class="th-but-badge">${b}</span>`).join('')}</div>
        </div>`;
      }).join('');
    } catch { container.innerHTML = '<p class="stats-empty">Erreur de chargement.</p>'; }
  }

  function updateHistoryForNonRefTeam() {
    const ref  = document.getElementById('team_ref').value;
    const home = document.getElementById('team_home').value;
    const away = document.getElementById('team_away').value;
    const nonRef = (home && home !== ref) ? home : (away && away !== ref) ? away : null;
    if (nonRef) { if (nonRef !== currentHistoryTeam) loadTeamHistory(nonRef); }
    else { document.getElementById('teamHistoryCard').classList.add('hidden'); currentHistoryTeam = null; }
  }

  // ── INIT ──
  const btnColorHalf = document.getElementById('btnColorHalf');
  btnColorHalf.title = `Aller : J1–J${HALF} · Retour : J${HALF+1}–J${NB_JOURNEES}`;
  btnColorHalf.addEventListener('click', () => {
    colorMode = !colorMode;
    btnColorHalf.classList.toggle('btn-color-half-active', colorMode);
    btnColorHalf.textContent = colorMode ? '🟢 Aller / Retour' : '⬛ Aller / Retour';
    renderGoalsGrid(cachedMatches);
  });

  initSaison();
  fillSelects();
  loadMatches();
  document.getElementById('statSort').addEventListener('change', () => renderStats(cachedMatches));
}

main();
