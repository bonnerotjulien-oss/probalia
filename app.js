import {cleanSeason,chronological,predict,csv,percent,MODEL_VERSION,chooseProfilePicks,buildSafeCombos} from './model.js';
import {freshnessStatus,mergeVerifiedResults,applyOfficialFixtures,parisDate} from './freshness.js';
import {mountBuilder,prefillBuilder} from './builder.js';
import {mountAutomaticOdds} from './auto.js';
import {mountTopPicks} from './top.js';
import {auditModel,calibratedPrediction} from './calibration.js';
import {rollingSeasons,currentSeasonTag} from './season.js';
import {weekendFixtures,weekendRange,weekendLabel} from './weekend.js';
import {mountCalendar} from './calendar.js';
const $=id=>document.getElementById(id),fmt=n=>percent(n).toFixed(1).replace('.',',')+' %',dec=n=>n.toFixed(2).replace('.',',');
const SEASONS=rollingSeasons();
const BASE='https://raw.githubusercontent.com/openfootball/football.json/master/';
const today=()=>parisDate(new Date());
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let all=[],upcoming=[],selected=null,bt=null,lastFetched=null,archive=[],dataReady=false,audit=null;
const comboStakes={double:.5,triple:.5,alternative:.5},comboQuotes={},comboSignatures={};
const predictionCache=new Map();
function predictForMatch(m){
  if(predictionCache.has(m.id))return predictionCache.get(m.id);
  const raw=predict(m.home,m.away,m.date,all);
  const result=audit?.validated?calibratedPrediction(raw,audit.calibrator):raw;
  predictionCache.set(m.id,result);return result;
}
const predictFor=(home,away,date)=>predictForMatch({id:`${date}|${home}|${away}`,home,away,date});
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
  $('match-list').innerHTML=list.map((m,i)=>{const p=dataReady?predictForMatch(m):null;return `<button class="match ${selected?.id===m.id?'active':''}" data-match="${i}"><div class="topline"><span>${escape(new Date(m.date+'T12:00:00Z').toLocaleDateString('fr-FR',{day:'numeric',month:'long',timeZone:'UTC'}))} · ${escape(m.time||'heure inconnue')}</span><span>${escape(m.season)}</span></div><div class="teams"><span>${escape(m.home)}</span><span>${escape(m.away)}</span></div><div class="smallprobs">${!dataReady?'<span>Prédiction suspendue · calendrier indicatif</span>':p?[`1 ${fmt(p.prob[0])}`,`N ${fmt(p.prob[1])}`,`2 ${fmt(p.prob[2])}`].map(x=>`<span>${x}</span>`).join(''):'<span>Données historiques insuffisantes</span>'}</div></button>`}).join('');
  document.querySelectorAll('[data-match]').forEach(b=>b.addEventListener('click',()=>choose(list[Number(b.dataset.match)])));
  if(!selected||!list.some(m=>m.id===selected.id))choose(list[0]);
}
function renderProfiles(){
  if(!dataReady){$('risk-cards').innerHTML='<div class="empty">⛔ Prédictions suspendues : les résultats ou leur synchronisation sont trop anciens. Réessayez après la prochaine mise à jour.</div>';return}
  const entries=upcoming.slice(0,24).map(match=>({match,prediction:predictForMatch(match)}));
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
  if(!audit?.ready||!audit.modelBeatsBaseline){$('combo-cards').innerHTML='<div class="empty">⛔ Combinés prudents suspendus : le modèle ne dispose pas d’une performance suffisamment convaincante face à la référence naïve sur son test indépendant. Tu peux toujours simuler un ticket personnel.</div>';return}
  const entries=weekendFixtures(upcoming,today()).map(match=>({match,prediction:predictForMatch(match)}));
  const choices=buildSafeCombos(entries);
  const names={double:'Double du week-end',triple:'Triple du week-end',alternative:'Double alternative'};
  // Never reuse a previously typed bookmaker quote on a different combination.
  for(const key of Object.keys(names)){
    const signature=choices[key]?.legs.map(leg=>`${leg.match.id}:${leg.market}`).join('|')||'';
    if(comboSignatures[key]!==signature){comboQuotes[key]='';comboSignatures[key]=signature}
  }
  const ticket=(key,title)=>{
    const pick=choices[key];if(!pick)return `<div class="combo-card"><h3>${title}</h3><p class="small">Aucune combinaison ne respecte les critères pour ce week-end.</p></div>`;
    return `<article class="combo-card"><div class="combo-card-head"><div><small>${key==='double'?'OPTION PRINCIPALE':'AUTRE SCÉNARIO'}</small><h3>${title}</h3></div><div class="combo-card-number">${fmt(pick.p)}<span>Probabilité estimée</span></div></div><div class="combo-legs">${pick.legs.map(l=>`<div class="combo-leg"><div class="combo-match">${escape(l.match.home)} – ${escape(l.match.away)} · ${escape(l.match.date)} à ${escape(l.match.time||'heure à confirmer')}</div><strong>${escape(l.label)}</strong><span class="combo-prob">${fmt(l.p)} selon le modèle</span></div>`).join('')}</div><div class="combo-footer"><span class="combo-fair">Cote équitable totale : <b>${dec(pick.fairOdds)}</b></span><span class="small">${pick.legs.length} matchs</span></div><details class="combo-sim"><summary>Simuler mon gain</summary><div class="combo-sim-fields"><label for="combo-odd-${key}">Cote réelle du combiné<input id="combo-odd-${key}" data-combo-odds="${key}" type="number" inputmode="decimal" min="1.01" step="0.01" placeholder="Ex. 1,55" value="${escape(comboQuotes[key]||'')}"></label><label for="combo-stake-${key}">Mise (€)<input id="combo-stake-${key}" data-combo-stake="${key}" type="number" inputmode="decimal" min="0.01" max="10000" step="0.1" value="${comboStakes[key]}"></label></div><div class="combo-ev" id="combo-ev-${key}">Renseigne la cote réellement proposée pour connaître le gain possible avec ${comboStakes[key].toFixed(2).replace('.',',')} €.</div></details><button class="combo-personalize" data-make-combo="${key}" type="button">Personnaliser ce ticket ↗</button></article>`;
  };
  const others=Object.entries(names).filter(([key])=>key!=='double'&&choices[key]);
  $('combo-cards').innerHTML=ticket('double',names.double)+(others.length?`<details class="more-combos"><summary>Voir ${others.length===1?'une autre combinaison':`${others.length} autres combinaisons`}</summary><div class="more-combos-list">${others.map(([key,title])=>ticket(key,title)).join('')}</div></details>`:'');
  const update=key=>{
    const p=choices[key]?.p,odd=Number(comboQuotes[key]),amount=Number(comboStakes[key]),target=$('combo-ev-'+key);
    if(!target||!p)return;
    if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(odd)||odd<=1){target.textContent='Indique une cote réelle et une mise positive pour simuler le gain.';target.className='combo-ev';return}
    const gross=amount*odd,net=gross-amount,ev=p*odd-1;
    target.innerHTML=`Si gagné : <strong>${gross.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</strong> brut, dont <strong>${net.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</strong> net. Écart théorique : ${ev>=0?'+':''}${fmt(ev)}. Aucun rendement garanti.`;
    target.className='combo-ev '+(ev>=0?'good':'bad');
  };
  document.querySelectorAll('[data-combo-odds]').forEach(input=>input.addEventListener('input',()=>{const key=input.dataset.comboOdds;comboQuotes[key]=input.value;update(key)}));
  document.querySelectorAll('[data-combo-stake]').forEach(input=>input.addEventListener('input',()=>{const key=input.dataset.comboStake;comboStakes[key]=Number(input.value);update(key)}));
  document.querySelectorAll('[data-make-combo]').forEach(button=>button.addEventListener('click',()=>{const key=button.dataset.makeCombo;prefillBuilder(choices[key].legs,comboStakes[key]);$('advanced-tools').open=true;document.getElementById('custom-combos').scrollIntoView({behavior:'smooth',block:'start'})}));
  for(const key of Object.keys(names))if(choices[key])update(key);
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
  const p=predictForMatch(m);
  if(!p){$('detail-content').innerHTML='<div class="empty">Historique insuffisant pour produire une prédiction.</div>';return}
  lastPredictionRecord(m,p);const names=['Domicile','Nul','Extérieur'];const max=Math.max(...p.prob);
  $('detail-content').innerHTML=`<div class="fixture-score">${p.prob.map((v,i)=>`<div class="outcome ${v===max?'highlight':''}"><b>${fmt(v)}</b><small>${names[i]}</small></div>`).join('')}</div><div class="context"><h3>Contexte du match</h3><p>Heure locale : <b>${escape(m.time||'non disponible')}</b> · Jours depuis le dernier match de championnat : domicile <b>${p.homeRestDays??'?'}</b>, extérieur <b>${p.awayRestDays??'?'}</b>. Ces valeurs sont descriptives, non utilisées comme coefficients.</p><p id="weather">Recherche de la météo…</p><p>Résultats historiques pris en compte : ${p.historyCount}. Échantillon d'équipe : ${p.homeMatches} / ${p.awayMatches}. Incertitude : <b>${p.uncertainty}</b>. Absences, compositions, arbitrage, fatigue et déplacement européen : non renseignés, aucun ajustement appliqué.</p></div><h3>Scores les plus probables</h3><div class="scores">${p.scores.slice(0,6).map(s=>`<div class="score-row"><b>${s.h}–${s.a}</b><div class="bar"><span style="width:${(s.p/p.scores[0].p*100).toFixed(2)}%"></span></div><span>${fmt(s.p)}</span></div>`).join('')}</div><div class="context"><h3>Marché 1N2 · Cotes décimales facultatives</h3><div class="odds">${['1','N','2'].map(x=>`<label>Cote ${x}<input data-odds="${x}" type="number" min="1.01" step="0.01" placeholder="ex. 2.10"></label>`).join('')}</div><div id="value" class="value">Saisis des cotes pour comparer la valeur théorique. Les estimations ne constituent pas des conseils de mise.</div></div><div class="context"><h3>Hypothèses du moteur</h3><p>Buts moyens λ : ${dec(p.lambdaH)} / ${dec(p.lambdaA)}. Elo : ${Math.round(p.eloHome)} / ${Math.round(p.eloAway)}. Plus de 2,5 buts : ${fmt(p.over)} · Les deux marquent : ${fmt(p.btts)}.</p></div>`;
  weather(m,$('weather'));
  document.querySelectorAll('[data-odds]').forEach(input=>input.addEventListener('input',()=>{let items=Array.from(document.querySelectorAll('[data-odds]')).map((el,i)=>({label:['1','N','2'][i],v:Number(el.value),p:p.prob[i]})).filter(x=>x.v>1&&Number.isFinite(x.v));
    if(!items.length){$('value').textContent='Aucune cote valide.';return}items.forEach(x=>x.ev=x.v*x.p-1);items.sort((a,b)=>b.ev-a.ev);const best=items[0];$('value').innerHTML=`Meilleure valeur mathématique parmi les cotes saisies : ${best.label}, <b class="${best.ev>0?'good':'bad'}">${best.ev>0?'+':''}${fmt(best.ev)}</b>. Cote juste théorique : ${dec(1/best.p)}. <br><b>Attention :</b> cet écart n'est pas validé par une marge d'erreur calibrée ; aucune recommandation automatique.`;
  }));
}
function renderListSelection(){document.querySelectorAll('[data-match]').forEach(b=>{const m=upcoming[Number(b.dataset.match)];b.classList.toggle('active',m?.id===selected?.id)})}
function renderWeekendHeading(){const range=weekendRange(today()),games=weekendFixtures(upcoming,today());$('weekend-range').textContent=weekendLabel(range);$('weekend-count').textContent=`${games.length} ${games.length===1?'rencontre':'rencontres'} au calendrier`;return games}
function showBacktest(){const data=all.filter(m=>m.played).sort(chronological);audit=auditModel(data);bt=audit;
  $('count').textContent=data.length.toLocaleString('fr-FR');$('nBack').textContent=audit.n;$('loss').textContent=audit.logloss?.toFixed(3)||'—';$('brier').textContent=audit.brier?.toFixed(3)||'—';$('baseLoss').textContent=audit.baseline?.toFixed(3)||'—';$('improvement').textContent=audit.improvement===null?'—':fmt(audit.improvement);$('savedCount').textContent=archive.length;
  $('rawLoss').textContent=audit.rawLogloss?.toFixed(3)||'—';$('adjustedLoss').textContent=audit.adjustedLogloss?.toFixed(3)||'—';
  $('calibration-status').textContent=audit.ready?`${audit.reason} · ${audit.trainingCount} matchs d'ajustement, ${audit.n} de test (${audit.holdoutStart} → ${audit.holdoutEnd}). ${audit.modelBeatsBaseline?'Modèle devant la référence naïve.':'Modèle non supérieur à la référence naïve : éviter toute interprétation en avantage de pari.'}`:audit.reason;
}
async function reload(){selected=null;dataReady=false;predictionCache.clear();$('refresh').disabled=true;status('Récupération des saisons et contrôle des résultats…');const loaded=await Promise.allSettled(SEASONS.map(loadSeason));let errors=[],warnings=[];all=[];for(let i=0;i<loaded.length;i++){const l=loaded[i];if(l.status==='fulfilled')all.push(...l.value);else if(i===loaded.length-1)warnings.push('Saison courante absente d’OpenFootball : résultats vérifiés utilisés en secours');else errors.push(l.reason.message)}
  if(!all.length){status('Impossible de charger les données. Vérifie ta connexion.',true);$('refresh').disabled=false;return}
  let feed=null,merged=0;
  try{const res=await fetch('./data/results.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('HTTP '+res.status);feed=await res.json();const mergedResults=mergeVerifiedResults(all,feed);all=mergedResults.matches;merged=mergedResults.merged}
  catch(e){errors.push('Synchronisation quotidienne indisponible : '+e.message)}
  let fixtureFeed=null,fixtureCount=0,fixtureReady=false;
  try{const res=await fetch('./data/fixtures.json',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!res.ok)throw Error('HTTP '+res.status);fixtureFeed=await res.json();const checked=applyOfficialFixtures(all,fixtureFeed);all=checked.matches;fixtureCount=checked.upcoming;fixtureReady=checked.ok}
  catch(e){errors.push('Calendrier officiel indisponible : '+e.message);all=all.filter(m=>m.played||m.season!==currentSeasonTag())}
  all.sort(chronological);lastFetched=new Date();$('updated').textContent='Contrôle : '+lastFetched.toLocaleString('fr-FR');
  const fresh=freshnessStatus(all,new Date(),feed?.fetchedAt);dataReady=fresh.ok&&merged>0&&fixtureReady&&!errors.length;
  splitList();const weekend=renderWeekendHeading();status('Validation chronologique et calibration en cours…');showBacktest();renderList();renderProfiles();mountBuilder(upcoming,all,dataReady,predictFor);renderCombos();
  mountCalendar(upcoming,today(),dataReady,predictForMatch,match=>{$('advanced-tools').open=true;choose(match);$('detail').scrollIntoView({behavior:'smooth',block:'start'})});
  let oddsFeed=null;
  try{const res=await fetch('./data/odds.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(res.ok)oddsFeed=await res.json()}
  catch{}
  mountAutomaticOdds(upcoming,all,oddsFeed,dataReady,predictFor,audit);
  mountTopPicks(weekend,all,oddsFeed,dataReady,predictFor,audit);
  const age=Number.isFinite(fresh.ageDays)?fresh.ageDays+' jour(s)':'inconnu';
  status(`${dataReady?'✓ Résultats et calendrier contrôlés':'⛔ PRONOSTICS SUSPENDUS'} · dernier résultat ${fresh.latest||'inconnu'} (${age}) · ${merged} résultats vérifiés · ${fixtureCount} rencontres calendaires · ${fixtureFeed?.fetchedAt?'calendrier '+new Date(fixtureFeed.fetchedAt).toLocaleString('fr-FR'):'calendrier indisponible'}${warnings.length?' · '+warnings.join(' ; '):''}${errors.length?' · '+errors.join(' ; '):''}`,!dataReady);
  $('refresh').disabled=false;
}
$('refresh').addEventListener('click',reload);
$('download').addEventListener('click',()=>{if(bt?.predictions.length)download('PROBALIA-backtest.csv','\ufeff'+csv(bt.predictions),'text/csv;charset=utf-8')});
$('history').addEventListener('click',()=>download('PROBALIA-journal.json',JSON.stringify(archive,null,2),'application/json'));
function revealAdvancedTarget(){const id=decodeURIComponent(location.hash.slice(1)),target=document.getElementById(id);if(target?.closest('#advanced-tools'))$('advanced-tools').open=true}
document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',()=>{const id=link.getAttribute('href').slice(1),target=document.getElementById(id);if(target?.closest('#advanced-tools'))$('advanced-tools').open=true}));
window.addEventListener('hashchange',revealAdvancedTarget);revealAdvancedTarget();
reload();
