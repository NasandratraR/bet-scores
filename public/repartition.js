const refTeam     = localStorage.getItem('team_ref') || 'London Reds';
const currentSaison = localStorage.getItem('saison_courante');

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function renderGoalsGrid(matches, teamName) {
  const groups = {};
  for (let i = 0; i <= 6; i++) groups[i] = [];

  matches.forEach(m => {
    const total = Number(m.score_home) + Number(m.score_away);
    if (total <= 6 && m.journee) groups[total].push(Number(m.journee));
  });
  for (let i = 0; i <= 6; i++) groups[i].sort((a, b) => a - b);

  const maxRows    = Math.max(...Object.values(groups).map(g => g.length), 1);
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
      const val    = groups[c][r];
      const isLast = val === maxJournee;
      const dcls   = val == null ? '' : val <= 9 ? ' jd-1' : val <= 19 ? ' jd-2' : val <= 29 ? ' jd-3' : ' jd-4';
      html += `<td class="goals-grid-cell${dcls}${isLast ? ' goals-grid-last' : ''}">${val != null ? val : ''}</td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

async function init() {
  document.getElementById('repRefLabel').textContent = refTeam;

  const res     = await fetch('/api/matches');
  const all     = await res.json();

  // Grouper par saison, garder la date minimale par saison
  const bySaison = {};
  all.forEach(m => {
    const key = m.saison || 'N/A';
    if (!bySaison[key]) bySaison[key] = { matches: [], minDate: m.created_at };
    bySaison[key].matches.push(m);
    if (new Date(m.created_at) < new Date(bySaison[key].minDate)) {
      bySaison[key].minDate = m.created_at;
    }
  });

  // Trier les saisons par date décroissante (plus récente en premier)
  const seasons = Object.entries(bySaison).sort(
    ([, a], [, b]) => new Date(b.minDate) - new Date(a.minDate)
  );

  if (seasons.length === 0) {
    document.getElementById('repGrid').innerHTML = '<p class="stats-empty">Aucune donnée disponible.</p>';
    return;
  }

  const html = seasons.map(([saison, { matches, minDate }]) => {
    const isCurrent = saison === currentSaison;
    const dateStr   = fmtDate(minDate);
    return `
    <div class="rep-card">
      <div class="rep-card-header">
        <span class="rep-saison-name">${escHtml(saison)}</span>
        <em class="th-date">(${dateStr})</em>
        ${isCurrent ? '<span class="th-current-tag">en cours</span>' : ''}
        <span class="rep-match-count">${matches.length} match${matches.length > 1 ? 's' : ''}</span>
      </div>
      ${renderGoalsGrid(matches, refTeam)}
    </div>`;
  }).join('');

  document.getElementById('repGrid').innerHTML = html;
}

init();
