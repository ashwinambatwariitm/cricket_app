/*
 * CricTrack scoring engine — shared by the app (crictrack (1).html) and the
 * test suite (crictrack.test.js). Pure functions only: no React, no DOM.
 *
 * Each state-changing call returns the NEXT match object. recordBall and
 * doInningsEnd return { match, event } where `event` (or null) tells the UI
 * layer what to show:
 *   { type:'inningsBreak', title, msg }   -> innings 1 finished
 *   { type:'matchOver',    title, msg, winner } -> match finished
 *   { type:'overDone',     title, msg, over }   -> over completed, pick new bowler
 *
 * Loaded as a plain <script> in the browser (defines window.CricEngine) and via
 * require() in Node (module.exports).
 */
(function(root){
  'use strict';

  const clone = o => JSON.parse(JSON.stringify(o));

  const initBatsman = () => ({runs:0,balls:0,fours:0,sixes:0,dots:0,ones:0,twos:0,threes:0,fives:0,out:false});
  const initBowler  = () => ({overs:0,balls:0,runs:0,wickets:0,wides:0,noBalls:0});

  // Resolve a player's name from the two teams stored on the match.
  function playerName(m,id){
    const all=[...m.teamA.players,...m.teamB.players];
    const f=all.find(p=>String(p.id)===String(id));
    return f?f.name:'?';
  }

  function selectBatsmen(m,striker,nonStriker){
    return {...m,striker,nonStriker,
      batsmen:{...m.batsmen,
        ...(striker&&!m.batsmen[striker]?{[striker]:initBatsman()}:{}),
        ...(nonStriker&&!m.batsmen[nonStriker]?{[nonStriker]:initBatsman()}:{})
      }
    };
  }

  function selectBowler(m,bowlerId){
    return {...m,currentBowler:bowlerId,
      bowlers:{...m.bowlers,...(!m.bowlers[bowlerId]?{[bowlerId]:initBowler()}:{})}
    };
  }

  function doInningsEnd(m){
    if(m.innings===1){
      const target=m[`team${m.battingTeam}`].score+1;
      const nb=m.bowlingTeam,nb2=m.battingTeam;
      const updated={...m,innings:2,battingTeam:nb,bowlingTeam:nb2,
        striker:null,nonStriker:null,currentBowler:null,lastBowler:null,currentOverBalls:[],
        [`team${nb}`]:{...m[`team${nb}`],overs:0,balls:0,wickets:0,score:0,extras:0}
      };
      return {match:updated,event:{type:'inningsBreak',title:'Innings Break!',
        msg:`${m[`team${m.battingTeam}`].name} scored ${m[`team${m.battingTeam}`].score}.\n${m[`team${nb}`].name} needs ${target} to win!`}};
    }
    const tA=m.teamA,tB=m.teamB;
    const winner=tA.score>tB.score?tA.name:tB.score>tA.score?tB.name:'Tie';
    const final={...m,status:'done',winner};
    return {match:final,event:{type:'matchOver',title:'Match Over!',winner,
      msg:`🏆 ${winner} wins!\n${tA.name}: ${tA.score} | ${tB.name}: ${tB.score}`}};
  }

  // Record one ball. type: 'run' | 'wide' | 'noball' | 'wicket'.
  // dismissal (wickets): { type, fielder, outBatsman }.
  function recordBall(match,type,runs=0,dismissal=null){
    if(!match||match.status==='done')return {match,event:null};
    let m=clone(match);
    const bt=m.battingTeam;
    const facedBy=m.striker;          // who actually faced this delivery (before any strike swap)
    const bowlerId=m.currentBowler;   // who bowled it
    const isExtra=type==='wide'||type==='noball';
    const d=dismissal||{};
    const hasDismissal=!!d.type||type==='wicket';

    // Split the delivery's runs into penalty (extras) and runs off the bat:
    //   wide N    -> N+1 all to extras (byes), nothing to the batsman
    //   no-ball N -> 1 penalty extra + N scored off the bat by the striker
    //   run N     -> N off the bat
    const batRuns=(type==='run'||type==='noball')?runs:0;
    const extraRuns=type==='wide'?(1+runs):(type==='noball'?1:0);
    const runsToAdd=batRuns+extraRuns;

    m[`team${bt}`].score+=runsToAdd;
    m[`team${bt}`].extras+=extraRuns;

    if(m.currentBowler){
      const bw=m.bowlers[m.currentBowler];
      bw.runs+=runsToAdd;
      if(!isExtra)bw.balls+=1;
      if(type==='wide')bw.wides+=1;
      if(type==='noball')bw.noBalls+=1;
    }

    if(m.striker&&m.batsmen[m.striker]){
      const bs=m.batsmen[m.striker];
      if(!isExtra)bs.balls+=1;                 // only legal deliveries count as faced
      if(type==='run'||type==='noball'){
        bs.runs+=batRuns;
        if(batRuns===0){if(!isExtra)bs.dots+=1;}
        else if(batRuns===1)bs.ones+=1;
        else if(batRuns===2)bs.twos+=1;
        else if(batRuns===3)bs.threes+=1;
        else if(batRuns===4)bs.fours+=1;
        else if(batRuns===5)bs.fives+=1;
        else if(batRuns===6)bs.sixes+=1;
      }
    }

    // Batsmen cross when they run an odd number (not on a dismissal).
    const ran=(type==='run'||type==='noball')?batRuns:(type==='wide'?runs:0);
    if(ran%2!==0&&!hasDismissal&&m.nonStriker){
      [m.striker,m.nonStriker]=[m.nonStriker,m.striker];
    }

    // Rich per-delivery record so we can show each bowler's ball-by-ball log later.
    // The same object is stored in both arrays, so the dismissal block below can
    // fill in howOut/outBatsman on it after the fact.
    const legalBefore=m.currentOverBalls.filter(b=>!b.isExtra).length;
    const ballRec={type,runs,isExtra,wicket:hasDismissal,batRuns,extraRuns,
      innings:m.innings,team:bt,over:m[`team${bt}`].overs,legalBefore,
      bowler:bowlerId,striker:facedBy,howOut:null,outBatsman:null};
    m.currentOverBalls=[...m.currentOverBalls,ballRec];
    m.ballHistory=[...m.ballHistory,ballRec];

    if(hasDismissal){
      const outId=(d.type==='runout'&&d.outBatsman)?d.outBatsman:m.striker;
      const bowlerName=m.currentBowler?playerName(m,m.currentBowler):'';
      const fielderName=d.fielder?playerName(m,d.fielder):'';
      let howOut='out';
      if(d.type==='bowled')howOut=`b ${bowlerName}`;
      else if(d.type==='lbw')howOut=`lbw b ${bowlerName}`;
      else if(d.type==='caught')howOut=`c ${fielderName} b ${bowlerName}`;
      else if(d.type==='stumped')howOut=`st ${fielderName} b ${bowlerName}`;
      else if(d.type==='hitwicket')howOut=`hit wicket b ${bowlerName}`;
      else if(d.type==='runout')howOut=`run out${fielderName?` (${fielderName})`:''}`;
      // A dismissal on a no-ball can only be a run-out; note it for clarity.
      if(type==='noball')howOut+=' (no-ball)';
      if(outId&&m.batsmen[outId]){m.batsmen[outId].out=true;m.batsmen[outId].howOut=howOut;}
      ballRec.howOut=howOut; ballRec.outBatsman=outId;
      m[`team${bt}`].wickets+=1;
      if(m.currentBowler&&d.type&&d.type!=='runout')m.bowlers[m.currentBowler].wickets+=1;
      const alive=m[`team${bt}`].players.filter(p=>!m.batsmen[p.id]||!m.batsmen[p.id].out).length;
      // With the gully "last man stands" rule the innings ends only when the
      // last batsman is also out; otherwise it ends when one batsman is left.
      if(alive<=(m.soloLastMan?0:1)){return doInningsEnd(m);}
      if(m.soloLastMan&&alive===1){
        // Last man bats alone: the lone not-out batsman is always on strike,
        // with no non-striker.
        const survivor=[m.striker,m.nonStriker].find(id=>id&&String(id)!==String(outId));
        m.striker=survivor||m.striker; m.nonStriker=null;
      }else{
        // Decide which end the new batsman fills. If the batsmen had crossed while
        // running (caught/run-out), the not-out batsman ends up at the other end,
        // so the survivor keeps strike and the new batsman fills the opposite end.
        const outIsNonStriker=String(outId)===String(m.nonStriker);
        if(d.crossed){
          if(outIsNonStriker){m.nonStriker=m.striker;m.striker=null;}
          else{m.striker=m.nonStriker;m.nonStriker=null;}
        }else{
          if(outIsNonStriker)m.nonStriker=null;else m.striker=null;
        }
      }
    }

    if(m.innings===2){
      const targetScore=m[`team${m.bowlingTeam}`].score+1;
      if(m[`team${bt}`].score>=targetScore){return doInningsEnd(m);}
    }

    // A wicket off a fair delivery is a legal ball, so it can also complete an
    // over — only true extras (wide/no-ball) are excluded here.
    const goodBalls=m.currentOverBalls.filter(b=>!b.isExtra).length;
    if(!isExtra&&goodBalls>=6){
      if(m.currentBowler){m.bowlers[m.currentBowler].overs+=1;m.bowlers[m.currentBowler].balls=0;}
      m[`team${bt}`].overs+=1;
      // Remember who bowled this over — they cannot bowl the next one.
      m.lastBowler=m.currentBowler;
      m.currentOverBalls=[];m.currentBowler=null;
      if(m.nonStriker)[m.striker,m.nonStriker]=[m.nonStriker,m.striker];
      if(m[`team${bt}`].overs>=m.maxOvers){return doInningsEnd(m);}
      return {match:m,event:{type:'overDone',title:`Over ${m[`team${bt}`].overs} done!`,
        msg:'Select a new bowler to continue.',over:m[`team${bt}`].overs}};
    }
    return {match:m,event:null};
  }

  const CricEngine={initBatsman,initBowler,playerName,selectBatsmen,selectBowler,doInningsEnd,recordBall};

  if(typeof module!=='undefined'&&module.exports)module.exports=CricEngine;
  else root.CricEngine=CricEngine;
})(typeof globalThis!=='undefined'?globalThis:this);
