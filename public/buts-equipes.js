const TEAMS = [
  'A. Villa','Bournemouth','Brentford','Brighton','Burnley','C Palace',
  'Everton','Fulham','Leeds','Liverpool','London Blues','London Reds',
  'Manchester Blue','Manchester Red','N Forest','Newcastle','Spurs',
  'Sunderlands','West Ham','Wolverhampton',
];

const TEAM_LEVELS = {
  fort:   ['Manchester Blue','Liverpool','Brighton','London Reds','A. Villa','Manchester Red','C Palace'],
  moyen:  ['Fulham','Bournemouth','Newcastle','West Ham','Brentford','Wolverhampton','N Forest'],
  faible: ['London Blues','Spurs','Burnley','Everton','Sunderlands','Leeds'],
};

function getTeamLevel(name) {
  for (const [lvl, teams] of Object.entries(TEAM_LEVELS)) {
    if (teams.includes(name)) return lvl;
  }
  return null;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

let allMatches    = [];
let currentSaison = localStorage.getItem('saison_courante');
const refTeam     = localStorage.getItem('team_ref') || 'London Reds';

async function init() {
  const res = await fetch('/api/matches');
  allMatches = await res.json();
  populateSaisonFilter();
  render();

  document.getElementById('beSearch').addEventListener('input', render);
  document.getElementById('beSaisonFilter').addEventListener('change', render);
}

function populateSaisonFilter() {
  const saisons = [...new Set(allMatches.map(m => m.saison).filter(Boolean))];
  // Ordre chronologique via la date du 1er match de chaque saison
  const saisonDates = {};
  allMatches.forEach(m => {
    if (!m.saison) return;
    const t = new Date(m.created_at).getTime();
    if (!saisonDates[m.saison] || t < saisonDates[m.saison]) saisonDates[m.saison] = t;
  });
  saisons.sort((a, b) => saisonDates[b] - saisonDates[a]);

  const sel = document.getElementById('beSaisonFilter');
  saisons.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s + (s === currentSaison ? ' (en cours)' : '');
    sel.appendChild(opt);
  });
}

function buildTeamHistory(team, saisonFilter) {
  const matches = allMatches.filter(m =>
    (m.team_home === team || m.team_away === team) &&
    (!saisonFilter || m.saison === saisonFilter)
  );

  // Grouper par saison, ordonné par date de création de la saison
  const bySaison = {};
  matches.forEach(m => {
    const key = m.saison || 'N/A';
    if (!bySaison[key]) bySaison[key] = { buts: [], date: m.created_at };
    const total = Number(m.score_home) + Number(m.score_away);
    // Insérer dans l'ordre journée croissante
    bySaison[key].buts.push({ total, journee: Number(m.journee) || 0, created_at: m.created_at });
    // Garder la date la plus ancienne comme date de création de saison
    if (new Date(m.created_at) < new Date(bySaison[key].date)) {
      bySaison[key].date = m.created_at;
    }
  });

  // Trier les matchs de chaque saison par journée croissante
  for (const s of Object.values(bySaison)) {
    s.buts.sort((a, b) => a.journee - b.journee);
  }

  // Trier les saisons par date décroissante (plus récente en premier)
  return Object.entries(bySaison).sort(([, a], [, b]) =>
    new Date(b.date) - new Date(a.date)
  );
}

function renderTeamCard(team, saisonFilter) {
  const lvl  = getTeamLevel(team);
  const lvlMap = {
    fort:   ['level-fort',   '● Fort'],
    moyen:  ['level-moyen',  '● Moyen'],
    faible: ['level-faible', '● Faible'],
  };
  const [lvlCls, lvlLabel] = lvl ? lvlMap[lvl] : ['', ''];

  const seasons = buildTeamHistory(team, saisonFilter);

  if (seasons.length === 0) return '';

  const seasonsHtml = seasons.map(([saison, { buts, date }], idx) => {
    const isCurrent = saison === currentSaison;
    const dateStr   = fmtDate(date);

    let separator = '';
    if (idx > 0) {
      const prevDate = seasons[idx - 1][1].date;
      const prevDay  = prevDate ? new Date(prevDate).toDateString() : null;
      const currDay  = date    ? new Date(date).toDateString()     : null;
      if (prevDay !== currDay) separator = '<hr class="th-separator">';
    }

    return `${separator}
    <div class="th-row${isCurrent ? ' th-row-current' : ''}">
      <span class="th-saison">${escHtml(saison)} <em class="th-date">(${dateStr})</em>${isCurrent ? ' <span class="th-current-tag">en cours</span>' : ''}</span>
      <div class="th-buts-list">
        ${buts.map(b => `<span class="th-but-badge">${b.total}</span>`).join('')}
      </div>
    </div>`;
  }).join('');

  return `
  <div class="be-card">
    <div class="be-card-header">
      <span class="be-team-name">${escHtml(team)}</span>
      ${lvl ? `<span class="level-badge ${lvlCls}">${lvlLabel}</span>` : ''}
    </div>
    <div class="be-seasons">${seasonsHtml}</div>
  </div>`;
}

function render() {
  const search       = document.getElementById('beSearch').value.trim().toLowerCase();
  const saisonFilter = document.getElementById('beSaisonFilter').value;
  const grid         = document.getElementById('beGrid');

  const html = TEAMS
    .filter(t => t !== refTeam)
    .filter(t => !search || t.toLowerCase().includes(search))
    .map(t => renderTeamCard(t, saisonFilter))
    .filter(Boolean)
    .join('');

  grid.innerHTML = html || '<p class="stats-empty">Aucune donnée disponible.</p>';
}

init();
