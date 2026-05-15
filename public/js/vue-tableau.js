function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function main() {
  const params   = new URLSearchParams(location.search);
  const leagueId = params.get('league');
  if (!leagueId) { location.href = 'index.html'; return; }

  const [leagueRes, teamsRes, matchRes, settingsRes] = await Promise.all([
    fetch(`/api/leagues/${leagueId}`),
    fetch(`/api/leagues/${leagueId}/teams`),
    fetch(`/api/matches?league_id=${leagueId}`),
    fetch(`/api/leagues/${leagueId}/settings`),
  ]);
  const leagueData    = await leagueRes.json();
  const teamsData     = await teamsRes.json();
  const all           = await matchRes.json();
  const savedSettings = await settingsRes.json();

  const currentSaison = leagueData.current_saison || '';
  const refTeam       = leagueData.ref_team || '';
  const NB_JOURNEES   = leagueData.nb_journees || 38;
  const TEAMS_NO_REF  = teamsData.map(t => t.name).sort().filter(t => t !== refTeam);

  document.querySelector('.header-sub').innerHTML =
    `<a href="index.html" class="league-back-link">← Ligues</a> <span class="header-sep">|</span> ${escHtml(leagueData.name)} — Vue tableau`;
  document.getElementById('vtRefLabel').textContent = refTeam;
  document.querySelectorAll('a.nav-link[href]').forEach(a => {
    const url = new URL(a.href, location.href);
    if (!url.pathname.endsWith('index.html')) { url.searchParams.set('league', leagueId); a.href = url.pathname + url.search; }
  });

  // Filtres chargés depuis MySQL
  let selectedGoals   = new Set(savedSettings.vt_goals   || []);
  let selectedSeasons = new Set(savedSettings.vt_seasons || []);
  let selectedTeams   = new Set(savedSettings.vt_teams   || []);
  let seasons         = [];
  let bySeason        = {};
  let nextJournee     = null;

  async function saveSetting(key, set) {
    await fetch(`/api/leagues/${leagueId}/settings/${key}`, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ value: [...set] }),
    });
  }

  function hitClass(j) { return j<=9?'vt-hit vt-hit-1':j<=19?'vt-hit vt-hit-2':j<=29?'vt-hit vt-hit-3':'vt-hit vt-hit-4'; }

  function renderFilter() {
    const allActive = selectedGoals.size === 0 ? ' vt-filter-active' : '';
    let btns = `<button class="vt-filter-btn${allActive}" onclick="setFilter(null)">Tous</button>`;
    for (let g = 0; g <= 6; g++) {
      btns += `<button class="vt-filter-btn${selectedGoals.has(g)?' vt-filter-active':''}" onclick="setFilter(${g})">${g}</button>`;
    }
    document.getElementById('vtFilter').innerHTML = btns;
  }

  window.setFilter = function(g) {
    if (g === null) selectedGoals.clear();
    else { if (selectedGoals.has(g)) selectedGoals.delete(g); else selectedGoals.add(g); }
    saveSetting('vt_goals', selectedGoals);
    renderFilter();
    renderTable();
  };

  function renderSeasonFilter() {
    document.getElementById('vtSeasonPanel').innerHTML = seasons.map(s => {
      const isCurrent = s === currentSaison;
      return `<label class="vt-season-option">
        <input type="checkbox" ${selectedSeasons.has(s)?'checked':''} onchange="toggleSeason('${s.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
        ${escHtml(s)}${isCurrent?` <span class="vt-active-dot" style="width:6px;height:6px;box-shadow:none;margin-left:3px"></span>`:''}
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

  window.toggleSeason = function(s) {
    if (selectedSeasons.has(s)) selectedSeasons.delete(s); else selectedSeasons.add(s);
    saveSetting('vt_seasons', selectedSeasons);
    updateSeasonBtnLabel();
    renderTable();
  };

  function renderTeamFilter() {
    document.getElementById('vtTeamPanel').innerHTML = TEAMS_NO_REF.map(t => `
      <label class="vt-season-option">
        <input type="checkbox" ${selectedTeams.has(t)?'checked':''} onchange="toggleTeam('${t.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}')">
        ${escHtml(t)}
      </label>`).join('');
    updateTeamBtnLabel();
  }

  function updateTeamBtnLabel() {
    const label = document.getElementById('vtTeamBtnLabel');
    if (selectedTeams.size === 0)      label.textContent = 'Toutes les équipes';
    else if (selectedTeams.size === 1) label.textContent = [...selectedTeams][0];
    else                               label.textContent = `${selectedTeams.size} équipes`;
  }

  window.toggleTeam = function(t) {
    if (selectedTeams.has(t)) selectedTeams.delete(t); else selectedTeams.add(t);
    saveSetting('vt_teams', selectedTeams);
    updateTeamBtnLabel();
    renderTable();
  };

  document.addEventListener('click', e => {
    if (!document.getElementById('vtSeasonDropdown').contains(e.target)) document.getElementById('vtSeasonPanel').classList.add('hidden');
    if (!document.getElementById('vtTeamDropdown').contains(e.target))   document.getElementById('vtTeamPanel').classList.add('hidden');
  });
  document.getElementById('vtSeasonBtn').addEventListener('click', e => { e.stopPropagation(); document.getElementById('vtSeasonPanel').classList.toggle('hidden'); });
  document.getElementById('vtTeamBtn').addEventListener('click',   e => { e.stopPropagation(); document.getElementById('vtTeamPanel').classList.toggle('hidden'); });

  function renderTable() {
    if (seasons.length === 0) { document.getElementById('vtWrap').innerHTML = '<p class="stats-empty">Aucune donnée disponible.</p>'; return; }
    const activeSeasons = selectedSeasons.size > 0 ? seasons.filter(s => selectedSeasons.has(s)) : seasons;
    const activeCols    = selectedGoals.size > 0 ? [...selectedGoals].sort((a,b)=>a-b) : [0,1,2,3,4,5,6];
    let html = '<table class="vt-table"><thead><tr><th class="vt-corner" rowspan="2">J.</th>';
    activeSeasons.forEach((s, si) => {
      const isCurrent = s === currentSaison;
      html += `<th colspan="${activeCols.length}" class="vt-season-header${isCurrent?' vt-season-current':''}${si>0?' vt-sep':''}">${escHtml(s)}${isCurrent?' <span class="vt-active-dot"></span>':''}</th>`;
    });
    html += '</tr><tr>';
    activeSeasons.forEach((s, si) => activeCols.forEach((g, gi) => { html += `<th class="vt-goal-col${gi===0&&si>0?' vt-sep':''}">${g}</th>`; }));
    html += '</tr></thead><tbody>';
    for (let j = 1; j <= NB_JOURNEES; j++) {
      const rowSep = (j===10||j===20||j===30) ? ' vt-row-sep' : '';
      const isNext = j === nextJournee;
      html += `<tr><td class="vt-j-cell${rowSep}">${isNext?'<span class="vt-next-arrow">▶</span>':''}${j}</td>`;
      activeSeasons.forEach((s, si) => {
        const match = bySeason[s] && bySeason[s][j];
        activeCols.forEach((g, gi) => {
          const teamOk = selectedTeams.size === 0 || (match && selectedTeams.has(match.opponent));
          const isHit  = match && match.total === g && teamOk;
          const sep    = gi===0 && si>0 ? ' vt-sep' : '';
          html += `<td class="vt-cell${sep}${rowSep}${isHit?' '+hitClass(j):''}"${isHit?` title="${match.score}"`:''}>${isHit&&match.opponent?`<span class="vt-opponent">${escHtml(match.opponent)}</span>`:''}</td>`;
        });
      });
      html += '</tr>';
    }
    document.getElementById('vtWrap').innerHTML = html + '</tbody></table>';
  }

  const seasonDates = {};
  all.forEach(m => {
    const key = m.saison || 'N/A', journee = Number(m.journee), total = Number(m.score_home) + Number(m.score_away);
    if (!journee || total > 6) return;
    if (!bySeason[key]) { bySeason[key] = {}; seasonDates[key] = m.created_at; }
    const opponent = m.team_home === refTeam ? m.team_away : m.team_away === refTeam ? m.team_home : null;
    bySeason[key][journee] = { total, opponent, score: `${m.team_home} ${m.score_home}–${m.score_away} ${m.team_away}` };
    if (new Date(m.created_at) < new Date(seasonDates[key])) seasonDates[key] = m.created_at;
  });

  seasons = Object.keys(bySeason).sort((a,b) => new Date(seasonDates[b]) - new Date(seasonDates[a]));

  if (currentSaison && bySeason[currentSaison]) {
    const played = Object.keys(bySeason[currentSaison]).map(Number);
    nextJournee  = Math.min((played.length ? Math.max(...played) : 0) + 1, NB_JOURNEES);
  }

  renderFilter(); renderSeasonFilter(); renderTeamFilter(); renderTable();
}

main();
