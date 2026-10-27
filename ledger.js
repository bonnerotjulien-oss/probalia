/** Persistent, pre-match forecast ledger. Shared by GitHub Actions and the PWA. */
import {teamKey} from './freshness.js';

export const LEDGER_VERSION=1;
export const matchIdentity=(season,home,away)=>[season,teamKey(home),teamKey(away)].join('|');
const validProbabilities=p=>Array.isArray(p)&&p.length===3&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=1)&&Math.abs(p.reduce((a,b)=>a+b,0)-1)<.001;
const validOdds=quote=>quote&&['home','draw','away'].every(k=>Number.isFinite(quote[k])&&quote[k]>1);

export function archiveForecasts(existing,fixtures,now=new Date()){
  const records=Array.isArray(existing)?existing.slice():[];
  const seen=new Set(records.map(r=>r.id));
  let added=0;
  for(const f of fixtures){
    const t=Date.parse(f.scheduledAt),made=now.getTime();
    if(!Number.isFinite(t)||t-made<15*60*1000||!validProbabilities(f.prob))continue;
    const id=matchIdentity(f.season,f.home,f.away);
    if(seen.has(id))continue;
    const entry={id,createdAt:now.toISOString(),scheduledAt:f.scheduledAt,season:f.season,home:f.home,away:f.away,modelVersion:f.modelVersion,
      p1:f.prob[0],pN:f.prob[1],p2:f.prob[2],score:f.score?{home:f.score.h,away:f.score.a,p:f.score.p}:null,
      odds:validOdds(f.odds)?{...f.odds}:null,oddsObservedAt:f.oddsObservedAt||null,result:null};
    records.push(entry);seen.add(id);added++;
  }
  return {records,added};
}

export function settleForecasts(records,completed,now=new Date()){
  const finished=new Map();
  for(const match of completed||[]){
    if(!Number.isInteger(match.hg)||!Number.isInteger(match.ag)||match.hg<0||match.ag<0)continue;
    finished.set(matchIdentity(match.season,match.home,match.away),match);
  }
  let settled=0;
  const updated=records.map(record=>{
    if(record.result)return record;
    const real=finished.get(record.id);
    if(!real||Date.parse(real.date+'T12:00:00Z')>now.getTime())return record;
    // If a match was postponed or the recorded start time was already in the
    // past at prediction time, do not count that record as a valid forecast.
    if(Date.parse(record.createdAt)>=Date.parse(record.scheduledAt))return record;
    settled++;
    return {...record,result:{home:real.hg,away:real.ag,date:real.date,settledAt:now.toISOString()}};
  });
  return {records:updated,settled};
}

export function summarizeForecasts(records){
  const valid=(Array.isArray(records)?records:[]).filter(r=>r.result&&validProbabilities([r.p1,r.pN,r.p2])&&Date.parse(r.createdAt)<Date.parse(r.scheduledAt));
  if(!valid.length)return {n:0,pending:(records||[]).filter(r=>!r.result).length,accuracy:null,scoreAccuracy:null,brier:null,logloss:null,calibration:[],quoted:0,flatProfit:null};
  let hits=0,scoreHits=0,scoreCount=0,brier=0,logloss=0,quoted=0,flatProfit=0;
  const buckets=Array.from({length:5},(_,i)=>({from:i*.2,to:(i+1)*.2,n:0,predicted:0,observed:0}));
  for(const r of valid){
    const outcome=r.result.home>r.result.away?0:r.result.home===r.result.away?1:2;
    const p=[r.p1,r.pN,r.p2],pick=p.indexOf(Math.max(...p));
    hits+=Number(pick===outcome);brier+=p.reduce((total,x,i)=>total+(x-(i===outcome?1:0))**2,0)/3;
    logloss-=Math.log(Math.max(1e-12,p[outcome]));
    if(r.score){scoreCount++;scoreHits+=Number(r.score.home===r.result.home&&r.score.away===r.result.away)}
    const b=buckets[Math.min(4,Math.floor(p[pick]*5))];b.n++;b.predicted+=p[pick];b.observed+=Number(pick===outcome);
    const odds=r.odds&&[r.odds.home,r.odds.draw,r.odds.away];
    if(odds?.every(x=>Number.isFinite(x)&&x>1)){quoted++;flatProfit+=(pick===outcome?odds[pick]:0)-1}
  }
  return {n:valid.length,pending:(records||[]).filter(r=>!r.result).length,accuracy:hits/valid.length,scoreAccuracy:scoreCount?scoreHits/scoreCount:null,
    brier:brier/valid.length,logloss:logloss/valid.length,quoted,flatProfit:quoted?flatProfit:null,
    calibration:buckets.filter(b=>b.n).map(b=>({range:`${Math.round(b.from*100)}–${Math.round(b.to*100)} %`,n:b.n,predicted:b.predicted/b.n,observed:b.observed/b.n}))};
}
