function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function main() {
  const params   = new URLSearchParams(location.search);
  const leagueId = params.get('league');
  if (!leagueId) { location.href = 'index.html'; return; }

  const [leagueRes, teamsRes, matchRes] = await Promise.all([
    fetch(`/api/leagues/${leagueId}`),
    fetch(`/api/leagues/${leagueId}/teams`),
    fetch(`/api/matches?league_id=${leagueId}`),
  ]);
  const leagueData    = await leagueRes.json();
  const teamsData     = await teamsRes.json();
  const allMatches    = await matchRes.json();
  const currentSaison = leagueData.current_saison || '';
  const refTeam       = leagueData.ref_team || '';
  const TEAMS         = teamsData.map(t => t.name).sort();
  const teamLevelMap  = {};
  teamsData.forEach(t => { if (t.level) teamLevelMap[t.name] = t.level; });

  document.querySelector('.header-sub').innerHTML =
    `<a href="index.html" class="league-back-link">← Ligues</a> <span class="header-sep">|</span> ${escHtml(leagueData.name)} — Buts équipes`;
  document.querySelectorAll('a.nav-link[href]').forEach(a => {
    const url = new URL(a.href, location.href);
    if (!url.pathname.endsWith('index.html')) { url.searchParams.set('league', leagueId); a.href = url.pathname + url.search; }
  });

  function fmtDate(d) { return d ? new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : ''; }
  function getTeamLevel(name) { return teamLevelMap[name] || null; }

  populateSaisonFilter();
  render();
  document.getElementById('beSearch').addEventListener('input', render);
  document.getElementById('beSaisonFilter').addEventListener('change', render);

  function populateSaisonFilter() {
    const saisonDates = {};
    allMatches.forEach(m => {
      if (!m.saison) return;
      const t = new Date(m.created_at).getTime();
      if (!saisonDates[m.saison] || t < saisonDates[m.saison]) saisonDates[m.saison] = t;
    });
    const saisons = [...new Set(allMatches.map(m => m.saison).filter(Boolean))].sort((a,b) => saisonDates[b] - saisonDates[a]);
    const sel = document.getElementById('beSaisonFilter');
    saisons.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s + (s === currentSaison ? ' (en cours)' : '');
      sel.appendChild(opt);
    });
  }

  function buildTeamHistory(team, saisonFilter) {
    const matches = allMatches.filter(m => (m.team_home === team || m.team_away === team) && (!saisonFilter || m.saison === saisonFilter));
    const bySaison = {};
    matches.forEach(m => {
      const key = m.saison || 'N/A';
      if (!bySaison[key]) bySaison[key] = { buts: [], date: m.created_at };
      bySaison[key].buts.push({ total: Number(m.score_home) + Number(m.score_away), journee: Number(m.journee) || 0 });
      if (new Date(m.created_at) < new Date(bySaison[key].date)) bySaison[key].date = m.created_at;
    });
    for (const s of Object.values(bySaison)) s.buts.sort((a,b) => a.journee - b.journee);
    return Object.entries(bySaison).sort(([,a],[,b]) => new Date(b.date) - new Date(a.date));
  }

  function renderTeamCard(team, saisonFilter) {
    const lvl = getTeamLevel(team);
    const lvlMap = { fort:['level-fort','● Fort'], moyen:['level-moyen','● Moyen'], faible:['level-faible','● Faible'] };
    const [lvlCls, lvlLabel] = lvl ? lvlMap[lvl] : ['', ''];
    const seasons = buildTeamHistory(team, saisonFilter);
    if (seasons.length === 0) return '';

    const seasonsHtml = seasons.map(([saison, { buts, date }], idx) => {
      const isCurrent = saison === currentSaison;
      let sep = '';
      if (idx > 0) {
        const prevDay = seasons[idx-1][1].date ? new Date(seasons[idx-1][1].date).toDateString() : null;
        const currDay = date ? new Date(date).toDateString() : null;
        if (prevDay !== currDay) sep = '<hr class="th-separator">';
      }
      return `${sep}<div class="th-row${isCurrent?' th-row-current':''}">
        <span class="th-saison">${escHtml(saison)} <em class="th-date">(${fmtDate(date)})</em>${isCurrent?' <span class="th-current-tag">en cours</span>':''}</span>
        <div class="th-buts-list">${buts.map(b=>`<span class="th-but-badge">${b.total}</span>`).join('')}</div>
      </div>`;
    }).join('');

    return `<div class="be-card">
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
    const html = TEAMS.filter(t => t !== refTeam).filter(t => !search || t.toLowerCase().includes(search))
      .map(t => renderTeamCard(t, saisonFilter)).filter(Boolean).join('');
    document.getElementById('beGrid').innerHTML = html || '<p class="stats-empty">Aucune donnée disponible.</p>';
  }
}

main();
