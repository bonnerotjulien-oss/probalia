import {mkdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seasons = ['2022-23','2023-24','2024-25','2025-26','2026-27'];

export function parseCSV(text) {
  const rows=[]; let row=[], value='', quoted=false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if (c==='"' && quoted && text[i+1]==='"') {value+='"';i++;continue}
    if (c==='"') {quoted=!quoted;continue}
    if (c===',' && !quoted) {row.push(value);value='';continue}
    if ((c==='\n'||c==='\r') && !quoted) {if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value='';continue}
    value+=c;
  }
  if (value||row.length) {row.push(value);rows.push(row)}
  return rows;
}

export function normalizeDate(s) {
  const m=String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const year=m[3].length===2?2000+Number(m[3]):Number(m[3]);
  const date=`${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return Number.isFinite(Date.parse(date+'T12:00:00Z'))?date:null;
}

export function parseResults(csv,season) {
  const rows=parseCSV(csv), fields=rows.shift()?.map(s=>s.replace(/^\uFEFF/,'').trim())||[];
  const col=name=>fields.indexOf(name);
  if (['Date','HomeTeam','AwayTeam','FTHG','FTAG'].some(name=>col(name)<0)) throw Error(`Missing CSV columns for ${season}`);
  return rows.map(r=>{
    const date=normalizeDate(r[col('Date')]);
    const hg=Number(r[col('FTHG')]),ag=Number(r[col('FTAG')]);
    const home=r[col('HomeTeam')]?.trim(),away=r[col('AwayTeam')]?.trim();
    if (!date||!home||!away||r[col('FTHG')]===''||r[col('FTAG')]===''||!Number.isInteger(hg)||!Number.isInteger(ag)||hg<0||ag<0) return null;
    return {season,date,home,away,hg,ag};
  }).filter(Boolean);
}

async function run() {
  const results=[];
  for (const season of seasons) {
    const code=season.slice(2,4)+season.slice(5,7);
    const url=`https://www.football-data.co.uk/mmz4281/${code}/F1.csv`;
    const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{'User-Agent':'PROBALIA data update (personal analytical app)'}});
    if (!response.ok) throw Error(`${season} HTTP ${response.status}`);
    const parsed=parseResults(await response.text(),season);
    if (parsed.length<30) throw Error(`${season}: suspiciously few results (${parsed.length}); refusing to publish`);
    results.push(...parsed);
    process.stdout.write(`${season}: ${parsed.length} results\n`);
  }
  const destination=path.join(root,'data','results.json');
  await mkdir(path.dirname(destination),{recursive:true});
  await writeFile(destination,JSON.stringify({version:1,source:'football-data.co.uk',fetchedAt:new Date().toISOString(),results},null,2)+'\n');
  process.stdout.write(`Generated ${results.length} results\n`);
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) run().catch(err=>{console.error(err);process.exitCode=1});
