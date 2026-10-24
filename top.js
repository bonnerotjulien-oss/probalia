import {MARKET_LABELS} from './model.js';
import {calculateOddsRadar,currentOdds} from './odds.js';

const $=id=>document.getElementById(id);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=x=>(x*100).toLocaleString('fr-FR',{maximumFractionDigits:1})+' %';
const eur=x=>x.toLocaleString('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const dec=x=>x.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
const MARKETS=['1X','X2','under45','over05','homeScore','awayScore','over15','home','away'];
let selections=[],stake=0.5,quotes={};

/** One high-probability market per distinct fixture, preferably near 88%, not 99% at tiny odds. */
export function selectTopPicks(entries,minProbability=.85,count=3){
  if(!Array.isArray(entries)||minProbability<=0||minProbability>=1)return [];
  const eligible=[];
  for(const {match,prediction} of entries){
    if(!prediction||prediction.homeMatches<14||prediction.awayMatches<14)continue;
    for(const market of MARKETS){
      const p=prediction.markets[market];
      if(Number.isFinite(p)&&p>=minProbability&&p<.995){eligible.push({match,market,label:MARKET_LABELS[market],p,fairOdds:1/p});}
    }
  }
  eligible.sort((a,b)=>Math.abs(a.p-.88)-Math.abs(b.p-.88)||b.p-a.p||String(a.match.date).localeCompare(String(b.match.date)));
  const chosen=[],usedMatches=new Set(),usedTeams=new Set();
  for(const candidate of eligible){
    if(usedMatches.has(candidate.match.id)||usedTeams.has(candidate.match.home)||usedTeams.has(candidate.match.away))continue;
    chosen.push(candidate);usedMatches.add(candidate.match.id);usedTeams.add(candidate.match.home);usedTeams.add(candidate.match.away);
    if(chosen.length===count)break;
  }
  return chosen;
}

export function simulateSingle(p,odds,amount=.5){
  if(!Number.isFinite(p)||p<=0||p>=1||!Number.isFinite(odds)||odds<=1||!Number.isFinite(amount)||amount<=0)return null;
  return {gross:amount*odds,net:amount*(odds-1),ev:p*odds-1,expectedNet:amount*(p*odds-1),threshold:1/p};
}

function updateNumbers(){
  for(let i=0;i<selections.length;i++){
    const p=selections[i].p,number=Number(quotes[i]),result=simulateSingle(p,number,stake),node=$(`top-result-${i}`);
    if(!node)continue;
    if(!result){node.innerHTML=`<span>Indique la cote réellement proposée : seuil théorique de rentabilité <b>${dec(1/p)}</b>.</span>`;continue}
    node.innerHTML=`<div><small>Gain brut si gagné</small><strong>${eur(result.gross)}</strong></div><div><small>Bénéfice net si gagné</small><strong>${eur(result.net)}</strong></div><div><small>Écart théorique</small><strong class="${result.ev>=0?'good':'bad'}">${result.ev>=0?'+':''}${pct(result.ev)}</strong></div><p>${result.ev>=0?'La cote dépasse le seuil du modèle, sans preuve de rendement réel.':'La cote ne compense pas suffisamment le risque selon le modèle.'}</p>`;
  }
  const total=$('top-total');if(total)total.textContent=eur(stake*selections.length);
}

export function mountTopPicks(upcoming,history,oddsFeed,ready,predictor,quality){
  const panel=$('top-picks');if(!panel)return;
  if(!ready){panel.innerHTML='<div class="empty">Top 3 suspendu : résultats ou calendrier non actualisés.</div>';return}
  const first=upcoming[0]?.date;
  const window=upcoming.filter(m=>first&&(Date.parse(m.date+'T12:00:00Z')-Date.parse(first+'T12:00:00Z'))<=7*86400000).slice(0,35);
  selections=selectTopPicks(window.map(match=>({match,prediction:predictor(match.home,match.away,match.date)})),.85,3);
  const radar=currentOdds(oddsFeed)?calculateOddsRadar(window,history,oddsFeed,new Date(),predictor):[];
  const signal=quality?.ready&&quality.modelBeatsBaseline?'Le modèle a dépassé une référence naïve sur le test historique. Cela ne prouve pas un rendement aux cotes réelles.':'⚠ Performance du modèle insuffisante ou non validée : ces scénarios sont exploratoires, pas des paris conseillés.';
  if(!selections.length){panel.innerHTML=`<p class="top-caution">${signal}</p><div class="empty">Aucune sélection à au moins 85 % ne respecte les critères d'historique et de matchs distincts pour les 7 prochains jours. PROBALIA n'invente pas de pari.</div>`;return}
  panel.innerHTML=`<div class="top-toolbar"><div><b>Probabilité modèle ≥ 85 %</b><p>Trois paris simples, jamais présentés comme un combiné à 85 %. Les marchés à cote très faible sont moins privilégiés.</p></div><label>Mise par pari (€)<input id="top-stake" type="number" min="0.01" max="10000" step="0.1" value="${stake}"></label></div>
  <p class="top-caution">${signal} À 85 % de probabilité, le seuil théorique est <b>1,176</b> (soit environ 1,18). En dessous, le rendement mathématique estimé est négatif. Les cotes équitables ne sont pas des offres de bookmakers.</p>
  <div class="top-grid">${selections.map((s,i)=>{
    const live=radar.find(o=>o.fixture.id===s.match.id&&o.market===s.market);
    const saved=quotes[s.match.id+'|'+s.market];
    quotes[i]=saved??(live?String(live.odds):'');
    const source=live?`Cote réelle observée · ${esc(live.bookmaker)} · disponibilité en France non vérifiée`:'Aucune cote réelle disponible pour ce marché : saisis celle de ton bookmaker';
    return `<article class="top-card"><div class="top-card-head"><span class="top-position">${i+1}</span><span class="top-date">${esc(s.match.date)} · ${esc(s.match.time||'heure non confirmée')}</span></div><h3>${esc(s.match.home)} – ${esc(s.match.away)}</h3><b class="top-market">${esc(s.label)}</b><div class="top-core"><div><small>Probabilité estimée</small><strong>${pct(s.p)}</strong></div><div><small>Cote équitable</small><strong>${dec(s.fairOdds)}</strong></div></div><label class="top-quote">Cote proposée <input data-top-odd="${i}" inputmode="decimal" type="number" min="1.01" step="0.01" placeholder="ex. 1,20" value="${esc(quotes[i])}"></label><p class="top-source">${source}</p><div id="top-result-${i}" class="top-result"></div></article>`;
  }).join('')}</div><div class="top-summary">Budget pour ${selections.length} paris simples à cette mise : <strong id="top-total">${eur(stake*selections.length)}</strong>. Si chacun a 85 % de chances, un combiné triple n'aurait qu'environ 61,4 % de réussite sous hypothèse d'indépendance. <b>Aucune mise n'est effectuée.</b></div>`;
  panel.querySelectorAll('[data-top-odd]').forEach(node=>node.addEventListener('input',()=>{const i=Number(node.dataset.topOdd);quotes[i]=node.value;quotes[selections[i].match.id+'|'+selections[i].market]=node.value;updateNumbers()}));
  $('top-stake').addEventListener('input',e=>{const n=Number(e.target.value);stake=Number.isFinite(n)&&n>0&&n<=10000?n:0;updateNumbers()});
  updateNumbers();
}
