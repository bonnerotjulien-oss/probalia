/** Match-level observable statistics. Never infer event types from aggregated data. */
import {teamKey} from './freshness.js';
export const TEAM_STATS_VERSION=1;
const metrics=['shots','onTarget','corners','goals'];
const validDate=s=>/^20\d{2}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'));
const validInt=n=>n===null||(Number.isInteger(n)&&n>=0&&n<=100);
const diffDays=(a,b)=>(Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000;
export function normalizeTeamMatches(rows,now=new Date()){
  const dateNow=now.toISOString().slice(0,10),found=new Map();
  for(const row of rows||[]){
    if(!validDate(row.date)||row.date>dateNow||!teamKey(row.home)||!teamKey(row.away)||teamKey(row.home)===teamKey(row.away))continue;
    if(!metrics.every(k=>validInt(row.homeStats?.[k])&&validInt(row.awayStats?.[k])))continue;
    if(!Number.isInteger(row.homeStats?.goals)||!Number.isInteger(row.awayStats?.goals))continue;
    if(row.homeStats.onTarget!==null&&row.homeStats.shots!==null&&row.homeStats.onTarget>row.homeStats.shots)continue;
    if(row.awayStats.onTarget!==null&&row.awayStats.shots!==null&&row.awayStats.onTarget>row.awayStats.shots)continue;
    const id=[row.date,teamKey(row.home),teamKey(row.away)].join('|');
    found.set(id,{date:row.date,season:String(row.season||''),home:teamKey(row.home),away:teamKey(row.away),homeStats:row.homeStats,awayStats:row.awayStats});
  }
  return {version:TEAM_STATS_VERSION,fetchedAt:now.toISOString(),source:'football-data.co.uk match statistics, where available',matches:[...found.values()].sort((a,b)=>a.date.localeCompare(b.date))};
}
export function teamProfile(feed,team,atDate,{windowDays=150,maxMatches=12,minMatches=4}={}){
  if(feed?.version!==TEAM_STATS_VERSION||!Array.isArray(feed.matches)||!validDate(atDate))return {ready:false,reason:'Base statistique absente.'};
  const name=teamKey(team);
  const records=feed.matches.filter(m=>m.date<atDate&&diffDays(m.date,atDate)<=windowDays&&diffDays(m.date,atDate)>=0&&(m.home===name||m.away===name))
    .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,maxMatches);
  if(records.length<minMatches)return {ready:false,reason:`Moins de ${minMatches} rencontres récentes`,n:records.length};
  const fields={};
  for(const k of metrics){
    const values=records.map(m=>({for:(m.home===name?m.homeStats:m.awayStats)[k],against:(m.home===name?m.awayStats:m.homeStats)[k]}));
    const avg=side=>{const numbers=values.map(v=>v[side]).filter(Number.isFinite);return numbers.length>=minMatches?{value:numbers.reduce((a,b)=>a+b,0)/numbers.length,n:numbers.length}:null};
    fields[k]={for:avg('for'),against:avg('against')};
  }
  return {ready:true,n:records.length,firstDate:records.at(-1).date,lastDate:records[0].date,metrics:fields};
}
export function compareTeamStats(feed,home,away,date){
  const a=teamProfile(feed,home,date),b=teamProfile(feed,away,date);
  if(!a.ready||!b.ready)return {ready:false,reason:`${home}: ${a.reason||'OK'} ; ${away}: ${b.reason||'OK'}`};
  const metricsCompare=[];
  for(const key of ['shots','onTarget','corners']){
    for(const [attack,defence,side] of [[a,b,'home'],[b,a,'away']]){
      const f=attack.metrics[key]?.for,d=defence.metrics[key]?.against;
      if(!f||!d)continue;
      metricsCompare.push({side,key,attackingAverage:f.value,opponentConcedingAverage:d.value,
        opportunities:(f.value+d.value)/2,supportingMatches:Math.min(f.n,d.n)});
    }
  }
  return {ready:true,home:a,away:b,comparisons:metricsCompare.sort((x,y)=>y.opportunities-x.opportunities)};
}
