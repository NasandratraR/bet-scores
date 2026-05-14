const TEAM_LEVELS = {
  fort:  ['Manchester Blue','Liverpool','Brighton','London Reds','A. Villa','Manchester Red','C Palace'],
  moyen: ['Fulham','Bournemouth','Newcastle','West Ham','Brentford','Wolverhampton','N Forest'],
  faible:['London Blues','Spurs','Burnley','Everton','Sunderlands','Leeds'],
};
function getTeamLevel(name) {
  for (const [lvl, teams] of Object.entries(TEAM_LEVELS)) {
    if (teams.includes(name)) return lvl;
  }
  return null;
}
function levelTag(name) {
  const lvl = getTeamLevel(name);
  if (!lvl) return '';
  const map = { fort: ['level-fort','Ft'], moyen: ['level-moyen','Mo'], faible: ['level-faible','Fb'] };
  const [cls, label] = map[lvl];
  return `<span class="level-badge ${cls}" style="font-size:.62rem;padding:.08rem .3rem">${label}</span>`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const REF_TEAM = 'London Reds';

function resultLabel(m) {
  const sh = Number(m.score_home), sa = Number(m.score_away);
  if (sh === sa) return '<span class="result-badge draw">Nul</span>';

  if (m.team_home === REF_TEAM || m.team_away === REF_TEAM) {
    const refWins = (m.team_home === REF_TEAM && sh > sa) || (m.team_away === REF_TEAM && sa > sh);
    return refWins
      ? '<span class="result-badge win">Gagné</span>'
      : '<span class="result-badge loss">Perdu</span>';
  }

  return sh > sa
    ? '<span class="result-badge win">Domicile</span>'
    : '<span class="result-badge loss">Extérieur</span>';
}

async function loadSaisons() {
  const res  = await fetch('/api/saisons');
  const data = await res.json();
  const container = document.getElementById('saisonsList');

  if (data.length === 0) {
    container.innerHTML = '<p class="histo-empty">Aucune saison enregistrée.</p>';
    return;
  }

  container.innerHTML = data.map(s => `
    <div class="saison-card" data-saison="${escHtml(s.saison || '')}">
      <div class="saison-card-name">${escHtml(s.saison || '—')}</div>
      <div class="saison-card-stats">
        <span class="sc-stat"><strong>${s.total}</strong> matchs</span>
        <span class="sc-stat sc-win">✔ ${s.domicile} dom.</span>
        <span class="sc-stat sc-draw">— ${s.nul} nuls</span>
        <span class="sc-stat sc-loss">✘ ${s.exterieur} ext.</span>
        <span class="sc-stat">⚽ ${s.total_buts} buts</span>
        <span class="sc-stat sc-muted">J${s.j_min}→J${s.j_max}</span>
      </div>
      <span class="saison-card-arrow">›</span>
    </div>
  `).join('');

  document.querySelectorAll('.saison-card').forEach(card => {
    card.addEventListener('click', () => loadDetail(card.dataset.saison));
  });
}

function renderHistoStats(matches) {
  const container = document.getElementById('histoStatsGoals');
  if (!matches.length) { container.innerHTML = '<p class="stats-empty">Aucune donnée.</p>'; return; }

  const counts = {}, lastSeen = {};
  matches.forEach(m => {
    const total = m.score_home + m.score_away;
    counts[total] = (counts[total] || 0) + 1;
    const j = Number(m.journee) || 0;
    if (!lastSeen[total] || j > lastSeen[total]) lastSeen[total] = j;
  });

  const maxJ = Math.max(...matches.map(m => Number(m.journee) || 0));
  const nextJ = maxJ + 1;

  let rows = [];
  for (let i = 0; i <= 6; i++) {
    const count    = counts[i] || 0;
    const pct      = Math.round((count / matches.length) * 100);
    const last     = lastSeen[i];
    const interval = last != null ? nextJ - last - 1 : null;
    rows.push({ goals: i, count, pct, interval });
  }

  const sort = document.getElementById('histoSort').value;
  if (sort === 'interval') rows.sort((a,b) => (b.interval ?? -1) - (a.interval ?? -1));
  else if (sort === 'goals') rows.sort((a,b) => b.count - a.count);

  container.innerHTML = rows.map(r => `
    <div class="stat-row">
      <span class="stat-label">${r.goals}</span>
      <div class="stat-bar-wrap">
        ${r.pct > 0 ? `<div class="stat-bar" style="width:${r.pct}%">
          <span class="stat-pct-in">${r.pct}%</span>
        </div>` : ''}
      </div>
      <span class="stat-pct-out"></span>
      <span class="stat-count">${r.count} match${r.count > 1 ? 's' : ''}</span>
      <span class="stat-interval">${r.interval !== null ? `(il y a ${r.interval} inter.)` : '—'}</span>
    </div>`
  ).join('');
}

function renderHistoGrid(matches) {
  const container = document.getElementById('histoGoalsGrid');
  if (!matches.length) { container.innerHTML = '<p class="stats-empty">Aucune donnée.</p>'; return; }

  const groups = {};
  for (let i = 0; i <= 6; i++) groups[i] = [];
  matches.forEach(m => {
    const total = m.score_home + m.score_away;
    if (total <= 6 && m.journee) groups[total].push(Number(m.journee));
  });
  for (let i = 0; i <= 6; i++) groups[i].sort((a,b) => a - b);

  const maxRows   = Math.max(...Object.values(groups).map(g => g.length));
  const maxJournee = Math.max(...matches.map(m => Number(m.journee) || 0));

  let html = `<table class="goals-grid-table">
    <thead>
      <tr>${[0,1,2,3,4,5,6].map(i => `<th class="goals-grid-col">${i}</th>`).join('')}</tr>
    </thead><tbody>`;

  for (let r = 0; r < maxRows; r++) {
    html += '<tr>';
    for (let c = 0; c <= 6; c++) {
      const val  = groups[c][r];
      const dcls = val == null ? '' : val <= 9 ? ' jd-1' : val <= 19 ? ' jd-2' : val <= 29 ? ' jd-3' : ' jd-4';
      html += `<td class="goals-grid-cell${dcls}${val === maxJournee ? ' goals-grid-last' : ''}">${val != null ? val : ''}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
}

async function loadDetail(saison) {
  const res     = await fetch(`/api/saisons/${encodeURIComponent(saison)}/matches`);
  const matches = await res.json();

  document.getElementById('viewSaisons').classList.add('hidden');
  document.getElementById('viewDetail').classList.remove('hidden');
  document.getElementById('detailTitle').textContent = saison;

  // Stats résumé
  const total   = matches.length;
  const dom     = matches.filter(m => m.score_home > m.score_away).length;
  const ext     = matches.filter(m => m.score_home < m.score_away).length;
  const nul     = matches.filter(m => m.score_home === m.score_away).length;
  const buts    = matches.reduce((s, m) => s + m.score_home + m.score_away, 0);
  const moyButs = total ? (buts / total).toFixed(1) : 0;

  document.getElementById('detailStats').innerHTML = `
    <div class="hstat-box"><div class="hstat-val">${total}</div><div class="hstat-lbl">Matchs</div></div>
    <div class="hstat-box hstat-green"><div class="hstat-val">${dom}</div><div class="hstat-lbl">Victoires dom.</div></div>
    <div class="hstat-box hstat-yellow"><div class="hstat-val">${nul}</div><div class="hstat-lbl">Nuls</div></div>
    <div class="hstat-box hstat-red"><div class="hstat-val">${ext}</div><div class="hstat-lbl">Défaites ext.</div></div>
    <div class="hstat-box"><div class="hstat-val">${buts}</div><div class="hstat-lbl">Total buts</div></div>
    <div class="hstat-box"><div class="hstat-val">${moyButs}</div><div class="hstat-lbl">Moy. buts/match</div></div>
  `;

  // Tableau par journée
  const grouped = {};
  matches.forEach(m => {
    const j = m.journee || '?';
    if (!grouped[j]) grouped[j] = [];
    grouped[j].push(m);
  });

  let html = '';
  Object.keys(grouped).sort((a,b) => Number(a)-Number(b)).forEach(j => {
    grouped[j].forEach((m, i) => {
      html += `<tr${i === 0 ? ' class="journee-first"' : ''}>
        ${i === 0 ? `<td class="td-journee" rowspan="${grouped[j].length}">J${j}</td>` : ''}
        <td><strong>${escHtml(m.team_home)}</strong></td>
        <td class="score-display center">${m.score_home} – ${m.score_away}</td>
        <td><strong>${escHtml(m.team_away)}</strong></td>
        <td class="center">${resultLabel(m)}</td>
        <td class="td-buts center">${m.score_home + m.score_away}</td>
      </tr>`;
    });
  });
  document.getElementById('detailBody').innerHTML = html;

  renderHistoStats(matches);
  renderHistoGrid(matches);

  document.getElementById('histoSort').onchange = () => renderHistoStats(matches);

  // Bouton Résumé
  document.getElementById('histoBtnResume').onclick = () => openHistoResume(matches, saison);
  // Bouton Buts / Équipes
  document.getElementById('histoBtnButs').onclick   = () => openHistoButs(matches, saison);
}

function openHistoResume(matches, saison) {
  const ref = 'London Reds';
  const gagnes = [], nuls = [], perdus = [];
  matches.forEach(m => {
    if (m.team_home !== ref && m.team_away !== ref) return;
    const opponent = m.team_home === ref ? m.team_away : m.team_home;
    const sh = Number(m.score_home), sa = Number(m.score_away);
    const score = `${sh}–${sa}`;
    const leg   = m.team_home === ref ? 'Domicile' : 'Extérieur';
    const entry = { opponent, score, leg, journee: m.journee };
    if (sh === sa) nuls.push(entry);
    else if ((m.team_home === ref && sh > sa) || (m.team_away === ref && sa > sh)) gagnes.push(entry);
    else perdus.push(entry);
  });

  const renderGroup = (list) => list.length === 0
    ? '<p class="resume-empty">Aucun</p>'
    : list.map(e => `
      <div class="resume-row">
        <span class="resume-team">${escHtml(e.opponent)} ${levelTag(e.opponent)}</span>
        <span class="resume-score">${e.score}</span>
        <span class="resume-leg">${e.leg}</span>
        <span class="resume-j">J${e.journee || '?'}</span>
      </div>`).join('');

  document.getElementById('histoResumeTitle').textContent = `Résumé — ${saison}`;
  document.getElementById('histoResumeBody').innerHTML = `
    <div class="resume-cols">
      <div class="resume-section resume-win">
        <div class="resume-section-title">✔ Victoires (${gagnes.length})</div>${renderGroup(gagnes)}
      </div>
      <div class="resume-section resume-draw">
        <div class="resume-section-title">— Nuls (${nuls.length})</div>${renderGroup(nuls)}
      </div>
      <div class="resume-section resume-loss">
        <div class="resume-section-title">✘ Défaites (${perdus.length})</div>${renderGroup(perdus)}
      </div>
    </div>`;
  document.getElementById('histoResumeModal').classList.remove('hidden');
}

function openHistoButs(matches, saison) {
  const ref = 'London Reds';
  const groups = {};
  for (let i = 0; i <= 6; i++) groups[i] = [];
  matches.forEach(m => {
    if (m.team_home !== ref && m.team_away !== ref) return;
    const total    = Number(m.score_home) + Number(m.score_away);
    const opponent = m.team_home === ref ? m.team_away : m.team_home;
    const leg      = m.team_home === ref ? 'Dom.' : 'Ext.';
    if (total <= 6) groups[total].push({ opponent, leg, journee: m.journee });
  });

  const cols = [0,1,2,3,4,5,6].map(i => `
    <div class="buts-col">
      <div class="buts-col-header">${i} but${i>1?'s':''} <span class="buts-count">${groups[i].length}</span></div>
      ${groups[i].length === 0
        ? '<p class="resume-empty">—</p>'
        : groups[i].map(e => `
          <div class="buts-row">
            <span class="buts-team">${escHtml(e.opponent)} ${levelTag(e.opponent)}</span>
            <span class="buts-leg">${e.leg}</span>
            <span class="resume-j">J${e.journee||'?'}</span>
          </div>`).join('')}
    </div>`).join('');

  document.getElementById('histoButsTitle').textContent = `Buts par équipe — ${saison}`;
  document.getElementById('histoButsBody').innerHTML = `<div class="buts-cols">${cols}</div>`;
  document.getElementById('histoButsModal').classList.remove('hidden');
}

document.getElementById('histoResumeClose').addEventListener('click', () => {
  document.getElementById('histoResumeModal').classList.add('hidden');
});
document.getElementById('histoResumeModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});
document.getElementById('histoButsClose').addEventListener('click', () => {
  document.getElementById('histoButsModal').classList.add('hidden');
});
document.getElementById('histoButsModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden');
});

document.getElementById('btnBack').addEventListener('click', () => {
  document.getElementById('viewDetail').classList.add('hidden');
  document.getElementById('viewSaisons').classList.remove('hidden');
});

document.getElementById('btnDelSaison').addEventListener('click', async () => {
  const saison = document.getElementById('detailTitle').textContent;
  if (!confirm(`Supprimer définitivement la saison "${saison}" et tous ses matchs ?`)) return;
  const res = await fetch(`/api/matches/saison/${encodeURIComponent(saison)}`, { method: 'DELETE' });
  if (res.ok) {
    document.getElementById('viewDetail').classList.add('hidden');
    document.getElementById('viewSaisons').classList.remove('hidden');
    loadSaisons();
  }
});

document.getElementById('btnReactiver').addEventListener('click', () => {
  const saison = document.getElementById('detailTitle').textContent;
  if (!confirm(`Remettre "${saison}" en cours ? Elle redeviendra la saison active.`)) return;
  localStorage.setItem('saison_courante', saison);
  window.location.href = 'index.html';
});

loadSaisons();
