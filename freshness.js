// Rules shared by the browser and automated tests; no external dependencies.
const DAY = 86400000;
export const MAX_RESULT_AGE_DAYS = 10;
export const MAX_SYNC_AGE_HOURS = 48;

export function freshnessStatus(matches, now = new Date(), syncAt = null) {
  const played = matches.filter(m => m.played && Number.isFinite(Date.parse(m.date + 'T12:00:00Z')));
  const latest = played.reduce((date, m) => !date || m.date > date ? m.date : date, null);
  const ageDays = latest ? Math.max(0, Math.floor((now - new Date(latest + 'T12:00:00Z')) / DAY)) : Infinity;
  const syncAgeHours = syncAt ? (now - new Date(syncAt)) / 3600000 : Infinity;
  // Do not silently accept stale records or a failed/missing automated sync.
  return {latest, ageDays, syncAgeHours, ok: ageDays <= MAX_RESULT_AGE_DAYS && syncAgeHours >= 0 && syncAgeHours <= MAX_SYNC_AGE_HOURS};
}

const NAME_ALIASES = {
  psg: 'paris saint germain', 'paris sg': 'paris saint germain', 'paris saint germain fc': 'paris saint germain',
  marseille: 'olympique de marseille', lyon: 'olympique lyonnais', lyonnais: 'olympique lyonnais',
  lille: 'lille osc', lens: 'rc lens', rennes: 'stade rennais', nice: 'ogc nice',
  monaco: 'as monaco', toulouse: 'toulouse fc', nantes: 'fc nantes',
  strasbourg: 'rc strasbourg', brest: 'stade brestois', auxerre: 'aj auxerre',
  'le havre': 'le havre ac', lorient: 'fc lorient', angers: 'angers sco',
  metz: 'fc metz', montpellier: 'montpellier hsc', reims: 'stade de reims',
  'paris fc': 'paris fc', 'saint etienne': 'as saint etienne',
};
export function teamKey(name) {
  const basic = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/saint[. -]*germain/g, 'saint germain').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
  return NAME_ALIASES[basic] || basic;
}

export function mergeVerifiedResults(matches, feed) {
  if (!feed || !Array.isArray(feed.results) || !Number.isFinite(Date.parse(feed.fetchedAt))) return {matches, merged:0};
  const index = new Map();
  for (const r of feed.results) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isInteger(r.hg) || !Number.isInteger(r.ag) || r.hg < 0 || r.ag < 0) continue;
    index.set([r.season, teamKey(r.home), teamKey(r.away)].join('|'), r);
  }
  let merged = 0;
  const updated = matches.map(m => {
    const r = index.get([m.season, teamKey(m.home), teamKey(m.away)].join('|'));
    if (!r) return m;
    merged++;
    // When sources disagree, use the fresh result source for score and actual match date.
    return {...m, date:r.date, hg:r.hg, ag:r.ag, played:true, resultSource:'football-data.co.uk'};
  });
  return {matches:updated, merged};
}
