import { subscribeAuth, subscribeEvent, subscribeVotes, isFirebaseConfigured } from './firebase-service.js';

const eventId=new URLSearchParams(location.search).get('event')||'main',$=selector=>document.querySelector(selector);
let event={question:'投票準備中',nameA:'SIDE A',nameB:'SIDE B',nameC:'SIDE C',optionCount:3,round:1,status:'paused',endsAt:null},votes={a:0,b:0,c:0},started=false;

function remainingSeconds(){const end=event.endsAt?.toMillis?.()??(event.endsAt?new Date(event.endsAt).getTime():0);return end?Math.max(0,Math.ceil((end-Date.now())/1000)):null}
function render(){
  const keys=Number(event.optionCount)===2?['a','b']:['a','b','c'],names={a:event.nameA,b:event.nameB,c:event.nameC},total=keys.reduce((sum,key)=>sum+votes[key],0),max=Math.max(...keys.map(key=>votes[key]));
  $('#round').textContent=`ROUND ${Number(event.round)||1} / LIVE`;$('#liveQuestion').textContent=event.question;$('#liveTotal').textContent=total.toLocaleString('ja-JP');
  const remaining=remainingSeconds(),expired=event.status==='open'&&remaining===0,labels={open:'投票受付中',paused:'一時停止中',closed:'投票終了'};$('#liveState').className=`live-state ${expired?'closed':event.status}`;$('#liveState').textContent=expired?'投票終了':labels[event.status]||'準備中';if(event.status==='open'&&remaining!==null&&!expired)$('#liveState').textContent+=`  ${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
  const root=$('#liveChoices');root.innerHTML='';keys.forEach(key=>{const count=votes[key],percent=total?Math.round(count/total*100):0,leading=total>0&&count===max;const card=document.createElement('article');card.className=`screen-choice choice-${key}${leading?' winner':''}`;card.innerHTML=`<div class="choice-top"><span>SIDE ${key.toUpperCase()}</span>${leading?'<b>LEADING</b>':''}</div><h2></h2><div class="choice-score"><strong>${percent}%</strong><span>${count.toLocaleString('ja-JP')}票</span></div><div class="choice-meter"><i style="--score:${percent}%"></i></div>`;card.querySelector('h2').textContent=names[key]||`候補 ${key.toUpperCase()}`;root.appendChild(card)});
}

$('#fullscreenButton').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
document.addEventListener('fullscreenchange',()=>$('#fullscreenButton').textContent=document.fullscreenElement?'全画面を終了':'全画面表示');
if(!isFirebaseConfigured()){$('#liveError').hidden=false}else subscribeAuth(user=>{if(!user||started)return;started=true;subscribeEvent(eventId,data=>{event={...event,...data};render()},()=>{$('#liveError').hidden=false});subscribeVotes(eventId,list=>{votes=list.reduce((counts,vote)=>{if(counts[vote.choice]!==undefined)counts[vote.choice]++;return counts},{a:0,b:0,c:0});render()},()=>{$('#liveError').hidden=false})});
render();setInterval(render,1000);
