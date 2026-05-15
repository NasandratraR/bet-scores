function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `msg ${type}`;
  setTimeout(() => { el.className = 'msg hidden'; }, 3500);
}

const LEVEL_META = {
  fort:   { label: '● Fort',   cls: 'level-fort'   },
  moyen:  { label: '● Moyen',  cls: 'level-moyen'  },
  faible: { label: '● Faible', cls: 'level-faible' },
};

// ── LISTE DES LIGUES ──

async function loadLeagues() {
  const res  = await fetch('/api/leagues');
  const data = await res.json();
  const container = document.getElementById('leaguesList');

  if (data.length === 0) {
    container.innerHTML = '<p class="leagues-empty">Aucune ligue. Créez-en une pour commencer.</p>';
    return;
  }

  container.innerHTML = data.map(l => `
    <div class="league-card">
      <div class="league-card-info">
        <div class="league-card-name">${escHtml(l.name)}</div>
        <div class="league-card-meta">${l.team_count} équipe${l.team_count > 1 ? 's' : ''} · ${l.nb_journees} journées · ${l.match_count} match${l.match_count > 1 ? 's' : ''}</div>
      </div>
      <div class="league-card-actions">
        <button class="btn-league-teams" data-id="${l.id}" data-name="${escHtml(l.name)}" title="Gérer les équipes">⚙ Équipes</button>
        <button class="btn-league-rename" data-id="${l.id}" data-name="${escHtml(l.name)}" data-journees="${l.nb_journees}" title="Modifier">✏</button>
        <button class="btn-league-delete" data-id="${l.id}" data-name="${escHtml(l.name)}" title="Supprimer">🗑</button>
        <button class="btn-league-enter" data-id="${l.id}" data-name="${escHtml(l.name)}">Entrer →</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.btn-league-enter').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.href = 'saisie.html?league=' + btn.dataset.id;
    });
  });

  container.querySelectorAll('.btn-league-teams').forEach(btn => {
    btn.addEventListener('click', () => openTeamsModal(btn.dataset.id, btn.dataset.name));
  });

  container.querySelectorAll('.btn-league-rename').forEach(btn => {
    btn.addEventListener('click', () => openLeagueModal(btn.dataset.id, btn.dataset.name, btn.dataset.journees));
  });

  container.querySelectorAll('.btn-league-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Supprimer la ligue "${btn.dataset.name}" et TOUS ses matchs ?`)) return;
      await fetch(`/api/leagues/${btn.dataset.id}`, { method: 'DELETE' });
      loadLeagues();
    });
  });
}

// ── MODALE LIGUE ──

function openLeagueModal(id = null, name = '', nbJournees = 38) {
  document.getElementById('leagueEditId').value            = id || '';
  document.getElementById('leagueName').value              = name;
  document.getElementById('leagueNbJournees').value        = nbJournees;
  document.getElementById('leagueModalTitle').textContent  = id ? 'Modifier la ligue' : 'Nouvelle ligue';
  document.getElementById('leagueFormSubmit').textContent  = id ? 'Enregistrer' : 'Créer la ligue';
  document.getElementById('leagueFormMsg').className       = 'msg hidden';
  document.getElementById('leagueModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('leagueName').focus(), 50);
}

function closeLeagueModal() {
  document.getElementById('leagueModal').classList.add('hidden');
}

document.getElementById('btnNewLeague').addEventListener('click', () => openLeagueModal());
document.getElementById('leagueModalClose').addEventListener('click', closeLeagueModal);
document.getElementById('leagueModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeLeagueModal();
});

document.getElementById('leagueForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name        = document.getElementById('leagueName').value.trim();
  const nbJournees  = Number(document.getElementById('leagueNbJournees').value) || 38;
  const id          = document.getElementById('leagueEditId').value;
  const msg         = document.getElementById('leagueFormMsg');

  const method = id ? 'PUT' : 'POST';
  const url    = id ? `/api/leagues/${id}` : '/api/leagues';
  const res    = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, nb_journees: nbJournees }),
  });
  const data = await res.json();
  if (!res.ok) { showMsg(msg, data.error, 'error'); return; }
  closeLeagueModal();
  loadLeagues();
});

// ── MODALE ÉQUIPES ──

async function openTeamsModal(leagueId, leagueName) {
  document.getElementById('teamsLeagueId').value         = leagueId;
  document.getElementById('teamsModalTitle').textContent = `Équipes — ${leagueName}`;
  document.getElementById('newTeamName').value           = '';
  document.getElementById('newTeamLevel').value          = '';
  document.getElementById('addTeamMsg').className        = 'msg hidden';
  document.getElementById('teamsModal').classList.remove('hidden');
  await renderTeamsList(leagueId);
}

function closeTeamsModal() {
  document.getElementById('teamsModal').classList.add('hidden');
}

document.getElementById('teamsModalClose').addEventListener('click', closeTeamsModal);
document.getElementById('teamsModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeTeamsModal();
});

async function renderTeamsList(leagueId) {
  const res   = await fetch(`/api/leagues/${leagueId}/teams`);
  const teams = await res.json();
  const list  = document.getElementById('teamsList');

  if (teams.length === 0) {
    list.innerHTML = '<p class="teams-empty">Aucune équipe. Ajoutez-en ci-dessous.</p>';
    return;
  }

  list.innerHTML = teams.map(t => `
    <div class="team-row" data-id="${t.id}">
      <span class="team-row-name">${escHtml(t.name)}</span>
      ${t.level
        ? `<span class="level-badge ${LEVEL_META[t.level].cls} team-row-level">${LEVEL_META[t.level].label}</span>`
        : '<span class="team-row-level"></span>'}
      <div class="team-row-actions">
        <button class="btn-team-edit"
          data-id="${t.id}" data-name="${escHtml(t.name)}" data-level="${t.level || ''}">✏</button>
        <button class="btn-team-delete"
          data-id="${t.id}" data-name="${escHtml(t.name)}">🗑</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.btn-team-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Supprimer "${btn.dataset.name}" ?`)) return;
      await fetch(`/api/teams/${btn.dataset.id}`, { method: 'DELETE' });
      renderTeamsList(leagueId);
      loadLeagues();
    });
  });

  list.querySelectorAll('.btn-team-edit').forEach(btn => {
    btn.addEventListener('click', () =>
      openTeamEdit(btn.dataset.id, btn.dataset.name, btn.dataset.level, leagueId)
    );
  });
}

function openTeamEdit(teamId, name, level, leagueId) {
  const row = document.querySelector(`.team-row[data-id="${teamId}"]`);
  if (!row) return;

  row.innerHTML = `
    <input type="text" class="team-edit-input" value="${escHtml(name)}" />
    <select class="team-edit-level">
      <option value="">-- Niveau --</option>
      <option value="fort"   ${level === 'fort'   ? 'selected' : ''}>Fort</option>
      <option value="moyen"  ${level === 'moyen'  ? 'selected' : ''}>Moyen</option>
      <option value="faible" ${level === 'faible' ? 'selected' : ''}>Faible</option>
    </select>
    <div class="team-row-actions">
      <button class="btn-team-save"   data-id="${teamId}">✔</button>
      <button class="btn-team-cancel">✕</button>
    </div>
  `;

  row.querySelector('.btn-team-cancel').addEventListener('click', () => renderTeamsList(leagueId));

  row.querySelector('.btn-team-save').addEventListener('click', async () => {
    const newName  = row.querySelector('.team-edit-input').value.trim();
    const newLevel = row.querySelector('.team-edit-level').value;
    if (!newName) return;
    await fetch(`/api/teams/${teamId}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: newName, level: newLevel || null }),
    });
    renderTeamsList(leagueId);
    loadLeagues();
  });
}

document.getElementById('addTeamForm').addEventListener('submit', async e => {
  e.preventDefault();
  const leagueId = document.getElementById('teamsLeagueId').value;
  const name     = document.getElementById('newTeamName').value.trim();
  const level    = document.getElementById('newTeamLevel').value;
  const msg      = document.getElementById('addTeamMsg');

  const res  = await fetch(`/api/leagues/${leagueId}/teams`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, level: level || null }),
  });
  const data = await res.json();
  if (!res.ok) { showMsg(msg, data.error, 'error'); return; }
  document.getElementById('newTeamName').value  = '';
  document.getElementById('newTeamLevel').value = '';
  renderTeamsList(leagueId);
  loadLeagues();
});

loadLeagues();
