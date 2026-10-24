import {predict,MARKET_LABELS} from './model.js';

const marketKeys=['1X','X2','12','home','draw','away','over05','over15','over25','under25','under45','bttsYes','bttsNo','homeScore','awayScore'];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>Number.isFinite(n)?n.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const pct=n=>Number.isFinite(n)?(n*100).toLocaleString('fr-FR',{maximumFractionDigits:1})+' %':'—';
const initialLine=()=>({match:'',market:'1X',odds:''});
let lines=[initialLine(),initialLine()],stake=10,fixtures=[],results=[],ready=false,ranked=[],priceInputs={};

export function simulateTicket(legs,stakeValue){
  const valid=legs.length>=2&&legs.every(x=>Number.isFinite(x.p)&&x.p>0&&x.p<=1&&Number.isFinite(x.odds)&&x.odds>1);
  const value=Number(stakeValue);
  if(!valid||!Number.isFinite(value)||value<=0)return null;
  const odds=legs.reduce((a,l)=>a*l.odds,1),probability=legs.reduce((a,l)=>a*l.p,1);
  return {odds,probability,gross:value*odds,net:value*(odds-1),expectedValue:probability*odds-1,expectedNet:value*(probability*odds-1),breakEvenProbability:1/odds};
}

function entries(){return fixtures.map(match=>({match,prediction:predict(match.home,match.away,match.date,results)})).filter(x=>x.prediction)}
function options(){return fixtures.slice(0,30).map(m=>`<option value="${esc(m.id)}">${esc(m.home)} – ${esc(m.away)} · ${esc(m.date)} ${esc(m.time||'')}</option>`).join('')}
function marketOptions(){return marketKeys.map(k=>`<option value="${k}">${esc(MARKET_LABELS[k])}</option>`).join('')}
function rankedOpportunities(){
  const candidates=[];
  for(const {match,prediction} of entries())for(const key of marketKeys){const p=prediction.markets[key];if(p>=.08&&p<.99)candidates.push({match,market:key,p,fairOdds:1/p})}
  candidates.sort((a,b)=>b.p-a.p);
  // One clear candidate per match, to avoid giving five near-identical markets on the same game.
  const used=new Set();ranked=[];
  for(const candidate of candidates){if(used.has(candidate.match.id))continue;used.add(candidate.match.id);ranked.push(candidate);if(ranked.length===10)break}
}

function renderQuoteCompare(){
  const node=document.getElementById('quote-compare');if(!node)return;
  if(!ready){node.innerHTML='<div class="empty">Comparateur suspendu : données insuffisamment fraîches.</div>';return}
  node.innerHTML=`<p class="value-explanation">Les <b>cotes équitables</b> ci-dessous sont calculées par PROBALIA, elles ne sont pas des prix disponibles à la vente. Saisis une cote réellement affichée chez ton bookmaker pour comparer. Nous mettons alors les écarts théoriques en évidence.</p><div class="quote-grid">${ranked.map((c,i)=>`<div class="quote-item"><div><span>${esc(c.match.home)} – ${esc(c.match.away)}</span><strong>${esc(MARKET_LABELS[c.market])}</strong><small>Probabilité modèle : ${pct(c.p)} · cote équitable : ${number(c.fairOdds)}</small></div><label>Cote observée<input data-quote="${i}" type="number" inputmode="decimal" step="0.01" min="1.01" placeholder="Ex. 1.90" value="${esc(priceInputs[c.match.id+'|'+c.market]||'')}"></label><div class="quote-status" id="quote-status-${i}">—</div></div>`).join('')}</div><p class="builder-disclaimer">Le classement des écarts dépend entièrement des cotes que tu saisis. Un écart positif n'est pas une preuve de rentabilité : les probabilités restent expérimentales et non calibrées.</p>`;
  node.querySelectorAll('[data-quote]').forEach(el=>el.addEventListener('input',()=>{const i=Number(el.dataset.quote);priceInputs[ranked[i].match.id+'|'+ranked[i].market]=el.value;updateQuotes()}));
  updateQuotes();
}
function updateQuotes(){
  let values=[];
  for(let i=0;i<ranked.length;i++){
    const c=ranked[i],odd=Number(String(priceInputs[c.match.id+'|'+c.market]||'').replace(',','.'));
    const out=document.getElementById('quote-status-'+i);if(!out)continue;
    if(!Number.isFinite(odd)||odd<=1){out.textContent='Cote absente';out.className='quote-status';continue}
    const ev=odd*c.p-1;values.push({i,ev});out.textContent=(ev>=0?'+':'')+pct(ev);out.className='quote-status '+(ev>0?'good':'bad');
  }
  values.sort((a,b)=>b.ev-a.ev);
  for(let i=0;i<ranked.length;i++){const row=document.getElementById('quote-status-'+i)?.closest('.quote-item');if(row)row.style.order=values.findIndex(x=>x.i===i)>=0?String(values.findIndex(x=>x.i===i)):'99'}
}

function display(){
  const host=document.getElementById('custom-builder');if(!host)return;
  if(!ready){host.innerHTML='<div class="empty">🔒 Combinés personnalisés suspendus jusqu’à validation des résultats ET du calendrier officiel.</div>';return}
  const list=options(),markets=marketOptions();
  host.innerHTML=`<div class="builder-title"><div><h3>Mon combiné</h3><p>Compose ton ticket, entre les cotes proposées par ton bookmaker, puis compare le gain et la probabilité estimée.</p></div><span class="builder-count">${lines.length} sélections</span></div>
    <div id="builder-legs">${lines.map((line,i)=>`<div class="builder-leg"><span class="builder-index">${i+1}</span><label>Rencontre<select data-fixture="${i}"><option value="">Choisir un match</option>${list}</select></label><label>Marché<select data-market="${i}">${markets}</select></label><label>Cote bookmaker<input type="number" min="1.01" max="1000" step="0.01" inputmode="decimal" placeholder="Ex. 1,85" data-odd="${i}" value="${esc(line.odds)}"></label><button class="builder-remove" data-remove="${i}" aria-label="Retirer cette sélection" title="Retirer">×</button></div>`).join('')}</div>
    <div class="builder-footer"><button class="secondary" id="add-leg" ${lines.length>=5?'disabled':''}>+ Ajouter une sélection</button><label>Mise simulée (€)<input id="stake" type="number" min="0.01" max="100000" step="0.5" inputmode="decimal" value="${stake}"></label></div>
    <div id="ticket-result" class="ticket-result"></div><div class="builder-disclaimer">Cotes exclusivement saisies par toi. Probabilités théoriques non calibrées ; indépendance supposée entre rencontres. Le simulateur ne place aucun pari.</div>`;
  host.querySelectorAll('[data-fixture]').forEach(el=>{const i=Number(el.dataset.fixture);el.value=lines[i].match;el.addEventListener('change',()=>{lines[i].match=el.value;compute()})});
  host.querySelectorAll('[data-market]').forEach(el=>{const i=Number(el.dataset.market);el.value=lines[i].market;el.addEventListener('change',()=>{lines[i].market=el.value;compute()})});
  host.querySelectorAll('[data-odd]').forEach(el=>{const i=Number(el.dataset.odd);el.addEventListener('input',()=>{lines[i].odds=el.value;compute()})});
  host.querySelectorAll('[data-remove]').forEach(el=>el.addEventListener('click',()=>{if(lines.length<=2)return;lines.splice(Number(el.dataset.remove),1);display()}));
  document.getElementById('add-leg').addEventListener('click',()=>{if(lines.length<5){lines.push(initialLine());display()}});
  document.getElementById('stake').addEventListener('input',e=>{stake=e.target.value;compute()});
  compute();
}

function compute(){
  const out=document.getElementById('ticket-result');if(!out)return;
  const chosen=lines.map(l=>fixtures.find(m=>m.id===l.match)).filter(Boolean);
  if(chosen.length!==lines.length){out.innerHTML='<p>Sélectionne au moins deux rencontres pour commencer.</p>';return}
  const clubs=chosen.flatMap(m=>[m.home,m.away]);if(new Set(clubs).size!==clubs.length){out.innerHTML='<p class="bad">Choisis des rencontres avec des équipes différentes pour limiter les dépendances.</p>';return}
  const legs=lines.map((l,i)=>({p:predict(chosen[i].home,chosen[i].away,chosen[i].date,results)?.markets[l.market],odds:Number(String(l.odds).replace(',','.'))}));
  const sim=simulateTicket(legs,stake);
  if(!sim){out.innerHTML='<p>Renseigne une cote réelle supérieure à 1 pour chaque sélection, puis une mise positive.</p>';return}
  const positive=sim.expectedValue>0;
  out.innerHTML=`<div class="ticket-metrics"><div><small>Cote totale</small><strong>${number(sim.odds)}</strong></div><div><small>Gain brut si gagné</small><strong>${number(sim.gross)} €</strong></div><div><small>Bénéfice net si gagné</small><strong>${number(sim.net)} €</strong></div><div><small>Probabilité du combiné (modèle)</small><strong>${pct(sim.probability)}</strong></div><div><small>Seuil de rentabilité de la cote</small><strong>${pct(sim.breakEvenProbability)}</strong></div><div><small>Écart théorique du modèle</small><strong class="${positive?'good':'bad'}">${positive?'+':''}${pct(sim.expectedValue)}</strong></div></div><p class="builder-disclaimer">${positive?'Cote supérieure à la cote équitable estimée, selon notre modèle expérimental.':'Cote inférieure ou égale à la cote équitable estimée.'} Ce calcul ne prouve pas un avantage réel sur le bookmaker.</p>`;
}

export function mountBuilder(upcoming,all,dataReady){fixtures=upcoming;results=all;ready=dataReady;rankedOpportunities();display();renderQuoteCompare()}
