import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {predict,MODEL_VERSION} from '../model.js';
import {teamKey,parisDate} from '../freshness.js';
import {currentSeasonTag} from '../season.js';
import {archiveForecasts,settleForecasts,summarizeForecasts,LEDGER_VERSION} from '../ledger.js';
import {safeLearnedSettings} from '../learning.js';
import {auditModel,calibratedPrediction} from '../calibration.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function readJson(name){try{return JSON.parse(await readFile(path.join(root,'data',name),'utf8'))}catch{return null}}

export function createForecastCandidates(results,fixtures,oddsFeed,now=new Date(),learned=null){
  if(!Array.isArray(results?.results)||!Array.isArray(fixtures?.matches))return [];
  if(!Number.isFinite(Date.parse(fixtures.fetchedAt))||Math.abs(now-Date.parse(fixtures.fetchedAt))>48*3600000)return [];
  const completed=results.results.filter(r=>r.date<=parisDate(now)&&Number.isInteger(r.hg)&&Number.isInteger(r.ag))
    .map((r,i)=>({...r,id:`history:${i}`,played:true,home:teamKey(r.home),away:teamKey(r.away)}));
  const official=new Map(completed.flatMap(r=>[[teamKey(r.home),r.home],[teamKey(r.away),r.away]]));
  if(completed.length<60)return [];
  const settings=safeLearnedSettings(learned);
  const audit=auditModel(completed,settings);
  const quotes=Array.isArray(oddsFeed?.events)&&Date.parse(oddsFeed.fetchedAt)>now.getTime()-24*3600000?oddsFeed.events:[];
  const output=[];
  for(const match of fixtures.matches){
    if(match.status!=='TIMED'||!match.home||!match.away)continue;
    const starts=Date.parse(match.utcDate);
    // Record the first forecast during the week before kickoff, not months ahead.
    if(!Number.isFinite(starts)||starts-now.getTime()<15*60000||starts-now.getTime()>7*86400000)continue;
    const homeKey=teamKey(match.home),awayKey=teamKey(match.away);
    if(!official.has(homeKey)||!official.has(awayKey)||homeKey===awayKey)continue;
    const gameDay=parisDate(new Date(starts));
    const raw=predict(homeKey,awayKey,gameDay,completed,settings);
    const result=audit.validated?calibratedPrediction(raw,audit.calibrator):raw;
    if(!result)continue;
    const offer=quotes.find(o=>teamKey(o.home)===homeKey&&teamKey(o.away)===awayKey&&Math.abs(Date.parse(o.commenceTime)-starts)<4*3600000);
    const prices=offer?.best;
    const odds=prices&&['home','draw','away'].every(k=>Number(prices[k]?.price)>1)?{
      home:prices.home.price,draw:prices.draw.price,away:prices.away.price,
      bookmakers:{home:prices.home.bookmaker,draw:prices.draw.bookmaker,away:prices.away.bookmaker}
    }:null;
    output.push({season:currentSeasonTag(now),home:match.home,away:match.away,scheduledAt:match.utcDate,
      prob:result.prob,score:result.scores[0],modelVersion:`${MODEL_VERSION}:${learned?.status==='validated'?learned.candidateId:'reference'}`,odds,oddsObservedAt:odds?oddsFeed.fetchedAt:null});
  }
  return output;
}

async function run(){
  const now=new Date();
  const [results,fixtures,odds,existing,learned]=await Promise.all(['results.json','fixtures.json','odds.json','predictions.json','model-settings.json'].map(readJson));
  if(!Array.isArray(results?.results))throw Error('Résultats vérifiés absents : journal non modifié.');
  const records=Array.isArray(existing?.records)?existing.records:[];
  const settled=settleForecasts(records,results.results,now);
  const forecasts=createForecastCandidates(results,fixtures,odds,now,learned);
  const added=archiveForecasts(settled.records,forecasts,now);
  const payload={version:LEDGER_VERSION,source:'PROBALIA',updatedAt:now.toISOString(),
    forecastPolicy:'Immutable pre-match 1N2, first available prediction retained; no retroactive market reconstruction',
    records:added.records,summary:summarizeForecasts(added.records)};
  await mkdir(path.join(root,'data'),{recursive:true});
  await writeFile(path.join(root,'data','predictions.json'),JSON.stringify(payload,null,2)+'\n');
  console.log(`Journal de prévisions : ${added.added} nouvelles, ${settled.settled} réglées, ${payload.summary.n} évaluées, ${payload.summary.pending} en attente.`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(e=>{console.error(e.message);process.exitCode=1});
