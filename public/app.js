const API = '/api/matches';

// ── SAISON ──
function initSaison() {
  const input    = document.getElementById('saison');
  const btnEdit  = document.getElementById('btnEditSaison');
  const btnFinir = document.getElementById('btnFinirSaison');
  const saved    = localStorage.getItem('saison_courante');

  function lockSaison(val) {
    localStorage.setItem('saison_courante', val);
    input.readOnly = true;
    btnEdit.classList.remove('hidden');
    btnFinir.classList.remove('hidden');
  }

  function unlockSaison() {
    input.readOnly = false;
    btnEdit.classList.add('hidden');
    btnFinir.classList.add('hidden');
    input.focus();
    input.select();
  }

  if (saved) {
    input.value = saved;
    lockSaison(saved);
    updateSaisonLabel(saved);
  }

  input.addEventListener('change', () => {
    const val = input.value.trim();
    if (!val) return;
    lockSaison(val);
    updateSaisonLabel(val);
  });

  btnEdit.addEventListener('click', unlockSaison);

  btnFinir.addEventListener('click', () => {
    if (!confirm('Confirmer la fin de la saison ? Le nom sera effacé.')) return;
    localStorage.removeItem('saison_courante');
    input.value = '';
    unlockSaison();
    updateSaisonLabel('');
  });
}

const TEAMS = [
  'A. Villa',
  'Bournemouth',
  'Brentford',
  'Brighton',
  'Burnley',
  'C Palace',
  'Everton',
  'Fulham',
  'Leeds',
  'Liverpool',
  'London Blues',
  'London Reds',
  'Manchester Blue',
  'Manchester Red',
  'N Forest',
  'Newcastle',
  'Spurs',
  'Sunderlands',
  'West Ham',
  'Wolverhampton',
];

function fillSelects() {
  // Scores 0-6
  ['score_home', 'score_away'].forEach(id => {
    const sel = document.getElementById(id);
    for (let i = 0; i <= 6; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      sel.appendChild(opt);
    }
    sel.value = '0';
  });

  // Journées 1-37
  const journeeSel = document.getElementById('journee');
  for (let j = 1; j <= 37; j++) {
    const opt = document.createElement('option');
    opt.value = j;
    opt.textContent = `Journée ${j}`;
    journeeSel.appendChild(opt);
  }

  // Équipes
  ['team_ref', 'team_home', 'team_away'].forEach(id => {
    const sel = document.getElementById(id);
    TEAMS.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
  });

  // Référence par défaut : London Reds
  const refSel = document.getElementById('team_ref');
  refSel.value = 'London Reds';
  resetTeams();

  refSel.addEventListener('change', () => {
    resetTeams();
    renderGoalsGrid(cachedMatches);
    updateAvailableTeams(cachedMatches);
    checkFirstLeg();
  });

  document.getElementById('team_home').addEventListener('change', checkFirstLeg);
  document.getElementById('team_away').addEventListener('change', checkFirstLeg);
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

  if (!home || !away || home === away) {
    info.classList.add('hidden');
    return;
  }

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
    // Si la valeur sélectionnée est épuisée, revenir à la référence
    if (exhausted.has(sel.value)) sel.value = ref;
  });
}

function resetForm() {
  resetTeams();
  document.getElementById('score_home').value = '0';
  document.getElementById('score_away').value = '0';
  const sel = document.getElementById('journee');
  const next = Math.min(Number(sel.value) + 1, 37);
  sel.value = String(next);
}

let journeeReady   = false;
let cachedMatches  = [];

function updateSaisonLabel(val) {
  const label = document.getElementById('saisonLabel');
  if (val) {
    label.textContent = val;
    label.classList.remove('hidden');
  } else {
    label.classList.add('hidden');
  }
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

function resultLabel(sh, sa) {
  if (sh > sa) return '<span class="result-badge win">Domicile</span>';
  if (sh < sa) return '<span class="result-badge loss">Extérieur</span>';
  return '<span class="result-badge draw">Nul</span>';
}

function renderRow(m) {
  return `
    <tr data-id="${m.id}">
      <td class="td-journee">J${m.journee || '—'}</td>
      <td><strong>${escHtml(m.team_home)}</strong></td>
      <td class="score-display">${m.score_home} – ${m.score_away}</td>
      <td><strong>${escHtml(m.team_away)}</strong></td>
      <td>${resultLabel(m.score_home, m.score_away)}</td>
      <td class="td-actions">
        <button class="btn-edit-row" data-match='${JSON.stringify(m)}'>✏️</button>
        <button class="btn-del" data-id="${m.id}">🗑</button>
      </td>
    </tr>`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function loadMatches() {
  const res  = await fetch(API);
  const data = await res.json();
  matchCount.textContent = data.length;
  if (data.length === 0) {
    matchBody.innerHTML = '';
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
  if (matches.length === 0) {
    container.innerHTML = '<p class="stats-empty">Aucune donnée disponible.</p>';
    return;
  }

  const nextJournee = Number(document.getElementById('journee').value) || 1;

  // Compter et trouver la dernière journée par total de buts
  const counts    = {};
  const lastSeen  = {};
  matches.forEach(m => {
    const total = Number(m.score_home) + Number(m.score_away);
    counts[total]   = (counts[total] || 0) + 1;
    const j = Number(m.journee) || 0;
    if (!lastSeen[total] || j > lastSeen[total]) lastSeen[total] = j;
  });

  const rows = [];
  for (let i = 0; i <= 6; i++) {
    const count    = counts[i] || 0;
    const pct      = Math.round((count / matches.length) * 100);
    const last     = lastSeen[i];
    const interval = last != null ? nextJournee - last - 1 : null;
    rows.push({ goals: i, count, pct, interval });
  }

  const sort = document.getElementById('statSort').value;
  if (sort === 'interval') {
    rows.sort((a, b) => {
      if (a.interval === null) return 1;
      if (b.interval === null) return -1;
      return b.interval - a.interval;
    });
  } else if (sort === 'goals') {
    rows.sort((a, b) => b.count - a.count);
  }

  container.innerHTML = rows.map(r => `
    <div class="stat-row">
      <span class="stat-label">${r.goals}</span>
      <div class="stat-bar-wrap">
        <div class="stat-bar" style="width:${r.pct}%">
          ${r.pct > 0 ? `<span class="stat-pct-in">${r.pct}%</span>` : ''}
        </div>
      </div>
      <span class="stat-count">${r.count} match${r.count > 1 ? 's' : ''}</span>
      <span class="stat-interval">${r.interval !== null ? `(il y a ${r.interval} inter.)` : '—'}</span>
    </div>`
  ).join('');
}

function renderGoalsGrid(matches) {
  const container = document.getElementById('goalsGrid');
  if (matches.length === 0) {
    container.innerHTML = '<p class="stats-empty">Aucune donnée disponible.</p>';
    return;
  }

  // Grouper les journées par total de buts
  const groups = {};
  for (let i = 0; i <= 6; i++) groups[i] = [];
  matches.forEach(m => {
    const total = Number(m.score_home) + Number(m.score_away);
    if (total <= 6 && m.journee) groups[total].push(Number(m.journee));
  });
  for (let i = 0; i <= 6; i++) groups[i].sort((a, b) => a - b);

  const maxRows   = Math.max(...Object.values(groups).map(g => g.length));
  const teamName  = document.getElementById('team_ref').value || 'Équipe';
  const maxJournee = Math.max(...matches.map(m => Number(m.journee) || 0));

  let html = `<table class="goals-grid-table">
    <thead>
      <tr><th colspan="7" class="goals-grid-title">${escHtml(teamName)}</th></tr>
      <tr>${[0,1,2,3,4,5,6].map(i => `<th class="goals-grid-col">${i}</th>`).join('')}</tr>
    </thead>
    <tbody>`;

  for (let r = 0; r < maxRows; r++) {
    html += '<tr>';
    for (let c = 0; c <= 6; c++) {
      const val     = groups[c][r];
      const isLast  = val === maxJournee;
      html += `<td class="goals-grid-cell${isLast ? ' goals-grid-last' : ''}">${val != null ? val : ''}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

function setDefaultJournee(matches) {
  if (journeeReady) return;
  journeeReady = true;
  const sel = document.getElementById('journee');
  if (matches.length === 0) { sel.value = '1'; return; }
  const max = Math.max(...matches.map(m => m.journee || 0));
  sel.value = String(Math.min((max > 0 ? max : 0) + 1, 37));
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const team_home = document.getElementById('team_home').value;
  const team_away = document.getElementById('team_away').value;

  if (team_home === team_away) {
    showMsg('Les deux équipes ne peuvent pas être identiques.', 'error');
    return;
  }

  const body = {
    saison:     document.getElementById('saison').value.trim() || null,
    journee:    document.getElementById('journee').value,
    team_home,
    score_home: document.getElementById('score_home').value,
    score_away: document.getElementById('score_away').value,
    team_away,
  };
  try {
    const res = await fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { showMsg(data.error, 'error'); return; }
    showMsg('Match enregistré avec succès !', 'success');
    resetForm();
    document.getElementById('firstLegInfo').classList.add('hidden');
    loadMatches();
  } catch {
    showMsg('Erreur de connexion au serveur.', 'error');
  }
});

matchBody.addEventListener('click', async e => {
  // Suppression
  const btnDel = e.target.closest('.btn-del');
  if (btnDel) {
    if (!confirm('Supprimer ce match ?')) return;
    await fetch(`${API}/${btnDel.dataset.id}`, { method: 'DELETE' });
    loadMatches();
    return;
  }
  // Édition
  const btnEdit = e.target.closest('.btn-edit-row');
  if (btnEdit) openEditModal(JSON.parse(btnEdit.dataset.match));
});

// ── MODALE ÉDITION ──
function fillModalSelects() {
  ['editScoreHome', 'editScoreAway'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel.options.length > 1) return;
    for (let i = 0; i <= 6; i++) {
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = i;
      sel.appendChild(opt);
    }
  });
  ['editTeamHome', 'editTeamAway'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel.options.length > 1) return;
    TEAMS.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name; opt.textContent = name;
      sel.appendChild(opt);
    });
  });
  const jSel = document.getElementById('editJournee');
  if (jSel.options.length <= 1) {
    for (let j = 1; j <= 37; j++) {
      const opt = document.createElement('option');
      opt.value = j; opt.textContent = `Journée ${j}`;
      jSel.appendChild(opt);
    }
  }
}

function openEditModal(m) {
  fillModalSelects();
  document.getElementById('editId').value         = m.id;
  document.getElementById('editJournee').value    = m.journee || '';
  document.getElementById('editTeamHome').value   = m.team_home;
  document.getElementById('editScoreHome').value  = m.score_home;
  document.getElementById('editScoreAway').value  = m.score_away;
  document.getElementById('editTeamAway').value   = m.team_away;
  document.getElementById('editMsg').className    = 'msg hidden';
  document.getElementById('editModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editModal').classList.add('hidden');
}

document.getElementById('modalClose').addEventListener('click', closeEditModal);
document.getElementById('editModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeEditModal();
});

document.getElementById('editForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id   = document.getElementById('editId').value;
  const body = {
    journee:    document.getElementById('editJournee').value,
    team_home:  document.getElementById('editTeamHome').value,
    score_home: document.getElementById('editScoreHome').value,
    score_away: document.getElementById('editScoreAway').value,
    team_away:  document.getElementById('editTeamAway').value,
  };
  const res  = await fetch(`${API}/${id}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = document.getElementById('editMsg');
    msg.textContent = data.error;
    msg.className   = 'msg error';
    return;
  }
  closeEditModal();
  loadMatches();
});

initSaison();
fillSelects();
loadMatches();

document.getElementById('statSort').addEventListener('change', () => renderStats(cachedMatches));
