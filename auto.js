import {calculateOddsRadar,automaticCombos,currentOdds} from './odds.js';

const $=id=>document.getElementById(id);
const pct=p=>(p*100).toLocaleString('fr-FR',{maximumFractionDigits:1})+' %';
const eur=n=>n.toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:2});
const dec=n=>n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={home:'Victoire domicile',draw:'Match nul',away:'Victoire extérieur'};
let stake=10,radar=[],combos=[];

function render(){
  const box=$('automatic-odds');if(!box)return;
  const positive=radar.filter(x=>x.ev>=.02);
  const caution='<p class="auto-caution">Écart EV théorique seulement : modèle non calibré, aucune garantie de bénéfice. Les cotes peuvent changer avant le pari. Vérifie la disponibilité et les règles de règlement chez le bookmaker.</p>';
  box.innerHTML=`<div class="auto-head"><div><h3>Radar automatique des cotes 1N2</h3><p>Classement calculé à partir des cotes récentes. Aucun bookmaker connecté ne permet de parier depuis PROBALIA.</p></div><span class="auto-chip">${radar.length} cotes comparées</span></div>
    ${!radar.length?'<div class="empty">Aucune cote récente recoupée avec le calendrier. Aucun pari proposé.</div>':
      positive.length?`<div class="auto-list">${positive.slice(0,8).map(x=>`<div class="auto-line"><div><b>${esc(x.fixture.home)} – ${esc(x.fixture.away)}</b><small>${esc(x.fixture.date)} ${esc(x.fixture.time||'')} · ${esc(names[x.market])}</small></div><div><small>Probabilité modèle</small><strong>${pct(x.probability)}</strong></div><div><small>Meilleure cote observée</small><strong>${dec(x.odds)}</strong><small>${esc(x.bookmaker)}</small></div><div><small>Écart théorique</small><strong class="${x.ev>0?'positive':''}">+${pct(x.ev)}</strong></div></div>`).join('')}</div>`:'<div class="empty">Aucune cote présentant un écart théorique supérieur à +2 % actuellement. PROBALIA n’invente pas de sélection.</div>'}
    ${caution}`;
  const panel=$('automatic-combos');if(!panel)return;
  combos=[automaticCombos(radar,2),automaticCombos(radar,3)].filter(Boolean);
  panel.innerHTML=`<div class="auto-head"><div><h3>Combinés pré-calculés</h3><p>Uniquement si plusieurs marchés montrent un écart théorique favorable et que les équipes sont distinctes.</p></div><label class="auto-stake">Mise simulée (€)<input id="auto-stake" type="number" inputmode="decimal" min="0.01" max="100000" step="1" value="${stake}"></label></div>
    ${combos.length?`<div class="auto-ticket-grid">${combos.map((c,i)=>`<article class="auto-ticket"><h4>${i===0?'Double':'Triple'} calculé${i===0?'e':''}</h4><div class="auto-legs">${c.legs.map(l=>`<p><b>${esc(l.fixture.home)} – ${esc(l.fixture.away)}</b><span>${esc(names[l.market])} · ${dec(l.odds)} (${esc(l.bookmaker)})</span></p>`).join('')}</div><div class="auto-numbers"><div><small>Cote combinée</small><b>${dec(c.odds)}</b></div><div><small>Chance estimée</small><b>${pct(c.p)}</b></div><div><small>Retour brut si gagné</small><b data-auto-gross="${i}">${eur(stake*c.odds)}</b></div><div><small>Bénéfice net si gagné</small><b data-auto-net="${i}">${eur(stake*(c.odds-1))}</b></div></div></article>`).join('')}</div>`:'<div class="empty">Aucun combiné ne respecte les critères actuellement. Une sélection automatique n’est pas forcée.</div>'}
    ${caution}`;
  $('auto-stake').addEventListener('input',e=>{const n=Number(e.target.value);stake=Number.isFinite(n)&&n>0&&n<=100000?n:0;combos.forEach((c,i)=>{const gross=document.querySelector(`[data-auto-gross="${i}"]`),net=document.querySelector(`[data-auto-net="${i}"]`);if(gross)gross.textContent=eur(stake*c.odds);if(net)net.textContent=eur(stake*(c.odds-1))})});
}

export function mountAutomaticOdds(upcoming,history,feed,ready){
  const status=$('auto-status');if(!status)return;
  if(!ready||!currentOdds(feed)){
    status.textContent='⛔ Radar désactivé : cotes absentes, trop anciennes ou données sportives non vérifiées.';status.classList.add('bad');
    $('automatic-odds').innerHTML='<div class="empty">Cotes automatiques indisponibles : aucune recommandation.</div>';
    $('automatic-combos').innerHTML='<div class="empty">Combinés automatiques suspendus.</div>';return;
  }
  radar=calculateOddsRadar(upcoming,history,feed);
  const at=new Date(feed.fetchedAt).toLocaleString('fr-FR');status.textContent=`Cotes 1N2 · Europe · relevé ${at} · ${radar.length} marchés recoupés · crédits API restants : ${Number.isFinite(feed.remainingCredits)?feed.remainingCredits:'non disponible'}`;status.classList.remove('bad');
  render();
}
