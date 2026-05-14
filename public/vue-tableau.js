const refTeam       = localStorage.getItem('team_ref') || 'London Reds';
const currentSaison = localStorage.getItem('saison_courante');
const NB_JOURNEES   = 38;

let selectedGoals   = new Set(JSON.parse(localStorage.getItem('vt_goals')   || '[]'));
let selectedSeasons = new Set(JSON.parse(localStorage.getItem('vt_seasons') || '[]'));
let selectedTeams   = new Set(JSON.parse(localStorage.getItem('vt_teams')   || '[]'));
let seasons         = [];
let bySeason        = {};
let nextJournee     = null;

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function hitClass(journee) {
  if (journee <= 9)  return 'vt-hit vt-hit-1';
  if (journee <= 19) return 'vt-hit vt-hit-2';
  if (journee <= 29) return 'vt-hit vt-hit-3';
  return 'vt-hit vt-hit-4';
}

function renderFilter() {
  const allActive = selectedGoals.size === 0 ? ' vt-filter-active' : '';
  let btns = `<button class="vt-filter-btn${allActive}" onclick="setFilter(null)">Tous</button>`;
  for (let g = 0; g <= 6; g++) {
    const active = selectedGoals.has(g) ? ' vt-filter-active' : '';
    btns += `<button class="vt-filter-btn${active}" onclick="setFilter(${g})">${g}</button>`;
  }
  document.getElementById('vtFilter').innerHTML = btns;
}

function setFilter(g) {
  if (g === null) {
    selectedGoals.clear();
  } else {
    if (selectedGoals.has(g)) selectedGoals.delete(g);
    else selectedGoals.add(g);
  }
  localStorage.setItem('vt_goals', JSON.stringify([...selectedGoals]));
  renderFilter();
  renderTable();
}

function renderSeasonFilter() {
  const panel = document.getElementById('vtSeasonPanel');
  panel.innerHTML = seasons.map(s => {
    const checked   = selectedSeasons.has(s) ? 'checked' : '';
    const isCurrent = s === currentSaison;
    return `<label class="vt-season-option">
      <input type="checkbox" ${checked} onchange="toggleSeason('${s.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
      ${escHtml(s)}${isCurrent ? ' <span class="vt-active-dot" style="width:6px;height:6px;box-shadow:none;margin-left:3px"></span>' : ''}
    </label>`;
  }).join('');
  updateSeasonBtnLabel();
}

function updateSeasonBtnLabel() {
  const label = document.getElementById('vtSeasonBtnLabel');
  if (selectedSeasons.size === 0)      label.textContent = 'Toutes les saisons';
  else if (selectedSeasons.size === 1) label.textContent = [...selectedSeasons][0];
  else                                 label.textContent = `${selectedSeasons.size} saisons`;
}

function toggleSeason(s) {
  if (selectedSeasons.has(s)) selectedSeasons.delete(s);
  else selectedSeasons.add(s);
  localStorage.setItem('vt_seasons', JSON.stringify([...selectedSeasons]));
  updateSeasonBtnLabel();
  renderTable();
}

function renderTeamFilter() {
  const TEAMS_NO_REF = [
    'A. Villa','Bournemouth','Brentford','Brighton','Burnley','C Palace',
    'Everton','Fulham','Leeds','Liverpool','London Blues','London Reds',
    'Manchester Blue','Manchester Red','N Forest','Newcastle','Spurs',
    'Sunderlands','West Ham','Wolverhampton',
  ].filter(t => t !== refTeam);

  const panel = document.getElementById('vtTeamPanel');
  panel.innerHTML = TEAMS_NO_REF.map(t => {
    const checked = selectedTeams.has(t) ? 'checked' : '';
    return `<label class="vt-season-option">
      <input type="checkbox" ${checked} onchange="toggleTeam('${t.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
      ${escHtml(t)}
    </label>`;
  }).join('');
  updateTeamBtnLabel();
}

function updateTeamBtnLabel() {
  const label = document.getElementById('vtTeamBtnLabel');
  if (selectedTeams.size === 0)      label.textContent = 'Toutes les équipes';
  else if (selectedTeams.size === 1) label.textContent = [...selectedTeams][0];
  else                               label.textContent = `${selectedTeams.size} équipes`;
}

function toggleTeam(t) {
  if (selectedTeams.has(t)) selectedTeams.delete(t);
  else selectedTeams.add(t);
  localStorage.setItem('vt_teams', JSON.stringify([...selectedTeams]));
  updateTeamBtnLabel();
  renderTable();
}

document.addEventListener('click', e => {
  const seasonDd = document.getElementById('vtSeasonDropdown');
  if (seasonDd && !seasonDd.contains(e.target))
    document.getElementById('vtSeasonPanel').classList.add('hidden');

  const teamDd = document.getElementById('vtTeamDropdown');
  if (teamDd && !teamDd.contains(e.target))
    document.getElementById('vtTeamPanel').classList.add('hidden');
});

document.getElementById('vtSeasonBtn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('vtSeasonPanel').classList.toggle('hidden');
});

document.getElementById('vtTeamBtn').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('vtTeamPanel').classList.toggle('hidden');
});

function renderTable() {
  if (seasons.length === 0) {
    document.getElementById('vtWrap').innerHTML = '<p class="stats-empty">Aucune donnée disponible.</p>';
    return;
  }

  const activeSeasons = selectedSeasons.size > 0 ? seasons.filter(s => selectedSeasons.has(s)) : seasons;
  const activeCols    = selectedGoals.size > 0 ? [...selectedGoals].sort((a,b) => a-b) : [0,1,2,3,4,5,6];
  const filtered   = selectedGoals.size > 0;
  let html = '<table class="vt-table"><thead>';

  // Ligne 1 : noms des saisons
  html += '<tr><th class="vt-corner" rowspan="2">J.</th>';
  activeSeasons.forEach((s, si) => {
    const isCurrent = s === currentSaison;
    const sep       = si > 0 ? ' vt-sep' : '';
    html += `<th colspan="${activeCols.length}" class="vt-season-header${isCurrent ? ' vt-season-current' : ''}${sep}">${escHtml(s)}${isCurrent ? ' <span class="vt-active-dot"></span>' : ''}</th>`;
  });
  html += '</tr>';

  // Ligne 2 : colonnes buts actives
  html += '<tr>';
  activeSeasons.forEach((s, si) => {
    activeCols.forEach((g, gi) => {
      const sep = (gi === 0 && si > 0) ? ' vt-sep' : '';
      html += `<th class="vt-goal-col${sep}">${g}</th>`;
    });
  });
  html += '</tr></thead><tbody>';

  // Lignes journées 1–38
  for (let j = 1; j <= NB_JOURNEES; j++) {
    const rowSep = (j === 10 || j === 20 || j === 30) ? ' vt-row-sep' : '';
    const isNext = j === nextJournee;
    html += `<tr><td class="vt-j-cell${rowSep}">${isNext ? '<span class="vt-next-arrow">▶</span>' : ''}${j}</td>`;

    activeSeasons.forEach((s, si) => {
      const match = bySeason[s][j];
      activeCols.forEach((g, gi) => {
        const teamOk = selectedTeams.size === 0 || (match && selectedTeams.has(match.opponent));
        const isHit  = match && match.total === g && teamOk;
        const sep    = (gi === 0 && si > 0) ? ' vt-sep' : '';
        const inner  = isHit && match.opponent ? `<span class="vt-opponent">${escHtml(match.opponent)}</span>` : '';
        const tip    = isHit ? ` title="${match.score}"` : '';
        html += `<td class="vt-cell${sep}${rowSep}${isHit ? ' ' + hitClass(j) : ''}"${tip}>${inner}</td>`;
      });
    });

    html += '</tr>';
  }

  html += '</tbody></table>';
  document.getElementById('vtWrap').innerHTML = html;
}

async function init() {
  document.getElementById('vtRefLabel').textContent = refTeam;

  const res = await fetch('/api/matches');
  const all = await res.json();

  const seasonDates = {};
  all.forEach(m => {
    const key     = m.saison || 'N/A';
    const journee = Number(m.journee);
    const total   = Number(m.score_home) + Number(m.score_away);
    if (!journee || total > 6) return;

    if (!bySeason[key]) { bySeason[key] = {}; seasonDates[key] = m.created_at; }
    const opponent = m.team_home === refTeam ? m.team_away
                   : m.team_away === refTeam ? m.team_home
                   : null;
    bySeason[key][journee] = {
      total,
      opponent,
      score: `${m.team_home} ${m.score_home}–${m.score_away} ${m.team_away}`
    };
    if (new Date(m.created_at) < new Date(seasonDates[key])) {
      seasonDates[key] = m.created_at;
    }
  });

  // Plus récente en premier
  seasons = Object.keys(bySeason).sort(
    (a, b) => new Date(seasonDates[b]) - new Date(seasonDates[a])
  );

  // Prochaine journée de la saison en cours
  if (currentSaison && bySeason[currentSaison]) {
    const played    = Object.keys(bySeason[currentSaison]).map(Number);
    const maxPlayed = played.length ? Math.max(...played) : 0;
    nextJournee     = Math.min(maxPlayed + 1, NB_JOURNEES);
  }

  renderFilter();
  renderSeasonFilter();
  renderTeamFilter();
  renderTable();
}

init();
