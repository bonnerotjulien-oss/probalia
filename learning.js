/** Conservative model selection from chronological, result-only walk-forward tests.
 * The final validation slice is never used to select a candidate.
 */
import {SETTINGS,predict,chronological,dayNumber} from './model.js';

export const LEARNING_VERSION=1;
const MIN_MATCHES=400;
const OPTIONS=Object.freeze([
  {id:'reference',patch:{}},
  {id:'forme-recente',patch:{halfLifeDays:150}},
  {id:'forme-longue',patch:{halfLifeDays:300}},
  {id:'prudence-fortes',patch:{priorMatches:15}},
  {id:'forme-sensible',patch:{priorMatches:6}},
  {id:'elo-doux',patch:{eloGoalInfluence:.06}},
  {id:'elo-renforce',patch:{eloGoalInfluence:.14}},
  {id:'nul-frequent',patch:{rho:-.10}},
  {id:'nul-modere',patch:{rho:-.02}}
]);
export const settingsFor=id=>({...SETTINGS,...(OPTIONS.find(o=>o.id===id)?.patch||{})});
export function safeLearnedSettings(payload){
  if(payload?.version!==LEARNING_VERSION||payload?.status!=='validated')return {...SETTINGS};
  const id=payload.candidateId;
  return OPTIONS.some(o=>o.id===id)?settingsFor(id):{...SETTINGS};
}
const outcome=m=>m.hg>m.ag?0:m.hg===m.ag?1:2;
const logloss=(p,k)=>-Math.log(Math.max(1e-12,p[k]));
const brier=(p,k)=>p.reduce((sum,v,i)=>sum+(v-(i===k?1:0))**2,0)/3;

export function evaluateSettings(history,matches,config){
  let loss=0,bs=0,n=0;
  // Each prediction sees only results from earlier calendar days.
  for(const m of matches){
    const past=history.filter(g=>g.played&&dayNumber(g.date)<dayNumber(m.date));
    const p=predict(m.home,m.away,m.date,past,config);
    if(!p)continue;
    loss+=logloss(p.prob,outcome(m));bs+=brier(p.prob,outcome(m));n++;
  }
  return {n,logloss:n?loss/n:null,brier:n?bs/n:null};
}

export function trainConservatively(all,now=new Date()){
  const completed=all.filter(m=>m.played&&Number.isInteger(m.hg)&&Number.isInteger(m.ag)&&
    m.hg>=0&&m.ag>=0&&dayNumber(m.date)<now.getTime()).slice().sort(chronological);
  const meta={version:LEARNING_VERSION,trainedAt:now.toISOString(),totalResults:completed.length,
    method:'chronological walk-forward, frozen candidate grid; independent final holdout; logarithmic loss + Brier safety check',
    warning:'Validation historique uniquement, pas de garantie de rentabilité, pas de données tactiques ni de cotes'};
  if(completed.length<MIN_MATCHES)return {...meta,status:'insufficient',candidateId:'reference',settings:{...SETTINGS},reason:`${completed.length} résultats, minimum ${MIN_MATCHES}`,training:null,validation:null};
  // A bounded but sufficiently broad recent block; train on first 200, test on last 90.
  // Same-day matches are excluded from histories inside evaluateSettings.
  const assessed=completed.slice(-290),training=assessed.slice(0,200),holdout=assessed.slice(200);
  const trainingScores=OPTIONS.map(o=>({id:o.id,...evaluateSettings(completed,training,settingsFor(o.id))}));
  const baselineTraining=trainingScores[0];
  // A small regularization penalty favours the stable default configuration.
  const ranked=trainingScores.slice().sort((a,b)=>(a.logloss+(a.id==='reference'?0:.003))-(b.logloss+(b.id==='reference'?0:.003)));
  const selected=ranked[0];
  const baseline=evaluateSettings(completed,holdout,SETTINGS);
  const challenger=evaluateSettings(completed,holdout,settingsFor(selected.id));
  const enough=baseline.n>=70&&challenger.n===baseline.n&&baselineTraining.n>=160;
  const approved=selected.id!=='reference'&&enough&&
    challenger.logloss<=baseline.logloss-.008&&challenger.brier<=baseline.brier+.0002;
  return {...meta,status:approved?'validated':'baseline',candidateId:approved?selected.id:'reference',
    settings:approved?settingsFor(selected.id):{...SETTINGS},
    reason:approved?'Réglage retenu après amélioration vérifiée hors échantillon.':
      selected.id==='reference'?'Le modèle de référence reste le meilleur à l’entraînement.':
      'Réglage candidat rejeté : gain insuffisant sur la période indépendante.',
    selectedOnTraining:selected.id,
    training:{first:training[0]?.date,last:training.at(-1)?.date,n:baselineTraining.n,
      reference:baselineTraining,selected:trainingScores.find(r=>r.id===selected.id)},
    validation:{first:holdout[0]?.date,last:holdout.at(-1)?.date,reference:baseline,challenger},
    testedCandidates:trainingScores};
}
