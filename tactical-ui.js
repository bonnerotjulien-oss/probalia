import {tacticalMatchup,LABELS} from './tactics.js';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=n=>(100*n).toFixed(1).replace('.',',')+' %';

export async function mountTactics(fixtures){
  const node=document.getElementById('tactical-content');if(!node)return;
  let feed=null;
  try{const r=await fetch('./data/tactics.json',{cache:'no-store',signal:AbortSignal.timeout(9000)});if(r.ok)feed=await r.json()}catch{}
  if(!feed?.teams||!Object.keys(feed.teams).length){
    node.innerHTML='<div class="empty">Aucune donnée événementielle récente et autorisée n’est encore intégrée. Les scores seuls ne permettent pas d’identifier les faiblesses sur corners, jeu aérien ou transitions. Les probabilités restent inchangées.</div>';
    return;
  }
  const candidates=fixtures.slice(0,20).map(match=>({match,report:tacticalMatchup(feed,match.home,match.away,match.date)}));
  const active=candidates.filter(r=>r.report.ready);
  if(!active.length){node.innerHTML='<div class="empty">Base tactique disponible, mais aucune confrontation actuelle validée : équipes absentes, échantillon insuffisant ou données de plus de 120 jours. Aucun ajustement probabiliste.</div>';return}
  node.innerHTML=`<p class="tactical-note">${active.length} rencontre(s) avec données tactiques suffisamment récentes. Ces indices comparent les types de tirs créés et concédés ; ce ne sont pas des probabilités de victoire.</p><div class="tactical-picker">${active.slice(0,8).map(({match},i)=>`<button type="button" class="tactical-select" data-tactical="${i}">${esc(match.home)} – ${esc(match.away)}</button>`).join('')}</div><div id="tactical-detail"></div>`;
  function display(i){
    const item=active[i];if(!item)return;
    const best=item.report.checks.slice(0,4);
    document.getElementById('tactical-detail').innerHTML=`<h3>${esc(item.match.home)} – ${esc(item.match.away)}</h3><p class="tactical-note">Matchs documentés : ${item.report.matches.home} / ${item.report.matches.away}. Derniers événements : ${esc(item.report.lastUpdated.home)} / ${esc(item.report.lastUpdated.away)}.</p><div class="tactical-grid">${best.map(c=>`<div class="tactical-card"><small>Attaque ${c.side}</small><strong>${esc(LABELS[c.key])}</strong><span>${fmt(c.attackingShare)} des tirs de cette équipe · ${fmt(c.concedingShare)} des tirs subis par l’adversaire</span><small>Échantillons : ${c.supportingShots} tirs offensifs · ${c.supportingConceded} tirs concédés</small></div>`).join('')}</div><p class="tactical-note">Croisement descriptif, sans coefficient arbitraire ajouté aux probabilités 1/N/2 ou aux scores exacts.</p>`;
  }
  node.querySelectorAll('[data-tactical]').forEach(button=>button.addEventListener('click',()=>display(Number(button.dataset.tactical))));display(0);
}
