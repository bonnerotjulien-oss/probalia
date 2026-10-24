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
  strasbourg: 'rc strasbourg', 'rc strasbourg alsace': 'rc strasbourg', brest: 'stade brestois', 'stade brestois 29': 'stade brestois', auxerre: 'aj auxerre',
  'le havre': 'le havre ac', lorient: 'fc lorient', angers: 'angers sco',
  metz: 'fc metz', montpellier: 'montpellier hsc', reims: 'stade de reims',
  'paris fc': 'paris fc', 'saint etienne': 'as saint etienne',
  'stade rennais fc': 'stade rennais', 'as monaco fc': 'as monaco',
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

export function applyOfficialFixtures(matches, feed, now = new Date()) {
  if (!feed || !Array.isArray(feed.matches) || !Number.isFinite(Date.parse(feed.fetchedAt))) return {matches:matches.filter(m=>m.played||m.season!=='2026-27'),upcoming:0,ok:false};
  const hours=(now-new Date(feed.fetchedAt))/3600000;
  if (hours<0 || hours>MAX_SYNC_AGE_HOURS) return {matches:matches.filter(m=>m.played||m.season!=='2026-27'),upcoming:0,ok:false};
  const existingTeams=new Map();
  for(const m of matches) for(const name of [m.home,m.away]) existingTeams.set(teamKey(name),name);
  const scheduled=[];
  for(const m of feed.matches) {
    const millis=Date.parse(m.utcDate);
    // SCHEDULED may be a placeholder without a confirmed kick-off time.
    if(!Number.isFinite(millis)||millis<=now.getTime()||m.status!=='TIMED'||!m.home||!m.away)continue;
    const home=existingTeams.get(teamKey(m.home)),away=existingTeams.get(teamKey(m.away));
    if(!home||!away||home===away)continue; // Never invent a team mapping.
    const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(millis));
    const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(millis));
    scheduled.push({id:`official:${m.id}`,season:'2026-27',date,time,home,away,played:false,hg:null,ag:null,fixtureSource:'football-data.org',fixtureStatus:m.status});
  }
  const unique=new Map(scheduled.map(m=>[m.id,m]));
  return {matches:[...matches.filter(m=>m.played||m.season!=='2026-27'),...unique.values()],upcoming:unique.size,ok:unique.size>0};
}
