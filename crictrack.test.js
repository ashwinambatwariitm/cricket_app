/*
 * CricTrack engine tests
 * ----------------------
 * Run with:  node "crictrack.test.js"
 *
 * These tests drive the SAME engine the app uses — crictrack-engine.js — which is
 * imported below. The app (crictrack (1).html) loads that file as a <script>, so
 * there is a single source of truth and the tests can never drift from the app.
 *
 * A simulator sets up 12 players (6 per team) and drives matches through every
 * combination of runs, wides, no-balls and wicket types, asserting invariants.
 */

const Engine = require('./crictrack-engine.js');
const selectBatsmen = Engine.selectBatsmen;
const selectBowler = Engine.selectBowler;
// Engine.recordBall returns { match, event }; tests only need the next match.
const recordBall = (m,type,runs=0,dismissal=null) => Engine.recordBall(m,type,runs,dismissal).match;

// ---------------------------------------------------------------------------
// SIMULATOR — 12 players, 6 per team, auto-fills selections
// ---------------------------------------------------------------------------
function makeMatch(maxOvers,battingTeam='A'){
  const mk=(prefix,n)=>Array.from({length:n},(_,i)=>({id:`${prefix}${i+1}`,name:`${prefix}_p${i+1}`,role:'All-rounder'}));
  const teamA=mk('A',6), teamB=mk('B',6);
  return {
    id:1,date:'test',
    teamA:{name:'Alpha',players:teamA,captain:null,score:0,wickets:0,overs:0,balls:0,extras:0},
    teamB:{name:'Beta', players:teamB,captain:null,score:0,wickets:0,overs:0,balls:0,extras:0},
    maxOvers,innings:1,battingTeam,bowlingTeam:battingTeam==='A'?'B':'A',
    striker:null,nonStriker:null,currentBowler:null,
    batsmen:{},bowlers:{},ballHistory:[],currentOverBalls:[],status:'live',winner:null
  };
}

// Make sure a striker, non-striker and bowler are selected (mirrors what the UI
// forces the scorer to do). Picks a different bowler than the previous over.
function ensureSelections(m,ctx){
  if(m.status==='done')return m;
  const bt=m.battingTeam,bwt=m.bowlingTeam;
  const battingPlayers=m[`team${bt}`].players;
  const bowlingPlayers=m[`team${bwt}`].players;
  const avail=()=>battingPlayers.filter(p=>{
    const bs=m.batsmen[p.id];
    return (!bs||!bs.out)&&p.id!==m.striker&&p.id!==m.nonStriker;
  });
  if(!m.striker){const a=avail();if(a.length)m=selectBatsmen(m,a[0].id,m.nonStriker);}
  if(!m.nonStriker){const a=avail();if(a.length)m=selectBatsmen(m,m.striker,a[0].id);}
  if(!m.currentBowler){
    const pick=bowlingPlayers.find(p=>p.id!==ctx.lastBowler)||bowlingPlayers[0];
    m=selectBowler(m,pick.id);
    ctx.lastBowler=pick.id;
  }
  return m;
}

// Record one ball, auto-selecting players first.
function play(m,ctx,type,runs=0,dismissal=null){
  if(m.status==='done')return m;
  m=ensureSelections(m,ctx);
  return recordBall(m,type,runs,dismissal);
}

// ---------------------------------------------------------------------------
// INVARIANTS — must hold after every ball
// ---------------------------------------------------------------------------
function invariantErrors(m){
  const errs=[];
  const bt=m.battingTeam,bwt=m.bowlingTeam;
  const bTeam=m[`team${bt}`],bowlTeam=m[`team${bwt}`];

  const batRuns=bTeam.players.reduce((s,p)=>s+((m.batsmen[p.id]||{}).runs||0),0);
  if(batRuns+bTeam.extras!==bTeam.score)
    errs.push(`score ${bTeam.score} != batsmen runs ${batRuns} + extras ${bTeam.extras}`);

  const bowlRuns=bowlTeam.players.reduce((s,p)=>s+((m.bowlers[p.id]||{}).runs||0),0);
  if(bowlRuns!==bTeam.score)
    errs.push(`bowler runs ${bowlRuns} != team score ${bTeam.score}`);

  const outCount=bTeam.players.filter(p=>(m.batsmen[p.id]||{}).out).length;
  if(outCount!==bTeam.wickets)
    errs.push(`wickets ${bTeam.wickets} != out batsmen ${outCount}`);

  const goodBalls=m.currentOverBalls.filter(b=>!b.isExtra).length;
  const legalBalls=bTeam.overs*6+goodBalls;
  const bowlBalls=bowlTeam.players.reduce((s,p)=>{const b=m.bowlers[p.id];return s+(b?b.overs*6+b.balls:0);},0);
  if(bowlBalls!==legalBalls)
    errs.push(`bowler legal balls ${bowlBalls} != team legal balls ${legalBalls}`);

  if(bTeam.score<0||bTeam.wickets<0)errs.push('negative score/wickets');
  if(bTeam.wickets>bTeam.players.length-1)errs.push(`wickets ${bTeam.wickets} exceeds 5 (all out)`);
  return errs;
}

// ---------------------------------------------------------------------------
// TEST RUNNER
// ---------------------------------------------------------------------------
let pass=0,fail=0;
function ok(cond,name,detail){
  if(cond){pass++;console.log(`  ✓ ${name}`);}
  else{fail++;console.log(`  ✗ ${name}${detail?`\n      ${detail}`:''}`);}
}
function group(name){console.log(`\n${name}`);}

// --- 1. Basic runs -----------------------------------------------------------
group('1. Runs are scored & credited correctly');
{
  let m=makeMatch(5),ctx={};
  for(const r of [0,1,2,3,4,6]) m=play(m,ctx,'run',r);
  ok(m.teamA.score===16,'0+1+2+3+4+6 = 16 total',`got ${m.teamA.score}`);
  const totalBatRuns=m.teamA.players.reduce((s,p)=>s+((m.batsmen[p.id]||{}).runs||0),0);
  ok(totalBatRuns===16,'all runs credited to batsmen',`got ${totalBatRuns}`);
  ok(invariantErrors(m).length===0,'invariants hold',invariantErrors(m).join('; '));
}

// --- 2. Strike rotation ------------------------------------------------------
group('2. Strike rotates on odd runs');
{
  let m=makeMatch(5),ctx={};
  m=ensureSelections(m,ctx);
  const firstStriker=m.striker, firstNon=m.nonStriker;
  m=recordBall(m,'run',1);
  ok(m.striker===firstNon&&m.nonStriker===firstStriker,'1 run swaps strike');
  m=recordBall(m,'run',2);
  ok(m.striker===firstNon&&m.nonStriker===firstStriker,'2 runs keeps strike');
}

// --- 3. Extras: wide & no-ball ----------------------------------------------
group('3. Wides and no-balls add 1 and are not legal balls');
{
  let m=makeMatch(5),ctx={};
  m=play(m,ctx,'wide',0);
  ok(m.teamA.score===1&&m.teamA.extras===1,'wide => +1 run, +1 extra',`score ${m.teamA.score} extras ${m.teamA.extras}`);
  ok(m.currentOverBalls.filter(b=>!b.isExtra).length===0,'wide is not a legal ball');
  m=play(m,ctx,'noball',0);
  ok(m.teamA.score===2&&m.teamA.extras===2,'no-ball => +1 run, +1 extra',`score ${m.teamA.score} extras ${m.teamA.extras}`);
  ok(m.teamA.overs===0,'extras do not advance the over');
  ok(invariantErrors(m).length===0,'invariants hold',invariantErrors(m).join('; '));
}

// --- 3b. Runs scored off a no-ball go to the batsman ------------------------
group('3b. No-ball with runs off the bat (free hit)');
{
  let m=makeMatch(5),ctx={};
  m=ensureSelections(m,ctx);
  const striker=m.striker;
  m=recordBall(m,'noball',4);   // batsman hits 4 off a no-ball
  ok(m.teamA.score===5,'no-ball + 4 => 5 total runs',`got ${m.teamA.score}`);
  ok(m.teamA.extras===1,'only the 1-run penalty is an extra',`extras ${m.teamA.extras}`);
  ok(m.batsmen[striker].runs===4,'4 runs credited to the batsman',`got ${m.batsmen[striker].runs}`);
  ok(m.batsmen[striker].fours===1,'counts as the batsman\'s four');
  ok(m.batsmen[striker].balls===0,'no-ball is not a ball faced');
  ok(m.teamA.overs===0&&m.currentOverBalls.filter(b=>!b.isExtra).length===0,'no-ball is not a legal ball');
  ok(invariantErrors(m).length===0,'invariants hold',invariantErrors(m).join('; '));
}

// --- 3c. Dismissals on extras (run out on a no-ball, stumped on a wide) ------
group('3c. Run out on a no-ball / stumped on a wide');
{
  // Run out off a no-ball: +1 extra, wicket counted, bowler NOT credited.
  let m=makeMatch(5),ctx={};
  m=ensureSelections(m,ctx);
  const bowlerId=m.currentBowler, outId=m.striker;
  m=recordBall(m,'noball',0,{type:'runout',fielder:m[`team${m.bowlingTeam}`].players[2].id,outBatsman:outId});
  ok(m.teamA.score===1,'no-ball run-out => +1 penalty run',`got ${m.teamA.score}`);
  ok(m.teamA.wickets===1,'wicket counted');
  ok(m.batsmen[outId].out===true&&/run out/.test(m.batsmen[outId].howOut),`howOut "${m.batsmen[outId].howOut}"`);
  ok(m.bowlers[bowlerId].wickets===0,'bowler NOT credited for a run out');
  ok(m.teamA.overs===0,'no-ball still does not advance the over');

  // Stumped off a wide: +1 extra, wicket counted, bowler IS credited.
  let m2=makeMatch(5),c2={};
  m2=ensureSelections(m2,c2);
  const bId=m2.currentBowler, sId=m2.striker;
  m2=recordBall(m2,'wide',0,{type:'stumped',fielder:m2[`team${m2.bowlingTeam}`].players[1].id,outBatsman:sId});
  ok(m2.teamA.score===1&&m2.teamA.extras===1,'wide stumping => +1 wide run');
  ok(m2.bowlers[bId].wickets===1,'bowler IS credited for a stumping (even off a wide)');
  ok(/^st /.test(m2.batsmen[sId].howOut||''),`howOut "${m2.batsmen[sId].howOut}"`);
  ok(invariantErrors(m2).length===0,'invariants hold',invariantErrors(m2).join('; '));
}

// --- 4. Over completes after exactly 6 legal balls --------------------------
group('4. Over completes after 6 legal balls (extras excluded)');
{
  let m=makeMatch(5),ctx={};
  m=play(m,ctx,'wide',0);          // not counted
  m=play(m,ctx,'noball',0);        // not counted
  for(let i=0;i<5;i++) m=play(m,ctx,'run',0); // 5 legal
  ok(m.teamA.overs===0,'over not done after 5 legal balls + 2 extras');
  m=play(m,ctx,'run',0);           // 6th legal
  ok(m.teamA.overs===1,'over done after 6th legal ball',`overs ${m.teamA.overs}`);
  ok(m.currentBowler===null,'bowler cleared at end of over (must pick new)');
  ok(invariantErrors(m).length===0,'invariants hold',invariantErrors(m).join('; '));
}

// --- 4b. Over completes when the 6th legal ball is a WICKET ------------------
group('4b. A wicket off a fair ball completes the over (the 0.6 bug)');
{
  // Reproduce the reported over: 1, 6, 6, NB, NB, NB, Wd, Wd, 1, 1, W
  let m=makeMatch(5),ctx={};
  m=ensureSelections(m,ctx);
  const bowlerId=m.currentBowler;
  m=recordBall(m,'run',1);
  m=recordBall(m,'run',6);
  m=recordBall(m,'run',6);
  m=recordBall(m,'noball',0);m=recordBall(m,'noball',0);m=recordBall(m,'noball',0);
  m=recordBall(m,'wide',0);m=recordBall(m,'wide',0);
  m=recordBall(m,'run',1);
  m=recordBall(m,'run',1);
  ok(m.teamA.overs===0,'5 legal balls bowled, over not yet done',`overs ${m.teamA.overs}`);
  m=ensureSelections(m,ctx);   // strike may have rotated; keep a striker
  m=recordBall(m,'wicket',0,{type:'bowled',outBatsman:m.striker}); // 6th legal = wicket
  ok(m.teamA.overs===1,'over completes on the 6th-ball wicket',`overs ${m.teamA.overs}`);
  ok(m.bowlers[bowlerId].overs===1&&m.bowlers[bowlerId].balls===0,'bowler shows a full over (1.0), not 0.6',`${m.bowlers[bowlerId].overs}.${m.bowlers[bowlerId].balls}`);
  ok(m.currentBowler===null,'new bowler required for next over');
  ok(invariantErrors(m).length===0,'invariants hold',invariantErrors(m).join('; '));
}

// --- 4c. A bowler cannot bowl two overs in a row ----------------------------
group('4c. Bowler who just bowled is barred from the next over (lastBowler)');
{
  let m=makeMatch(5),ctx={};
  m=ensureSelections(m,ctx);
  const bowler1=m.currentBowler;
  for(let i=0;i<6;i++)m=recordBall(m,'run',0);   // complete the over
  ok(String(m.lastBowler)===String(bowler1),'lastBowler = the bowler who just bowled',`${m.lastBowler} vs ${bowler1}`);
  ok(m.currentBowler===null,'a new bowler must be chosen');
  const eligible=m[`team${m.bowlingTeam}`].players.filter(p=>String(p.id)!==String(m.lastBowler));
  ok(!eligible.some(p=>String(p.id)===String(bowler1)),'previous over\'s bowler is not eligible');
  ok(eligible.length>0,'other bowlers are available');

  // lastBowler must reset at the innings break so anyone can open the bowling.
  let m2=makeMatch(1),c2={};
  m2=ensureSelections(m2,c2);
  for(let i=0;i<6;i++)m2=recordBall(m2,'run',0);  // 1 over => innings ends
  ok(m2.innings===2,'moved to 2nd innings after the only over');
  ok(!m2.lastBowler,'lastBowler reset at the innings break',`lastBowler ${m2.lastBowler}`);
}

// --- 4d. An out batsman cannot return to bat --------------------------------
group('4d. A dismissed batsman stays out and is not eligible again');
{
  let m=makeMatch(50),ctx={};
  m=ensureSelections(m,ctx);
  const outId=m.striker;
  m=recordBall(m,'wicket',0,{type:'bowled',outBatsman:outId});
  ok(m.batsmen[outId].out===true,'batsman marked out');
  m=ensureSelections(m,ctx);
  for(let i=0;i<3;i++)m=recordBall(m,'run',0);   // play on
  ok(m.batsmen[outId].out===true,'still out after more play');
  const eligible=m[`team${m.battingTeam}`].players.filter(p=>{const bs=m.batsmen[p.id];return !bs||!bs.out;});
  ok(!eligible.some(p=>String(p.id)===String(outId)),'out batsman is not eligible to bat again');
}

// --- 4e. Ball history captures bowler, striker and over for each delivery ----
group('4e. Per-delivery log (bowler / striker / over / dismissal)');
{
  let m=makeMatch(5),ctx={};
  m=ensureSelections(m,ctx);
  const bowler1=m.currentBowler, opener=m.striker;
  m=recordBall(m,'run',1);   // 1 run, strike rotates
  let last=m.ballHistory[m.ballHistory.length-1];
  ok(String(last.bowler)===String(bowler1),'ball records the bowler who bowled it');
  ok(String(last.striker)===String(opener),'ball records the striker who faced it (not the post-run swap)');
  ok(last.over===0&&last.innings===1,'ball records over index and innings',`over ${last.over} inns ${last.innings}`);

  m=recordBall(m,'noball',4);
  last=m.ballHistory[m.ballHistory.length-1];
  ok(last.type==='noball'&&last.batRuns===4&&last.extraRuns===1,'no-ball log splits 4 off bat + 1 extra',`${last.type} bat${last.batRuns} ex${last.extraRuns}`);

  m=ensureSelections(m,ctx);
  const wktStriker=m.striker;
  m=recordBall(m,'wicket',0,{type:'bowled',outBatsman:wktStriker});
  const wktBall=m.ballHistory.filter(b=>b.wicket).pop();
  ok(/^b /.test(wktBall.howOut||''),`wicket ball logs howOut "${wktBall.howOut}"`);
  ok(String(wktBall.outBatsman)===String(wktStriker),'wicket ball logs which batsman was out');

  const inns1=m.ballHistory.filter(b=>b.innings===1);
  ok(inns1.every(b=>b.bowler!=null),'every delivery has a bowler attached');
}

// --- 4f. "Batsmen crossed" puts the new batsman at the correct end ----------
group('4f. Crossing on caught / run-out sets the right end');
{
  // Caught, NOT crossed: new batsman comes on strike (striker end empty).
  let m=makeMatch(50),ctx={};
  m=ensureSelections(m,ctx);
  const nonStriker=m.nonStriker;
  m=recordBall(m,'wicket',0,{type:'caught',fielder:m[`team${m.bowlingTeam}`].players[2].id,outBatsman:m.striker,crossed:false});
  ok(m.striker===null&&m.nonStriker===nonStriker,'not crossed: new batsman fills the striker end',`s=${m.striker} n=${m.nonStriker}`);

  // Caught, CROSSED: not-out batsman keeps strike, new batsman to non-striker end.
  let m2=makeMatch(50),c2={};
  m2=ensureSelections(m2,c2);
  const s2=m2.striker, n2=m2.nonStriker;
  m2=recordBall(m2,'wicket',0,{type:'caught',fielder:m2[`team${m2.bowlingTeam}`].players[2].id,outBatsman:s2,crossed:true});
  ok(String(m2.striker)===String(n2)&&m2.nonStriker===null,'crossed: survivor keeps strike, new batsman fills non-striker end',`s=${m2.striker} n=${m2.nonStriker}`);
  ok(m2.batsmen[s2].out===true,'the batsman who hit it is still the one out');

  // Run-out of the NON-striker, crossed: survivor to non-striker end, new on strike.
  let m3=makeMatch(50),c3={};
  m3=ensureSelections(m3,c3);
  const s3=m3.striker, n3=m3.nonStriker;
  m3=recordBall(m3,'wicket',0,{type:'runout',fielder:m3[`team${m3.bowlingTeam}`].players[1].id,outBatsman:n3,crossed:true});
  ok(m3.striker===null&&String(m3.nonStriker)===String(s3),'run-out non-striker crossed: new batsman on strike, survivor at non-striker end',`s=${m3.striker} n=${m3.nonStriker}`);
}

// --- 5. Every dismissal type -------------------------------------------------
group('5. All dismissal types record correctly');
{
  const cases=[
    ['bowled',    null, /^b /,            1],
    ['lbw',       null, /^lbw b /,        1],
    ['caught',    'fielder', /^c .* b /,  1],
    ['stumped',   'fielder', /^st .* b /, 1],
    ['hitwicket', null, /^hit wicket b /, 1],
    ['runout',    'fielder', /^run out/,  0],
  ];
  for(const [type,needFielder,re,bowlerCredit] of cases){
    let m=makeMatch(5),ctx={};
    m=ensureSelections(m,ctx);
    const bowlerId=m.currentBowler, outBatsman=m.striker;
    const fielder=needFielder?m[`team${m.bowlingTeam}`].players[2].id:null;
    m=recordBall(m,'wicket',0,{type,fielder,outBatsman});
    const bs=m.batsmen[outBatsman];
    ok(bs.out===true,`${type}: batsman marked out`);
    ok(re.test(bs.howOut||''),`${type}: howOut "${bs.howOut}" matches ${re}`);
    ok((m.bowlers[bowlerId].wickets)===bowlerCredit,`${type}: bowler wicket credit = ${bowlerCredit}`,`got ${m.bowlers[bowlerId].wickets}`);
    ok(m.teamA.wickets===1,`${type}: team wicket counted`);
    ok((bs.balls)===1,`${type}: counts as a ball faced`,`got ${bs.balls}`);
  }
}

// --- 6. All out ends the innings --------------------------------------------
group('6. Innings ends when team is all out (5 of 6 out)');
{
  let m=makeMatch(50),ctx={};   // huge overs so only wickets can end it
  for(let i=0;i<5;i++){
    m=ensureSelections(m,ctx);
    m=recordBall(m,'wicket',0,{type:'bowled',outBatsman:m.striker});
  }
  ok(m.innings===2,'after 5 wickets the innings ends (last batsman cannot bat alone)',`innings ${m.innings}`);
  ok(m.battingTeam==='B','batting team switched to B');
}

// --- 7. Chase ends the instant the target is reached ------------------------
group('7. 2nd-innings chase stops at the target (the bug we fixed)');
{
  // Innings 1: Team A makes a small total, then ends via all-out.
  let m=makeMatch(50),ctx={};
  m=play(m,ctx,'run',4);              // A = 4
  for(let i=0;i<5;i++){m=ensureSelections(m,ctx);m=recordBall(m,'wicket',0,{type:'bowled',outBatsman:m.striker});}
  ok(m.innings===2&&m.teamA.score===4,'innings 1 over, A scored 4 (target 5)',`innings ${m.innings} Ascore ${m.teamA.score}`);

  // Innings 2: Team B chases. Should END exactly when reaching 5, not keep going.
  let ctx2={};
  m=play(m,ctx2,'run',2);            // B = 2
  ok(m.status==='live','still live at 2/target5');
  m=play(m,ctx2,'run',2);            // B = 4
  ok(m.status==='live','still live at 4/target5');
  m=play(m,ctx2,'run',2);            // B = 6 >= 5  -> WIN immediately
  ok(m.status==='done','match ends the moment target is passed',`status ${m.status}`);
  ok(m.winner==='Beta','chasing team (Beta) is the winner',`winner ${m.winner}`);
  ok(m.teamB.score===6,'no extra balls bowled after the win',`Bscore ${m.teamB.score}`);
}

// --- 8. Tie is detected ------------------------------------------------------
group('8. Equal scores after both innings = Tie');
{
  let m=makeMatch(50),ctx={};
  m=play(m,ctx,'run',4);
  for(let i=0;i<5;i++){m=ensureSelections(m,ctx);m=recordBall(m,'wicket',0,{type:'bowled',outBatsman:m.striker});}
  // innings 2, target 5. Reach 4 then go all out -> B=4 == A=4 -> Tie
  let ctx2={};
  m=play(m,ctx2,'run',4);            // B = 4
  for(let i=0;i<5;i++){m=ensureSelections(m,ctx2);m=recordBall(m,'wicket',0,{type:'bowled',outBatsman:m.striker});}
  ok(m.status==='done','match done after 2nd innings all out');
  ok(m.winner==='Tie','scores level => Tie',`winner ${m.winner} A${m.teamA.score} B${m.teamB.score}`);
}

// --- 9. Combination sweep: many ball types across several over limits --------
group('9. Combination sweep — invariants hold after every ball');
{
  const ballTypes=[
    ['run',0],['run',1],['run',2],['run',3],['run',4],['run',5],['run',6],
    ['wide',0],['noball',0],
    ['wicket',0,{type:'bowled'}],
    ['wicket',0,{type:'caught',_fielder:true}],
    ['wicket',0,{type:'runout',_fielder:true}],
  ];
  let totalBalls=0,broke=false,brokeMsg='';
  for(const maxOvers of [2,5,6,10]){
    for(let seed=1;seed<=12&&!broke;seed++){
      let m=makeMatch(maxOvers),ctx={};
      let n=0,rng=seed*7919;
      while(m.status!=='done'&&n<2000){
        rng=(rng*1103515245+12345)&0x7fffffff;
        let [type,runs,extra]=ballTypes[rng%ballTypes.length];
        let dismissal=null;
        if(type==='wicket'){
          m=ensureSelections(m,ctx);
          dismissal={type:extra.type,outBatsman:m.striker};
          if(extra._fielder)dismissal.fielder=m[`team${m.bowlingTeam}`].players[1].id;
          m=recordBall(m,type,runs,dismissal);
        }else{
          m=play(m,ctx,type,runs);
        }
        n++;totalBalls++;
        const errs=invariantErrors(m);
        if(errs.length){broke=true;brokeMsg=`overs=${maxOvers} seed=${seed} ball#${n}: ${errs.join('; ')}`;break;}
      }
      if(!broke&&m.status!=='done'){broke=true;brokeMsg=`overs=${maxOvers} seed=${seed} did not finish in 2000 balls`;}
    }
  }
  ok(!broke,`all simulated matches stayed consistent (${totalBalls} balls played)`,brokeMsg);
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(50)}`);
console.log(`RESULT: ${pass} passed, ${fail} failed`);
console.log('='.repeat(50));
process.exit(fail?1:0);
