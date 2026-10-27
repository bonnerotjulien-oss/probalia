import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildIntelligence} from '../intelligence.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function run(){
  const content=JSON.parse(await readFile(path.join(root,'tactical-sources','observations.json'),'utf8'));
  const result=buildIntelligence(content.observations);
  await mkdir(path.join(root,'data'),{recursive:true});
  await writeFile(path.join(root,'data','intelligence.json'),JSON.stringify(result,null,2)+'\n');
  console.log(`Mémoire tactique : ${result.observations.length} observations sourcées et contrôlées.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(e=>{console.error(e);process.exitCode=1});
