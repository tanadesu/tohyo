import { subscribeAuth, subscribeSurveyResponses, isAdmin, isFirebaseConfigured } from './firebase-service.js';
import { prefectures, mapCoordinates } from './prefectures.js';

const eventId=new URLSearchParams(location.search).get('event')||'main';
const $=selector=>document.querySelector(selector);
let counts=Object.fromEntries(prefectures.map(name=>[name,0]));
let started=false;

function render(){
  const total=Object.values(counts).reduce((sum,count)=>sum+count,0);
  const max=Math.max(1,...Object.values(counts));
  $('#surveyTotal').textContent=total.toLocaleString('ja-JP');
  const map=$('#mapMarkers');
  map.innerHTML='';
  prefectures.forEach((name,index)=>{
    const value=counts[name];
    const cell=document.createElement('div');
    const [pixelX,pixelY]=mapCoordinates[index];
    const left=pixelX/1480*100;
    const top=pixelY/1110*100;
    const strength=value/max;
    cell.className=`prefecture-marker${value?' has-answer':''}`;
    cell.style.left=`${left}%`;
    cell.style.top=`${top}%`;
    cell.style.setProperty('--size',`${13+strength*22}px`);
    cell.style.setProperty('--alpha',String(.38+strength*.62));
    cell.style.setProperty('--glow',`${10+strength*28}px`);
    cell.style.setProperty('--wide-glow',`${18+strength*42}px`);
    cell.title=`${name}: ${value}人`;
    cell.innerHTML=`<span>${name.replace(/[都府県]$/,'')}</span><b>${value||''}</b>`;
    map.appendChild(cell);
  });
  const ranking=prefectures.map(name=>({name,count:counts[name]})).filter(item=>item.count).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'ja')).slice(0,10);
  const list=$('#surveyRanking');
  list.innerHTML='';
  if(!ranking.length){list.innerHTML='<li class="ranking-empty">回答を待っています</li>';return}
  ranking.forEach((item,index)=>{
    const li=document.createElement('li');
    li.innerHTML=`<em>${String(index+1).padStart(2,'0')}</em><span></span><b>${item.count.toLocaleString('ja-JP')}人</b>`;
    li.querySelector('span').textContent=item.name;
    list.appendChild(li);
  });
}

$('#fullscreenButton').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
document.addEventListener('fullscreenchange',()=>$('#fullscreenButton').textContent=document.fullscreenElement?'全画面を終了':'全画面表示');
if(!isFirebaseConfigured())$('#screenError').hidden=false;
else subscribeAuth(async user=>{
  if(!user||started)return;
  if(user.isAnonymous||!await isAdmin(user.uid)){
    document.querySelector('main').hidden=true;
    $('#screenError').hidden=false;
    return;
  }
  started=true;
  subscribeSurveyResponses(eventId,list=>{
    counts=Object.fromEntries(prefectures.map(name=>[name,0]));
    list.forEach(response=>{if(counts[response.prefecture]!==undefined)counts[response.prefecture]++});
    render();
  },()=>{$('#screenError').hidden=false});
},false);
render();
