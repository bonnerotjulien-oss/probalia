import {chronological,predict} from './model.js';

/* Strictly time-ordered probability audit. No bookmaker prices or future scores enter fitting. */
const EPS=1e-9;
const outcome=m=>m.hg>m.ag?0:m.hg===m.ag?1:2;
const dateKey=m=>String(m.date);
const probabilities=p=>p.map(x=>Math.max(EPS,Math.min(1,x)));

export function adjust1N2(raw,{temperature=1,drawBias=0}={}){
  const z=probabilities(raw).map((p,i)=>Math.log(p)/temperature+(i===1?drawBias:0));
  const peak=Math.max(...z),weights=z.map(x=>Math.exp(x-peak)),sum=weights.reduce((s,x)=>s+x,0);
  return weights.map(x=>x/sum);
}

function metrics(rows,transform=x=>x){
  if(!rows.length)return {n:0,logloss:null,brier:null};
  let logloss=0,brier=0;
  for(const row of rows){const p=transform(row);logloss-=Math.log(Math.max(EPS,p[row.actual]));
    brier+=p.reduce((s,v,i)=>s+(v-(i===row.actual?1:0))**2,0)/3;
  }
  return {n:rows.length,logloss:logloss/rows.length,brier:brier/rows.length};
}

export function fitTemperature(rows){
  if(rows.length<90)return {temperature:1,drawBias:0};
  let best={temperature:1,drawBias:0},loss=Infinity;
  const precomputed=rows.map(row=>({logs:probabilities(row.raw).map(Math.log),actual:row.actual}));
  // Small, regularized two-parameter model: avoids fitting a large model to scant data.
  for(let t=0.75;t<=2.201;t+=0.05)for(let d=-0.4;d<=0.401;d+=0.05){
    const candidate={temperature:Number(t.toFixed(2)),drawBias:Number(d.toFixed(2))};
    const inverse=1/candidate.temperature;let totalLoss=0;
    for(const row of precomputed){const w0=Math.exp(row.logs[0]*inverse),w1=Math.exp(row.logs[1]*inverse+candidate.drawBias),w2=Math.exp(row.logs[2]*inverse);
      const selected=row.actual===0?w0:row.actual===1?w1:w2;
      totalLoss+=Math.log(w0+w1+w2)-Math.log(selected);
    }
    const fit=totalLoss/precomputed.length;
    const regularized=fit+0.002*(candidate.temperature-1)**2+0.003*candidate.drawBias**2;
    if(regularized<loss){loss=regularized;best=candidate;}
  }
  return best;
}

export function auditModel(matches){
  const completed=matches.filter(m=>m.played&&Number.isInteger(m.hg)&&Number.isInteger(m.ag)).slice().sort(chronological);
  const rows=[],counts=[1,1,1];let past=[],index=0;
  for(const match of completed){
    // A match played on the same day cannot inform another prediction from that day.
    while(index<completed.length&&dateKey(completed[index])<dateKey(match)){
      past.push(completed[index]);counts[outcome(completed[index])]++;index++;
    }
    const raw=predict(match.home,match.away,match.date,past);
    if(!raw)continue;
    const n=counts.reduce((a,b)=>a+b,0);
    rows.push({id:match.id,date:match.date,home:match.home,away:match.away,score:`${match.hg}-${match.ag}`,actual:outcome(match),raw:raw.prob,baseline:counts.map(x=>x/n)});
  }
  if(rows.length<200){return {ready:false,validated:false,reason:'Historique insuffisant pour une validation chronologique indépendante.',n:rows.length,calibrator:{temperature:1,drawBias:0},predictions:[],logloss:null,brier:null,baseline:null,rawLogloss:null,rawBrier:null,improvement:null};}
  const holdoutSize=Math.max(60,Math.floor(rows.length*.22)),training=rows.slice(0,-holdoutSize),holdout=rows.slice(-holdoutSize);
  const candidate=fitTemperature(training);
  const raw=metrics(holdout,row=>row.raw),adjusted=metrics(holdout,row=>adjust1N2(row.raw,candidate));
  const baseline=metrics(holdout,row=>row.baseline);
  // Never call an adjustment 'validated' if it fails either unmodified predictions
  // or a simple, strictly historical league-frequency benchmark.
  const validated=adjusted.logloss<raw.logloss-.002&&adjusted.logloss<baseline.logloss-.002&&adjusted.brier<=raw.brier+.001;
  // The deployed adjustment is the exact one tested on unseen matches;
  // unlike a post-validation refit, it never learns from that held-out window.
  const active=validated?candidate:{temperature:1,drawBias:0};
  const tested=validated?adjusted:raw;
  const predictions=holdout.map(row=>{
    const p=validated?adjust1N2(row.raw,candidate):row.raw;
    return {date:row.date,home:row.home,away:row.away,score:row.score,actual:['1','N','2'][row.actual],p1:p[0],pN:p[1],p2:p[2],raw1:row.raw[0],rawN:row.raw[1],raw2:row.raw[2],logloss:-Math.log(Math.max(EPS,p[row.actual])),period:'test indépendant'};
  });
  return {ready:true,validated,reason:validated?'Ajustement retenu : amélioration vérifiée sur la période de test.':'Ajustement rejeté : pas de gain robuste hors échantillon. Probabilités brutes conservées.',n:tested.n,
    trainingCount:training.length,holdoutStart:holdout[0].date,holdoutEnd:holdout.at(-1).date,
    candidate,calibrator:active,rawLogloss:raw.logloss,rawBrier:raw.brier,
    adjustedLogloss:adjusted.logloss,adjustedBrier:adjusted.brier,
    logloss:tested.logloss,brier:tested.brier,baseline:baseline.logloss,baselineBrier:baseline.brier,
    improvement:(baseline.logloss-tested.logloss)/baseline.logloss,
    modelBeatsBaseline:tested.logloss<baseline.logloss&&tested.brier<baseline.brier,
    predictions};
}

// Reweight the full scoreline distribution so derived markets remain internally consistent.
export function calibratedPrediction(raw,calibrator){
  if(!raw||!raw.scoreGrid||!calibrator)return raw;
  const p=adjust1N2(raw.prob,calibrator);
  const ratios=p.map((v,i)=>v/raw.prob[i]);
  const grid=raw.scoreGrid.map(s=>({...s,p:s.p*ratios[s.h>s.a?0:s.h===s.a?1:2]}));
  const markets={home:p[0],draw:p[1],away:p[2],'1X':p[0]+p[1],X2:p[1]+p[2],'12':p[0]+p[2],over05:0,over15:0,over25:0,under25:0,under45:0,bttsYes:0,bttsNo:0,homeScore:0,awayScore:0,homeOver25:0,awayOver25:0,homeBtts:0,awayBtts:0};
  for(const s of grid){const {h,a}=s,w=s.p;if(h+a>0)markets.over05+=w;if(h+a>1)markets.over15+=w;if(h+a>2)markets.over25+=w;if(h+a<3)markets.under25+=w;if(h+a<5)markets.under45+=w;
    if(h>0&&a>0)markets.bttsYes+=w;else markets.bttsNo+=w;
    if(h>0)markets.homeScore+=w;if(a>0)markets.awayScore+=w;
    if(h>a){if(h+a>2)markets.homeOver25+=w;if(a>0)markets.homeBtts+=w;}
    if(a>h){if(h+a>2)markets.awayOver25+=w;if(h>0)markets.awayBtts+=w;}
  }
  return {...raw,rawProb:raw.prob,prob:p,markets,over:markets.over25,btts:markets.bttsYes,scores:grid.sort((a,b)=>b.p-a.p).slice(0,8),calibrationApplied:true};
}
