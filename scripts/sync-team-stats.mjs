/** Match statistics published with Ligue 1 results; NOT event-by-event tactical data. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseCSV,normalizeDate} from './sync-results.mjs';
import {normalizeTeamMatches} from '../team-stats.js';
import {currentSeasonTag} from '../season.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const field=(line,pos)=>pos<0?null:String(line[pos]??'').trim();
const nonNegative=s=>s===null||s===''?null:(/^\d+$/.test(s)&&Number(s)<=100?Number(s):null);
export function parseTeamStats(csv,season){
  const rows=parseCSV(csv),header=rows.shift()?.map(x=>x.replace(/^\uFEFF/,'').trim())||[];
  const col=name=>header.indexOf(name);
  if(['Date','HomeTeam','AwayTeam','FTHG','FTAG'].some(k=>col(k)<0))throw Error('CSV requis incomplet');
  const parsed=[];
  for(const row of rows){
    const date=normalizeDate(field(row,col('Date'))),home=field(row,col('HomeTeam')),away=field(row,col('AwayTeam'));
    const hg=nonNegative(field(row,col('FTHG'))),ag=nonNegative(field(row,col('FTAG')));
    if(!date||!home||!away||hg===null||ag===null)continue;
    const homeStats={goals:hg,shots:nonNegative(field(row,col('HS'))),onTarget:nonNegative(field(row,col('HST'))),corners:nonNegative(field(row,col('HC')))};
    const awayStats={goals:ag,shots:nonNegative(field(row,col('AS'))),onTarget:nonNegative(field(row,col('AST'))),corners:nonNegative(field(row,col('AC')))};
    parsed.push({date,season,home,away,homeStats,awayStats});
  }
  return parsed;
}
async function run(now=new Date()){
  const season=currentSeasonTag(now),start=Number(season.slice(0,4));
  const seasons=[`${start-1}-${String(start).slice(-2)}`,season];
  const destination=path.join(root,'data','team-stats.json');
  let previous=[];try{previous=JSON.parse(await readFile(destination,'utf8')).matches||[]}catch{}
  const all=[];let succeeded=0;
  for(const s of seasons){
    const code=s.slice(2,4)+s.slice(5,7),url=`https://www.football-data.co.uk/mmz4281/${code}/F1.csv`;
    try{
      const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'Mozilla/5.0 (compatible; PROBALIA-personal-statistics/4.9; +https://www.football-data.co.uk/)'}});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const bytes=await response.text();if(bytes.length>2_000_000)throw Error('Fichier trop volumineux');
      const records=parseTeamStats(bytes,s);
      if(s!==season&&records.length<30)throw Error('Saison historique tronquée');
      if(!records.length)throw Error('Pas de matchs vérifiés');
      all.push(...records);succeeded++;
      console.log(`${s}: ${records.length} rencontres avec colonnes disponibles`);
    }catch(e){
      console.warn(`${s}: source temporairement indisponible (${e.message})`);
      all.push(...previous.filter(m=>m.season===s));
    }
  }
  if(!succeeded){console.warn('Aucun téléchargement réussi : conserver les données précédentes sans modifier leur horodatage.');return}
  const data=normalizeTeamMatches(all,now);
  if(data.matches.length<4&&previous.length>=4)throw Error('Synchronisation suspecte : historique quasiment vide');
  await mkdir(path.dirname(destination),{recursive:true});
  await writeFile(destination,JSON.stringify(data,null,2)+'\n');
  console.log(`Statistiques équipe : ${data.matches.length} matchs publiés.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(e=>{console.error(e);process.exitCode=1});
