import {cleanSeason,chronological,predict,backtest,csv,percent,MODEL_VERSION,chooseProfilePicks,buildSafeCombos} from './model.js';
import {freshnessStatus,mergeVerifiedResults,applyOfficialFixtures,parisDate} from './freshness.js';
import {mountBuilder} from './builder.js';
import {mountAutomaticOdds} from './auto.js';
const $=id=>document.getElementById(id),fmt=n=>percent(n).toFixed(1).replace('.',',')+' %',dec=n=>n.toFixed(2).replace('.',',');
const SEASONS=['2022-23','2023-24','2024-25','2025-26','2026-27'];
const BASE='https://raw.githubusercontent.com/openfootball/football.json/master/';
const today=()=>parisDate(new Date());
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let all=[],upcoming=[],selected=null,bt=null,lastFetched=null,archive=[],dataReady=false;
try{archive=JSON.parse(localStorage.getItem('probalia-v2-journal')||'[]')}catch{}
function status(message,error=false){$('status').textContent=message;$('status-dot').classList.toggle('bad',error)}
async function loadSeason(season){
  const key='probalia-openfootball-'+season;const cached=localStorage.getItem(key);let parsed=null;
  try{const res=await fetch(`${BASE}${season}/fr.1.json`,{cache:'no-store',signal:AbortSignal.timeout(14000)});if(!res.ok)throw Error('HTTP '+res.status);parsed=await res.json();
    try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data:parsed}))}catch{}
  }catch(e){if(cached){const record=JSON.parse(cached);parsed=record.data}else throw Error(`${season} : ${e.message}`)}
  return cleanSeason(parsed,season);
}
function download(name,text,type='text/plain'){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function splitList(){const now=today();upcoming=all.filter(m=>!m.played&&m.date>=now).sort(chronological);const hasRecent=all.filter(m=>m.played&&m.date<=now).sort(chronological);return hasRecent}
function renderList(){const list=upcoming.slice(0,24);$('future').textContent=upcoming.length.toLocaleString('fr-FR');
  if(!list.length){$('match-list').innerHTML='<div class="empty">Aucun match à venir dans la source. Vérifie sa fraîcheur ou actualise les données.</div>';return}
  $('match-list').innerHTML=list.map((m,i)=>{const p=dataReady?predict(m.home,m.away,m.date,all):null;return `<button class="match ${selected?.id===m.id?'active':''}" data-match="${i}"><div class="topline"><span>${escape(new Date(m.date+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',timeZone:'UTC'}))} · ${escape(m.time||'heure inconnue')}</span><span>${escape(m.season)}</span></div><div class="teams"><span>${escape(m.home)}</span><span>${escape(m.away)}</span></div><div class="smallprobs">${!dataReady?'<span>Prédiction suspendue · calendrier indicatif</span>':p?[`1 ${fmt(p.prob[0])}`,`N ${fmt(p.prob[1])}`,`2 ${fmt(p.prob[2])}`].map(x=>`<span>${x}</span>`).join(''):'<span>Données historiques insuffisantes</span>'}</div></button>`}).join('');
  document.querySelectorAll('[data-match]').forEach(b=>b.addEventListener('click',()=>choose(list[Number(b.dataset.match)])));
  if(!selected||!list.some(m=>m.id===selected.id))choose(list[0]);
}
function renderProfiles(){
  if(!dataReady){$('risk-cards').innerHTML='<div class="empty">⛔ Prédictions suspendues : les résultats ou leur synchronisation sont trop anciens. Réessayez après la prochaine mise à jour.</div>';return}
  const entries=upcoming.slice(0,24).map(match=>({match,prediction:predict(match.home,match.away,match.date,all)}));
  const picks=chooseProfilePicks(entries);
  const meta={prudent:{icon:'🛡️',title:'Prudent',description:'Le scénario le plus probable. Gain potentiel souvent faible.'},equilibre:{icon:'⚖️',title:'Équilibré',description:'Un compromis : la probabilité reste supérieure à une chance sur deux.'},audacieux:{icon:'🎯',title:'Audacieux',description:'Un scénario moins fréquent, dont la cote peut être plus élevée.'}};
  $('risk-cards').innerHTML=Object.entries(meta).map(([key,info])=>{
    const pick=picks[key];if(!pick)return `<div class="risk-card ${key}"><div class="risk-head"><span class="risk-icon">${info.icon}</span><span class="risk-name">${info.title}</span></div><p class="risk-desc">${info.description}</p><p class="risk-detail">Aucun marché suffisamment documenté dans cette catégorie.</p></div>`;
    const idx=upcoming.findIndex(m=>m.id===pick.match.id);
    return `<div class="risk-card ${key}"><div class="risk-head"><span class="risk-icon">${info.icon}</span><span class="risk-name">${info.title}</span></div><div class="risk-desc">${info.description}</div><div class="risk-game">${escape(pick.match.home)} – ${escape(pick.match.away)} · ${escape(pick.match.date)} à ${escape(pick.match.time||'heure inconnue')}</div><div class="risk-pick">${escape(pick.label)}</div><div class="risk-percent">${fmt(pick.p)}</div><div class="risk-detail">Cote équitable théorique : <b>${dec(pick.fairOdds)}</b> · Incertitude : ${escape(pick.uncertainty)}. Aucune garantie ni cote bookmaker vérifiée.</div><button class="risk-open" data-open-pick="${idx}">Voir le match et les cotes →</button></div>`;
  }).join('');
  document.querySelectorAll('[data-open-pick]').forEach(button=>button.addEventListener('click',()=>{const m=upcoming[Number(button.dataset.openPick)];if(m){choose(m);document.getElementById('detail').scrollIntoView({behavior:'smooth',block:'start'})}}));
}
function renderCombos(){
  if(!dataReady){$('combo-cards').innerHTML='<div class="empty">⛔ Aucun combiné proposé : fraîcheur des données non confirmée.</div>';return}
  const entries=upcoming.slice(0,24).map(match=>({match,prediction:predict(match.home,match.away,match.date,all)}));
  const choices=buildSafeCombos(entries);
  const names={double:'Double prudente',triple:'Triple prudente',alternative:'Double alternative'};
  $('combo-cards').innerHTML=Object.entries(names).map(([key,title])=>{
    const pick=choices[key];if(!pick)return `<div class="combo-card"><h3>${title}</h3><p class="small">Pas assez de sélections répondant aux critères pour cette combinaison.</p></div>`;
    return `<div class="combo-card"><h3>${title}</h3><div class="combo-legs">${pick.legs.map(l=>`<div class="combo-leg"><div class="combo-match">${escape(l.match.home)} – ${escape(l.match.away)} · ${escape(l.match.date)}</div><strong>${escape(l.label)}</strong><div class="combo-prob">${fmt(l.p)}</div></div>`).join('')}</div><div class="combo-global"><b>${fmt(pick.p)}</b><span class="small">Probabilité conjointe estimée</span></div><div class="combo-odds">Cote équitable théorique : <strong>${dec(pick.fairOdds)}</strong><label for="combo-odd-${key}">Cote combinée réellement proposée<input id="combo-odd-${key}" type="number" min="1.01" step="0.01" placeholder="Saisir la cote totale" data-combo-odds="${key}"></label><div class="combo-ev" id="combo-ev-${key}">Renseigne la cote réelle pour calculer l'EV théorique.</div></div></div>`;
  }).join('');
  document.querySelectorAll('[data-combo-odds]').forEach(input=>input.addEventListener('input',()=>{const key=input.dataset.comboOdds,pick=choices[key],odd=Number(input.value);const label=$('combo-ev-'+key);
    if(!Number.isFinite(odd)||odd<=1){label.textContent='Cote manquante ou invalide.';label.className='combo-ev';return}
    const ev=pick.p*odd-1;label.textContent=`EV théorique : ${ev>=0?'+':''}${fmt(ev)} · sans garantie de rentabilité (modèle non calibré).`;label.className='combo-ev '+(ev>0?'good':'bad');
  }));
}
function lastPredictionRecord(m,p){const key=m.id+'|'+MODEL_VERSION;const record={key,createdAt:new Date().toISOString(),fixtureDate:m.date,fixtureTime:m.time,home:m.home,away:m.away,p1:p.prob[0],pN:p.prob[1],p2:p.prob[2],model:MODEL_VERSION,source:'openfootball/football.json'};
  if(!archive.some(x=>x.key===key)){archive.push(record);try{localStorage.setItem('probalia-v2-journal',JSON.stringify(archive))}catch{}}$('savedCount').textContent=archive.length;
}
const cityLocations=[['Lens',[50.43,2.83]],['Paris',[48.85,2.35]],['Lille',[50.63,3.06]],['Marseille',[43.3,5.38]],['Monaco',[43.73,7.42]],['Rennes',[48.11,-1.68]],['Strasbourg',[48.58,7.75]],['Lyon',[45.76,4.84]],['Toulouse',[43.60,1.44]],['Brest',[48.39,-4.49]],['Nice',[43.70,7.27]],['Angers',[47.47,-.55]],['Lorient',[47.75,-3.37]],['Auxerre',[47.80,3.57]],['Le Mans',[48.00,.20]],['Le Havre',[49.49,.10]],['Troyes',[48.30,4.08]]];
const matchLocation=name=>cityLocations.find(([s])=>name.toLowerCase().includes(s.toLowerCase()))?.[1]||null;
async function weather(m,el){const coords=matchLocation(m.home);if(!coords){el.textContent='Météo indisponible (lieu non reconnu).';return}
  const delta=(Date.parse(m.date+'T12:00:00Z')-Date.now())/86400000;if(delta<0||delta>13){el.textContent='Prévisions météo indisponibles à cette échéance.';return}
  try{const [lat,lon]=coords;const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation,wind_speed_10m&timezone=Europe%2FParis&forecast_days=14`;
    const r=await fetch(url,{signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error('Météo inaccessible');const j=await r.json();const hour=m.time?m.time.slice(0,2):'15';const key=`${m.date}T${hour}:00`;const index=j.hourly.time.indexOf(key);
    if(index<0){el.textContent='Prévision horaire indisponible.';return}
    const temp=j.hourly.temperature_2m[index],rain=j.hourly.precipitation[index],wind=j.hourly.wind_speed_10m[index];el.textContent=`Prévision à proximité de ${m.home} : ${temp} °C · pluie ${rain} mm/h · vent ${wind} km/h. Non intégrée au calcul (impact non calibré).`;
  }catch{el.textContent='Météo indisponible. Aucun ajustement appliqué.'}
}
function choose(m){selected=m;renderListSelection();$('fixture-title').textContent=`${m.home} – ${m.away}`;$('fixture-time').textContent=`${m.date} · ${m.time||'heure non renseignée'}`;
  if(!dataReady){$('detail-content').innerHTML='<div class="empty">⛔ Analyse suspendue : données sportives non actualisées. Le calendrier et les horaires doivent aussi être vérifiés auprès de la ligue.</div>';return}
  const p=predict(m.home,m.away,m.date,all);
  if(!p){$('detail-content').innerHTML='<div class="empty">Historique insuffisant pour produire une prédiction.</div>';return}
  lastPredictionRecord(m,p);const names=['Domicile','Nul','Extérieur'];const max=Math.max(...p.prob);
  $('detail-content').innerHTML=`<div class="fixture-score">${p.prob.map((v,i)=>`<div class="outcome ${v===max?'highlight':''}"><b>${fmt(v)}</b><small>${names[i]}</small></div>`).join('')}</div><div class="context"><h3>Contexte du match</h3><p>Heure locale : <b>${escape(m.time||'non disponible')}</b> · Jours depuis le dernier match de championnat : domicile <b>${p.homeRestDays??'?'}</b>, extérieur <b>${p.awayRestDays??'?'}</b>. Ces valeurs sont descriptives, non utilisées comme coefficients.</p><p id="weather">Recherche de la météo…</p><p>Résultats historiques pris en compte : ${p.historyCount}. Échantillon d'équipe : ${p.homeMatches} / ${p.awayMatches}. Incertitude : <b>${p.uncertainty}</b>. Absences, compositions, arbitrage, fatigue et déplacement européen : non renseignés, aucun ajustement appliqué.</p></div><h3>Scores les plus probables</h3><div class="scores">${p.scores.slice(0,6).map(s=>`<div class="score-row"><b>${s.h}–${s.a}</b><div class="bar"><span style="width:${(s.p/p.scores[0].p*100).toFixed(2)}%"></span></div><span>${fmt(s.p)}</span></div>`).join('')}</div><div class="context"><h3>Marché 1N2 · Cotes décimales facultatives</h3><div class="odds">${['1','N','2'].map(x=>`<label>Cote ${x}<input data-odds="${x}" type="number" min="1.01" step="0.01" placeholder="ex. 2.10"></label>`).join('')}</div><div id="value" class="value">Saisis des cotes pour comparer la valeur théorique. Les estimations ne constituent pas des conseils de mise.</div></div><div class="context"><h3>Hypothèses du moteur</h3><p>Buts moyens λ : ${dec(p.lambdaH)} / ${dec(p.lambdaA)}. Elo : ${Math.round(p.eloHome)} / ${Math.round(p.eloAway)}. Plus de 2,5 buts : ${fmt(p.over)} · Les deux marquent : ${fmt(p.btts)}.</p></div>`;
  weather(m,$('weather'));
  document.querySelectorAll('[data-odds]').forEach(input=>input.addEventListener('input',()=>{let items=Array.from(document.querySelectorAll('[data-odds]')).map((el,i)=>({label:['1','N','2'][i],v:Number(el.value),p:p.prob[i]})).filter(x=>x.v>1&&Number.isFinite(x.v));
    if(!items.length){$('value').textContent='Aucune cote valide.';return}items.forEach(x=>x.ev=x.v*x.p-1);items.sort((a,b)=>b.ev-a.ev);const best=items[0];$('value').innerHTML=`Meilleure valeur mathématique parmi les cotes saisies : ${best.label}, <b class="${best.ev>0?'good':'bad'}">${best.ev>0?'+':''}${fmt(best.ev)}</b>. Cote juste théorique : ${dec(1/best.p)}. <br><b>Attention :</b> cet écart n'est pas validé par une marge d'erreur calibrée ; aucune recommandation automatique.`;
  }));
}
function renderListSelection(){document.querySelectorAll('[data-match]').forEach(b=>{const m=upcoming[Number(b.dataset.match)];b.classList.toggle('active',m?.id===selected?.id)})}
function showBacktest(){const data=all.filter(m=>m.played).sort(chronological);bt=backtest(data,160);$('count').textContent=data.length.toLocaleString('fr-FR');$('nBack').textContent=bt.n;$('loss').textContent=bt.logloss?.toFixed(3)||'—';$('brier').textContent=bt.brier?.toFixed(3)||'—';$('baseLoss').textContent=bt.baseline?.toFixed(3)||'—';$('improvement').textContent=bt.improvement===null?'—':fmt(bt.improvement);$('savedCount').textContent=archive.length}
async function reload(){selected=null;dataReady=false;$('refresh').disabled=true;status('Récupération des saisons et contrôle des résultats…');const loaded=await Promise.allSettled(SEASONS.map(loadSeason));let errors=[];all=[];for(let i=0;i<loaded.length;i++){const l=loaded[i];if(l.status==='fulfilled')all.push(...l.value);else errors.push(l.reason.message)}
  if(!all.length){status('Impossible de charger les données. Vérifie ta connexion.',true);$('refresh').disabled=false;return}
  let feed=null,merged=0;
  try{const res=await fetch('./data/results.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('HTTP '+res.status);feed=await res.json();const mergedResults=mergeVerifiedResults(all,feed);all=mergedResults.matches;merged=mergedResults.merged}
  catch(e){errors.push('Synchronisation quotidienne indisponible : '+e.message)}
  let fixtureFeed=null,fixtureCount=0,fixtureReady=false;
  try{const res=await fetch('./data/fixtures.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('HTTP '+res.status);fixtureFeed=await res.json();const checked=applyOfficialFixtures(all,fixtureFeed);all=checked.matches;fixtureCount=checked.upcoming;fixtureReady=checked.ok}
  catch(e){errors.push('Calendrier officiel indisponible : '+e.message);all=all.filter(m=>m.played||m.season!=='2026-27')}
  all.sort(chronological);lastFetched=new Date();$('updated').textContent='Contrôle : '+lastFetched.toLocaleString('fr-FR');
  const fresh=freshnessStatus(all,new Date(),feed?.fetchedAt);dataReady=fresh.ok&&merged>0&&fixtureReady&&!errors.length;
  splitList();showBacktest();renderList();renderProfiles();renderCombos();mountBuilder(upcoming,all,dataReady);
  let oddsFeed=null;
  try{const res=await fetch('./data/odds.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(res.ok)oddsFeed=await res.json()}
  catch{}
  mountAutomaticOdds(upcoming,all,oddsFeed,dataReady);
  const age=Number.isFinite(fresh.ageDays)?fresh.ageDays+' jour(s)':'inconnu';
  status(`${dataReady?'✓ Résultats et calendrier contrôlés':'⛔ PRONOSTICS SUSPENDUS'} · dernier résultat ${fresh.latest||'inconnu'} (${age}) · ${merged} résultats recoupés · ${fixtureCount} rencontres calendaires · ${fixtureFeed?.fetchedAt?'calendrier '+new Date(fixtureFeed.fetchedAt).toLocaleString('fr-FR'):'calendrier indisponible'}${errors.length?' · '+errors.join(' ; '):''}`,!dataReady);
  $('refresh').disabled=false;
}
$('refresh').addEventListener('click',reload);
$('download').addEventListener('click',()=>{if(bt?.predictions.length)download('PROBALIA-backtest.csv','\ufeff'+csv(bt.predictions),'text/csv;charset=utf-8')});
$('history').addEventListener('click',()=>download('PROBALIA-journal.json',JSON.stringify(archive,null,2),'application/json'));
reload();
