import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {summarizeTacticalEvents} from '../tactics.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sources=path.join(root,'tactical-sources');
async function run(){
  const entries=await readdir(sources).catch(()=>[]),matches=[];
  for(const entry of entries.filter(name=>/^[-\w]+\.json$/.test(name))){
    const data=JSON.parse(await readFile(path.join(sources,entry),'utf8'));
    if(Array.isArray(data.matches))matches.push(...data.matches);
  }
  if(!matches.length){console.log('Aucune source tactique validée : tactiques.json inchangé.');return}
  const output=summarizeTacticalEvents(matches,new Date().toISOString().slice(0,10));
  output.generatedAt=new Date().toISOString();
  output.inputs=entries.filter(n=>/^[-\w]+\.json$/.test(n));
  await mkdir(path.join(root,'data'),{recursive:true});
  await writeFile(path.join(root,'data','tactics.json'),JSON.stringify(output,null,2)+'\n');
  console.log(`Base tactique : ${output.matches} matchs, ${output.events} événements ; ${Object.keys(output.teams).length} équipes.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run().catch(e=>{console.error(e);process.exitCode=1});
