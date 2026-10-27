import {compareTeamStats} from './team-stats.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label={shots:'Tirs',onTarget:'Tirs cadrés',corners:'Corners'};
const round=v=>v.toFixed(1).replace('.',',');
export async function mountTeamStats(fixtures){
  const node=document.getElementById('team-stats-content');if(!node)return;
  let feed;try{const r=await fetch('./data/team-stats.json',{cache:'no-store',signal:AbortSignal.timeout(9000)});if(r.ok)feed=await r.json()}catch{}
  if(!Array.isArray(feed?.matches)||!feed.matches.length){node.innerHTML='<p class="tactical-note">La collecte des tirs, tirs cadrés et corners sera remplie par la première exécution de l’action « Statistiques équipes ». Aucune valeur n’est simulée.</p>';return}
  const matches=fixtures.slice(0,25).map(match=>({match,data:compareTeamStats(feed,match.home,match.away,match.date)}));
  const usable=matches.filter(item=>item.data.ready);
  if(!usable.length){node.innerHTML='<p class="tactical-note">Des matchs ont été collectés, mais pas encore quatre matchs récents par équipe pour les rencontres à venir. Analyse suspendue.</p>';return}
  const cards=usable.slice(0,8).map(({match,data})=>{
    const rows=data.comparisons.filter(c=>c.supportingMatches>=4).slice(0,6);
    return `<article class="intel-card"><strong>${esc(match.home)} – ${esc(match.away)}</strong><small>Matchs récents : ${data.home.n} / ${data.away.n} · Dernière observation ${esc(data.home.lastDate)} / ${esc(data.away.lastDate)}</small><div class="stat-grid">${rows.length?rows.map(c=>`<div class="stat-line"><b>${esc(c.side==='home'?match.home:match.away)} · ${esc(label[c.key])}</b><span>Créés : ${round(c.attackingAverage)} / match</span><span>Concédés par l’adversaire : ${round(c.opponentConcedingAverage)} / match</span></div>`).join(''):'<span>Les colonnes tirs et corners ne sont pas disponibles dans les fichiers sources de ces rencontres.</span>'}</div><p>Comparaison des volumes observés, pas d’occasions sur coup franc, de buts de la tête ou de probabilités de victoire.</p></article>`;
  }).join('');
  node.innerHTML=`<p class="tactical-note">Statistiques agrégées de matchs réels, issues de Football-Data lorsque les colonnes existent. Fenêtre glissante : 150 jours et 12 matchs maximum. Chaque rencontre est calculée avec les matchs joués AVANT son coup d’envoi.</p><div class="intel-cards">${cards}</div><p class="tactical-note">Source : <a href="https://www.football-data.co.uk/francem.php" target="_blank" rel="noopener noreferrer">Football-Data</a> · Aucun ajustement automatique du modèle de probabilité.</p>`;
}
