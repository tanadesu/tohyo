import { subscribeEvent, subscribeAuth, submitVote, getMyVote, getVoteCounts, isFirebaseConfigured } from './firebase-service.js';

const EVENT_ID = new URLSearchParams(location.search).get('event') || 'main';
const defaults = { question:'今夜、勝つのは誰だ？', nameA:'蒼井 レン', nameB:'赤城 カイ', nameC:'緑川 ソラ', optionCount:3, status:'open', showResults:true, timerMinutes:0, endsAt:null };
let event = defaults, votes = { a:0, b:0, c:0 }, myVote = null, user = null, sending = false, currentRound = null, finalResultsRound = null, finalResultsLoading = false;
const $ = s => document.querySelector(s), all = s => document.querySelectorAll(s);

function remainingSeconds() {
  const end = event.endsAt?.toMillis?.() ?? (event.endsAt ? new Date(event.endsAt).getTime() : 0);
  return end ? Math.max(0, Math.ceil((end-Date.now())/1000)) : null;
}

function formatTime(seconds) {
  const minutes=Math.floor(seconds/60),secs=seconds%60;
  return `${String(minutes).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

function render() {
  const remaining=remainingSeconds(),timedOut=event.status==='open'&&remaining===0,effectiveStatus=timedOut?'closed':event.status;
  const round=Number(event.round)||1,finalReady=effectiveStatus==='closed'&&finalResultsRound===round;
  const isThree=Number(event.optionCount)!==2,total=votes.a+votes.b+(isThree?votes.c:0), a=total?Math.round(votes.a/total*100):(isThree?34:50), b=total?Math.round(votes.b/total*100):(isThree?33:50), c=isThree?100-a-b:0;
  $('#totalVotes').textContent=total.toLocaleString('ja-JP'); $('#percentA').textContent=`${a}%`; $('#percentB').textContent=`${b}%`; $('#percentC').textContent=`${c}%`;
  $('#countA').textContent=`${votes.a.toLocaleString('ja-JP')}票`; $('#countB').textContent=`${votes.b.toLocaleString('ja-JP')}票`; $('#countC').textContent=`${votes.c.toLocaleString('ja-JP')}票`; $('#meterA').style.width=`${a}%`; $('#meterB').style.width=`${b}%`; $('#meterC').style.width=`${c}%`;
  $('#question').textContent=event.question; $('#nameA').textContent=event.nameA; $('#nameB').textContent=event.nameB; $('#nameC').textContent=event.nameC;
  const activeVotes=isThree?[votes.a,votes.b,votes.c]:[votes.a,votes.b],max=Math.max(...activeVotes); $('#trendA').textContent=total&&votes.a===max?'LEADING':'CATCHING UP'; $('#trendB').textContent=total&&votes.b===max?'LEADING':'CATCHING UP'; $('#trendC').textContent=total&&votes.c===max?'LEADING':'CATCHING UP';
  const leaders=activeVotes.filter(x=>x===max).length; $('#statusText').textContent=!total?'あなたの一票で動き出す':leaders>1?'現在、同率です':`${max-[...activeVotes].sort((x,y)=>y-x)[1]}票差でリード`;
  $('.arena').classList.toggle('two-choice',!isThree); $('.results').classList.toggle('two-choice',!isThree); $('.fighter-c').hidden=!isThree; $('.versus-second').hidden=!isThree; $('#percentC').hidden=!isThree; $('#countC').hidden=!isThree; $('#meterC').hidden=!isThree;
  all('.fighter').forEach(x=>x.classList.toggle('selected',x.dataset.choice===myVote));
  all('.vote-button').forEach(x=>{x.disabled=sending||!user||effectiveStatus!=='open'||Boolean(myVote);x.querySelector('span').textContent=effectiveStatus==='closed'?'投票は終了しました':effectiveStatus==='paused'?'ただいま受付停止中':x.dataset.vote===myVote?'投票済み':myVote?'投票後は変更できません':'この勝利を予想する'});
  $('#votePolicy').textContent=myVote?'投票を受け付けました。この投票は変更できません。':'投票は一人1回です。投票後に選択を変更することはできません。';
  $('#votePolicy').classList.toggle('confirmed',Boolean(myVote));
  document.body.classList.toggle('vote-completed',Boolean(myVote)&&!finalReady);
  document.body.classList.toggle('final-results',finalReady);
  $('#voteCompletePanel').hidden=!myVote||finalReady;
  $('.results').hidden=!finalReady;
  const timer=$('#audienceTimer');timer.hidden=remaining===null||event.status!=='open';timer.classList.toggle('ending',remaining!==null&&remaining<=30);$('#audienceTimerValue').textContent=remaining===0?'締め切りました':formatTime(remaining||0);
}
function toast(message){const x=$('#toast');x.textContent=message;x.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>x.classList.remove('show'),2200)}
async function loadFinalResultsIfNeeded(){
  const ended=event.status==='closed'||(event.status==='open'&&remainingSeconds()===0),round=Number(event.round)||1;
  if(!ended||!user||finalResultsLoading||finalResultsRound===round)return;
  finalResultsLoading=true;
  try{votes=await getVoteCounts(EVENT_ID,Number(event.optionCount)!==2);finalResultsRound=round;render()}
  catch(e){console.error(e);toast('最終結果を読み込めませんでした')}
  finally{finalResultsLoading=false}
}
async function vote(choice){if(sending||event.status!=='open'||remainingSeconds()===0||myVote)return;sending=true;render();try{const result=await submitVote(EVENT_ID,choice);myVote=result.choice;toast('投票を受け付けました。変更はできません')}catch(e){console.error(e);toast(e.message==='already-voted'?'すでに投票済みです。変更はできません':remainingSeconds()===0?'投票時間が終了しました':'投票できませんでした。もう一度お試しください')}finally{sending=false;render()}}
let pendingChoice=null;
function openConfirmation(choice){if(sending||myVote||event.status!=='open'||remainingSeconds()===0)return;pendingChoice=choice;$('#confirmName').textContent={a:event.nameA,b:event.nameB,c:event.nameC}[choice];$('#confirmDialog').showModal()}

all('[data-vote]').forEach(x=>x.addEventListener('click',()=>openConfirmation(x.dataset.vote)));
$('#confirmCancel').addEventListener('click',()=>{$('#confirmDialog').close();pendingChoice=null});
$('#confirmSubmit').addEventListener('click',()=>{const choice=pendingChoice;$('#confirmDialog').close();pendingChoice=null;if(choice)vote(choice)});
$('#confirmDialog').addEventListener('click',e=>{if(e.target===$('#confirmDialog')){$('#confirmDialog').close();pendingChoice=null}});
$('#eventDate').textContent=new Intl.DateTimeFormat('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
if(!isFirebaseConfigured()){document.body.classList.remove('is-loading');toast('Firebaseの設定が必要です');all('.vote-button').forEach(x=>x.disabled=true)}
else {
  subscribeAuth(async current=>{user=current;const saved=await getMyVote(EVENT_ID);myVote=saved?.choice||null;render();loadFinalResultsIfNeeded()});
  subscribeEvent(EVENT_ID,async data=>{if(data.surveyOpen===true){location.replace(`/survey?event=${encodeURIComponent(EVENT_ID)}`);return}const next={...defaults,...data},nextRound=Number(next.round)||1,roundChanged=currentRound!==null&&nextRound!==currentRound;event=next;currentRound=nextRound;if(roundChanged){votes={a:0,b:0,c:0};finalResultsRound=null}if(event.status==='open'&&remainingSeconds()!==0)finalResultsRound=null;if(roundChanged&&user){const saved=await getMyVote(EVENT_ID);myVote=saved?.choice||null;if(!myVote&&event.status==='open')toast('次の投票が始まりました')}render();loadFinalResultsIfNeeded();document.body.classList.remove('is-loading')},e=>{console.error(e);document.body.classList.remove('is-loading');toast('イベントを読み込めませんでした')});
}
render();
setInterval(()=>{render();loadFinalResultsIfNeeded()},1000);
