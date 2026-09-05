import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getCountFromServer, serverTimestamp, writeBatch, getDocs, runTransaction, orderBy } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export const isFirebaseConfigured=()=>firebaseConfig.apiKey&&!firebaseConfig.apiKey.startsWith('YOUR_');
let auth=null,db=null;
if(isFirebaseConfigured()){const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app)}
export function subscribeAuth(callback,anonymous=true){return onAuthStateChanged(auth,async user=>{if(!user&&anonymous){try{await signInAnonymously(auth)}catch(e){console.error(e)}return}callback(user)})}
export const loginAdmin=(email,password)=>signInWithEmailAndPassword(auth,email,password).then(x=>x.user);
export const logoutAdmin=()=>signOut(auth);
export async function isAdmin(uid){return (await getDoc(doc(db,'admins',uid))).exists()}
export function subscribeEvent(id,next,error=console.error){return onSnapshot(doc(db,'events',id),snap=>next(snap.exists()?snap.data():{}),error)}
export async function updateEvent(id,data){const ref=doc(db,'events',id),snap=await getDoc(ref);return snap.exists()?updateDoc(ref,{...data,updatedAt:serverTimestamp()}):setDoc(ref,{question:'今夜、勝つのは誰だ？',nameA:'蒼井 レン',nameB:'赤城 カイ',nameC:'緑川 ソラ',optionCount:3,status:'open',showResults:true,timerMinutes:0,endsAt:null,...data,updatedAt:serverTimestamp()})}
export async function getMyVote(eventId){if(!auth.currentUser)return null;const snap=await getDoc(doc(db,'events',eventId,'votes',auth.currentUser.uid));return snap.exists()?snap.data():null}
export async function submitVote(eventId,choice){
  if(!['a','b','c'].includes(choice)||!auth.currentUser)throw new Error('invalid-vote');
  const ref=doc(db,'events',eventId,'votes',auth.currentUser.uid);
  return runTransaction(db,async transaction=>{
    const snap=await transaction.get(ref),current=snap.exists()?snap.data():null;
    if(current)throw new Error('already-voted');
    transaction.set(ref,{choice,voterId:auth.currentUser.uid,updatedAt:serverTimestamp()});
    return {choice};
  });
}
export async function getVoteCounts(eventId,includeC=true){const votes=collection(db,'events',eventId,'votes'),requests=[getCountFromServer(query(votes,where('choice','==','a'))),getCountFromServer(query(votes,where('choice','==','b')))];if(includeC)requests.push(getCountFromServer(query(votes,where('choice','==','c'))));const [a,b,c]=await Promise.all(requests);return{a:a.data().count,b:b.data().count,c:c?.data().count||0}}
export function subscribeVotes(eventId,next,error=console.error){return onSnapshot(collection(db,'events',eventId,'votes'),snap=>next(snap.docs.map(x=>x.data())),error)}
export async function resetVotes(eventId){const ref=collection(db,'events',eventId,'votes');while(true){const snap=await getDocs(ref);if(snap.empty)return;for(let i=0;i<snap.docs.length;i+=450){const batch=writeBatch(db);snap.docs.slice(i,i+450).forEach(x=>batch.delete(x.ref));await batch.commit()}if(snap.size<450)return}}
export async function saveResult(eventId,event,votes){const round=Number(event.round)||1,total=votes.a+votes.b+(Number(event.optionCount)===2?0:votes.c);await setDoc(doc(db,'events',eventId,'history',`round-${round}`),{round,question:event.question,nameA:event.nameA,nameB:event.nameB,nameC:event.nameC||'',optionCount:Number(event.optionCount)||2,votes:{a:votes.a||0,b:votes.b||0,c:votes.c||0},total,savedAt:serverTimestamp()});return round}
export function subscribeHistory(eventId,next,error=console.error){return onSnapshot(query(collection(db,'events',eventId,'history'),orderBy('round','desc')),snap=>next(snap.docs.map(x=>({id:x.id,...x.data()}))),error)}
export function subscribeResult(eventId,resultId,next,error=console.error){return onSnapshot(doc(db,'events',eventId,'history',resultId),snap=>next(snap.exists()?{id:snap.id,...snap.data()}:null),error)}
export function deleteResult(eventId,resultId){return deleteDoc(doc(db,'events',eventId,'history',resultId))}
export function subscribePresets(eventId,next,error=console.error){return onSnapshot(collection(db,'events',eventId,'presets'),snap=>next(snap.docs.map(x=>({id:x.id,...x.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0))),error)}
export async function savePreset(eventId,name,settings){const ref=doc(collection(db,'events',eventId,'presets'));await setDoc(ref,{name,...settings,createdAt:serverTimestamp()});return ref.id}
export function deletePreset(eventId,presetId){return deleteDoc(doc(db,'events',eventId,'presets',presetId))}
export async function getMySurveyResponse(eventId){if(!auth.currentUser)return null;const snap=await getDoc(doc(db,'events',eventId,'surveyResponses',auth.currentUser.uid));return snap.exists()?snap.data():null}
export async function submitSurveyResponse(eventId,prefecture){if(!auth.currentUser)throw new Error('not-signed-in');const ref=doc(db,'events',eventId,'surveyResponses',auth.currentUser.uid);return runTransaction(db,async transaction=>{const snap=await transaction.get(ref);if(snap.exists())throw new Error('already-answered');transaction.set(ref,{prefecture,respondentId:auth.currentUser.uid,createdAt:serverTimestamp()});return{prefecture}})}
export function subscribeSurveyResponses(eventId,next,error=console.error){return onSnapshot(collection(db,'events',eventId,'surveyResponses'),snap=>next(snap.docs.map(x=>x.data())),error)}
export async function resetSurveyResponses(eventId){const ref=collection(db,'events',eventId,'surveyResponses');while(true){const snap=await getDocs(ref);if(snap.empty)return;for(let i=0;i<snap.docs.length;i+=450){const batch=writeBatch(db);snap.docs.slice(i,i+450).forEach(x=>batch.delete(x.ref));await batch.commit()}if(snap.size<450)return}}
