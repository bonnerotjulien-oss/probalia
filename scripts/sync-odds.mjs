import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const key=process.env.ODDS_API_KEY;
const destination=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','data','odds.json');
const wanted=['home','draw','away'];

export function compactOdds(events,now=new Date()) {
  if(!Array.isArray(events))throw Error('The Odds API returned an unexpected JSON format');
  const result=[];
  for(const event of events){
    const eventTime=Date.parse(event.commence_time);
    if(!Number.isFinite(eventTime)||eventTime<=now.getTime()||!event.home_team||!event.away_team)continue;
    const best={home:null,draw:null,away:null};
    for(const bookmaker of event.bookmakers||[])for(const market of bookmaker.markets||[]){
      if(market.key!=='h2h')continue;
      const observed=Date.parse(market.last_update);
      if(!Number.isFinite(observed)||now.getTime()-observed>24*3600000||observed>now.getTime()+5*60000)continue;
      for(const outcome of market.outcomes||[]){
        const resultType=String(outcome.name).toLowerCase()==='draw'?'draw':outcome.name===event.home_team?'home':outcome.name===event.away_team?'away':null;
        const price=Number(outcome.price);
        if(!resultType||!wanted.includes(resultType)||!Number.isFinite(price)||price<=1||price>150)continue;
        if(!best[resultType]||price>best[resultType].price)best[resultType]={price,bookmaker:bookmaker.title||bookmaker.key||'Non renseigné',updatedAt:market.last_update};
      }
    }
    if(Object.values(best).some(Boolean))result.push({home:event.home_team,away:event.away_team,commenceTime:event.commence_time,best});
  }
  return result;
}

async function run(){
  if(!key){console.log('ODDS_API_KEY absent: skipped optional bookmaker odds sync');return}
  // One market, one region: generally 1 usage credit per successful response.
  const url=new URL('https://api.the-odds-api.com/v4/sports/soccer_france_ligue_one/odds/');
  url.searchParams.set('apiKey',key);url.searchParams.set('regions','eu');url.searchParams.set('markets','h2h');url.searchParams.set('oddsFormat','decimal');
  const now=new Date();
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
    if(!response.ok)throw Error(`The Odds API HTTP ${response.status}`);
    const condensed=compactOdds(await response.json(),now);
    const remaining=response.headers.get('x-requests-remaining');
    const payload={version:1,source:'the-odds-api.com',fetchedAt:now.toISOString(),market:'h2h',region:'eu',remainingCredits:remaining===null?null:Number(remaining),events:condensed};
    await mkdir(path.dirname(destination),{recursive:true});
    await writeFile(destination,JSON.stringify(payload,null,2)+'\n');
    console.log(`Odds scanned: ${condensed.length} upcoming matches, credits remaining: ${remaining??'unknown'}`);
  }catch(error){
    // Do not prevent verified results and schedules from updating when odds are unavailable.
    // Never log request URLs: they include the private API key.
    console.error('Optional odds feed unavailable:',error.message);
  }
}

if (process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run();
