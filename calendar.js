import {weekendFixtures,weekendRange} from './weekend.js';

const days=['Vendredi','Samedi','Dimanche','Lundi'];
const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pct=value=>`${(value*100).toFixed(1).replace('.',',')} %`;
const dateAt=(start,index)=>new Date(Date.parse(`${start}T12:00:00Z`)+index*86400000).toISOString().slice(0,10);

/** Pure view data. Indexes always refer to the already filtered weekend fixtures. */
export function calendarDays(fixtures,reference){
  const range=weekendRange(reference);
  if(!range)return [];
  const matches=weekendFixtures(fixtures,reference);
  return days.map((title,index)=>{
    const date=dateAt(range.start,index);
    return {title,date,short:new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`)),matches:matches.filter(match=>match.date===date)};
  });
}

export function mountCalendar(fixtures,reference,ready,predictFor,onOpen){
  const tabs=document.getElementById('calendar-days');
  const list=document.getElementById('calendar-matches');
  const detail=document.getElementById('calendar-preview');
  if(!tabs||!list||!detail)return;
  const grouped=calendarDays(fixtures,reference);
  if(!grouped.length){tabs.replaceChildren();list.innerHTML='<div class="empty">Dates du week-end indisponibles.</div>';detail.hidden=true;return}
  const firstWithGames=grouped.findIndex(day=>day.matches.length);
  let activeDay=Math.max(0,firstWithGames),activeMatch=null;
  const prediction=match=>ready?predictFor(match):null;

  function renderDetail(){
    const match=activeMatch;
    if(!match){detail.hidden=true;return}
    detail.hidden=false;
    const p=prediction(match);
    const outcomes=['Victoire domicile','Match nul','Victoire extérieur'];
    const best=p?p.prob.indexOf(Math.max(...p.prob)):-1;
    detail.innerHTML=`<div class="calendar-preview-top"><div><span class="calendar-label">FICHE DU MATCH</span><h3>${safe(match.home)} <span>–</span> ${safe(match.away)}</h3><p>${safe(match.date)} · ${safe(match.time||'Heure non communiquée')}</p></div><button type="button" class="calendar-dismiss" aria-label="Fermer la fiche">×</button></div>`+
      (!ready?'<p class="calendar-warning">Analyse suspendue : données sportives non actualisées. Calendrier indicatif.</p>':
      !p?'<p class="calendar-warning">Historique insuffisant pour calculer les probabilités de cette rencontre.</p>':
      `<div class="calendar-prob-grid">${p.prob.map((v,i)=>`<div class="calendar-prob ${i===best?'calendar-prob-best':''}"><small>${['1','N','2'][i]}</small><strong>${pct(v)}</strong><span>${outcomes[i]}</span></div>`).join('')}</div>`+
       `<div class="calendar-score-area"><div><small>SCORE EXACT LE PLUS PROBABLE</small><strong>${p.scores[0].h} – ${p.scores[0].a}</strong><span>Probabilité de ce score : ${pct(p.scores[0].p)}</span></div><div><small>AUTRES SCORES POSSIBLES</small>${p.scores.slice(1,4).map(s=>`<span class="calendar-alt-score">${s.h}–${s.a} <b>${pct(s.p)}</b></span>`).join('')}</div></div>`+
       `<div class="calendar-markets"><span>+2,5 buts <b>${pct(p.over)}</b></span><span>Les deux marquent <b>${pct(p.btts)}</b></span></div><p class="calendar-warning">Estimations statistiques, non garanties. Le score exact reste un événement peu probable individuellement.</p>`)+
      '<button type="button" class="calendar-open-detail">Voir l’analyse complète ↗</button>';
    detail.querySelector('.calendar-dismiss').addEventListener('click',()=>{activeMatch=null;renderList();renderDetail()});
    detail.querySelector('.calendar-open-detail').addEventListener('click',()=>onOpen(match));
  }
  function renderList(){
    const current=grouped[activeDay];
    if(!current.matches.length){list.innerHTML='<div class="calendar-empty">Aucune rencontre prévue ce jour.</div>';return}
    list.innerHTML=current.matches.map((match,index)=>{
      const p=prediction(match),score=p?.scores?.[0];
      const selected=activeMatch?.id===match.id;
      return `<button type="button" class="calendar-fixture ${selected?'is-selected':''}" data-calendar-match="${index}" aria-pressed="${selected}"><span class="calendar-kickoff">${safe(match.time||'--:--')}</span><span class="calendar-fixture-teams"><strong>${safe(match.home)}</strong><span>${safe(match.away)}</span></span><span class="calendar-fixture-score">${p&&score?`<b>${score.h}–${score.a}</b><small>Score estimé</small>`:'<small>Analyse indisponible</small>'}</span><span class="calendar-chevron">›</span></button>`;
    }).join('');
    list.querySelectorAll('[data-calendar-match]').forEach(button=>button.addEventListener('click',()=>{
      activeMatch=current.matches[Number(button.dataset.calendarMatch)];renderList();renderDetail();
      if(window.matchMedia('(max-width:680px)').matches)detail.scrollIntoView({behavior:'smooth',block:'nearest'});
    }));
  }
  function renderTabs(){
    tabs.innerHTML=grouped.map((day,index)=>`<button type="button" role="tab" class="calendar-day ${activeDay===index?'active':''}" aria-selected="${activeDay===index}" tabindex="${activeDay===index?'0':'-1'}" data-calendar-day="${index}"><span>${day.title}</span><b>${day.short}</b><small>${day.matches.length} match${day.matches.length>1?'s':''}</small></button>`).join('');
    tabs.querySelectorAll('[data-calendar-day]').forEach(button=>button.addEventListener('click',()=>{
      activeDay=Number(button.dataset.calendarDay);activeMatch=null;renderTabs();renderList();renderDetail();
    }));
  }
  renderTabs();renderList();renderDetail();
}
