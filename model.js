/* PROBALIA: transparent, deterministic scoring model, with separate time-split calibration. */
export const MODEL_VERSION = '4.5.0-walk-forward-audited';
export const SETTINGS = Object.freeze({halfLifeDays:210,priorMatches:9,eloK:18,eloHomeAdvantage:65,eloGoalInfluence:0.10,rho:-0.06,maxGoals:10,minHistory:60});
const DAY=86400000;
export function dayNumber(s){return Date.parse(`${s}T12:00:00Z`)}
export function cleanSeason(input,season,asOf=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())){
  if(!input||!Array.isArray(input.matches))throw Error(`Format inconnu (${season})`);
  return input.matches.map((m,i)=>{
    const ft=m.score?.ft;
    // OpenFootball represents some finished 0-0 draws as score:[0,0], but uses the
    // same shape as a placeholder in future fixtures. A strict past-date cutoff
    // disambiguates these cases conservatively; today's 0-0 remains unresolved.
    const isFinal=Array.isArray(ft)&&ft.length===2&&ft.every(x=>Number.isInteger(x)&&x>=0&&x<=20);
    const zeroDraw=Array.isArray(m.score)&&m.score.length===2&&m.score[0]===0&&m.score[1]===0&&m.date<asOf;
    const played=isFinal||zeroDraw;const result=isFinal?ft:zeroDraw?[0,0]:null;
    return {id:`${season}:${i}`,season,date:m.date,time:/^\d\d:\d\d$/.test(m.time||'')?m.time:null,home:String(m.team1||'').trim(),away:String(m.team2||'').trim(),hg:played?result[0]:null,ag:played?result[1]:null,played};
  }).filter(m=>m.home&&m.away&&Number.isFinite(dayNumber(m.date))&&m.home!==m.away);
}
export const chronological=(a,b)=>dayNumber(a.date)-dayNumber(b.date)||String(a.time||'').localeCompare(String(b.time||''));
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const fact=n=>{let out=1;for(let i=2;i<=n;i++)out*=i;return out};
const poisson=(n,mean)=>Math.exp(-mean)*Math.pow(mean,n)/fact(n);
const percent=(n)=>Math.round(n*1000)/10;
function eloRatings(history,config=SETTINGS){
  const ratings=new Map();
  for(const m of history){const h=ratings.get(m.home)??1500,a=ratings.get(m.away)??1500;
    const p=1/(1+Math.pow(10,(a-h-config.eloHomeAdvantage)/400));const score=m.hg>m.ag?1:m.hg===m.ag?.5:0;
    const delta=config.eloK*(score-p);ratings.set(m.home,h+delta);ratings.set(m.away,a-delta);
  }return ratings;
}
export function predict(home,away,atDate,all,config=SETTINGS){
  const cutoff=dayNumber(atDate);const history=all.filter(m=>m.played&&dayNumber(m.date)<cutoff).sort(chronological);
  if(history.length<config.minHistory)return null;
  let sumH=0,sumA=0,sumW=0;const teams=new Map();
  const get=name=>{if(!teams.has(name))teams.set(name,{hFor:0,hAgainst:0,hW:0,aFor:0,aAgainst:0,aW:0,played:0,last:null});return teams.get(name)};
  for(const m of history){let elapsed=Math.max(0,(cutoff-dayNumber(m.date))/DAY);const w=Math.exp(-Math.LN2*elapsed/config.halfLifeDays);
    sumH+=w*m.hg;sumA+=w*m.ag;sumW+=w;
    const h=get(m.home),a=get(m.away);h.hFor+=w*m.hg;h.hAgainst+=w*m.ag;h.hW+=w;h.played++;h.last=m.date;
    a.aFor+=w*m.ag;a.aAgainst+=w*m.hg;a.aW+=w;a.played++;a.last=m.date;
  }
  const leagueH=sumH/sumW,leagueA=sumA/sumW,prior=config.priorMatches;const H=get(home),A=get(away);
  const smoothed=(goals,weight,league)=>((goals+prior*league)/(weight+prior));
  const homeAttack=smoothed(H.hFor,H.hW,leagueH)/leagueH;
  const awayDefence=smoothed(A.aAgainst,A.aW,leagueH)/leagueH;
  const awayAttack=smoothed(A.aFor,A.aW,leagueA)/leagueA;
  const homeDefence=smoothed(H.hAgainst,H.hW,leagueA)/leagueA;
  const elo=eloRatings(history,config),eDiff=((elo.get(home)??1500)-(elo.get(away)??1500))/400;
  const multiplier=Math.exp(clamp(config.eloGoalInfluence*eDiff,-.35,.35));
  const lambdaH=clamp(leagueH*homeAttack*awayDefence*multiplier,.15,4.4);
  const lambdaA=clamp(leagueA*awayAttack*homeDefence/multiplier,.15,4.4);
  const dcTau=(i,j)=>{const r=config.rho;if(i===0&&j===0)return 1-lambdaH*lambdaA*r;if(i===0&&j===1)return 1+lambdaH*r;if(i===1&&j===0)return 1+lambdaA*r;if(i===1&&j===1)return 1-r;return 1};
  let grid=[],norm=0;for(let i=0;i<=config.maxGoals;i++)for(let j=0;j<=config.maxGoals;j++){const p=poisson(i,lambdaH)*poisson(j,lambdaA)*Math.max(0,dcTau(i,j));grid.push({h:i,a:j,p});norm+=p}
  let win=0,draw=0,loss=0,over=0,btts=0,over05=0,over15=0,under45=0,homeScore=0,awayScore=0,homeAndOver25=0,awayAndOver25=0,homeAndBtts=0,awayAndBtts=0;
  for(const s of grid){s.p/=norm;
    if(s.h>s.a){win+=s.p;if(s.h+s.a>2)homeAndOver25+=s.p;if(s.a>0)homeAndBtts+=s.p}
    else if(s.h===s.a)draw+=s.p;
    else {loss+=s.p;if(s.h+s.a>2)awayAndOver25+=s.p;if(s.h>0)awayAndBtts+=s.p}
    if(s.h+s.a>2)over+=s.p;if(s.h+s.a>1)over15+=s.p;if(s.h+s.a>0)over05+=s.p;if(s.h+s.a<5)under45+=s.p;
    if(s.h>0)homeScore+=s.p;if(s.a>0)awayScore+=s.p;if(s.h&&s.a)btts+=s.p;
  }
  grid.sort((a,b)=>b.p-a.p);
  const daysSince=date=>date===null?null:Math.max(0,Math.floor((cutoff-dayNumber(date))/DAY));
  return {home,away,atDate,lambdaH,lambdaA,prob:[win,draw,loss],over,btts,markets:{'home':win,'draw':draw,'away':loss,'1X':win+draw,'X2':loss+draw,'12':win+loss,'over05':over05,'over15':over15,'over25':over,'under25':1-over,'under45':under45,'bttsYes':btts,'bttsNo':1-btts,'homeScore':homeScore,'awayScore':awayScore,'homeOver25':homeAndOver25,'awayOver25':awayAndOver25,'homeBtts':homeAndBtts,'awayBtts':awayAndBtts},scores:grid.slice(0,8),scoreGrid:grid,historyCount:history.length,homeMatches:H.played,awayMatches:A.played,homeRestDays:daysSince(H.last),awayRestDays:daysSince(A.last),eloHome:elo.get(home)??1500,eloAway:elo.get(away)??1500,uncertainty:(H.played<6||A.played<6)?'élevée':(H.played<14||A.played<14)?'modérée':'non quantifiée',leagueH,leagueA,modelVersion:MODEL_VERSION};
}
export const MARKET_LABELS=Object.freeze({home:'Victoire domicile',draw:'Match nul',away:'Victoire extérieur','1X':'Domicile ou nul','X2':'Extérieur ou nul','12':'Pas de nul',over05:'Plus de 0,5 but',over15:'Plus de 1,5 but',over25:'Plus de 2,5 buts',under25:'Moins de 2,5 buts',under45:'Moins de 4,5 buts',bttsYes:'Les deux marquent',bttsNo:'Au moins une équipe ne marque pas',homeScore:'Domicile marque',awayScore:'Extérieur marque',homeOver25:'Domicile gagne + plus de 2,5 buts',awayOver25:'Extérieur gagne + plus de 2,5 buts',homeBtts:'Domicile gagne + les deux marquent',awayBtts:'Extérieur gagne + les deux marquent'});
export const PROFILE_RULES=Object.freeze({prudent:{min:.78,max:1,markets:['1X','X2','over05','under45','homeScore','awayScore']},equilibre:{min:.54,max:.78,markets:['home','away','over15','under25','over25','bttsYes','bttsNo','12','1X','X2']},audacieux:{min:.12,max:.42,markets:['home','draw','away','homeOver25','awayOver25','homeBtts','awayBtts']}});
export function chooseProfilePicks(entries){
  const result={};
  for(const [profile,rule] of Object.entries(PROFILE_RULES)){
    const candidates=[];
    for(const {match,prediction} of entries){if(!prediction||prediction.homeMatches<6||prediction.awayMatches<6)continue;
      for(const key of rule.markets){const p=prediction.markets[key];if(p>=rule.min&&p<rule.max){candidates.push({match,market:key,label:MARKET_LABELS[key],p,fairOdds:1/p,modelVersion:prediction.modelVersion,uncertainty:prediction.uncertainty})}}
    }
    // Highest likelihood for prudent, representative likelihood for intermediate,
    // and an explicitly low-probability option for ambitious bets.
    candidates.sort((a,b)=>profile==='prudent'?b.p-a.p:profile==='equilibre'?Math.abs(a.p-.67)-Math.abs(b.p-.67):Math.abs(a.p-.25)-Math.abs(b.p-.25));
    result[profile]=candidates[0]??null;
  }
  return result;
}
/** Estimated joint probabilities for fixtures involving different clubs.
 * These products assume independence and are NOT calibrated confidence levels.
 * A missing strong selection returns null rather than forcing a ticket.
 */
export function buildSafeCombos(entries){
  const allowed=['1X','X2','under45','homeScore','awayScore','over15'];
  const available=[];
  const nextDate=Math.min(...entries.map(({match})=>dayNumber(match.date)).filter(Number.isFinite));
  for(const {match,prediction} of entries){
    // A useful betting ticket should be settled within the same short window.
    if(!Number.isFinite(nextDate)||dayNumber(match.date)-nextDate>7*DAY)continue;
    if(!prediction||prediction.homeMatches<6||prediction.awayMatches<6)continue;
    const candidates=allowed.map(key=>({key,p:prediction.markets[key]})).filter(x=>x.p>=.76&&x.p<1);
    candidates.sort((a,b)=>b.p-a.p);
    if(candidates.length)available.push({match,market:candidates[0].key,label:MARKET_LABELS[candidates[0].key],p:candidates[0].p});
  }
  available.sort((a,b)=>b.p-a.p);
  const build=(count,excluded=new Set())=>{
    const legs=[],usedTeams=new Set();
    for(const c of available){
      if(excluded.has(c.match.id)||usedTeams.has(c.match.home)||usedTeams.has(c.match.away))continue;
      legs.push(c);usedTeams.add(c.match.home);usedTeams.add(c.match.away);
      if(legs.length===count)break;
    }
    if(legs.length!==count)return null;
    const p=legs.reduce((v,x)=>v*x.p,1);
    if(p<(count===2?.60:.48))return null;
    return {legs,p,fairOdds:1/p,assumption:'Indépendance approximative entre matchs distincts'};
  };
  const double=build(2),triple=build(3);
  const alternative=double?build(2,new Set([double.legs[0].match.id])):null;
  return {double,triple,alternative:alternative&&JSON.stringify(alternative.legs.map(x=>x.match.id))!==JSON.stringify(double.legs.map(x=>x.match.id))?alternative:null};
}
export function backtest(all,lastN=150){
  const completed=all.filter(m=>m.played).sort(chronological),candidates=completed.slice(-lastN);let predictions=[],log=0,brier=0,baseLog=0;
  for(const m of candidates){const p=predict(m.home,m.away,m.date,completed);if(!p)continue;
    const actual=m.hg>m.ag?0:m.hg===m.ag?1:2;
    const previous=completed.filter(x=>dayNumber(x.date)<dayNumber(m.date));
    const counts=[1,1,1];for(const g of previous){const ix=g.hg>g.ag?0:g.hg===g.ag?1:2;counts[ix]++}
    const prior=counts[actual]/(counts[0]+counts[1]+counts[2]);
    const ll=-Math.log(Math.max(1e-12,p.prob[actual]));
    const bs=p.prob.reduce((s,x,i)=>s+Math.pow(x-(i===actual?1:0),2),0)/3;
    log+=ll;brier+=bs;baseLog-=Math.log(prior);
    predictions.push({date:m.date,home:m.home,away:m.away,score:`${m.hg}-${m.ag}`,actual:actual===0?'1':actual===1?'N':'2',p1:p.prob[0],pN:p.prob[1],p2:p.prob[2],logloss:ll,brier:bs});
  }
  const n=predictions.length;return {n,logloss:n?log/n:null,brier:n?brier/n:null,baseline:n?baseLog/n:null,predictions,improvement:n?(baseLog-log)/baseLog:null};
}
export function csv(rows){if(!rows.length)return '';
  const keys=Object.keys(rows[0]);const safe=s=>{const v=String(s??'');const secured=/^[=+@\-\t\r]/.test(v)?"'"+v:v;return '"'+secured.replace(/"/g,'""')+'"'};
  return [keys.join(','),...rows.map(r=>keys.map(k=>safe(r[k])).join(','))].join('\r\n');
}
export {percent};
