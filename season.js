/** French Ligue 1 runs across two calendar years; new seasons begin in summer. */
export function seasonStart(date=new Date()){
  const values=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit'}).formatToParts(date);
  const parts=Object.fromEntries(values.filter(v=>v.type!=='literal').map(v=>[v.type,v.value]));
  return Number(parts.year)-(Number(parts.month)<7?1:0);
}
export function seasonTag(year){return `${year}-${String((year+1)%100).padStart(2,'0')}`}
export function currentSeasonTag(date=new Date()){return seasonTag(seasonStart(date))}
export function rollingSeasons(date=new Date(),count=5){const end=seasonStart(date);return Array.from({length:count},(_,i)=>seasonTag(end-count+1+i))}
