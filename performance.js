import {summarizeForecasts} from './ledger.js';
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=n=>n===null?'—':(n*100).toFixed(1).replace('.',',')+' %';

export async function mountPerformance(){
  const node=document.getElementById('performance-content');
  if(!node)return;
  let learned=null;
  try{const response=await fetch('./data/model-settings.json',{cache:'no-store',signal:AbortSignal.timeout(8000)});if(response.ok)learned=await response.json()}catch{}
  const learningNote=learned?.status==='validated'
    ?`<p class="performance-note">🧠 Ajustement automatique actif : <b>${escape(learned.candidateId)}</b>. Vérification indépendante sur ${Number(learned.validation?.reference?.n)||0} matchs. Dernier test : ${escape(learned.trainedAt?.slice(0,10))}.</p>`
    :`<p class="performance-note">🧠 Auto-apprentissage : <b>${learned?'réglages de référence conservés':'en attente du premier entraînement GitHub'}</b>. Une variante n’est activée que si ses performances s’améliorent sur une période indépendante.</p>`;
  let data;
  try{const r=await fetch('./data/predictions.json',{cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(`HTTP ${r.status}`);data=await r.json()}catch{
    node.innerHTML=learningNote+'<div class="empty">Le journal automatique n’est pas encore publié. Il sera alimenté par les prochaines synchronisations GitHub Actions de la V4.5.</div>';return;
  }
  const records=Array.isArray(data.records)?data.records:[];
  const metrics=summarizeForecasts(records);
  if(!records.length){node.innerHTML=learningNote+'<div class="empty">La mémoire est activée. Les prochaines rencontres seront enregistrées avant leur coup d’envoi ; les statistiques apparaîtront après les premiers résultats.</div>';return}
  const recent=records.slice(-6).reverse();
  node.innerHTML=learningNote+`<div class="performance-metrics"><div><small>Prévisions enregistrées</small><strong>${records.length}</strong></div><div><small>Matchs évalués</small><strong>${metrics.n}</strong></div><div><small>Pronostics 1N2 corrects</small><strong>${pct(metrics.accuracy)}</strong></div><div><small>Score de probabilité (Brier)</small><strong>${metrics.brier===null?'—':metrics.brier.toFixed(3)}</strong></div></div>`+
    `<p class="performance-note">${metrics.n<30?'Échantillon encore trop limité pour conclure sur la fiabilité du modèle.':'Ces résultats mesurent les prévisions archivées avant le match, sans garantir les prédictions futures.'} ${metrics.pending} pronostic(s) en attente de résultat.</p>`+
    `<div class="performance-history">${recent.map(r=>{const t=r.result?`${r.result.home}–${r.result.away}`:'À venir';return `<div class="performance-row"><div><strong>${escape(r.home)} – ${escape(r.away)}</strong><small>${escape(r.scheduledAt.slice(0,10))} · ${r.result?'Terminé':'En attente'}</small></div><div class="performance-numbers"><b>${pct(Math.max(r.p1,r.pN,r.p2))}</b><small>Probabilité du scénario favori</small></div><div class="performance-result"><b>${t}</b><small>${r.result?'Score réel':'Statut'}</small></div></div>`}).join('')}</div>`+
    `<p class="performance-note">${metrics.quoted?`${metrics.quoted} prévisions terminées ont des cotes réelles archivées ; résultat théorique à mise fixe de 1 unité sur le scénario 1N2 favori : ${metrics.flatProfit>=0?'+':''}${metrics.flatProfit.toFixed(2)} unités (avant frais).`:'Pas encore assez de cotes bookmaker pré-match archivées pour calculer un rendement réel.'} L’optimisation porte actuellement sur des paramètres statistiques, pas sur une analyse tactique détaillée.</p>`;
}
