/** Source-aware football event profiles. Descriptive: never mutates betting probabilities. */
import {teamKey} from './freshness.js';

export const TACTICS_VERSION=1;
export const CHANNELS=Object.freeze(['setPiece','header','counter','openPlay']);
export const LABELS=Object.freeze({setPiece:'Coups de pied arrêtés',header:'Jeu aérien',counter:'Transitions rapides',openPlay:'Jeu placé'});
const safeNumber=n=>Number.isFinite(Number(n))?Number(n):null;
const textName=v=>typeof v==='string'?v:typeof v?.name==='string'?v.name:'';

export function classifyShot(event){
  if(event?.type?.name!=='Shot')return null;
  const pattern=textName(event.play_pattern).toLowerCase();
  const shotType=textName(event.shot?.type).toLowerCase();
  const body=textName(event.shot?.body_part).toLowerCase();
  if(pattern.includes('corner')||pattern.includes('free kick')||shotType.includes('free kick'))return 'setPiece';
  if(body.includes('head'))return 'header';
  if(pattern.includes('counter'))return 'counter';
  return 'openPlay';
}

const emptyStats=()=>({shots:0,goals:0,xg:0,concededShots:0,concededGoals:0,concededXg:0});
const emptyTeam=(name)=>({name,played:0,channels:Object.fromEntries(CHANNELS.map(k=>[k,emptyStats()])),crosses:0,crossAttempts:0,duelsWon:0,duelAttempts:0,lastDate:null});
const isGoal=e=>textName(e.shot?.outcome)==='Goal';

/** Format: [{date:'YYYY-MM-DD',home:'...',away:'...',events:[StatsBomb events]}]
 * All events are attributable to the pre-specified two participants.
 */
export function summarizeTacticalEvents(matches,asOf='9999-12-31'){
  const teams=new Map();let acceptedMatches=0,eventsCount=0;
  const cutoff=Date.parse(asOf+'T12:00:00Z');
  for(const game of (Array.isArray(matches)?matches:[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)))){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(game?.date)||game.date>=asOf||!Array.isArray(game.events))continue;
    // A rolling window prevents old play styles from dominating current profiles.
    if(Number.isFinite(cutoff)&&cutoff-Date.parse(game.date+'T12:00:00Z')>120*86400000)continue;
    const home=teamKey(game.home),away=teamKey(game.away);
    if(!home||!away||home===away)continue;
    const sides=[home,away].map(name=>{if(!teams.has(name))teams.set(name,emptyTeam(name));return teams.get(name)});
    for(const side of sides){side.played++;side.lastDate=game.date}
    acceptedMatches++;
    for(const e of game.events){
      const actor=teamKey(textName(e.team));const idx=actor===home?0:actor===away?1:-1;
      if(idx<0)continue;
      const t=sides[idx],opponent=sides[1-idx];eventsCount++;
      if(textName(e.type)==='Pass'&&e.pass?.cross===true){t.crossAttempts++;if(!e.pass?.outcome)t.crosses++}
      if(textName(e.type)==='Duel'&&textName(e.duel?.type)==='Aerial Lost'){t.duelAttempts++;opponent.duelAttempts++;opponent.duelsWon++}
      const category=classifyShot(e);if(!category)continue;
      const xg=safeNumber(e.shot?.statsbomb_xg)??0,goal=isGoal(e);
      t.channels[category].shots++;t.channels[category].goals+=Number(goal);t.channels[category].xg+=xg;
      opponent.channels[category].concededShots++;opponent.channels[category].concededGoals+=Number(goal);opponent.channels[category].concededXg+=xg;
    }
  }
  return {version:TACTICS_VERSION,source:'StatsBomb-compatible events supplied by operator',
    matches:acceptedMatches,events:eventsCount,teams:Object.fromEntries(teams),hasRecentData:false};
}

export function tacticalMatchup(feed,home,away,atDate){
  if(feed?.version!==TACTICS_VERSION||!feed?.teams)return {ready:false,reason:'Aucune base événementielle vérifiée.'};
  const a=feed.teams[teamKey(home)],b=feed.teams[teamKey(away)];
  if(!a||!b)return {ready:false,reason:'Aucun historique tactique pour au moins une des équipes.'};
  if(a.played<8||b.played<8)return {ready:false,reason:'Échantillon trop faible : au moins huit matchs événementiels par équipe nécessaires.'};
  if(!a.lastDate||!b.lastDate||a.lastDate>=atDate||b.lastDate>=atDate)return {ready:false,reason:'Dates des événements non vérifiées avant la rencontre.'};
  const latest=Date.parse([a.lastDate,b.lastDate].sort()[0]+'T12:00:00Z');
  const date=Date.parse(atDate+'T12:00:00Z');
  if(!Number.isFinite(latest)||!Number.isFinite(date)||date-latest>120*86400000)
    return {ready:false,reason:'Base tactique trop ancienne pour ce match (plus de 120 jours).'};
  const checks=[];
  for(const [att,def,side] of [[a,b,'domicile'],[b,a,'extérieur']]){
    const attacks=CHANNELS.reduce((n,k)=>n+(att.channels[k]?.shots||0),0);
    const conceded=CHANNELS.reduce((n,k)=>n+(def.channels[k]?.concededShots||0),0);
    if(attacks<30||conceded<30)continue;
    for(const key of CHANNELS){
      const pAtt=(att.channels[key]?.shots||0)/attacks;
      const pDef=(def.channels[key]?.concededShots||0)/conceded;
      const index=pAtt*pDef;
      checks.push({side,key,label:LABELS[key],attackingShare:pAtt,concedingShare:pDef,index,
        supportingShots:att.channels[key]?.shots||0,supportingConceded:def.channels[key]?.concededShots||0});
    }
  }
  checks.sort((x,y)=>y.index-x.index);
  return {ready:checks.length>0,reason:checks.length?'Confrontation descriptive des types de tirs : aucun ajustement probabiliste non validé.':'Échantillon insuffisant de tirs par équipe.',
    matches:{home:a.played,away:b.played},lastUpdated:{home:a.lastDate,away:b.lastDate},checks};
}
