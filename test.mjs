import assert from 'node:assert/strict';
import {cleanSeason,chronological,predict,backtest,csv,chooseProfilePicks,PROFILE_RULES,buildSafeCombos} from './model.js';
import {freshnessStatus,mergeVerifiedResults,teamKey,applyOfficialFixtures} from './freshness.js';
import {parseResults} from './scripts/sync-results.mjs';
import {simulateTicket} from './builder.js';
const sample=[];const teams=['Lens','Paris FC','Lille','Lyon'];
for(let i=0;i<180;i++){const h=teams[i%4],a=teams[(i+1+(Math.floor(i/4)%2))%4];if(h===a)continue;sample.push({id:String(i),season:'test',home:h,away:a,date:new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10),time:'20:45',hg:i%4,ag:i%3,played:true})}
sample.sort(chronological);
const p=predict('Lens','Paris FC','2025-01-01',sample);
assert.ok(p,'predict should return a model');assert.ok(Math.abs(p.prob.reduce((a,b)=>a+b,0)-1)<1e-8,'probabilities sum to one');
assert.ok(p.scores[0].p>=p.scores[1].p,'score ordering');
assert.ok(p.lambdaH>0&&p.lambdaA>0,'expected goals positive');
assert.ok(Math.abs(p.markets['1X']-p.prob[0]-p.prob[1])<1e-10,'double chance is union of outcomes');
assert.ok(p.markets.over05>=p.markets.over15&&p.markets.over15>=p.markets.over25,'goals market ordered');
const picks=chooseProfilePicks([{match:sample[0],prediction:p}]);
for(const [k,pick] of Object.entries(picks)){if(pick){assert.ok(pick.p>=PROFILE_RULES[k].min&&pick.p<PROFILE_RULES[k].max);assert.ok(Math.abs(pick.fairOdds-1/pick.p)<1e-8)}}
const comboPred={...p,homeMatches:20,awayMatches:20,markets:{...p.markets,'1X':.91,'X2':.85,under45:.90,homeScore:.80,awayScore:.78,over15:.77}};
const comboEntries=[['Lens','Paris FC'],['Lille','Lyon'],['Brest','Nice'],['Angers','Lorient']].map(([home,away],i)=>({match:{id:String(i),home,away,date:'2026-11-01'},prediction:comboPred}));
const combos=buildSafeCombos(comboEntries);
assert.ok(combos.double&&combos.triple);
assert.equal(combos.double.legs.length,2);
assert.ok(Math.abs(combos.double.p-combos.double.legs.reduce((v,l)=>v*l.p,1))<1e-12);
assert.ok(combos.triple.p<combos.double.p,'more legs reduce joint probability');
assert.equal(new Set(combos.triple.legs.flatMap(l=>[l.match.home,l.match.away])).size,6,'teams cannot repeat in a combination');
const b=backtest(sample,30);assert.ok(b.n>0);assert.ok(Number.isFinite(b.logloss));assert.ok(Number.isFinite(b.brier));
const changed=sample.slice();changed.push({...sample[0],id:'future',date:'2025-06-01',hg:20,ag:0});
const p2=predict('Lens','Paris FC','2025-01-01',changed);assert.deepEqual(p.prob,p2.prob,'future result must not leak into prediction');
assert.equal(cleanSeason({matches:[{date:'2026-11-01',team1:'A',team2:'B',score:[0,0]},{date:'2026-10-01',team1:'A',team2:'B',score:[0,0]}]},'26','2026-10-24').filter(m=>m.played).length,1,'past 0-0 draws and future placeholders disambiguated');
assert.ok(csv([{name:'=HYPERLINK()',p:.2}]).includes("'=HYPERLINK"),'CSV injection defended');
assert.equal(teamKey('Paris SG'),teamKey('Paris Saint-Germain FC'));
assert.equal(teamKey('Lyon'),teamKey('Olympique Lyonnais'));
const feed={fetchedAt:'2026-10-24T10:00:00.000Z',results:[{season:'2026-27',date:'2026-10-23',home:'Lyon',away:'Paris SG',hg:2,ag:1}]};
const merged=mergeVerifiedResults([{id:'fixture',season:'2026-27',date:'2026-10-22',home:'Olympique Lyonnais',away:'Paris Saint-Germain FC',played:false}],feed);
assert.equal(merged.merged,1);assert.equal(merged.matches[0].date,'2026-10-23');assert.equal(merged.matches[0].hg,2);
assert.equal(freshnessStatus(merged.matches,new Date('2026-10-24T11:00:00Z'),feed.fetchedAt).ok,true);
assert.equal(freshnessStatus(merged.matches,new Date('2026-11-12T11:00:00Z'),feed.fetchedAt).ok,false);
assert.equal(freshnessStatus(merged.matches,new Date('2026-10-24T11:00:00Z'),null).ok,false);
assert.deepEqual(parseResults('Date,HomeTeam,AwayTeam,FTHG,FTAG\n23/10/2026,Lyon,Paris SG,2,1\n24/10/2026,Lens,Lille,,\n','2026-27'),feed.results);
const fixtureFeed={fetchedAt:'2026-10-24T08:00:00Z',matches:[
  {id:100,status:'TIMED',utcDate:'2026-10-25T19:45:00Z',home:'RC Strasbourg Alsace',away:'Olympique Lyonnais'},
  {id:101,status:'IN_PLAY',utcDate:'2026-10-24T10:00:00Z',home:'RC Strasbourg Alsace',away:'Olympique Lyonnais'},
]};
const fixtureList=applyOfficialFixtures([{id:'old',season:'2026-27',date:'2026-11-02',home:'RC Strasbourg Alsace',away:'Olympique Lyonnais',played:false},{id:'historical',season:'2026-27',date:'2026-10-10',home:'RC Strasbourg Alsace',away:'Olympique Lyonnais',played:true,hg:1,ag:0}],fixtureFeed,new Date('2026-10-24T12:00:00Z'));
assert.equal(fixtureList.ok,true);assert.equal(fixtureList.upcoming,1);assert.equal(fixtureList.matches.length,2);
assert.equal(fixtureList.matches.find(m=>!m.played).time,'20:45');
assert.equal(applyOfficialFixtures(fixtureList.matches,fixtureFeed,new Date('2026-10-28T12:00:00Z')).ok,false,'stale fixture feed must fail closed');
const ticket=simulateTicket([{p:.70,odds:1.80},{p:.80,odds:1.60}],10);
assert.ok(ticket);assert.ok(Math.abs(ticket.gross-28.8)<1e-10);assert.ok(Math.abs(ticket.probability-.56)<1e-12);assert.equal(simulateTicket([{p:.9,odds:1.2}],10),null);
console.log('PROBALIA model tests OK · '+b.n+' evaluated predictions');
