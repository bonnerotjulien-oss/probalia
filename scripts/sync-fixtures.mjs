import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const token=process.env.FOOTBALL_DATA_TOKEN;
if(!token) {console.error('FOOTBALL_DATA_TOKEN missing in GitHub Actions Secrets');process.exitCode=1}
else {
  try {
    const res=await fetch('https://api.football-data.org/v4/competitions/FL1/matches?season=2026',{
      headers:{'X-Auth-Token':token},signal:AbortSignal.timeout(25000),
    });
    if(!res.ok)throw Error(`football-data.org HTTP ${res.status}`);
    const json=await res.json();
    if(!Array.isArray(json.matches)||json.matches.length<30)throw Error('Unexpected fixture response; refusing to publish');
    const matches=json.matches.map(m=>({id:m.id,utcDate:m.utcDate,status:m.status,home:m.homeTeam?.name||null,away:m.awayTeam?.name||null}));
    const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
    await mkdir(path.join(root,'data'),{recursive:true});
    await writeFile(path.join(root,'data','fixtures.json'),JSON.stringify({version:1,source:'football-data.org',fetchedAt:new Date().toISOString(),competition:'FL1',matches},null,2)+'\n');
    console.log(`Fixtures received: ${matches.length}, future/unknown: ${matches.filter(m=>['TIMED','SCHEDULED'].includes(m.status)).length}`);
  } catch(e) {console.error('Fixture sync failed:',e.message);process.exitCode=1}
}
