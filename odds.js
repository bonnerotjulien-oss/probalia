import {teamKey,parisDate} from './freshness.js';
import {predict} from './model.js';

export function currentOdds(feed,now=new Date()){
  if(!feed||!Array.isArray(feed.events)||!Number.isFinite(Date.parse(feed.fetchedAt)))return false;
  const age=(now-new Date(feed.fetchedAt))/3600000;
  return age>=0&&age<=18;
}

export function calculateOddsRadar(upcoming,history,feed,now=new Date(),predictor=(h,a,d)=>predict(h,a,d,history)){
  if(!currentOdds(feed,now))return [];
  const marketKey={home:0,draw:1,away:2};
  const result=[];
  for(const fixture of upcoming){
    const oddsEvent=feed.events.find(e=>{
      if(teamKey(e.home)!==teamKey(fixture.home)||teamKey(e.away)!==teamKey(fixture.away))return false;
      const timestamp=Date.parse(e.commenceTime);if(!Number.isFinite(timestamp))return false;
      const date=parisDate(new Date(timestamp));
      const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(timestamp));
      return date===fixture.date&&(!fixture.time||Math.abs(Number(time.slice(0,2))*60+Number(time.slice(3,5))-Number(fixture.time.slice(0,2))*60-Number(fixture.time.slice(3,5)))<=90);
    });
    if(!oddsEvent)continue;
    const prediction=predictor(fixture.home,fixture.away,fixture.date);
    if(!prediction||prediction.homeMatches<6||prediction.awayMatches<6)continue;
    for(const [market,index] of Object.entries(marketKey)){
      const quote=oddsEvent.best?.[market];if(!quote||!Number.isFinite(quote.price)||quote.price<=1||!Number.isFinite(Date.parse(quote.updatedAt)))continue;
      const minutes=(now-new Date(quote.updatedAt))/60000;
      if(minutes<0||minutes>24*60)continue;
      const p=prediction.prob[index];
      const marketProbability=oddsEvent.consensus?.probabilities?.[market];
      result.push({fixture,market,probability:p,odds:quote.price,bookmaker:quote.bookmaker,updatedAt:quote.updatedAt,ev:p*quote.price-1,fairOdds:1/p,
        marketProbability:Number.isFinite(marketProbability)?marketProbability:null,bookmakerCount:oddsEvent.consensus?.bookmakers??null});
    }
  }
  return result.sort((a,b)=>b.ev-a.ev);
}

export function automaticCombos(opportunities,size=2){
  // Only independent-club tickets; require value estimates to be positive and 1N2 p >= 40%.
  const pool=opportunities.filter(o=>o.probability>=.4&&o.ev>=.02).sort((a,b)=>b.ev-a.ev);
  const chosen=[],used=new Set();
  for(const pick of pool){
    if(used.has(pick.fixture.home)||used.has(pick.fixture.away))continue;
    chosen.push(pick);used.add(pick.fixture.home);used.add(pick.fixture.away);
    if(chosen.length>=size)break;
  }
  if(chosen.length<size)return null;
  return {legs:chosen,odds:chosen.reduce((v,x)=>v*x.odds,1),p:chosen.reduce((v,x)=>v*x.probability,1),ev:chosen.reduce((v,x)=>v*x.odds,1)*chosen.reduce((v,x)=>v*x.probability,1)-1};
}
