import { subscribeResult, isFirebaseConfigured } from './firebase-service.js';

const params=new URLSearchParams(location.search),eventId=params.get('event')||'main',resultId=params.get('result');
const $=selector=>document.querySelector(selector);

function render(item){
  if(!item){$('#resultScreen').hidden=true;$('#resultError').hidden=false;return}
  $('#resultScreen').hidden=false;$('#resultError').hidden=true;
  const keys=Number(item.optionCount)===2?['a','b']:['a','b','c'];
  const names={a:item.nameA,b:item.nameB,c:item.nameC},total=Number(item.total)||keys.reduce((sum,key)=>sum+(item.votes?.[key]||0),0),rankedKeys=[...keys].sort((left,right)=>(item.votes?.[right]||0)-(item.votes?.[left]||0)||keys.indexOf(left)-keys.indexOf(right));
  const max=Math.max(...keys.map(key=>item.votes?.[key]||0));
  $('#resultQuestion').textContent=item.question;$('#screenTotal').textContent=total.toLocaleString('ja-JP');
  const root=$('#screenChoices');root.innerHTML='';
  keys.forEach((key,index)=>{const count=item.votes?.[key]||0,percent=total?Math.round(count/total*100):0,winner=total>0&&count===max,rank=rankedKeys.indexOf(key)+1;const card=document.createElement('article');card.className=`screen-choice choice-${key} rank-${rank}${winner?' winner':''}`;card.style.setProperty('--delay',`${index*120}ms`);card.innerHTML=`<div class="choice-top"><span>SIDE ${key.toUpperCase()}</span>${winner?'<b>WINNER</b>':''}</div><h2></h2><div class="choice-score"><strong>${percent}%</strong><span>${count.toLocaleString('ja-JP')}票</span></div><div class="choice-meter"><i style="--score:${percent}%"></i></div>`;card.querySelector('h2').textContent=names[key]||`候補 ${key.toUpperCase()}`;root.appendChild(card)});
  $('#savedTime').textContent=item.savedAt?.toDate?.().toLocaleString('ja-JP')||'';
}

$('#fullscreenButton').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
document.addEventListener('fullscreenchange',()=>$('#fullscreenButton').textContent=document.fullscreenElement?'全画面を終了':'全画面表示');
if(!isFirebaseConfigured()||!resultId)render(null);else subscribeResult(eventId,resultId,render,()=>render(null));
