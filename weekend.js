/** French football matchday: Friday to Monday, based on calendar dates in Europe/Paris. */
const day=86400000;
const iso=n=>new Date(n).toISOString().slice(0,10);
const utcDate=isoDate=>Date.parse(`${isoDate}T12:00:00Z`);

export function weekendRange(reference){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(reference)||!Number.isFinite(utcDate(reference)))return null;
  const at=utcDate(reference),weekday=new Date(at).getUTCDay();
  // Tuesday, Wednesday and Thursday: next Friday. Friday to Monday: current matchday.
  const untilFriday=weekday>=2&&weekday<=4?5-weekday:weekday===0?-2:weekday===1?-3:5-weekday;
  const start=at+untilFriday*day;
  return {start:iso(start),end:iso(start+3*day)};
}

export function weekendFixtures(upcoming,reference){
  const range=weekendRange(reference);
  if(!range||!Array.isArray(upcoming))return [];
  return upcoming.filter(match=>match?.date>=range.start&&match.date<=range.end)
    .sort((a,b)=>a.date.localeCompare(b.date)||String(a.time||'').localeCompare(String(b.time||'')));
}

export function weekendLabel(range){
  if(!range)return 'Week-end indisponible';
  const asDate=isoDate=>new Date(`${isoDate}T12:00:00Z`);
  const fmt=(value,opts)=>new Intl.DateTimeFormat('fr-FR',{...opts,timeZone:'UTC'}).format(asDate(value));
  const first=fmt(range.start,{day:'numeric',month:'long'}),last=fmt(range.end,{day:'numeric',month:'long'});
  return `Du ${first} au ${last}`;
}
