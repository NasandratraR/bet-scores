function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function main() {
  const params   = new URLSearchParams(location.search);
  const leagueId = params.get('league');
  if (!leagueId) { location.href = 'index.html'; return; }

  const [leagueRes, matchRes] = await Promise.all([
    fetch(`/api/leagues/${leagueId}`),
    fetch(`/api/matches?league_id=${leagueId}`),
  ]);
  const leagueData    = await leagueRes.json();
  const all           = await matchRes.json();
  const currentSaison = leagueData.current_saison || '';
  const refTeam       = leagueData.ref_team || '';

  document.querySelector('.header-sub').innerHTML =
    `<a href="index.html" class="league-back-link">← Ligues</a> <span class="header-sep">|</span> ${escHtml(leagueData.name)} — Répartition buts`;
  document.querySelectorAll('a.nav-link[href]').forEach(a => {
    const url = new URL(a.href, location.href);
    if (!url.pathname.endsWith('index.html')) { url.searchParams.set('league', leagueId); a.href = url.pathname + url.search; }
  });

  document.getElementById('repRefLabel').textContent = refTeam;

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  }

  function renderGoalsGrid(matches, teamName) {
    const groups = {};
    for (let i = 0; i <= 6; i++) groups[i] = [];
    matches.forEach(m => { const t = Number(m.score_home)+Number(m.score_away); if (t<=6 && m.journee) groups[t].push(Number(m.journee)); });
    for (let i = 0; i <= 6; i++) groups[i].sort((a,b)=>a-b);
    const maxRows = Math.max(...Object.values(groups).map(g=>g.length), 1);
    const maxJ    = Math.max(...matches.map(m=>Number(m.journee)||0));
    let html = `<table class="goals-grid-table"><thead>
      <tr><th colspan="7" class="goals-grid-title">${escHtml(teamName)}</th></tr>
      <tr>${[0,1,2,3,4,5,6].map(i=>`<th class="goals-grid-col">${i}</th>`).join('')}</tr>
      </thead><tbody>`;
    for (let r = 0; r < maxRows; r++) {
      html += '<tr>';
      for (let c = 0; c <= 6; c++) {
        const val = groups[c][r];
        const dcls = val==null?'':val<=9?' jd-1':val<=19?' jd-2':val<=29?' jd-3':' jd-4';
        html += `<td class="goals-grid-cell${dcls}${val===maxJ?' goals-grid-last':''}">${val!=null?val:''}</td>`;
      }
      html += '</tr>';
    }
    return html + '</tbody></table>';
  }

  const bySaison = {};
  all.forEach(m => {
    const key = m.saison || 'N/A';
    if (!bySaison[key]) bySaison[key] = { matches: [], minDate: m.created_at };
    bySaison[key].matches.push(m);
    if (new Date(m.created_at) < new Date(bySaison[key].minDate)) bySaison[key].minDate = m.created_at;
  });

  const seasons = Object.entries(bySaison).sort(([,a],[,b]) => new Date(b.minDate) - new Date(a.minDate));

  if (seasons.length === 0) {
    document.getElementById('repGrid').innerHTML = '<p class="stats-empty">Aucune donnée disponible.</p>';
    return;
  }

  document.getElementById('repGrid').innerHTML = seasons.map(([saison, { matches, minDate }]) => `
    <div class="rep-card">
      <div class="rep-card-header">
        <span class="rep-saison-name">${escHtml(saison)}</span>
        <em class="th-date">(${fmtDate(minDate)})</em>
        ${saison === currentSaison ? '<span class="th-current-tag">en cours</span>' : ''}
        <span class="rep-match-count">${matches.length} match${matches.length>1?'s':''}</span>
      </div>
      ${renderGoalsGrid(matches, refTeam)}
    </div>`).join('');
}

main();
