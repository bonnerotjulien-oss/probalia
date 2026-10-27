/** Evidence-backed editorial memory: sources are claims, not measured events. */
import {teamKey} from './freshness.js';
export const INTELLIGENCE_VERSION=2;
const categories=['pressing','setPiece','aerial','transition','buildUp','wide','defence'];
const roles=['strength','weakness','style'];
const evidenceTypes=['measured','reported','hypothesis'];
const validUrl=url=>{try{const u=new URL(url);return u.protocol==='https:'&&Boolean(u.hostname)}catch{return false}};
const currentOrPrevious=(season,atDate)=>{
  const year=Number(String(atDate).slice(0,4)),month=Number(String(atDate).slice(5,7));
  const start=month>=7?year:year-1;
  return season===`${start}-${String(start+1).slice(-2)}`||season===`${start-1}-${String(start).slice(-2)}`;
};
export function validateObservation(o){
  return o&&typeof o.id==='string'&&o.id.length<=120&&o.id.length>0&&
    typeof o.team==='string'&&teamKey(o.team).length>0&&roles.includes(o.role)&&
    categories.includes(o.category)&&evidenceTypes.includes(o.evidenceType)&&
    /^20\d{2}-\d{2}$/.test(o.season)&&/^20\d{2}-\d{2}-\d{2}$/.test(o.observedAt)&&
    validUrl(o.sourceUrl)&&typeof o.claim==='string'&&o.claim.length>=12&&o.claim.length<=320&&
    (o.sampleMatches===undefined||(Number.isInteger(o.sampleMatches)&&o.sampleMatches>=1))&&
    (o.metric===undefined||(o.metric&&typeof o.metric.label==='string'&&o.metric.label.length<=80&&Number.isFinite(o.metric.value)&&typeof o.metric.unit==='string'&&o.metric.unit.length<=24));
}
export function buildIntelligence(observations,now=new Date()){
  const unique=new Map(),limit=now.toISOString().slice(0,10);
  for(const o of observations||[]){
    if(!validateObservation(o)||o.observedAt>limit)continue;
    if(!unique.has(o.id))unique.set(o.id,{id:o.id,team:teamKey(o.team),role:o.role,category:o.category,evidenceType:o.evidenceType,
      claim:o.claim,season:o.season,observedAt:o.observedAt,sourceTitle:String(o.sourceTitle||''),sourceUrl:o.sourceUrl,
      coach:String(o.coach||''),reviewed:Boolean(o.reviewed),sampleMatches:o.sampleMatches??null,
      metric:o.metric??null});
  }
  return {version:INTELLIGENCE_VERSION,updatedAt:now.toISOString(),observations:[...unique.values()]};
}
const daysBetween=(from,to)=>Math.round((Date.parse(`${to}T12:00:00Z`)-Date.parse(`${from}T12:00:00Z`))/86400000);
export function observationsForTeam(feed,team,atDate,coach=''){
  if(feed?.version!==INTELLIGENCE_VERSION||!Array.isArray(feed.observations))return [];
  return feed.observations.filter(o=>o.team===teamKey(team)&&o.observedAt<atDate&&currentOrPrevious(o.season,atDate)&&o.reviewed&&
    daysBetween(o.observedAt,atDate)<=270&&daysBetween(o.observedAt,atDate)>=0&&
    (!o.coach||(coach&&teamKey(coach)===teamKey(o.coach))))
    .sort((a,b)=>b.observedAt.localeCompare(a.observedAt));
}
const sourceCount=observations=>new Set(observations.map(o=>new URL(o.sourceUrl).hostname+new URL(o.sourceUrl).pathname)).size;
export function summarizeEvidence(observations,atDate){
  if(!observations.length)return {level:'indisponible',score:0,sources:0,measured:0,latest:null};
  const sources=sourceCount(observations),measured=observations.filter(o=>o.evidenceType==='measured').length;
  const recency=observations.reduce((sum,o)=>sum+Math.max(0,1-daysBetween(o.observedAt,atDate)/270),0)/observations.length;
  // An evidence coverage indicator, NOT the likelihood of winning a match.
  const score=Math.round(100*(.4*Math.min(sources/3,1)+.35*measured/observations.length+.25*recency));
  return {level:sources>=3&&measured>=2&&recency>.35?'documenté':sources>=2?'partiel':'limité',score,sources,measured,latest:observations[0].observedAt};
}
export function compareStyles(feed,home,away,date,coaches={}){
  const h=observationsForTeam(feed,home,date,coaches.home),a=observationsForTeam(feed,away,date,coaches.away);
  const contrasts=[];
  for(const [attack,defend,side] of [[h,a,'domicile'],[a,h,'extérieur']]){
    for(const strength of attack.filter(o=>o.role==='strength')){
      for(const weakness of defend.filter(o=>o.role==='weakness'&&o.category===strength.category)){
        const independentlySourced=strength.sourceUrl!==weakness.sourceUrl;
        contrasts.push({side,category:strength.category,attack:strength,defence:weakness,
          confidence:independentlySourced&&strength.evidenceType==='measured'&&weakness.evidenceType==='measured'?'deux observations chiffrées':'hypothèse à vérifier'});
      }
    }
  }
  const sharedStrengths=[];
  for(const category of categories){
    const homeStrength=h.find(o=>o.role==='strength'&&o.category===category);
    const awayStrength=a.find(o=>o.role==='strength'&&o.category===category);
    if(homeStrength&&awayStrength)sharedStrengths.push({category,home:homeStrength,away:awayStrength});
  }
  return {home:h,away:a,contrasts,sharedStrengths,coverage:{home:summarizeEvidence(h,date),away:summarizeEvidence(a,date)}};
}
