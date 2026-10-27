/** Narrow RSS discovery, not article scraping or automated factual extraction. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SOURCES=[{name:'RMC Sport Ligue 1',url:'https://rmcsport.bfmtv.com/rss/football/ligue-1/'}];
const KEYWORDS=/tactiq|pressing|syst[eè]me|entra[iî]neur|sch[eé]ma|d[eé]fense|attaque|transition|corner|coup franc|possession|recrue|absence|blessure|ligue 1/i;
const decode=s=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const field=(xml,name)=>decode(xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'').trim();
export function readRSS(xml,source,now=new Date()){
  const output=[],cutoff=now.getTime()-90*86400000;
  for(const item of xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/g)||[]){
    const title=field(item,'title').replace(/<[^>]+>/g,'').slice(0,180);
    const link=field(item,'link'),date=Date.parse(field(item,'pubDate'));
    let url;try{url=new URL(link)}catch{continue}
    if(url.protocol!=='https:'||!url.hostname.endsWith('bfmtv.com')||!Number.isFinite(date)||date<cutoff||date>now.getTime()+3600000||!KEYWORDS.test(title))continue;
    output.push({title,url:url.href,publishedAt:new Date(date).toISOString(),source,reviewed:false,
      note:'À lire et vérifier : ce titre ne constitue pas une observation tactique.'});
  }
  return output;
}
async function run(){
  const dest=path.join(root,'data','tactical-news.json');
  let existing=[];try{existing=JSON.parse(await readFile(dest,'utf8')).articles||[]}catch{}
  const seen=new Map(existing.filter(a=>Date.parse(a.publishedAt)>Date.now()-90*86400000).map(a=>[a.url,a]));
  let successful=0;
  for(const source of SOURCES){
    try{
      const response=await fetch(source.url,{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'PROBALIA/4.8 personal research RSS reader'}});
      if(!response.ok)throw Error('HTTP '+response.status);
      const xml=await response.text();for(const a of readRSS(xml,source.name))seen.set(a.url,a);
      successful++;
    }catch(e){console.warn(source.name+': flux indisponible ('+e.message+')')}
  }
  if(!successful&&!existing.length){console.log('Aucun flux disponible : aucune donnée de veille créée.');return}
  const articles=[...seen.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,80);
  await mkdir(path.dirname(dest),{recursive:true});
  await writeFile(dest,JSON.stringify({version:1,fetchedAt:new Date().toISOString(),sources:SOURCES.map(s=>s.name),articles},null,2)+'\n');
  console.log(`Veille : ${articles.length} titres à examiner ; ${successful}/${SOURCES.length} flux disponibles.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(e=>{console.error(e);process.exitCode=1});
