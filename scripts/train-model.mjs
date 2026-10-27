import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {trainConservatively} from '../learning.js';
import {teamKey} from '../freshness.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function run(){
  const input=JSON.parse(await readFile(path.join(root,'data','results.json'),'utf8'));
  if(!Array.isArray(input.results))throw Error('Résultats vérifiés manquants.');
  const history=input.results.map((m,i)=>({...m,id:`trained:${i}`,home:teamKey(m.home),away:teamKey(m.away),played:true}));
  const learned=trainConservatively(history);
  await mkdir(path.join(root,'data'),{recursive:true});
  await writeFile(path.join(root,'data','model-settings.json'),JSON.stringify(learned,null,2)+'\n');
  console.log(`Sélection hors échantillon : ${learned.status} / ${learned.candidateId} (${learned.validation?.reference.n||0} matchs évalués).`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(e=>{console.error(e);process.exitCode=1});
